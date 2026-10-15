-- MS7: 리퍼럴 동의·철회 기록 (service_role 전용 — 서버가 보여 준 동의 문구의 해시를 함께 기록)
-- 리퍼럴 생성과 동의 로그는 한 트랜잭션으로 기록되어야 한다 (DECISIONS D61).

create or replace function public.record_referral_consent(
  p_user_id uuid,
  p_partner_id uuid,
  p_items text[],
  p_text_version text,
  p_text_hash text,
  p_purpose text,
  p_retention text,
  p_ip_hash text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner public.partners;
  v_referral_id uuid;
begin
  select * into v_partner from public.partners where id = p_partner_id and active;
  if not found then
    raise exception 'partner not available' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.referrals
             where user_id = p_user_id and partner_id = p_partner_id and status in ('consented', 'sent')) then
    raise exception 'active referral exists' using errcode = '23505';
  end if;
  if cardinality(p_items) = 0 then
    raise exception 'no items' using errcode = '22023';
  end if;

  insert into public.referrals (user_id, partner_id, shared_items, status)
    values (p_user_id, p_partner_id, p_items, 'consented')
    returning id into v_referral_id;

  insert into public.consents (user_id, referral_id, kind, text_version, text_hash, items,
                               partner_snapshot, purpose, retention, ip_hash, user_agent)
  values (p_user_id, v_referral_id, 'grant', p_text_version, p_text_hash, p_items,
          jsonb_build_object('id', v_partner.id, 'name', v_partner.name, 'country', v_partner.country,
                             'contact_email', v_partner.contact_email, 'license_no', v_partner.license_no,
                             'privacy_contact', v_partner.privacy_contact),
          p_purpose, p_retention, p_ip_hash, left(p_user_agent, 300));
  return v_referral_id;
end;
$$;
revoke all on function public.record_referral_consent(uuid, uuid, text[], text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_referral_consent(uuid, uuid, text[], text, text, text, text, text, text)
  to service_role;

-- 철회: 이전 상태를 반환한다 ('sent' 였다면 제휴사에 철회 통지가 필요)
create or replace function public.record_referral_revocation(
  p_user_id uuid,
  p_referral_id uuid,
  p_text_version text,
  p_text_hash text,
  p_ip_hash text,
  p_user_agent text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref public.referrals;
  v_grant public.consents;
begin
  select * into v_ref from public.referrals where id = p_referral_id and user_id = p_user_id for update;
  if not found then
    raise exception 'referral not found' using errcode = 'P0002';
  end if;
  if v_ref.status not in ('consented', 'sent') then
    return v_ref.status::text;
  end if;
  select * into v_grant from public.consents
    where referral_id = p_referral_id and kind = 'grant' order by created_at desc limit 1;

  insert into public.consents (user_id, referral_id, kind, text_version, text_hash, items,
                               partner_snapshot, purpose, retention, ip_hash, user_agent)
  values (p_user_id, p_referral_id, 'revoke', p_text_version, p_text_hash, v_ref.shared_items,
          coalesce(v_grant.partner_snapshot, '{}'::jsonb), coalesce(v_grant.purpose, ''),
          coalesce(v_grant.retention, ''), p_ip_hash, left(p_user_agent, 300));

  update public.referrals set status = 'revoked', revoked_at = now() where id = p_referral_id;
  return v_ref.status::text;
end;
$$;
revoke all on function public.record_referral_revocation(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_referral_revocation(uuid, uuid, text, text, text, text) to service_role;

-- 사용자 결과 자가 보고
create or replace function public.report_referral_outcome(
  p_referral_id uuid,
  p_outcome public.referral_outcome,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.referrals
     set outcome = p_outcome,
         outcome_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
         outcome_reported_by = 'user'
   where id = p_referral_id and user_id = (select auth.uid()) and status in ('consented', 'sent', 'closed');
  return found;
end;
$$;
revoke all on function public.report_referral_outcome(uuid, public.referral_outcome, text) from public, anon;
grant execute on function public.report_referral_outcome(uuid, public.referral_outcome, text) to authenticated;

-- 보관 기한이 지난 동의 기록 파기 (주기 실행: pg_cron 등, DEPLOY.md 참고)
create or replace function public.purge_expired_consents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.consents where retain_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.purge_expired_consents() from public, anon, authenticated;
grant execute on function public.purge_expired_consents() to service_role;
