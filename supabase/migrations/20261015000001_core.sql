-- MS1 core: 공통 함수, 프로필, 역할 보호
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.persona_type as enum ('new_grad', 'second_new_grad', 'it_career');
create type public.jlpt_level as enum ('N1', 'N2', 'N3', 'N4', 'N5', 'none');
create type public.user_role as enum ('user', 'admin');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  persona_type public.persona_type,
  jlpt_level public.jlpt_level,
  graduation_date date,
  career_years smallint check (career_years between 0 and 50),
  target_start date,
  desired_roles text[] not null default '{}'
    check (cardinality(desired_roles) <= 10),
  role public.user_role not null default 'user',
  -- 품질 개선용 원문 활용 옵트인 (기본 OFF). ai_runs.raw 저장도 이 값에 따른다.
  allow_training_use boolean not null default false,
  ai_notice_ack_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- is_admin(): RLS 정책에서 사용. security definer로 profiles RLS 재귀를 피한다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- 역할(role)은 service_role(서버)만 변경할 수 있다.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  -- PostgREST는 요청마다 SET ROLE(authenticated / service_role)을 한다.
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'role change not permitted' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- 신규 가입 시 프로필 행 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- insert는 트리거(security definer)가, delete는 계정 삭제(service_role)가 담당한다.
