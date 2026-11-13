-- Jadwal per jam (pg_cron + pg_net). Jalankan SETELAH function di-deploy dan secrets di-set.
-- SYNC_KEY disimpan di Vault, bukan di tabel biasa.
create extension if not exists pg_cron; create extension if not exists pg_net;
-- select vault.create_secret('<SYNC_KEY>', 'sync_key');   -- isi lewat dashboard Supabase, jangan di chat
select cron.schedule('sync-accurate-hourly', '5 * * * *', $$
  select net.http_post(
    url := 'https://ecjhttvuvexdxklnalkz.supabase.co/functions/v1/sync-accurate',
    headers := jsonb_build_object('Content-Type','application/json','x-sync-key',(select decrypted_secret from vault.decrypted_secrets where name='sync_key')),
    body := jsonb_build_object('period', to_char(now() at time zone 'Asia/Jakarta','YYYY-MM')),
    timeout_milliseconds := 120000);
$$);
