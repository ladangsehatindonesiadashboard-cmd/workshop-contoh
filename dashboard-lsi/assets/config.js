/* Konfigurasi publik. Publishable key Supabase AMAN untuk frontend:
   akses dibatasi Row Level Security (hanya SELECT pada dashboard_snapshots).
   JANGAN pernah menaruh service_role / secret key di file ini. */
window.LSI_CONFIG = {
  SUPABASE_URL: 'https://ecjhttvuvexdxklnalkz.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_UG7CxGZWdbCHApduPiEXkw_JcJjlfr0',
  TABLE: 'dashboard_snapshots',
  // 'latest' = periode terbaru yang ada di dashboard_snapshots (bulan berjalan, disinkron tiap jam).
  // Bisa juga diisi periode tetap, mis. '2026-10'.
  DEFAULT_PERIOD: 'latest',
  // Periode dengan snapshot lengkap (produksi, finansial, WMS, karyawan). Periode lain = penjualan saja (sales_only).
  FULL_PERIOD: '2026-10',
  TIMEOUT_MS: 20000
};
