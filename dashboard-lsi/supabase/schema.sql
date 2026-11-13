-- Skema + policy yang DIHARUSKAN kode (dashboard-lsi). Jalankan di SQL editor Supabase.
-- Idempoten: aman diulang. Bagian RLS mengganti policy SELECT lama pada public.dashboard_snapshots
-- (policy "anon boleh membaca" dari README lama membuat login gate tidak ada artinya).
--
-- Verifikasi keadaan live setelah menjalankan:
--   select policyname, roles, cmd, qual from pg_policies where tablename = 'dashboard_snapshots';
--   select proname, prosecdef from pg_proc where proname = 'is_captcha_session';
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

create table if not exists private.captcha_sessions (
  session_id text primary key,
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
create or replace function public.is_captcha_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.captcha_sessions s
    where s.session_id = (auth.jwt() ->> 'session_id')
  );
$$;
revoke execute on function public.is_captcha_session() from public, anon;
grant execute on function public.is_captcha_session() to authenticated;

-- ---------- RLS dashboard_snapshots ----------
alter table public.dashboard_snapshots enable row level security;
revoke all on public.dashboard_snapshots from anon;
grant select on public.dashboard_snapshots to authenticated;

-- Buang SEMUA policy SELECT/ALL lama (termasuk policy anon), lalu pasang satu policy baru.
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
