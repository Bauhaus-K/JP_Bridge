-- 로컬 테스트 전용: 순수 Postgres에서 Supabase의 auth 스키마·역할·기본 권한을 흉내 낸다.
-- 실제 Supabase(로컬 CLI/클라우드)에는 적용하지 않는다.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create schema extensions;
grant usage on schema auth, extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Supabase와 동일하게 public의 새 객체에 대한 기본 권한
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
