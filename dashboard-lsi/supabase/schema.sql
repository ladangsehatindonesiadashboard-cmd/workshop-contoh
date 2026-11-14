-- Skema + policy yang DIHARUSKAN kode (dashboard-lsi). Jalankan di SQL editor Supabase.
-- Idempoten: aman diulang di database live. Bagian RLS membuang setiap policy SELECT/ALL lama
-- pada public.dashboard_snapshots — termasuk policy live "captcha-verified sessions read snapshots"
-- dan policy "anon boleh membaca" (policy anon membuat login gate tidak ada artinya) —
-- lalu memasang "captcha session read".
--
-- Verifikasi keadaan live setelah menjalankan:
--   select policyname, roles, cmd, qual from pg_policies where tablename = 'dashboard_snapshots';
--   select proname, prosecdef, proconfig from pg_proc where proname = 'is_captcha_session';
--   select grantee, privilege_type from information_schema.routine_privileges
--    where routine_name = 'is_captcha_session';
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'dashboard_snapshots' and grantee in ('anon','authenticated');

-- ---------- snapshot dashboard ----------
create table if not exists public.dashboard_snapshots (
  id bigint generated always as identity primary key,
  period text not null unique,
  label text,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- sesi yang lolos captcha (diisi login-gate) ----------
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- session_id uuid, sama dengan auth.sessions.id dan klaim JWT session_id.
-- CREATE TABLE IF NOT EXISTS tidak mengubah kolom yang sudah ada; di live kolom ini sudah uuid.
-- Database baru harus ikut uuid, supaya badan fungsi di bawah lolos pemeriksaan tipe.
create table if not exists private.captcha_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists private.captcha_used (
  jti text primary key,
  used_at timestamptz not null default now()
);

-- Percobaan login dikunci per (email, IP) + per IP, supaya penyerang tidak bisa mengunci akun orang lain.
create table if not exists private.login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ok boolean not null,
  ip text not null default 'unknown',
  at timestamptz not null default now()
);
alter table private.login_attempts add column if not exists ip text not null default 'unknown';
create index if not exists login_attempts_email_ip_at on private.login_attempts (email, ip, at desc);
create index if not exists login_attempts_ip_at on private.login_attempts (ip, at desc);

-- ---------- cek sesi untuk RLS ----------
-- Sesi yang sudah logout/dicabut, atau milik user lain, tidak lolos.
-- nullif + ::uuid: klaim kosong jadi null (bukan error cast), dan perbandingan
-- uuid = text gagal di CREATE FUNCTION (42883) karena session_id live bertipe uuid.
-- search_path kosong: setiap nama di badan wajib berkualifikasi skema.
create or replace function public.is_captcha_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.captcha_sessions s
    join auth.sessions a on a.id = s.session_id
    where s.session_id = nullif(auth.jwt() ->> 'session_id','')::uuid
      and s.user_id = auth.uid()
  );
$$;
revoke execute on function public.is_captcha_session() from public, anon;
grant execute on function public.is_captcha_session() to authenticated, service_role;

-- ---------- RLS dashboard_snapshots ----------
alter table public.dashboard_snapshots enable row level security;
revoke all on public.dashboard_snapshots from anon;
grant select on public.dashboard_snapshots to authenticated;
-- RLS tidak mencakup TRUNCATE. Cabut hak tulis; SELECT untuk authenticated tetap,
-- dan barisnya disaring policy "captcha session read".
revoke insert, update, delete, truncate, references, trigger on public.dashboard_snapshots from authenticated;

-- Buang SEMUA policy SELECT/ALL lama (nama live: "captcha-verified sessions read snapshots",
-- plus policy anon bila ada), lalu pasang satu policy baru. Mengulang skrip membuang
-- "captcha session read" yang baru dipasang, lalu membuatnya lagi.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'dashboard_snapshots' and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy %I on public.dashboard_snapshots', p.policyname);
  end loop;
end $$;

create policy "captcha session read" on public.dashboard_snapshots
  for select to authenticated
  using (public.is_captcha_session());

-- ---------- log sinkronisasi ----------
create schema if not exists accurate_sync;
revoke all on schema accurate_sync from anon, authenticated;

create table if not exists accurate_sync.runs (
  id bigint generated always as identity primary key,
  message text not null,
  stats jsonb not null default '{}'::jsonb,
  ok boolean,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Progres backfill / cek ulang per bulan untuk edge function sync-accurate (mode pull).
create table if not exists accurate_sync.period_state (
  period text primary key check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  complete boolean not null default false,
  checked_at timestamptz,
  built_at timestamptz,
  docs int,
  omzet bigint
);
alter table accurate_sync.period_state enable row level security;
revoke all on accurate_sync.period_state from anon, authenticated;
