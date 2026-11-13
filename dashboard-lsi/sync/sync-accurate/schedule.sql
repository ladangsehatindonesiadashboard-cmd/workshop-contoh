-- Jadwal per jam (pg_cron + pg_net). Jalankan SETELAH function di-deploy dan rahasia di-set.
-- Rahasia ada di Vault (bukan di tabel biasa, bukan di kode):
--   select vault.create_secret('<SYNC_KEY>', 'accurate_sync_key');        -- kunci x-sync-key (min. 128 bit acak)
--   select vault.create_secret('<OAUTH_STATE>', 'accurate_oauth_state');  -- state callback OAuth (min. 128 bit acak)
-- `accurate_sync_key` biasanya sudah terisi oleh handler lama; buat hanya bila belum ada
--   (select 1 from vault.secrets where name = 'accurate_sync_key';).
-- Isi lewat dashboard Supabase / SQL editor, jangan di chat. Untuk membuat nilai acak:
--   openssl rand -hex 32
create extension if not exists pg_cron; create extension if not exists pg_net;
select cron.schedule('sync-accurate-hourly', '5 * * * *', $$
  select net.http_post(
    url := 'https://ecjhttvuvexdxklnalkz.supabase.co/functions/v1/sync-accurate',
    headers := jsonb_build_object('Content-Type','application/json','x-sync-key',(select decrypted_secret from vault.decrypted_secrets where name='accurate_sync_key')),
    body := jsonb_build_object('period', to_char(now() at time zone 'Asia/Jakarta','YYYY-MM')),
    timeout_milliseconds := 120000);
$$);
