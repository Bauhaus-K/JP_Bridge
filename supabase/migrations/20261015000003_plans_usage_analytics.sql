-- 플랜·구독·사용량, AI 실행 로그, 만족도, 제품 이벤트, 이메일 로그

create type public.subscription_status as enum ('active', 'cancelled', 'expired');
create type public.payment_provider as enum ('manual', 'toss');
create type public.usage_bucket as enum ('ai_day', 'ai_minute', 'review_month');
create type public.ai_run_status as enum ('success', 'validation_error', 'api_error', 'quota_exceeded');

-- ---------------------------------------------------------------------------
-- 플랜 (정적 시드)
-- ---------------------------------------------------------------------------
create table public.plans (
  code text primary key,
  name text not null,
  daily_ai_limit integer not null check (daily_ai_limit >= 0),
  per_minute_ai_limit integer not null check (per_minute_ai_limit >= 0),
  monthly_review_limit integer not null check (monthly_review_limit >= 0),
  price_krw integer not null default 0,
  sort_order integer not null default 0
);

insert into public.plans (code, name, daily_ai_limit, per_minute_ai_limit, monthly_review_limit, price_krw, sort_order)
values
  ('free', '무료', 10, 3, 0, 0, 0),
  ('pro', '프로', 100, 10, 4, 19900, 1);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_code text not null references public.plans (code),
  provider public.payment_provider not null default 'manual',
  provider_ref text,
  status public.subscription_status not null default 'active',
  period_start timestamptz not null default now(),
  period_end timestamptz,
  activated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.subscriptions (user_id, status);
-- 사용자당 활성 구독은 하나
create unique index subscriptions_one_active on public.subscriptions (user_id) where status = 'active';

create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket public.usage_bucket not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

-- ---------------------------------------------------------------------------
-- AI 실행 로그 (raw는 옵트인 시에만, admin도 컬럼 접근 불가)
-- ---------------------------------------------------------------------------
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  feature text not null,
  model text not null,
  prompt_version text not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  status public.ai_run_status not null,
  error_code text,
  attempt smallint not null default 1,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index on public.ai_runs (created_at);
create index on public.ai_runs (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 만족도·이벤트
-- ---------------------------------------------------------------------------
create table public.feedback_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feature text not null,
  target_id uuid,
  phase text not null default 'after' check (phase in ('before', 'after')),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
create index on public.feedback_ratings (feature, created_at);

create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (name ~ '^[a-z0-9_.]{1,64}$'),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.events (name, created_at);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  to_domain text, -- 주소 전체는 저장하지 않는다
  provider text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
create policy plans_read on public.plans for select to authenticated, anon using (true);

alter table public.subscriptions enable row level security;
create policy subscriptions_owner_select on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy subscriptions_admin_all on public.subscriptions
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.usage_counters enable row level security;
create policy usage_counters_owner_select on public.usage_counters
  for select to authenticated using (user_id = (select auth.uid()));
-- 쓰기는 MS2의 security definer 함수(consume_quota)만.

alter table public.ai_runs enable row level security;
create policy ai_runs_admin_select on public.ai_runs
  for select to authenticated using ((select public.is_admin()));
-- 쓰기는 서버(service_role)만. raw 컬럼은 authenticated에 노출하지 않는다.
revoke select on public.ai_runs from authenticated, anon;
grant select (id, user_id, feature, model, prompt_version, input_tokens, output_tokens,
              latency_ms, status, error_code, attempt, created_at)
  on public.ai_runs to authenticated;

alter table public.feedback_ratings enable row level security;
create policy feedback_ratings_owner_all on public.feedback_ratings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy feedback_ratings_admin_select on public.feedback_ratings
  for select to authenticated using ((select public.is_admin()));

alter table public.events enable row level security;
create policy events_owner_insert on public.events
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy events_admin_select on public.events
  for select to authenticated using ((select public.is_admin()));

alter table public.email_log enable row level security;
create policy email_log_admin_select on public.email_log
  for select to authenticated using ((select public.is_admin()));
