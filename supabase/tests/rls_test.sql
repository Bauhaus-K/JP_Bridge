-- RLS / 트리거 회귀 테스트. scripts/db-test.sh 가 auth_shim + migrations 적용 후 실행한다.
-- 실패 시 예외로 중단된다 (psql ON_ERROR_STOP).
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- 테스트 유틸 -------------------------------------------------------------
create schema test_util;
grant usage on schema test_util to authenticated;

create function test_util.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, false);
  execute 'set role authenticated';
end $$;
grant execute on function test_util.login(uuid) to public;

create function test_util.assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'ASSERTION FAILED: %', p_msg;
  end if;
end $$;
grant execute on function test_util.assert(boolean, text) to public;

-- 고정 사용자 ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com');
update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000ad';

select test_util.assert((select count(*) = 3 from public.profiles where user_id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000ad')), 'profiles auto-created for new users');

-- 1. 프로필 ----------------------------------------------------------------
select test_util.login('00000000-0000-0000-0000-00000000000a');
select test_util.assert((select count(*) = 1 from public.profiles), 'user sees only own profile');
update public.profiles set display_name = '김에이', persona_type = 'new_grad' where user_id = auth.uid();
select test_util.assert((select display_name = '김에이' from public.profiles), 'user updates own profile');
update public.profiles set display_name = 'hack' where user_id = '00000000-0000-0000-0000-00000000000b';
reset role;
select test_util.assert(
  (select display_name is null from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  'user cannot update other profile');

select test_util.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  update public.profiles set role = 'admin' where user_id = auth.uid();
  raise exception 'ASSERTION FAILED: role escalation allowed';
exception when insufficient_privilege then null;
end $$;
reset role;

-- 2. ES 문서·버전 -----------------------------------------------------------
select test_util.login('00000000-0000-0000-0000-00000000000a');
insert into public.es_documents (id, question_type, title, char_limit)
  values ('10000000-0000-0000-0000-000000000001', 'self_pr', '自己PR', 400);
insert into public.es_versions (id, doc_id, version_no, content, char_count, source)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, '私の強みは', 5, 'user');
select test_util.assert(
  (select user_id = auth.uid() from public.es_versions where id = '20000000-0000-0000-0000-000000000001'),
  'es_versions.user_id filled from document owner');

do $$ begin
  insert into public.es_versions (doc_id, version_no, content, source)
    values ('10000000-0000-0000-0000-000000000001', 2, 'x', 'admin');
  raise exception 'ASSERTION FAILED: user inserted admin-sourced version';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.es_versions (doc_id, content, source, ai_feedback)
    values ('10000000-0000-0000-0000-000000000001', 'forged', 'ai', '{}');
  raise exception 'ASSERTION FAILED: user inserted ai-sourced version';
exception when insufficient_privilege then null;
end $$;

update public.es_versions set content = 'tampered' where id = '20000000-0000-0000-0000-000000000001';
delete from public.es_versions where id = '20000000-0000-0000-0000-000000000001';
select test_util.assert(
  (select content = '私の強みは' from public.es_versions where id = '20000000-0000-0000-0000-000000000001'),
  'es_versions are immutable for owner');
reset role;

select test_util.login('00000000-0000-0000-0000-00000000000b');
select test_util.assert((select count(*) = 0 from public.es_documents), 'other user cannot read ES docs');
select test_util.assert((select count(*) = 0 from public.es_versions), 'other user cannot read ES versions');
do $$ begin
  insert into public.es_versions (doc_id, version_no, content, source)
    values ('10000000-0000-0000-0000-000000000001', 9, 'inject', 'user');
  raise exception 'ASSERTION FAILED: inserted version into foreign doc';
exception when insufficient_privilege then null;
end $$;
reset role;

-- 3. 자식 행 소유권 ---------------------------------------------------------
select test_util.login('00000000-0000-0000-0000-00000000000b');
insert into public.analysis_conversations (id, title) values ('30000000-0000-0000-0000-00000000000b', 'B');
reset role;
select test_util.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  insert into public.analysis_messages (conversation_id, role, content)
    values ('30000000-0000-0000-0000-00000000000b', 'user', 'inject');
  raise exception 'ASSERTION FAILED: inserted message into foreign conversation';
exception when insufficient_privilege then null;
end $$;
reset role;

-- 4. admin 접근 범위 --------------------------------------------------------
select test_util.login('00000000-0000-0000-0000-0000000000ad');
select test_util.assert((select count(*) = 0 from public.es_documents where id = '10000000-0000-0000-0000-000000000001'), 'admin cannot read ES without review request');
select test_util.assert((select count(*) = 3 from public.profiles where user_id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000ad')), 'admin reads profiles');
reset role;

select test_util.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  insert into public.review_requests (target_type, target_id, status)
    values ('es_version', '20000000-0000-0000-0000-000000000001', 'done');
  raise exception 'ASSERTION FAILED: user created non-pending review request';
exception when insufficient_privilege then null;
end $$;
select test_util.assert(
  (select (public.request_review('es_version', '20000000-0000-0000-0000-000000000001', '확인 부탁드립니다') ->> 'ok')::boolean),
  'user requests review via RPC');
select test_util.assert(
  (select public.request_review('es_version', '20000000-0000-0000-0000-000000000001') ->> 'reason' = 'duplicate'),
  'duplicate open review request rejected');
reset role;
update public.review_requests set id = '40000000-0000-0000-0000-000000000001'
  where target_id = '20000000-0000-0000-0000-000000000001';

select test_util.login('00000000-0000-0000-0000-0000000000ad');
select test_util.assert((select count(*) = 1 from public.es_documents where id = '10000000-0000-0000-0000-000000000001'), 'admin reads ES doc under review');
select test_util.assert((select count(*) = 1 from public.es_versions where doc_id = '10000000-0000-0000-0000-000000000001'), 'admin reads versions under review');
insert into public.es_versions (doc_id, version_no, content, source)
  values ('10000000-0000-0000-0000-000000000001', 2, '運営者による修正版', 'admin');
update public.review_requests set status = 'done', admin_comment = 'good' where id = '40000000-0000-0000-0000-000000000001';
select test_util.assert((select count(*) = 0 from public.analysis_conversations), 'admin cannot read analysis conversations');
reset role;

select test_util.login('00000000-0000-0000-0000-00000000000a');
select test_util.assert(
  (select count(*) = 2 from public.es_versions where doc_id = '10000000-0000-0000-0000-000000000001'),
  'owner sees admin-authored version');
select test_util.assert(
  (select status = 'done' from public.review_requests where id = '40000000-0000-0000-0000-000000000001'),
  'owner sees processed review');
reset role;

-- 5. ai_runs raw 컬럼 차단 ---------------------------------------------------
insert into public.ai_runs (user_id, feature, model, prompt_version, status, raw)
  values ('00000000-0000-0000-0000-00000000000a', 'es_review', 'm', 'v1', 'success', '{"x":1}');
select test_util.login('00000000-0000-0000-0000-0000000000ad');
select test_util.assert((select count(*) >= 1 from (select id, feature from public.ai_runs where user_id = '00000000-0000-0000-0000-00000000000a') s), 'admin reads ai_runs metadata');
do $$ begin
  perform raw from public.ai_runs;
  raise exception 'ASSERTION FAILED: admin read ai_runs.raw';
exception when insufficient_privilege then null;
end $$;
reset role;
select test_util.login('00000000-0000-0000-0000-00000000000a');
select test_util.assert((select count(*) = 0 from (select id from public.ai_runs) s), 'user cannot read ai_runs');
reset role;

-- 6. 이벤트·사용량 ----------------------------------------------------------
select test_util.login('00000000-0000-0000-0000-00000000000a');
insert into public.events (name, props) values ('onboarding.completed', '{}');
select test_util.assert((select count(*) = 0 from public.events), 'user cannot read events');
do $$ begin
  insert into public.usage_counters (user_id, bucket, window_start, count)
    values (auth.uid(), 'ai_day', now(), -100);
  raise exception 'ASSERTION FAILED: user wrote usage counter';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.subscriptions (user_id, plan_code) values (auth.uid(), 'pro');
  raise exception 'ASSERTION FAILED: user self-activated subscription';
exception when insufficient_privilege then null;
end $$;
reset role;

-- 7. 동의 로그 불변성 + 계정 삭제 시 가명화 보존 -----------------------------
insert into public.partners (id, name, contact_email)
  values ('50000000-0000-0000-0000-000000000001', 'Partner KK', 'p@example.jp');
insert into public.referrals (id, user_id, partner_id, shared_items)
  values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
          '50000000-0000-0000-0000-000000000001', '{profile}');
insert into public.consents (user_id, referral_id, kind, text_version, text_hash, items,
                             partner_snapshot, purpose, retention)
  values ('00000000-0000-0000-0000-00000000000a', '60000000-0000-0000-0000-000000000001', 'grant',
          'v1', 'h', '{profile}', '{"name":"Partner KK"}', '채용 검토', '1년');

do $$ begin
  update public.consents set items = '{profile,es}';
  raise exception 'ASSERTION FAILED: consent updated';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  delete from public.consents;
  raise exception 'ASSERTION FAILED: consent deleted before retention';
exception when insufficient_privilege then null;
end $$;

select test_util.login('00000000-0000-0000-0000-00000000000a');
select test_util.assert((select count(*) = 1 from public.consents), 'owner reads own consent');
do $$ begin
  insert into public.consents (user_id, kind, text_version, text_hash, items, partner_snapshot, purpose, retention)
    values (auth.uid(), 'grant', 'v1', 'h', '{x}', '{}', 'p', 'r');
  raise exception 'ASSERTION FAILED: user inserted consent directly';
exception when insufficient_privilege then null;
end $$;
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select test_util.assert(
  (select count(*) = 1 and bool_and(user_id is null and referral_id is null)
   from public.consents
   where subject_hash = encode(extensions.digest('00000000-0000-0000-0000-00000000000a', 'sha256'), 'hex')),
  'consent kept pseudonymized after account deletion');
select test_util.assert((select count(*) = 0 from public.es_documents where id = '10000000-0000-0000-0000-000000000001'), 'user content cascaded on deletion');


-- 8. AI 한도 / 환불 / 버전 번호 / 검수 한도 ------------------------------------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'c@example.com');
select test_util.login('00000000-0000-0000-0000-0000000000c1');
-- free: 분당 3회
select test_util.assert((select (public.consume_ai_quota() ->> 'allowed')::boolean), 'quota call 1');
select test_util.assert((select (public.consume_ai_quota() ->> 'allowed')::boolean), 'quota call 2');
select test_util.assert((select (public.consume_ai_quota() ->> 'day_used')::int = 3), 'quota call 3 counts');
select test_util.assert((select public.consume_ai_quota() ->> 'reason' = 'minute'), 'per-minute limit enforced');
select test_util.assert((select (public.my_quota_status() ->> 'day_used')::int = 3), 'status shows day usage');
do $$ begin
  perform public.refund_ai_quota(auth.uid());
  raise exception 'ASSERTION FAILED: user called refund';
exception when insufficient_privilege then null;
end $$;
reset role;

-- 일일 한도: 분 창을 과거로 돌려 분당 제한을 피한 뒤 10회째까지 소비
update public.usage_counters set window_start = window_start - interval '2 minutes'
  where user_id = '00000000-0000-0000-0000-0000000000c1' and bucket = 'ai_minute';
update public.usage_counters set count = 10
  where user_id = '00000000-0000-0000-0000-0000000000c1' and bucket = 'ai_day';
select test_util.login('00000000-0000-0000-0000-0000000000c1');
select test_util.assert((select public.consume_ai_quota() ->> 'reason' = 'day'), 'daily limit enforced');
reset role;
select public.refund_ai_quota('00000000-0000-0000-0000-0000000000c1');
select test_util.assert(
  (select count = 9 from public.usage_counters
    where user_id = '00000000-0000-0000-0000-0000000000c1' and bucket = 'ai_day'),
  'service refund decrements day usage');

-- 유료 플랜이면 한도가 커진다
insert into public.subscriptions (user_id, plan_code) values ('00000000-0000-0000-0000-0000000000c1', 'pro');
select test_util.login('00000000-0000-0000-0000-0000000000c1');
select test_util.assert((select public.my_quota_status() ->> 'plan' = 'pro'), 'pro plan detected');
select test_util.assert((select (public.consume_ai_quota() ->> 'allowed')::boolean), 'pro user under limit');

-- 버전 번호 자동 부여 + 부모 검증
insert into public.es_documents (id, question_type, title) values ('10000000-0000-0000-0000-0000000000c1', 'gakuchika', 'ガクチカ');
insert into public.es_versions (id, doc_id, content) values ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1', 'v1');
insert into public.es_versions (doc_id, content, parent_version_id) values ('10000000-0000-0000-0000-0000000000c1', 'v2', '20000000-0000-0000-0000-0000000000c1');
select test_util.assert(
  (select array_agg(version_no order by version_no) = '{1,2}' from public.es_versions where doc_id = '10000000-0000-0000-0000-0000000000c1'),
  'version numbers auto-assigned');
do $$ begin
  insert into public.es_versions (doc_id, content, parent_version_id)
    values ('10000000-0000-0000-0000-0000000000c1', 'x', '20000000-0000-0000-0000-000000000001');
  raise exception 'ASSERTION FAILED: foreign parent accepted';
exception when check_violation then null;
end $$;

-- 검수: 남의 대상 불가, pro 월 4회
select test_util.assert(
  (select public.request_review('es_version', '20000000-0000-0000-0000-000000000001') ->> 'reason' = 'not_found'),
  'cannot request review of foreign content');
do $$ begin
  insert into public.review_requests (target_type, target_id) values ('es_version', '20000000-0000-0000-0000-0000000000c1');
  raise exception 'ASSERTION FAILED: direct review insert allowed';
exception when insufficient_privilege then null;
end $$;
reset role;
-- 월 사용량을 한도까지 채운 뒤 거절 확인
update public.usage_counters set count = 4 where user_id = '00000000-0000-0000-0000-0000000000c1' and bucket = 'review_month';
insert into public.usage_counters (user_id, bucket, window_start, count)
  select '00000000-0000-0000-0000-0000000000c1', 'review_month', public.quota_month_start(), 4
  where not exists (select 1 from public.usage_counters where user_id = '00000000-0000-0000-0000-0000000000c1' and bucket = 'review_month');
select test_util.login('00000000-0000-0000-0000-0000000000c1');
select test_util.assert(
  (select public.request_review('es_version', '20000000-0000-0000-0000-0000000000c1') ->> 'reason' = 'limit'),
  'monthly review limit enforced');
reset role;


-- 9. 함수 실행 권한 회귀 방지 --------------------------------------------------
-- anon 은 어떤 security definer 함수도 실행할 수 없다.
select test_util.assert(
  (select coalesce(string_agg(p.proname, ','), '') = '' from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute')),
  'anon cannot execute security definer functions');
-- authenticated 가 실행 가능한 security definer 함수는 허용 목록만.
select test_util.assert(
  (select coalesce(string_agg(p.proname, ',' order by p.proname), '') from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname not in ('is_admin', 'admin_can_view', 'admin_can_view_es_doc',
                           'consume_ai_quota', 'my_quota_status', 'request_review')) = '',
  'authenticated can execute only allow-listed security definer functions');

\echo 'RLS tests passed'
