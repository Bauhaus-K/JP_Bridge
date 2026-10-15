/**
 * 제휴 인재소개사 정보 제공 동의 문구 (법률 검토 필요 — 플레이스홀더).
 * 문구를 바꾸면 반드시 버전을 올린다. 동의 기록에는 버전과 "실제로 보여 준 문구"의 해시가 남는다.
 * 한국 개인정보보호법상 제3자 제공(제17조)·국외 이전(제28조의8) 고지 항목을 담는다 (DECISIONS Q2).
 */
export const REFERRAL_CONSENT_VERSION = "referral-v1";
export const REFERRAL_REVOKE_VERSION = "referral-revoke-v1";

export const REFERRAL_PURPOSE = "제휴 인재소개사의 일본 기업 채용 정보 안내 및 기업 추천 검토";
export const REFERRAL_RETENTION =
  "제공일로부터 1년 또는 동의 철회 시까지 (철회 시 제휴사에 즉시 삭제 요청)";

export const REFERRAL_CONSENT_TEMPLATE = `[개인정보 제3자 제공 및 국외 이전 동의] (문구 버전: ${REFERRAL_CONSENT_VERSION})

1. 제공받는 자: {{partner_name}}
   - 소재 국가: {{partner_country}}
   - 연락처: {{partner_contact}}
   - 유료직업소개 허가번호: {{partner_license}}
   - 개인정보 문의처: {{partner_privacy_contact}}
2. 제공 목적: ${REFERRAL_PURPOSE}
3. 제공 항목: {{items}}
4. 보유·이용 기간: ${REFERRAL_RETENTION}
5. 국외 이전 방법·시기: 운영자 확인 후 이메일로 전송하며, 동의일로부터 영업일 기준 3일 이내에 이전합니다.
6. 동의를 거부할 권리: 동의하지 않아도 JP Bridge의 다른 기능은 모두 이용할 수 있습니다. 다만 이 제휴사 연결은 진행되지 않습니다.
7. 철회 방법: '제휴사 연결' 화면에서 언제든 철회할 수 있으며, 이미 전달된 경우 제휴사에 삭제를 요청하는 통지를 보냅니다.

JP Bridge는 직업소개를 하지 않으며, 제휴사의 채용 결과를 보장하지 않습니다.`;

export const REFERRAL_REVOKE_TEXT = `[개인정보 제3자 제공 동의 철회] (문구 버전: ${REFERRAL_REVOKE_VERSION})
본인은 위 제휴사에 대한 개인정보 제공 동의를 철회합니다. 이미 전달된 정보는 제휴사에 삭제를 요청합니다.`;

export type ConsentVars = {
  partner_name: string;
  partner_country: string;
  partner_contact: string;
  partner_license: string;
  partner_privacy_contact: string;
  items: string;
};

export function renderConsentText(vars: ConsentVars): string {
  return REFERRAL_CONSENT_TEMPLATE.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: keyof ConsentVars) => vars[key] ?? "",
  );
}
