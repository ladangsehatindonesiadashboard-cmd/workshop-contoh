/* Konfigurasi publik. Publishable key Supabase AMAN untuk frontend:
   akses dibatasi Row Level Security (hanya SELECT pada dashboard_snapshots).
   JANGAN pernah menaruh service_role / secret key di file ini. */
window.LSI_CONFIG = {
  SUPABASE_URL: 'https://ecjhttvuvexdxklnalkz.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_UG7CxGZWdbCHApduPiEXkw_JcJjlfr0',
  TABLE: 'dashboard_snapshots',
  DEFAULT_PERIOD: '2026-10',
  // Periode yang tata letak & label UI-nya sudah disesuaikan (lihat README).
  UI_PERIOD: '2026-10',
  TIMEOUT_MS: 20000
};
