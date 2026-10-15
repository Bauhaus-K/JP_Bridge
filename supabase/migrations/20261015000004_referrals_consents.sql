-- 제휴사 리퍼럴과 동의 로그 (FEATURE_REFERRAL, 기본 OFF)
-- 동의 로그는 불변(append-only). 계정 삭제 시 user_id만 NULL로 끊기고
-- subject_hash로 가명화된 기록이 retain_until(3년)까지 남는다. (DECISIONS D-Q3)

create type public.referral_status as enum ('consented', 'sent', 'revoked', 'closed');
create type public.consent_kind as enum ('grant', 'revoke');
create type public.referral_outcome as enum ('none', 'interviewing', 'offer', 'hired', 'declined');

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default 'JP',
  contact_email text not null,
  license_no text,          -- 有料職業紹介事業 許可番号 등
  privacy_contact text,     -- 개인정보 문의처 (국외 이전 고지 항목)
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger partners_set_updated_at before update on public.partners
  for each row execute function public.set_updated_at();

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  partner_id uuid not null references public.partners (id),
  shared_items text[] not null check (cardinality(shared_items) > 0),
  status public.referral_status not null default 'consented',
  outcome public.referral_outcome not null default 'none',
  outcome_note text,
  outcome_reported_by text check (outcome_reported_by in ('user', 'admin')),
  sent_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.referrals (user_id);
create index on public.referrals (status);
create trigger referrals_set_updated_at before update on public.referrals
  for each row execute function public.set_updated_at();

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  subject_hash text not null,
  referral_id uuid references public.referrals (id) on delete set null,
  kind public.consent_kind not null,
  text_version text not null,
  text_hash text not null,
  items text[] not null,
  partner_snapshot jsonb not null,  -- 동의 당시 수신자명·국가·연락처
  purpose text not null,
  retention text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  retain_until timestamptz not null default (now() + interval '3 years')
);
create index on public.consents (user_id);
create index on public.consents (referral_id);

create or replace function public.consents_fill_subject_hash()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    raise exception 'consent requires user_id at insert' using errcode = '23502';
  end if;
  new.subject_hash = encode(extensions.digest(new.user_id::text, 'sha256'), 'hex');
  new.created_at = now();
  new.retain_until = now() + interval '3 years';
  return new;
end;
$$;
create trigger consents_fill_subject_hash
  before insert on public.consents
  for each row execute function public.consents_fill_subject_hash();

-- 불변: UPDATE는 계정 삭제에 따른 user_id/referral_id → NULL 만 허용,
-- DELETE는 보관 기한이 지난 행만 허용.
create or replace function public.consents_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.retain_until > now() then
      raise exception 'consents are immutable until retain_until' using errcode = '42501';
    end if;
    return old;
  end if;

  if (new.user_id is null or new.user_id = old.user_id)
     and (new.referral_id is null or new.referral_id = old.referral_id)
     and (to_jsonb(new) - 'user_id' - 'referral_id') = (to_jsonb(old) - 'user_id' - 'referral_id') then
    return new;
  end if;
  raise exception 'consents are append-only' using errcode = '42501';
end;
$$;
create trigger consents_immutable
  before update or delete on public.consents
  for each row execute function public.consents_immutable();

-- ---------------------------------------------------------------------------
-- RLS (생성·철회는 MS7의 security definer RPC로만)
-- ---------------------------------------------------------------------------
alter table public.partners enable row level security;
create policy partners_read_active on public.partners
  for select to authenticated using (active or (select public.is_admin()));
create policy partners_admin_write on public.partners
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.referrals enable row level security;
create policy referrals_owner_select on public.referrals
  for select to authenticated using (user_id = (select auth.uid()));
create policy referrals_admin_select on public.referrals
  for select to authenticated using ((select public.is_admin()));
create policy referrals_admin_update on public.referrals
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.consents enable row level security;
create policy consents_owner_select on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_admin_select on public.consents
  for select to authenticated using ((select public.is_admin()));
