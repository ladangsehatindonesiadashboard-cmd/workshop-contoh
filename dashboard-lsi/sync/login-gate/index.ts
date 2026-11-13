// Supabase Edge Function: login-gate
// Login dashboard LSI dengan captcha yang diverifikasi di server.
//   POST {action:"challenge"}                                   -> {token, img}   (gambar captcha + token bertanda tangan HMAC, berlaku 5 menit, sekali pakai)
//   POST {action:"verify", token, answer}                        -> {pass} bila jawaban captcha benar (pass berlaku 3 menit, sekali pakai)
//   POST {action:"login", pass, email, password}                -> sesi Supabase Auth bila pass captcha valid & password benar
// Setelah login sukses, session_id dari JWT dicatat di private.captcha_sessions. RLS dashboard_snapshots hanya mengizinkan
// sesi yang tercatat di sana, jadi sesi dari /auth/v1/token langsung (tanpa captcha) tidak bisa membaca data.
// Catatan: captcha + lockout di function ini TIDAK bisa menghentikan panggilan langsung ke /auth/v1/token (publishable key
// publik). Penguncian di titik itu adalah setelan project: Auth > Rate Limits, dan (Teams/Enterprise) Auth Hook
// "Password Verification Attempt". Yang ditahan di sisi data sudah: sesi tanpa captcha ditolak RLS.
import postgres from "npm:postgres@3.4.4";

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "https://ecjhttvuvexdxklnalkz.supabase.co";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_UG7CxGZWdbCHApduPiEXkw_JcJjlfr0";
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 });
const TTL = 300, LEN = 5, MAX_FAIL = 8, MAX_FAIL_IP = 20, FAIL_WINDOW_MIN = 15;
const CHARS = "ACDEFHJKLPRTXY34579";  // tanpa karakter yang mudah tertukar (B/8, G/6, U/V, Z/2, M/N/W, dst.)
// font bitmap 5x7 (baris atas ke bawah, 5 bit per baris)
const F: Record<string, string> = {
  A:"01110 10001 10001 11111 10001 10001 10001", B:"11110 10001 10001 11110 10001 10001 11110",
  C:"01110 10001 10000 10000 10000 10001 01110", D:"11110 10001 10001 10001 10001 10001 11110",
  E:"11111 10000 10000 11110 10000 10000 11111", F:"11111 10000 10000 11110 10000 10000 10000",
  G:"01110 10001 10000 10111 10001 10001 01111", H:"10001 10001 10001 11111 10001 10001 10001",
  J:"00111 00010 00010 00010 00010 10010 01100", K:"10001 10010 10100 11000 10100 10010 10001",
  L:"10000 10000 10000 10000 10000 10000 11111", M:"10001 11011 10101 10101 10001 10001 10001",
  N:"10001 11001 10101 10011 10001 10001 10001", P:"11110 10001 10001 11110 10000 10000 10000",
  R:"11110 10001 10001 11110 10100 10010 10001", T:"11111 00100 00100 00100 00100 00100 00100",
  U:"10001 10001 10001 10001 10001 10001 01110", V:"10001 10001 10001 10001 10001 01010 00100",
  W:"10001 10001 10001 10101 10101 10101 01010", X:"10001 10001 01010 00100 01010 10001 10001",
  Y:"10001 10001 01010 00100 00100 00100 00100", Z:"11111 00001 00010 00100 01000 10000 11111",
  "2":"01110 10001 00001 00010 00100 01000 11111", "3":"11110 00001 00001 01110 00001 00001 11110",
  "4":"00010 00110 01010 10010 11111 00010 00010", "5":"11111 10000 11110 00001 00001 10001 01110",
  "6":"00110 01000 10000 11110 10001 10001 01110", "7":"11111 00001 00010 00100 01000 01000 01000",
  "8":"01110 10001 10001 01110 10001 10001 01110", "9":"01110 10001 10001 01111 00001 00010 01100",
};
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const rnd = (a: number, b: number) => a + (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (b - a);
const ri = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ub64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

let keyP: Promise<CryptoKey> | null = null;
function hkey() {
  if (!keyP) keyP = (async () => {
    // kunci HMAC: diturunkan dari service role key (tidak pernah keluar dari server)
    const base = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_DB_URL")!;
    const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lsi-login-gate|" + base));
    return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  })();
  return keyP;
}
async function mac(s: string) { return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", await hkey(), new TextEncoder().encode(s)))); }
function eq(a: string, b: string) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
// IP pemanggil untuk throttle per-IP. Proxy platform mengisi X-Forwarded-For; dipakai sebagai pembatas biaya
// percobaan, bukan batas keamanan — kunci per (email, IP) mencegah satu penyerang mengunci akun orang lain.
function clientIp(req: Request) {
  const hop = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 45);
  return /^[0-9a-fA-F:.]{3,45}$/.test(hop) ? hop : "unknown";
}

// Captcha dirender jadi PNG (raster) di server: struktur huruf tidak terbaca dari markup.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Uint8Array) {
  const o = new Uint8Array(12 + data.length), dv = new DataView(o.buffer);
  dv.setUint32(0, data.length); o.set(new TextEncoder().encode(type), 4); o.set(data, 8);
  dv.setUint32(8 + data.length, crc32(o.subarray(4, 8 + data.length))); return o;
}
async function zlib(d: Uint8Array) { return new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer()); }
async function png(W: number, H: number, px: Uint8Array) {
  const raw = new Uint8Array((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (W * 3 + 1) + 1); }
  const ih = new Uint8Array(13), dv = new DataView(ih.buffer); dv.setUint32(0, W); dv.setUint32(4, H); ih[8] = 8; ih[9] = 2;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", await zlib(raw)), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
async function captchaPng(text: string) {
  const S = 2, W = 220 * S, H = 70 * S, px = new Uint8Array(W * H * 3);
  const cols = [[19, 41, 75], [30, 58, 110], [43, 76, 134], [15, 81, 50], [122, 46, 46]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3, n = rnd(-6, 5); px[i] = 236 + n; px[i + 1] = 242 + n; px[i + 2] = 249 + n; }
  const put = (x: number, y: number, c: number[], a = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; for (let k = 0; k < 3; k++) px[i + k] = px[i + k] * (1 - a) + c[k] * a; };
  const ph = rnd(0, 6.28), amp = rnd(1.2, 2.4) * S, fr = rnd(0.015, 0.03) / S;
  [...text].forEach((ch, ci) => {
    const g = F[ch].split(" "), cell = rnd(4.3, 4.9) * S, cx = (26 + ci * 42 + rnd(-3, 3)) * S, cy = (35 + rnd(-5, 5)) * S;
    const th = rnd(-0.22, 0.22), sk = rnd(-0.15, 0.15), co = Math.cos(th), si = Math.sin(th), c = cols[ri(3)], R = cell * 6;
    for (let y = Math.floor(cy - R); y < cy + R; y++) for (let x = Math.floor(cx - R); x < cx + R; x++) {
      const yw = y + amp * Math.sin(x * fr + ph);                         // gelombang global
      const dx = x - cx, dy = yw - cy, u = (co * dx + si * dy) / cell, v = (-si * dx + co * dy) / cell;
      const gx = u - sk * v + 2.5, gy = v + 3.5;
      if (gx < 0 || gy < 0 || gx >= 5 || gy >= 7) continue;
      if (g[Math.floor(gy)][Math.floor(gx)] === "1") put(x, y, c, 1);
    }
  });
  for (let l = 0; l < 2; l++) {                                             // garis pengganggu
    const c = cols[ri(5)], p = [[rnd(-10, 30), rnd(5, 65)], [rnd(40, 90), rnd(-20, 90)], [rnd(120, 170), rnd(-20, 90)], [rnd(180, 220), rnd(5, 65)]].map(([a, b]) => [a * S, b * S]), w = rnd(1, 1.6) * S;
    for (let t = 0; t <= 1; t += 0.0015) {
      const m = 1 - t, x = m ** 3 * p[0][0] + 3 * m * m * t * p[1][0] + 3 * m * t * t * p[2][0] + t ** 3 * p[3][0], y = m ** 3 * p[0][1] + 3 * m * m * t * p[1][1] + 3 * m * t * t * p[2][1] + t ** 3 * p[3][1];
      for (let a = -w / 2; a < w / 2; a++) for (let b = -w / 2; b < w / 2; b++) put(x + a, y + b, c, 0.45);
    }
  }
  for (let i = 0; i < 150 * S; i++) { const c = cols[ri(5)], x = rnd(0, W), y = rnd(0, H), r = rnd(0.5, 1.5) * S; for (let a = -r; a < r; a++) for (let b = -r; b < r; b++) if (a * a + b * b <= r * r) put(x + a, y + b, c, rnd(0.25, 0.6)); }
  return await png(W, H, px);
}
function b64(u: Uint8Array) { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }

async function challenge() {
  const ans = Array.from({ length: LEN }, () => CHARS[ri(CHARS.length)]).join("");
  const jti = crypto.randomUUID(), exp = Math.floor(Date.now() / 1000) + TTL;
  const payload = b64u(new TextEncoder().encode(JSON.stringify({ jti, exp, h: await mac("ans|" + jti + "|" + ans) })));
  return { token: payload + "." + await mac("tok|" + payload), img: "data:image/png;base64," + b64(await captchaPng(ans)), ttl: TTL };
}

async function checkCaptcha(token: string, answer: string): Promise<string | null> {
  const [p, sig] = String(token || "").split(".");
  if (!p || !sig || !eq(sig, await mac("tok|" + p))) return "captcha_invalid";
  let d: any; try { d = JSON.parse(new TextDecoder().decode(ub64(p))); } catch { return "captcha_invalid"; }
  if (!d.exp || d.exp < Date.now() / 1000) return "captcha_expired";
  const used = await sql`insert into private.captcha_used (jti) values (${d.jti}) on conflict do nothing returning jti`;
  if (!used.length) return "captcha_used";                                  // sekali pakai (benar atau salah)
  const a = String(answer || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!eq(d.h, await mac("ans|" + d.jti + "|" + a))) return "captcha_wrong";
  return null;
}

async function issuePass() {
  const jti = crypto.randomUUID(), exp = Math.floor(Date.now() / 1000) + 180;
  const p = b64u(new TextEncoder().encode(JSON.stringify({ jti, exp, k: "pass" })));
  return p + "." + await mac("pass|" + p);
}
async function checkPass(pass: string): Promise<string | null> {
  const [p, sig] = String(pass || "").split(".");
  if (!p || !sig || !eq(sig, await mac("pass|" + p))) return "captcha_required";
  let d: any; try { d = JSON.parse(new TextDecoder().decode(ub64(p))); } catch { return "captcha_required"; }
  if (d.k !== "pass" || !d.exp || d.exp < Date.now() / 1000) return "captcha_expired";
  const used = await sql`insert into private.captcha_used (jti) values (${"p:" + d.jti}) on conflict do nothing returning jti`;
  return used.length ? null : "captcha_used";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: any; try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  try {
    if (body.action === "challenge") return json(await challenge());
    if (body.action === "verify") {
      const e = await checkCaptcha(body.token, body.answer);
      return e ? json({ error: e, challenge: await challenge() }, 400) : json({ pass: await issuePass(), ttl: 180 });
    }
    if (body.action !== "login") return json({ error: "bad_request" }, 400);
    const email = String(body.email || "").trim().toLowerCase(), password = String(body.password || "");
    if (!email || !password) return json({ error: "missing_fields", challenge: await challenge() }, 400);
    const cErr = await checkPass(body.pass);
    if (cErr) return json({ error: cErr, challenge: await challenge() }, 400);
    const ip = clientIp(req);
    const f = await sql`select count(*)::int n from private.login_attempts where email = ${email} and ip = ${ip} and not ok and at > now() - make_interval(mins => ${FAIL_WINDOW_MIN})`;
    let tooMany = f[0].n >= MAX_FAIL;
    if (!tooMany && ip !== "unknown") {
      const fi = await sql`select count(*)::int n from private.login_attempts where ip = ${ip} and not ok and at > now() - make_interval(mins => ${FAIL_WINDOW_MIN})`;
      tooMany = fi[0].n >= MAX_FAIL_IP;
    }
    if (tooMany) return json({ error: "too_many_attempts", challenge: await challenge() }, 429);
    const r = await fetch(SUPA_URL + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) {
      await sql`insert into private.login_attempts (email, ok, ip) values (${email}, false, ${ip})`;
      return json({ error: j.error_code || j.error || "login_failed", status: r.status, challenge: await challenge() }, r.status === 429 ? 429 : 400);
    }
    const claims = JSON.parse(new TextDecoder().decode(ub64(j.access_token.split(".")[1])));
    await sql`insert into private.captcha_sessions (session_id, user_id) values (${claims.session_id}, ${claims.sub}) on conflict do nothing`;
    await sql`insert into private.login_attempts (email, ok, ip) values (${email}, true, ${ip})`;
    await sql`delete from private.captcha_used where used_at < now() - interval '1 day'`;
    await sql`delete from private.login_attempts where at < now() - interval '7 days'`;
    return json({ access_token: j.access_token, refresh_token: j.refresh_token, expires_in: j.expires_in, expires_at: j.expires_at, user: { email: j.user?.email } });
  } catch (e) {
    console.error("login-gate", e);
    return json({ error: "server_error", challenge: await challenge().catch(() => null) }, 500);
  }
});
