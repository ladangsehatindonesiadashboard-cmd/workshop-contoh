# Dashboard Manajemen LSI

Situs statis dashboard manajemen PT Ladang Sehat Indonesia (sumber: Accurate Online).
Tampilan (HTML/CSS/JS) disajikan sebagai file statis (mis. di Vercel). **Datanya tidak
disematkan di HTML**: saat dibuka, halaman mengambil snapshot JSON dari tabel Supabase
`public.dashboard_snapshots`.

## Struktur

```
dashboard-lsi/
├── index.html               # kerangka halaman + layar "memuat" / "gagal, coba lagi" + layar login
├── assets/
│   ├── styles.css           # seluruh gaya (responsif desktop, tablet, HP)
│   ├── config.js            # URL Supabase + publishable key (publik), periode default
│   ├── app.js               # logika dashboard: menu, filter, grafik, modul, detail
│   ├── loader.js            # login (login-gate) + ambil data Supabase → panggil LSIApp.start(data)
│   └── favicon.svg
├── sync/
│   ├── login-gate/index.ts  # edge function: captcha, lockout per (email, IP), sesi Auth
│   ├── sync-accurate/       # edge function sinkron Accurate (pull/ingest/OAuth callback) + schedule.sql
│   ├── oauth.py             # helper OAuth di box (authorize URL, exchange, refresh, dbs)
│   ├── acc.py, box_sync.py, start_sync.sh
├── supabase/
│   └── schema.sql           # skema + policy RLS yang diharuskan kode (idempoten)
├── scripts/
│   └── upload_snapshot.py   # unggah/ganti snapshot satu periode ke Supabase
├── vercel.json              # hosting statis (cleanUrls, header keamanan, CSP)
├── robots.txt               # mencegah diindeks mesin pencari
├── .vercelignore            # sync/, supabase/, scripts/ tidak ikut deploy
├── .env.example             # contoh variabel environment (tanpa rahasia)
└── .gitignore
```

## Cara kerja

1. `loader.js` membaca parameter `?period=YYYY-MM` dari URL (default `2026-10`).
2. Halaman menampilkan login; `login-gate` memberi captcha, memverifikasi password, lalu mencatat
   `session_id` sesi Supabase di `private.captcha_sessions`.
3. Dengan token sesi itu halaman memanggil REST API Supabase:
   `GET {SUPABASE_URL}/rest/v1/dashboard_snapshots?period=eq.2026-10&select=data,label,updated_at`
   dengan header `apikey: <publishable key>` dan `Authorization: Bearer <access_token sesi>`.
   Sesi tanpa captcha ditolak RLS (lihat `supabase/schema.sql`).
4. Selama menunggu tampil layar "Memuat data…". Jika gagal, muncul pesan dan tombol **Coba lagi**.
5. Setelah data diterima, `LSIApp.start(data)` merender seluruh dashboard.

Contoh: `https://<domain>/` (Oktober 2026) atau `https://<domain>/?period=2026-11`.

### Tabel Supabase

| kolom | tipe | keterangan |
|---|---|---|
| `id` | identity, PK | |
| `period` | text, unik | format `YYYY-MM` |
| `label` | text | mis. `Oktober 2026` |
| `data` | jsonb | seluruh data dashboard periode tsb. |
| `updated_at` | timestamptz | waktu unggah terakhir |

Row Level Security aktif dan role `anon` **tidak punya akses tabel**. Satu-satunya policy SELECT
adalah `captcha session read`: hanya role `authenticated` yang `session_id`-nya tercatat di
`private.captcha_sessions` (diisi `login-gate` setelah captcha + password benar) yang bisa membaca.
Policy dan tabel pendukungnya ada di [`supabase/schema.sql`](supabase/schema.sql) — file itu
idempoten, jalankan (ulang) kalau database dibuat dari nol atau kalau policy lama diduga masih
terbuka: **policy SELECT untuk `anon` membuat login gate tidak ada artinya**.

Verifikasi cepat di SQL editor:

```sql
select policyname, roles, cmd, qual from pg_policies where tablename = 'dashboard_snapshots';
-- tidak boleh ada baris yang menyertakan anon
```

## Rahasia & autentikasi

**Urutan saat memperbarui deployment yang sudah jalan** (kode baru gagal-tertutup bila langkah
rahasia dilewati):

1. Jalankan `supabase/schema.sql` (menambah `private.login_attempts.ip` dan policy baru).
2. Kunci `accurate_sync_key`: handler lama sudah menulis kunci asli ke Vault pada panggilan pertama yang
   terautentikasi, jadi biasanya **sudah ada** — cek dulu
   `select 1 from vault.secrets where name = 'accurate_sync_key';` dan hanya buat bila kosong
   (`select vault.create_secret('<SYNC_KEY>', 'accurate_sync_key')`).
   Rotasi tetap disarankan: SHA-256 tanpa salt dari kunci lama pernah tersaji publik, jadi kunci yang
   lemah/tebakan bisa dipulihkan. Setelah rotasi, perbarui `sync/.sync_key` di box (cron membaca Vault,
   jadi otomatis ikut).
3. `select vault.create_secret('<OAUTH_STATE>', 'accurate_oauth_state')` (`openssl rand -hex 32`).
4. Deploy ulang `login-gate` dan `sync-accurate`.

| rahasia | tempat | dipakai oleh |
|---|---|---|
| `SYNC_KEY` (x-sync-key) | Vault `accurate_sync_key` | `sync-accurate` (pull/ingest), `schedule.sql` |
| `OAUTH_STATE` | Vault `accurate_oauth_state` | callback OAuth `sync-accurate` |
| Accurate client secret | function secret `ACCURATE_CLIENT_SECRET` atau Vault `accurate_client_secret` | tukar token OAuth |
| Accurate token | Vault `accurate_access_token` / `accurate_refresh_token` / `accurate_token_expires_at` | pull |

Tidak ada kunci, hash kunci, atau angka keuangan yang disematkan di aset statis.

- **OAuth callback** menolak (403) setiap `GET ?code=` yang `state`-nya tidak sama dengan Vault
  `accurate_oauth_state`. Buat `state` dengan `openssl rand -hex 32`, simpan di Vault, dan berikan
  nilai yang sama ke `oauth.py` lewat `ACC_OAUTH_STATE` saat mencetak authorize URL.
- **Captcha + lockout** ada di `login-gate`; lockout dihitung per (email, IP) dan per IP, sehingga
  penyerang tidak bisa mengunci akun orang lain hanya dengan salah password berulang.
- **Panggilan langsung ke `/auth/v1/token`** (memakai publishable key yang memang publik) berada di
  luar jangkauan kode ini. Yang bisa dilakukan hanya di setelan project: *Authentication → Rate
  Limits* (batasi permintaan token per IP/jam) dan, pada paket Teams/Enterprise, Auth Hook
  **Password Verification Attempt** untuk menolak percobaan password tanpa captcha. Yang sudah
  ditahan di sisi data: sesi hasil panggilan langsung tidak pernah tercatat di
  `private.captcha_sessions`, jadi RLS menolak membacakan snapshot untuk sesi itu.
- **CSP** (`vercel.json`) membatasi skrip ke origin sendiri; inline script tidak dipakai.

## Mengunggah snapshot bulan baru

1. Siapkan file JSON data periode baru dengan struktur yang sama seperti Oktober
   (keluaran `build_okt_data.py`; kunci tingkat atas mis. `inv`, `ret`, `wo`, `fin`, `bs`, `ap`, `ar`, `stock`, `emp`, …).
2. Ambil **service_role key** (atau secret key `sb_secret_…`) dari Supabase Dashboard →
   Project Settings → API Keys. Simpan hanya di komputer sendiri, **jangan di-commit**.
3. Jalankan:

   ```bash
   export SUPABASE_URL=https://ecjhttvuvexdxklnalkz.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY='...rahasia...'
   python3 scripts/upload_snapshot.py data_nov.json --period 2026-11 --label "November 2026"
   # cek file saja tanpa mengunggah:
   python3 scripts/upload_snapshot.py data_nov.json --period 2026-11 --dry-run
   ```

   Periode yang sudah ada akan ditimpa (upsert pada kolom `period`).
4. Buka `/?period=2026-11` untuk melihat hasilnya. Untuk menjadikannya tampilan
   default, ubah `DEFAULT_PERIOD` di `assets/config.js`.

### Batasan saat ini

Logika tampilan (`app.js`) masih dikunci ke **Oktober 2026**: rentang hari 1–31 Okt,
minggu W40–W44, dan teks label "Oktober". Data bulan lain sudah bisa dimuat lewat
`?period=`, tetapi agar filter harian/mingguan dan label tepat, konstanta tanggal di
`app.js` (`MIND`, `MAXD`, pilihan bulan/tahun, dan teks "Oktober") perlu dibuat dinamis
berdasarkan periode. Halaman menampilkan catatan kuning bila periode ≠ `UI_PERIOD`.

## Menjalankan lokal

```bash
cd dashboard-site
python3 -m http.server 8000
# buka http://localhost:8000/  (perlu internet untuk mengambil data Supabase)
```

## Deploy

Folder ini bisa di-deploy apa adanya sebagai situs statis di Vercel (tanpa build step;
Framework Preset: *Other*, Output Directory: root). Tidak ada environment variable yang
diperlukan di Vercel karena hanya publishable key yang dipakai di frontend.

`.vercelignore` menahan `sync/`, `supabase/`, `scripts/`, dan `README.md` dari CDN: kode edge
function, skema, dan skrip operator tidak perlu (dan tidak boleh) ikut tersaji sebagai file statis.
