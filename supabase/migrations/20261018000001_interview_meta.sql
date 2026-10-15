-- MS4: 질문의 의도·답변 팁 등 질문 메타데이터
alter table public.interview_turns add column if not exists meta jsonb;
