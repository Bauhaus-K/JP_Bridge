-- MS2: AI 사용 한도, ES 버전 자동 번호, 검수 요청 RPC

-- ---------------------------------------------------------------------------
-- 플랜 조정: 무료 플랜도 월 1회 운영자 검수 체험 (DECISIONS D19 갱신)
-- ---------------------------------------------------------------------------
update public.plans set monthly_review_limit = 1 where code = 'free';

-- 주의: Supabase 는 public 스키마 함수에 anon/authenticated 실행 권한을 기본 부여한다.
-- `revoke ... from public` 만으로는 부족하므로 역할을 명시해 회수한다.

-- MS1 함수 권한 정리
revoke all on function public.is_admin() from anon;
revoke all on function public.admin_can_view(public.review_target_type, uuid) from anon;
revoke all on function public.admin_can_view_es_doc(uuid) from anon;

-- ---------------------------------------------------------------------------
-- 현재 플랜
-- ---------------------------------------------------------------------------
create or replace function public.current_plan_code(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan_code from public.subscriptions s
      where s.user_id = p_user and s.status = 'active'
        and (s.period_end is null or s.period_end > now())
      order by s.created_at desc limit 1),
    'free');
$$;
revoke all on function public.current_plan_code(uuid) from public, anon, authenticated;
grant execute on function public.current_plan_code(uuid) to service_role;

-- 한국 시간 기준 하루/한 달 창
create or replace function public.quota_day_start(p_at timestamptz default now())
returns timestamptz language sql immutable as $$
  select date_trunc('day', p_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
$$;
create or replace function public.quota_month_start(p_at timestamptz default now())
returns timestamptz language sql immutable as $$
  select date_trunc('month', p_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
$$;

-- ---------------------------------------------------------------------------
-- AI 한도 소비 (원자적). 호출 전 서버가 사용자 세션으로 호출한다.
-- 반환: { allowed, reason: null|'minute'|'day', plan, day_limit, day_used }
-- ---------------------------------------------------------------------------
create or replace function public.consume_ai_quota()
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
  v_day_used integer;
  v_min_used integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_plan from public.plans where code = public.current_plan_code(v_user);

  insert into public.usage_counters (user_id, bucket, window_start, count)
  values (v_user, 'ai_day', v_day, 0), (v_user, 'ai_minute', v_min, 0)
  on conflict do nothing;

  select count into v_day_used from public.usage_counters
    where user_id = v_user and bucket = 'ai_day' and window_start = v_day for update;
  select count into v_min_used from public.usage_counters
    where user_id = v_user and bucket = 'ai_minute' and window_start = v_min for update;

  if v_min_used >= v_plan.per_minute_ai_limit then
    return jsonb_build_object('allowed', false, 'reason', 'minute', 'plan', v_plan.code,
      'day_limit', v_plan.daily_ai_limit, 'day_used', v_day_used);
  end if;
  if v_day_used >= v_plan.daily_ai_limit then
    return jsonb_build_object('allowed', false, 'reason', 'day', 'plan', v_plan.code,
      'day_limit', v_plan.daily_ai_limit, 'day_used', v_day_used);
  end if;

  update public.usage_counters set count = count + 1
    where user_id = v_user and bucket in ('ai_day', 'ai_minute')
      and window_start in (v_day, v_min);

  -- 오래된 분 단위 카운터 정리 (가벼운 청소)
  delete from public.usage_counters
    where user_id = v_user and bucket = 'ai_minute' and window_start < now() - interval '1 hour';

  return jsonb_build_object('allowed', true, 'reason', null, 'plan', v_plan.code,
    'day_limit', v_plan.daily_ai_limit, 'day_used', v_day_used + 1);
end;
$$;
revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;

-- 서비스 측 오류(API 장애 등)로 결과를 주지 못했을 때 일일 사용량 1회 환불. 서버(service_role) 전용.
create or replace function public.refund_ai_quota(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_counters set count = greatest(count - 1, 0)
  where user_id = p_user and bucket = 'ai_day' and window_start = public.quota_day_start();
$$;
revoke all on function public.refund_ai_quota(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_quota(uuid) to service_role;

-- 화면 표시용 내 사용량
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
    'review_limit', p.monthly_review_limit,
    'review_used', coalesce((select u.count from public.usage_counters u
                              where u.user_id = auth.uid() and u.bucket = 'review_month'
                                and u.window_start = public.quota_month_start()), 0))
  from public.plans p
  where p.code = public.current_plan_code(auth.uid());
$$;
revoke all on function public.my_quota_status() from public, anon;
grant execute on function public.my_quota_status() to authenticated;

-- ---------------------------------------------------------------------------
-- ES 버전: 번호 자동 부여, 문서 updated_at 갱신, 사용자는 user 출처만 직접 추가
-- (ai 출처는 서버가 service_role 로 기록 → 사용자가 AI 결과를 위조할 수 없다)
-- ---------------------------------------------------------------------------
create or replace function public.es_versions_fill_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 같은 문서에 대한 동시 삽입을 직렬화한다
  select d.user_id into new.user_id from public.es_documents d where d.id = new.doc_id for update;
  if new.user_id is null then
    raise exception 'es_document not found' using errcode = '23503';
  end if;
  select coalesce(max(v.version_no), 0) + 1 into new.version_no
    from public.es_versions v where v.doc_id = new.doc_id;
  update public.es_documents set updated_at = now() where id = new.doc_id;
  return new;
end;
$$;

drop policy es_versions_owner_insert on public.es_versions;
create policy es_versions_owner_insert on public.es_versions
  for insert to authenticated
  with check (
    source = 'user'
    and ai_feedback is null and scores is null
    and exists (select 1 from public.es_documents d
                where d.id = doc_id and d.user_id = (select auth.uid())));

-- 부모 버전은 같은 문서여야 한다
create or replace function public.es_versions_check_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_version_id is not null and not exists (
    select 1 from public.es_versions p where p.id = new.parent_version_id and p.doc_id = new.doc_id
  ) then
    raise exception 'parent version must belong to the same document' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger es_versions_check_parent
  before insert on public.es_versions
  for each row execute function public.es_versions_check_parent();

-- ---------------------------------------------------------------------------
-- 운영자 검수 요청 (플랜별 월 한도, 대상 소유권 확인)
-- 반환: { ok, reason: null|'limit'|'not_found'|'duplicate', id }
-- ---------------------------------------------------------------------------
create or replace function public.request_review(
  p_target_type public.review_target_type,
  p_target_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plans;
  v_month timestamptz := public.quota_month_start();
  v_used integer;
  v_owned boolean;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_owned := case p_target_type
    when 'es_version' then exists (select 1 from public.es_versions where id = p_target_id and user_id = v_user)
    when 'career_translation' then exists (select 1 from public.career_translations where id = p_target_id and user_id = v_user)
    when 'interview_session' then exists (select 1 from public.interview_sessions where id = p_target_id and user_id = v_user)
  end;
  if not v_owned then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if exists (select 1 from public.review_requests
             where target_type = p_target_type and target_id = p_target_id
               and status in ('pending', 'in_review')) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate');
  end if;

  select * into v_plan from public.plans where code = public.current_plan_code(v_user);
  insert into public.usage_counters (user_id, bucket, window_start, count)
    values (v_user, 'review_month', v_month, 0) on conflict do nothing;
  select count into v_used from public.usage_counters
    where user_id = v_user and bucket = 'review_month' and window_start = v_month for update;
  if v_used >= v_plan.monthly_review_limit then
    return jsonb_build_object('ok', false, 'reason', 'limit',
      'limit', v_plan.monthly_review_limit, 'used', v_used);
  end if;

  insert into public.review_requests (user_id, target_type, target_id, user_note)
    values (v_user, p_target_type, p_target_id, nullif(left(trim(coalesce(p_note, '')), 1000), ''))
    returning id into v_id;
  update public.usage_counters set count = count + 1
    where user_id = v_user and bucket = 'review_month' and window_start = v_month;

  return jsonb_build_object('ok', true, 'reason', null, 'id', v_id);
end;
$$;
revoke all on function public.request_review(public.review_target_type, uuid, text) from public, anon;
grant execute on function public.request_review(public.review_target_type, uuid, text) to authenticated;

-- 직접 insert 대신 RPC 만 사용하도록 기존 정책 제거
drop policy review_requests_owner_insert on public.review_requests;
