-- 코칭 콘텐츠: 자기분석, ES, 면접, 경력 번역, 체크리스트, 검수 요청
-- 모든 테이블은 소유자(user_id)만 읽기/쓰기. admin은 검수 요청 대상에 한해 읽기.

create type public.es_question_type as enum ('self_pr', 'gakuchika', 'shiboudouki', 'free');
create type public.content_source as enum ('user', 'ai', 'admin');
create type public.interview_stage as enum ('first', 'final');
create type public.interview_status as enum ('active', 'completed', 'abandoned');
create type public.interview_turn_kind as enum ('question', 'followup');
create type public.answer_input_mode as enum ('text', 'voice');
create type public.checklist_category as enum ('schedule', 'documents', 'visa');
create type public.review_target_type as enum ('es_version', 'career_translation', 'interview_session');
create type public.review_status as enum ('pending', 'in_review', 'done', 'cancelled');

-- ---------------------------------------------------------------------------
-- 자기분석
-- ---------------------------------------------------------------------------
create table public.analysis_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analysis_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.analysis_conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index on public.analysis_messages (conversation_id, created_at);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_conversation_id uuid references public.analysis_conversations (id) on delete set null,
  title text not null,
  situation text not null default '',
  task text not null default '',
  action text not null default '',
  result text not null default '',
  keywords text[] not null default '{}',
  strengths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.episodes (user_id);

-- ---------------------------------------------------------------------------
-- ES
-- ---------------------------------------------------------------------------
create table public.es_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text,
  question_type public.es_question_type not null,
  question_text text,
  char_limit integer check (char_limit between 1 and 10000),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.es_documents (user_id);

create table public.es_versions (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.es_documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version_no integer not null,
  parent_version_id uuid references public.es_versions (id) on delete set null,
  content text not null,
  char_count integer not null default 0,
  ai_feedback jsonb,
  scores jsonb,
  source public.content_source not null default 'user',
  prompt_version text,
  created_at timestamptz not null default now(),
  unique (doc_id, version_no)
);
create index on public.es_versions (doc_id, version_no desc);

create table public.es_document_episodes (
  doc_id uuid not null references public.es_documents (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (doc_id, episode_id)
);

-- ---------------------------------------------------------------------------
-- 모의면접
-- ---------------------------------------------------------------------------
create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text,
  job_role text not null,
  stage public.interview_stage not null default 'first',
  question_count smallint not null default 5 check (question_count between 1 and 15),
  input_mode public.answer_input_mode not null default 'text',
  status public.interview_status not null default 'active',
  summary jsonb,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.interview_sessions (user_id);

create table public.interview_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  idx smallint not null,
  kind public.interview_turn_kind not null default 'question',
  parent_turn_id uuid references public.interview_turns (id) on delete cascade,
  question text not null,
  answer text,
  audio_path text, -- 음성 입력 확장용 (MVP 미사용)
  feedback jsonb,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index on public.interview_turns (session_id, idx);

-- ---------------------------------------------------------------------------
-- 경력 번역
-- ---------------------------------------------------------------------------
create table public.career_translations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  input text not null,
  output jsonb,
  source public.content_source not null default 'ai',
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.career_translations (user_id);

-- ---------------------------------------------------------------------------
-- 체크리스트 (템플릿은 src/content/checklists/*.json)
-- ---------------------------------------------------------------------------
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id text not null,
  template_version text not null,
  target_start date not null,
  created_at timestamptz not null default now()
);
create index on public.checklists (user_id);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_item_id text not null,
  category public.checklist_category not null,
  title text not null,
  description text,
  due_date date,
  sort_order integer not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.checklist_items (user_id, due_date) where done_at is null;

-- ---------------------------------------------------------------------------
-- 운영자 검수 요청
-- ---------------------------------------------------------------------------
create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type public.review_target_type not null,
  target_id uuid not null,
  user_note text check (char_length(user_note) <= 1000),
  status public.review_status not null default 'pending',
  admin_comment text,
  admin_version_id uuid references public.es_versions (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.review_requests (status, created_at);
create index on public.review_requests (target_type, target_id);

-- admin이 특정 콘텐츠를 볼 수 있는지: 열린(취소 아님) 검수 요청이 있을 때만.
create or replace function public.admin_can_view(p_type public.review_target_type, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.review_requests r
    where r.target_type = p_type and r.target_id = p_id and r.status <> 'cancelled'
  );
$$;
revoke all on function public.admin_can_view(public.review_target_type, uuid) from public;
grant execute on function public.admin_can_view(public.review_target_type, uuid) to authenticated, service_role;

-- ES 문서 단위 판정 (es_versions 정책에서 자기 테이블 재조회로 인한 RLS 재귀 방지)
create or replace function public.admin_can_view_es_doc(p_doc_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.review_requests r
    join public.es_versions v on v.id = r.target_id
    where r.target_type = 'es_version' and r.status <> 'cancelled' and v.doc_id = p_doc_id
  );
$$;
revoke all on function public.admin_can_view_es_doc(uuid) from public;
grant execute on function public.admin_can_view_es_doc(uuid) to authenticated, service_role;

-- es_versions.user_id는 항상 문서 소유자로 맞춘다 (admin이 작성한 버전 포함).
create or replace function public.es_versions_fill_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select d.user_id into new.user_id from public.es_documents d where d.id = new.doc_id;
  if new.user_id is null then
    raise exception 'es_document not found' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger es_versions_fill_owner
  before insert on public.es_versions
  for each row execute function public.es_versions_fill_owner();

-- updated_at triggers
create trigger analysis_conversations_set_updated_at before update on public.analysis_conversations
  for each row execute function public.set_updated_at();
create trigger episodes_set_updated_at before update on public.episodes
  for each row execute function public.set_updated_at();
create trigger es_documents_set_updated_at before update on public.es_documents
  for each row execute function public.set_updated_at();
create trigger interview_sessions_set_updated_at before update on public.interview_sessions
  for each row execute function public.set_updated_at();
create trigger career_translations_set_updated_at before update on public.career_translations
  for each row execute function public.set_updated_at();
create trigger review_requests_set_updated_at before update on public.review_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- 소유자 전용 CRUD 테이블
  foreach t in array array[
    'analysis_conversations', 'analysis_messages', 'episodes', 'es_documents',
    'es_document_episodes', 'interview_sessions', 'interview_turns',
    'career_translations', 'checklists', 'checklist_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner_all', t);
  end loop;
end;
$$;

-- 자식 행은 부모도 본인 소유여야 한다 (타인 부모에 끼워넣기 방지)
create policy analysis_messages_parent_owner on public.analysis_messages
  as restrictive for insert to authenticated
  with check (exists (select 1 from public.analysis_conversations c
                      where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy es_document_episodes_parent_owner on public.es_document_episodes
  as restrictive for insert to authenticated
  with check (
    exists (select 1 from public.es_documents d where d.id = doc_id and d.user_id = (select auth.uid()))
    and exists (select 1 from public.episodes e where e.id = episode_id and e.user_id = (select auth.uid())));
create policy interview_turns_parent_owner on public.interview_turns
  as restrictive for insert to authenticated
  with check (exists (select 1 from public.interview_sessions s
                      where s.id = session_id and s.user_id = (select auth.uid())));
create policy checklist_items_parent_owner on public.checklist_items
  as restrictive for insert to authenticated
  with check (exists (select 1 from public.checklists c
                      where c.id = checklist_id and c.user_id = (select auth.uid())));

-- admin: 검수 요청 대상만 읽기
create policy es_documents_admin_select on public.es_documents
  for select to authenticated
  using (public.admin_can_view_es_doc(id));
create policy career_translations_admin_select on public.career_translations
  for select to authenticated
  using (public.admin_can_view('career_translation', id));
create policy interview_sessions_admin_select on public.interview_sessions
  for select to authenticated
  using (public.admin_can_view('interview_session', id));
create policy interview_turns_admin_select on public.interview_turns
  for select to authenticated
  using (public.admin_can_view('interview_session', session_id));

-- es_versions: 소유자는 읽기/추가(user, ai 출처만), 수정·삭제 불가(히스토리 보존).
alter table public.es_versions enable row level security;
create policy es_versions_owner_select on public.es_versions
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy es_versions_owner_insert on public.es_versions
  for insert to authenticated
  with check (
    source in ('user', 'ai')
    and exists (select 1 from public.es_documents d
                where d.id = doc_id and d.user_id = (select auth.uid())));
-- admin: 검수 대상 문서의 버전 읽기 + admin 출처 버전 추가
create policy es_versions_admin_select on public.es_versions
  for select to authenticated
  using (public.admin_can_view_es_doc(doc_id));
create policy es_versions_admin_insert on public.es_versions
  for insert to authenticated
  with check (
    source = 'admin' and public.admin_can_view_es_doc(doc_id));

-- review_requests: 소유자는 읽기·생성(pending)·취소, admin은 읽기·처리
alter table public.review_requests enable row level security;
create policy review_requests_owner_select on public.review_requests
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy review_requests_owner_insert on public.review_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending'
              and admin_comment is null and admin_version_id is null and reviewed_by is null);
create policy review_requests_admin_select on public.review_requests
  for select to authenticated
  using ((select public.is_admin()));
create policy review_requests_admin_update on public.review_requests
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
-- 사용자 취소는 MS5에서 RPC로 제공 (상태 외 필드 변조 방지).
