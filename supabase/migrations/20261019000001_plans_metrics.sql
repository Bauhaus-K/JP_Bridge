-- MS6: 유료 플랜 신청(수동 활성화) + 운영 지표 집계

create type public.plan_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_code text not null references public.plans (code),
  message text check (char_length(message) <= 1000),
  status public.plan_request_status not null default 'pending',
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index plan_requests_one_pending on public.plan_requests (user_id) where status = 'pending';

alter table public.plan_requests enable row level security;
create policy plan_requests_owner_select on public.plan_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy plan_requests_owner_insert on public.plan_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and handled_by is null and handled_at is null
              and plan_code <> 'free');
create policy plan_requests_owner_cancel on public.plan_requests
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status = 'cancelled' and handled_by is null);
create policy plan_requests_admin_all on public.plan_requests
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 운영 지표 (service_role 전용 — 서버가 requireAdmin 후 호출)
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with week0 as (
    select (date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as start
  ),
  weeks as (
    select (select start from week0) - (n || ' weeks')::interval as week_start
    from generate_series(0, 7) as n
  ),
  active_users as (
    select user_id from public.events where created_at > now() - interval '7 days' and user_id is not null
    union
    select user_id from public.ai_runs where created_at > now() - interval '7 days' and user_id is not null
  )
  select jsonb_build_object(
    'generated_at', now(),
    'signups_total', (select count(*) from public.profiles),
    'onboarded_total', (select count(*) from public.profiles where onboarded_at is not null),
    'signups_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'signups_prev_7d', (select count(*) from public.profiles
                         where created_at > now() - interval '14 days' and created_at <= now() - interval '7 days'),
    'wau', (select count(*) from active_users),
    'paid_active', (select count(distinct user_id) from public.subscriptions
                     where status = 'active' and plan_code <> 'free' and (period_end is null or period_end > now())),
    'plan_requests_pending', (select count(*) from public.plan_requests where status = 'pending'),
    'weekly_signups', (
      select coalesce(jsonb_agg(jsonb_build_object('week_start', w.week_start, 'count', (
        select count(*) from public.profiles p
        where p.created_at >= w.week_start and p.created_at < w.week_start + interval '7 days'
      )) order by w.week_start), '[]'::jsonb)
      from weeks w
    ),
    'feature_usage', (
      select coalesce(jsonb_agg(jsonb_build_object('feature', f.feature, 'week_start', f.week_start, 'count', f.cnt)
                                order by f.feature, f.week_start), '[]'::jsonb)
      from (
        select r.feature,
               date_trunc('week', r.created_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' as week_start,
               count(*) as cnt
        from public.ai_runs r
        where r.status = 'success' and r.created_at >= (select start from week0) - interval '3 weeks'
        group by 1, 2
      ) f
    ),
    'satisfaction', (
      select coalesce(jsonb_agg(jsonb_build_object('feature', s.feature, 'phase', s.phase,
                                                   'avg', round(s.avg_rating, 2), 'n', s.n)), '[]'::jsonb)
      from (
        select feature, phase, avg(rating)::numeric as avg_rating, count(*) as n
        from public.feedback_ratings group by feature, phase
      ) s
    ),
    'reviews', jsonb_build_object(
      'pending', (select count(*) from public.review_requests where status = 'pending'),
      'in_review', (select count(*) from public.review_requests where status = 'in_review'),
      'done_30d', (select count(*) from public.review_requests
                    where status = 'done' and updated_at > now() - interval '30 days')
    ),
    'referrals', jsonb_build_object(
      'consented', (select count(*) from public.referrals),
      'sent', (select count(*) from public.referrals where sent_at is not null),
      'revoked', (select count(*) from public.referrals where status = 'revoked'),
      'offers', (select count(*) from public.referrals where outcome in ('offer', 'hired')),
      'hired', (select count(*) from public.referrals where outcome = 'hired')
    )
  );
$$;
revoke all on function public.admin_metrics() from public, anon, authenticated;
grant execute on function public.admin_metrics() to service_role;
