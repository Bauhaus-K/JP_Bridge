-- MS3: 대화형(chat) 한도 분리 (DECISIONS D35)
-- ai  : 무거운 작업(ES 첨삭, 경력 번역, 카드 정리, 면접 요약)  — plans.daily_ai_limit / per_minute_ai_limit
-- chat: 대화 턴(자기분석 대화, 면접 질문·피드백)              — plans.daily_chat_limit / 분당 10회

alter table public.plans add column if not exists daily_chat_limit integer not null default 40
  check (daily_chat_limit >= 0);
update public.plans set daily_chat_limit = 40 where code = 'free';
update public.plans set daily_chat_limit = 300 where code = 'pro';

drop function if exists public.consume_ai_quota();
drop function if exists public.refund_ai_quota(uuid);

create or replace function public.consume_ai_quota(p_kind text default 'ai')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plans;
  v_day timestamptz := public.quota_day_start();
  v_min timestamptz := date_trunc('minute', now());
  v_day_bucket public.usage_bucket;
  v_min_bucket public.usage_bucket;
  v_day_limit integer;
  v_min_limit integer;
  v_day_used integer;
  v_min_used integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_kind not in ('ai', 'chat') then
    raise exception 'invalid quota kind' using errcode = '22023';
  end if;
  select * into v_plan from public.plans where code = public.current_plan_code(v_user);

  if p_kind = 'ai' then
    v_day_bucket := 'ai_day'; v_min_bucket := 'ai_minute';
    v_day_limit := v_plan.daily_ai_limit; v_min_limit := v_plan.per_minute_ai_limit;
  else
    v_day_bucket := 'chat_day'; v_min_bucket := 'chat_minute';
    v_day_limit := v_plan.daily_chat_limit; v_min_limit := 10;
  end if;

  insert into public.usage_counters (user_id, bucket, window_start, count)
  values (v_user, v_day_bucket, v_day, 0), (v_user, v_min_bucket, v_min, 0)
  on conflict do nothing;

  select count into v_day_used from public.usage_counters
    where user_id = v_user and bucket = v_day_bucket and window_start = v_day for update;
  select count into v_min_used from public.usage_counters
    where user_id = v_user and bucket = v_min_bucket and window_start = v_min for update;

  if v_min_used >= v_min_limit then
    return jsonb_build_object('allowed', false, 'reason', 'minute', 'plan', v_plan.code,
      'day_limit', v_day_limit, 'day_used', v_day_used);
  end if;
  if v_day_used >= v_day_limit then
    return jsonb_build_object('allowed', false, 'reason', 'day', 'plan', v_plan.code,
      'day_limit', v_day_limit, 'day_used', v_day_used);
  end if;

  update public.usage_counters set count = count + 1
    where user_id = v_user
      and ((bucket = v_day_bucket and window_start = v_day) or (bucket = v_min_bucket and window_start = v_min));

  delete from public.usage_counters
    where user_id = v_user and bucket in ('ai_minute', 'chat_minute') and window_start < now() - interval '1 hour';

  return jsonb_build_object('allowed', true, 'reason', null, 'plan', v_plan.code,
    'day_limit', v_day_limit, 'day_used', v_day_used + 1);
end;
$$;
revoke all on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;

create or replace function public.refund_ai_quota(p_user uuid, p_kind text default 'ai')
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_counters set count = greatest(count - 1, 0)
  where user_id = p_user
    and bucket = (case when p_kind = 'chat' then 'chat_day' else 'ai_day' end)::public.usage_bucket
    and window_start = public.quota_day_start();
$$;
revoke all on function public.refund_ai_quota(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_ai_quota(uuid, text) to service_role;

create or replace function public.my_quota_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plan', p.code,
    'plan_name', p.name,
    'day_limit', p.daily_ai_limit,
    'day_used', coalesce((select u.count from public.usage_counters u
                           where u.user_id = auth.uid() and u.bucket = 'ai_day'
                             and u.window_start = public.quota_day_start()), 0),
    'chat_limit', p.daily_chat_limit,
    'chat_used', coalesce((select u.count from public.usage_counters u
                            where u.user_id = auth.uid() and u.bucket = 'chat_day'
                              and u.window_start = public.quota_day_start()), 0),
    'review_limit', p.monthly_review_limit,
    'review_used', coalesce((select u.count from public.usage_counters u
                              where u.user_id = auth.uid() and u.bucket = 'review_month'
                                and u.window_start = public.quota_month_start()), 0))
  from public.plans p
  where p.code = public.current_plan_code(auth.uid());
$$;
revoke all on function public.my_quota_status() from public, anon;
grant execute on function public.my_quota_status() to authenticated;

-- 자기분석 대화 메시지는 수정 불가(삭제는 실패한 턴 정리용으로 허용)
create policy analysis_messages_no_update on public.analysis_messages
  as restrictive for update to authenticated using (false);
