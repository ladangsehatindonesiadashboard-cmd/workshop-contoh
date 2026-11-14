// Supabase Edge Function: sync-accurate
// Sinkron penjualan PT LADANG SEHAT INDONESIA dari Accurate Online -> public.dashboard_snapshots.
// Accurate dipakai STRICT READ-ONLY: hanya GET */list.do & */detail.do (plus open-db.do & oauth/token untuk sesi/token).
// Mode:
//   POST {mode:"pull"}            (pg_cron per jam)  -> OAuth token dari Vault, tarik data inkremental, bangun snapshot
//   POST {mode:"ingest", ...}     (job di box)        -> terima kunci penjualan yang sudah dihitung, gabungkan ke snapshot
//   GET  ?code=...&state=...      (OAuth callback)    -> tukar code jadi token, simpan di Vault
// Auth pull/ingest: header x-sync-key, dibandingkan constant-time dengan Vault 'accurate_sync_key'
//          (tidak ada kunci maupun hash-nya di kode).
// OAuth callback: GET ?code=...&state=...; state wajib sama dengan Vault 'accurate_oauth_state' (selain itu 403).
// Rahasia: client secret dari env ACCURATE_CLIENT_SECRET (function secret) atau Vault 'accurate_client_secret';
//          token di Vault: accurate_access_token, accurate_refresh_token, accurate_token_expires_at.
import postgres from "npm:postgres@3.4.4";

const CLIENT_ID = "432f96f6-4f33-4ddd-b52b-a59fdb774ed7";
const DB_ID = 2685839; // PT LADANG SEHAT INDONESIA
// Data penjualan riil di Accurate mulai Juni 2026. Faktur bertanggal 31/05/2026 adalah migrasi saldo awal
// (invoiceDp, tanpa baris barang, salesAmountBase 0) sehingga Mei tidak disinkron.
const START_PERIOD = "2026-06";
const FULL_PERIOD = "2026-10"; // snapshot lengkap (non-penjualan) + basis urutan customer
const CONC = 3;                 // detail.do paralel (Accurate memutus koneksi kalau terlalu banyak)
const RECHECK_MS = 6 * 3600e3;  // bulan lama yang sudah lengkap dicek ulang (list.do lastUpdate) tiap 6 jam
const FN_URL = "https://ecjhttvuvexdxklnalkz.supabase.co/functions/v1/sync-accurate";
const READ_ONLY = /^\/accurate\/api\/[a-z-]+\/(list|detail)\.do$/;
const SALES_KEYS = ["inv", "ret", "itl", "retd", "dinv", "customers", "sales_src"];
const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3 });

// Perbandingan constant-time; panjang berbeda langsung ditolak.
function eq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function vaultGet(names: string[]): Promise<Record<string, string>> {
  const rows = await sql`select name, decrypted_secret from vault.decrypted_secrets where name = any(${names})`;
  return Object.fromEntries(rows.map((r: any) => [r.name, r.decrypted_secret]));
}
async function vaultSet(name: string, value: string) {
  const r = await sql`select id from vault.secrets where name = ${name}`;
  if (r.length) await sql`select vault.update_secret(${r[0].id}, ${value})`;
  else await sql`select vault.create_secret(${value}, ${name})`;
}
async function clientSecret() {
  const e = Deno.env.get("ACCURATE_CLIENT_SECRET");
  if (e) return e;
  const v = (await vaultGet(["accurate_client_secret"])).accurate_client_secret;
  if (!v) throw new Error("ACCURATE_CLIENT_SECRET belum di-set (function secret / Vault)");
  return v;
}
async function tokenRequest(body: Record<string, string>) {
  const r = await fetch("https://account.accurate.id/oauth/token", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${CLIENT_ID}:${await clientSecret()}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!r.ok) throw new Error(`oauth/token HTTP ${r.status}`);
  const j = await r.json();
  await vaultSet("accurate_access_token", j.access_token);
  if (j.refresh_token) await vaultSet("accurate_refresh_token", j.refresh_token);
  await vaultSet("accurate_token_expires_at", new Date(Date.now() + (j.expires_in ?? 0) * 1000).toISOString());
  return j.access_token as string;
}
async function accessToken(force = false) {
  const v = await vaultGet(["accurate_access_token", "accurate_refresh_token", "accurate_token_expires_at"]);
  if (!v.accurate_refresh_token && !v.accurate_access_token) throw new Error("Belum ada token OAuth di Vault (perlu otorisasi sekali)");
  const exp = Date.parse(v.accurate_token_expires_at ?? "") || 0;
  if (force || exp - Date.now() < 2 * 864e5) {
    if (!v.accurate_refresh_token) throw new Error("Token kedaluwarsa dan refresh token tidak ada");
    return await tokenRequest({ grant_type: "refresh_token", refresh_token: v.accurate_refresh_token });
  }
  return v.accurate_access_token;
}

type Db = { host: string; session: string; token: string };
async function openDb(): Promise<Db> {
  let token = await accessToken();
  for (let i = 0; i < 2; i++) {
    const r = await fetch(`https://account.accurate.id/api/open-db.do?id=${DB_ID}`, { headers: { Authorization: "Bearer " + token } });
    if (r.status === 401 && i === 0) { token = await accessToken(true); continue; }
    const j = await r.json();
    if (!r.ok || j.s === false) throw new Error(`open-db.do gagal HTTP ${r.status}`);
    return { host: j.host, session: j.session, token };
  }
  throw new Error("open-db.do gagal");
}
async function apiGet(db: Db, path: string, params: Record<string, string | string[]>) {
  if (!READ_ONLY.test(path)) throw new Error("endpoint ditolak (read-only): " + path);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const x of Array.isArray(v) ? v : [v]) qs.append(k, x);
  let url = `${db.host}${path}?${qs}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    let r: Response;
    try {
      r = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { Authorization: "Bearer " + db.token, "X-Session-ID": db.session } });
    } catch (e) { // koneksi putus / reset dari server Accurate: tunggu lalu coba lagi
      if (attempt === 4) throw e;
      await new Promise((s) => setTimeout(s, 1500 * (attempt + 1)));
      continue;
    }
    if (r.status === 308 || r.status === 307) { const loc = r.headers.get("location"); if (loc) { url = new URL(loc, url).toString(); db.host = new URL(url).origin; continue; } }
    if ([429, 502, 503, 504].includes(r.status)) { await new Promise((s) => setTimeout(s, 1500 * (attempt + 1))); continue; }
    const j = await r.json();
    if (!r.ok || j.s === false) throw new Error(`${path} HTTP ${r.status}`);
    return j;
  }
  throw new Error(`${path}: retry habis`);
}

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (dmy: string) => { const [d, m, y] = dmy.split("/"); return `${y}-${m}-${d}`; };
function monthRange(p: string) {
  const [y, m] = p.split("-").map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `01/${pad(m)}/${y}`, to: `${last}/${pad(m)}/${y}`, isoFrom: `${y}-${pad(m)}-01`, isoTo: `${y}-${pad(m)}-${last}` };
}
function trim(kind: string, d: any) {
  return {
    number: d.number, transDate: d.transDate, invoiceDp: !!d.invoiceDp, rate: d.rate ?? 1,
    customer: { name: d.customer?.name ?? "" }, dppAmount: d.dppAmount ?? 0, totalAmount: d.totalAmount ?? 0, salesAmountBase: d.salesAmountBase ?? null,
    detailItem: (d.detailItem ?? []).map((l: any) => ({
      item: { id: l.item?.id, name: l.item?.name, no: l.item?.no }, itemUnit: { name: l.itemUnit?.name ?? "" }, quantity: l.quantity ?? 0,
      grossAmount: l.grossAmount ?? 0, salesAmount: l.salesAmount ?? 0, salesAmountBase: l.salesAmountBase ?? null, itemCashDiscount: l.itemCashDiscount ?? 0, dppAmount: l.dppAmount ?? 0,
    })),
  };
}
async function syncKind(db: Db, kind: string, period: string, deadline: number, stats: any) {
  const { from, to, isoFrom, isoTo } = monthRange(period);
  const list: any[] = [];
  for (let page = 1; ; page++) {
    const j = await apiGet(db, `/accurate/api/${kind}/list.do`, { fields: "id,number,transDate,lastUpdate", "sp.page": String(page), "sp.pageSize": "100", "filter.transDate.op": "BETWEEN", "filter.transDate.val": [from, to] });
    list.push(...j.d);
    if (page >= (j.sp?.pageCount ?? 1)) break;
  }
  const have = new Map((await sql`select id, last_update from accurate_sync.docs where db_id=${DB_ID} and kind=${kind} and trans_date between ${isoFrom} and ${isoTo}`).map((r: any) => [Number(r.id), r.last_update]));
  const todo = list.filter((x) => have.get(Number(x.id)) !== x.lastUpdate);
  let done = 0, complete = true;
  for (let i = 0; i < todo.length; i += CONC) {
    if (Date.now() > deadline) { complete = false; break; }
    const batch = todo.slice(i, i + CONC);
    const det = await Promise.all(batch.map((x) => apiGet(db, `/accurate/api/${kind}/detail.do`, { id: String(x.id) })));
    for (let k = 0; k < batch.length; k++) {
      const x = batch[k], d = trim(kind, det[k].d);
      await sql`insert into accurate_sync.docs (db_id, kind, id, number, trans_date, last_update, detail) values (${DB_ID}, ${kind}, ${x.id}, ${x.number}, ${toIso(x.transDate)}, ${x.lastUpdate}, ${sql.json(d)})
        on conflict (db_id, kind, id) do update set number=excluded.number, trans_date=excluded.trans_date, last_update=excluded.last_update, detail=excluded.detail, fetched_at=now()`;
      done++;
    }
  }
  const ids = list.map((x) => Number(x.id));
  const del = await sql`delete from accurate_sync.docs where db_id=${DB_ID} and kind=${kind} and trans_date between ${isoFrom} and ${isoTo} and not (id = any(${ids})) returning id`;
  stats[`${period}:${kind}`] = { listed: list.length, fetched: done, pending: todo.length - done, deleted: del.length };
  return complete;
}
async function ensureItems(db: Db) {
  const missing = await sql`select distinct (l->'item'->>'id')::bigint id from accurate_sync.docs d, jsonb_array_elements(d.detail->'detailItem') l
    where not exists (select 1 from accurate_sync.items i where i.id = (l->'item'->>'id')::bigint)`;
  if (!missing.length) return 0;
  let n = 0;
  for (let page = 1; ; page++) {
    const j = await apiGet(db, "/accurate/api/item/list.do", { fields: "id,no,name,itemCategory", "sp.page": String(page), "sp.pageSize": "100" });
    const rows = j.d.map((x: any) => ({ id: x.id, no: x.no ?? "", name: x.name ?? "", cat: x.itemCategory?.name ?? "" }));
    if (rows.length) await sql`insert into accurate_sync.items ${sql(rows, "id", "no", "name", "cat")} on conflict (id) do update set no=excluded.no,name=excluded.name,cat=excluded.cat,updated_at=now()`;
    n += rows.length;
    if (page >= (j.sp?.pageCount ?? 1)) break;
  }
  return n;
}
// ---- transform (sama dengan /workspace/accurate_api/transform.py)
function dayIdx(dmy: string) { const [d, m, y] = dmy.split("/").map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5); }
async function buildKeys(period: string, baseCustomers: string[], complete: boolean) {
  const { isoFrom, isoTo } = monthRange(period);
  const docs = await sql`select kind, detail from accurate_sync.docs where db_id=${DB_ID} and trans_date between ${isoFrom} and ${isoTo}`;
  const cats = new Map((await sql`select id, cat from accurate_sync.items`).map((r: any) => [Number(r.id), r.cat ?? ""]));
  const customers = [...baseCustomers]; const ci = new Map(customers.map((n, i) => [n, i]));
  const cidx = (n: string) => { if (!ci.has(n)) { ci.set(n, customers.length); customers.push(n); } return ci.get(n)!; };
  const ord = (a: any, b: any) => dayIdx(a.transDate) - dayIdx(b.transDate) || String(a.number).localeCompare(String(b.number));
  const invs = docs.filter((r: any) => r.kind === "sales-invoice").map((r: any) => r.detail).sort(ord);
  const rets = docs.filter((r: any) => r.kind === "sales-return").map((r: any) => r.detail).sort(ord);
  const inv: any[] = [], itl: any[] = [], dinv: any[] = [], ret: any[] = [], retd: any[] = [];
  const r2 = (v: number) => Math.round(v * 100) / 100;
  for (const x of invs) {
    if (x.invoiceDp) continue;
    const dd = dayIdx(x.transDate), c = cidx(x.customer.name), rt = Number(x.rate || 1);
    inv.push([dd, 1, c, Math.round(Number(x.salesAmountBase ?? 0)), Math.round(Number(x.totalAmount) * rt), x.number]);
    let g = 0, s = 0, ld = 0;
    for (const l of x.detailItem) {
      const ga = Number(l.grossAmount || 0) * rt, sa = l.salesAmountBase != null ? Number(l.salesAmountBase) : Number(l.salesAmount || 0) * rt, cd = Number(l.itemCashDiscount || 0) * rt;
      g += ga; s += sa; ld += cd;
      itl.push([dd, l.item.name, l.itemUnit.name, Number(l.quantity), r2(sa), cats.get(Number(l.item.id)) ?? "", l.item.no, r2(ga)]);
    }
    dinv.push([dd, x.number, c, r2(g + ld), r2(g - s), r2(ld)]);
  }
  for (const x of rets) {
    const dd = dayIdx(x.transDate), c = cidx(x.customer.name), rt = Number(x.rate || 1);
    const lv = x.detailItem.reduce((a: number, l: any) => a + Number(l.dppAmount || 0), 0) * rt;
    ret.push([dd, 1, c, Math.round(lv), Math.round(Number(x.totalAmount || 0) * rt), x.number]);
    for (const l of x.detailItem) retd.push([dd, l.item.name, Number(l.quantity), r2(Number(l.dppAmount || 0) * rt), x.number, cats.get(Number(l.item.id)) ?? "", l.itemUnit.name, l.item.no]);
  }
  const sales_src = { source: "accurate-api", db: "PT LADANG SEHAT INDONESIA", period, synced_at: new Date().toISOString(), complete,
    inv: inv.length, inv_lines: itl.length, ret: ret.length, ret_lines: retd.length, omzet: inv.reduce((a, r) => a + r[3], 0) };
  return { inv, ret, itl, retd, dinv, customers, sales_src };
}
async function mergeSnapshot(period: string, keys: Record<string, unknown>, label?: string) {
  const [y, m] = period.split("-").map(Number);
  const lab = label ?? `${BULAN[m - 1]} ${y}`;
  const r = await sql`update public.dashboard_snapshots set data = data || ${sql.json(keys as any)}::jsonb, updated_at = now() where period = ${period} returning id`;
  if (!r.length) await sql`insert into public.dashboard_snapshots (period, label, data, updated_at) values (${period}, ${lab}, ${sql.json({ ...keys, sales_only: true } as any)}::jsonb, now())`;
}
async function baseCustomers(): Promise<string[]> {
  const r = await sql`select data->'customers' c from public.dashboard_snapshots where period=${FULL_PERIOD}`;
  return (r[0]?.c as string[]) ?? [];
}
function currentPeriod() { const d = new Date(Date.now() + 7 * 3600e3); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; }
function addMonth(p: string, n: number) { const [y, m] = p.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; }
function allPeriods() { const out: string[] = []; for (let p = START_PERIOD, cur = currentPeriod(); p <= cur; p = addMonth(p, 1)) out.push(p); return out; }

// Tiap run: (1) bulan berjalan + bulan lalu selalu disegarkan; (2) sisa waktu dipakai backfill/cek ulang bulan lama
// bergiliran: yang belum lengkap dulu (terbaru -> terlama), lalu yang lengkap tapi terakhir dicek > RECHECK_MS lalu.
// Snapshot sebuah bulan hanya dibangun kalau semua dokumennya sudah tertarik, dan hanya bila ada perubahan.
async function pull() {
  const t0 = Date.now(), deadline = t0 + 85_000, stats: any = {};
  const db = await openDb();
  const periods = allPeriods(), cur = currentPeriod(), prev = addMonth(cur, -1);
  const state: Map<string, any> = new Map((await sql`select period, complete, checked_at, built_at from accurate_sync.period_state`).map((r: any) => [r.period, r]));
  const hot = periods.filter((p) => p === cur || p === prev);
  const cold = periods.filter((p) => !hot.includes(p));
  const coldTodo = [
    ...cold.filter((p) => !state.get(p)?.complete).reverse(),
    ...cold.filter((p) => state.get(p)?.complete && Date.now() - +new Date(state.get(p).checked_at ?? 0) > RECHECK_MS)
      .sort((a, b) => +new Date(state.get(a).checked_at ?? 0) - +new Date(state.get(b).checked_at ?? 0)),
  ];
  const touched: string[] = [], complete: Record<string, boolean> = {}, changed: Record<string, boolean> = {};
  for (const p of [...hot, ...coldTodo]) {
    if (!hot.includes(p) && Date.now() > deadline - 8_000) break; // sisakan waktu; lanjut di run berikutnya
    let ok = true, ch = false;
    for (const k of ["sales-invoice", "sales-return"]) {
      ok = (await syncKind(db, k, p, deadline, stats)) && ok;
      const s = stats[`${p}:${k}`]; ch = ch || s.fetched > 0 || s.deleted > 0;
    }
    touched.push(p); complete[p] = ok; changed[p] = ch;
    await sql`insert into accurate_sync.period_state (period, complete, checked_at) values (${p}, ${ok}, now())
      on conflict (period) do update set complete=excluded.complete, checked_at=excluded.checked_at`;
  }
  stats.items_refreshed = await ensureItems(db);
  // Bangun snapshot untuk bulan yang lengkap & (berubah / belum pernah dibangun / bulan berjalan). FULL_PERIOD dulu (basis customer).
  const rank = (p: string) => (p === FULL_PERIOD ? 0 : p === cur ? 1 : p === prev ? 2 : 3);
  const st2: Map<string, any> = new Map((await sql`select period, complete, built_at from accurate_sync.period_state`).map((r: any) => [r.period, r]));
  const toBuild = periods.filter((p) => st2.get(p)?.complete &&
      (!st2.get(p)?.built_at || (touched.includes(p) && (changed[p] || p === cur || stats.items_refreshed > 0))))
    .sort((a, b) => rank(a) - rank(b) || b.localeCompare(a));
  let base = await baseCustomers(), built = 0;
  for (const p of toBuild) {
    // batas idle 150 dtk & CPU worker: maksimal 3 snapshot per run, sisanya (built_at masih null) di run berikutnya
    if (Date.now() - t0 > 110_000 || built >= 3) { stats.build_deferred = toBuild.slice(built); break; }
    built++;
    const keys = await buildKeys(p, base, true);
    if (p === FULL_PERIOD) base = keys.customers as string[];
    await mergeSnapshot(p, keys);
    const src = keys.sales_src as any;
    await sql`update accurate_sync.period_state set built_at=now(), docs=${src.inv + src.ret}, omzet=${src.omzet} where period=${p}`;
    stats[`${p}:omzet`] = src.omzet;
  }
  if (stats.build_deferred) await sql`update accurate_sync.period_state set built_at=null where period = any(${stats.build_deferred})`;
  const pend = touched.filter((p) => !complete[p]);
  const notYet = periods.filter((p) => !touched.includes(p) && !state.get(p)?.complete);
  if (pend.length || notYet.length) stats.partial = true;
  stats.backfill_pending = [...new Set([...pend, ...notYet])];
  stats.ms = Date.now() - t0;
  return stats;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.searchParams.get("code")) {           // OAuth callback
      const expectState = (await vaultGet(["accurate_oauth_state"])).accurate_oauth_state ?? "";
      if (!expectState) return new Response("oauth state belum di-set (Vault accurate_oauth_state)", { status: 503 });
      if (!eq(url.searchParams.get("state") ?? "", expectState)) return new Response("forbidden", { status: 403 });
      await tokenRequest({ grant_type: "authorization_code", code: url.searchParams.get("code")!, redirect_uri: FN_URL });
      return new Response("<h3>Accurate terhubung. Token tersimpan di Supabase Vault. Halaman ini boleh ditutup.</h3>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
    const key = req.headers.get("x-sync-key") ?? "";
    const expectKey = (await vaultGet(["accurate_sync_key"])).accurate_sync_key ?? "";
    if (!expectKey) return new Response("sync key belum di-set (Vault accurate_sync_key)", { status: 503 });
    if (!eq(key, expectKey)) return new Response("forbidden", { status: 403 });
    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? "pull";
    const run = await sql`insert into accurate_sync.runs (message, stats) values (${mode}, '{}'::jsonb) returning id`;
    let stats: any;
    try {
      if (mode === "ingest") {
        const p = String(body.period ?? "");
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) throw new Error("period tidak valid");
        const keys: Record<string, unknown> = {};
        for (const k of SALES_KEYS) if (k in (body.keys ?? {})) keys[k] = body.keys[k];
        if (!Array.isArray(keys.inv)) throw new Error("keys.inv wajib");
        await mergeSnapshot(p, keys, body.label);
        stats = { period: p, inv: (keys.inv as any[]).length, itl: Array.isArray(keys.itl) ? (keys.itl as any[]).length : 0 };
      } else if (mode === "pull") {
        stats = await pull();
      } else throw new Error("mode tidak dikenal");
      await sql`update accurate_sync.runs set finished_at=now(), ok=true, stats=${sql.json(stats)} where id=${run[0].id}`;
      return Response.json({ ok: true, mode, stats });
    } catch (e) {
      const msg = String((e as Error).message ?? e).slice(0, 500);
      await sql`update accurate_sync.runs set finished_at=now(), ok=false, message=${mode + ": " + msg} where id=${run[0].id}`;
      return Response.json({ ok: false, mode, error: msg }, { status: 500 });
    }
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error).message ?? e).slice(0, 300) }, { status: 500 });
  }
});
