# Dashboard Manajemen LSI

Situs statis dashboard manajemen PT Ladang Sehat Indonesia (sumber: Accurate Online).
Tampilan (HTML/CSS/JS) disajikan sebagai file statis (mis. di Vercel). **Datanya tidak
disematkan di HTML**: saat dibuka, halaman mengambil snapshot JSON dari tabel Supabase
`public.dashboard_snapshots`.

## Struktur

```
dashboard-site/
├── index.html               # kerangka halaman + layar "memuat" / "gagal, coba lagi"
├── assets/
│   ├── styles.css           # seluruh gaya (responsif desktop, tablet, HP)
│   ├── config.js            # URL Supabase + publishable key (publik), periode default
│   ├── app.js               # logika dashboard: menu, filter, grafik, modul, detail
│   ├── loader.js            # ambil data dari Supabase → panggil LSIApp.start(data)
│   └── favicon.svg
├── scripts/
│   └── upload_snapshot.py   # unggah/ganti snapshot satu periode ke Supabase
├── vercel.json              # konfigurasi hosting statis (cleanUrls, header keamanan)
├── robots.txt               # mencegah diindeks mesin pencari
├── .env.example             # contoh variabel environment (tanpa rahasia)
└── .gitignore
```

## Cara kerja

1. `loader.js` membaca parameter `?period=YYYY-MM` dari URL (default `2026-10`).
2. Halaman memanggil REST API Supabase:
   `GET {SUPABASE_URL}/rest/v1/dashboard_snapshots?period=eq.2026-10&select=data,label,updated_at`
   dengan header `apikey` dan `Authorization: Bearer <publishable key>`.
3. Selama menunggu tampil layar "Memuat data…". Jika gagal, muncul pesan dan tombol **Coba lagi**.
4. Setelah data diterima, `LSIApp.start(data)` merender seluruh dashboard.

Contoh: `https://<domain>/` (Oktober 2026) atau `https://<domain>/?period=2026-11`.

### Tabel Supabase

| kolom | tipe | keterangan |
|---|---|---|
| `id` | identity, PK | |
| `period` | text, unik | format `YYYY-MM` |
| `label` | text | mis. `Oktober 2026` |
| `data` | jsonb | seluruh data dashboard periode tsb. |
| `updated_at` | timestamptz | waktu unggah terakhir |

Row Level Security aktif. Publishable key (anon) **hanya boleh membaca** (SELECT);
insert/update/delete ditolak. Publishable key memang aman ditaruh di frontend.

> Penting: siapa pun yang tahu alamat situs dapat melihat data (termasuk laba rugi,
> hutang, piutang). Untuk membatasi akses, tambahkan login (mis. Supabase Auth atau
> Vercel Deployment Protection) dan ubah policy SELECT menjadi khusus pengguna terautentikasi.

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
