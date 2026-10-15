"use client";

import { startTransition, useActionState, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { renderConsentText } from "@/content/consent/referral";
import type { Partner } from "@/lib/db/database.types";
import {
  COUNTRY_LABELS,
  decodeItem,
  describeItems,
  PROFILE_ITEM_LABEL,
} from "@/lib/referral/items";
import { submitReferral, type ReferralFormState } from "../actions";

type Ref = { id: string; title: string };

export function ConsentForm({
  partner,
  docs,
  careers,
}: {
  partner: Partner;
  docs: Ref[];
  careers: Ref[];
}) {
  const [state, action, pending] = useActionState<ReferralFormState, FormData>(submitReferral, {});
  const [items, setItems] = useState<string[]>(["profile"]);
  const titles = useMemo(() => {
    const t: Record<string, string> = {};
    docs.forEach((d) => (t[`es:${d.id}`] = d.title));
    careers.forEach((c) => (t[`career:${c.id}`] = c.title));
    return t;
  }, [docs, careers]);

  // 서버가 기록·해시하는 것과 같은 함수로 동의 문구를 만든다
  const consentText = renderConsentText({
    partner_name: partner.name,
    partner_country: COUNTRY_LABELS[partner.country] ?? partner.country,
    partner_contact: partner.contact_email,
    partner_license: partner.license_no ?? "(제휴사 확인 중)",
    partner_privacy_contact: partner.privacy_contact ?? partner.contact_email,
    items: describeItems(
      items.map(decodeItem).filter((i) => i !== null),
      titles,
    ),
  });

  const toggle = (value: string, on: boolean) =>
    setItems((prev) => (on ? [...prev, value] : prev.filter((v) => v !== value)));

  return (
    <form
      // form action 대신 onSubmit 으로 호출해 실패 시 React 의 자동 폼 초기화를 피한다.
      // (초기화되면 체크박스 표시와 동의 문구·제출 항목이 어긋난다)
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
      className="grid gap-6"
    >
      <input type="hidden" name="partnerId" value={partner.id} />
      {/* 제출 항목은 화면의 동의 문구와 같은 상태(items)에서 만든다.
          React 19 는 액션 후 폼을 초기화하므로 체크박스 DOM 값에 의존하면 문구와 제출 항목이 어긋날 수 있다. */}
      {items.map((v) => (
        <input key={v} type="hidden" name="items" value={v} />
      ))}
      <fieldset className="grid gap-2 rounded-xl border bg-card p-4">
        <legend className="px-1 font-semibold">공유할 항목</legend>
        {[
          { value: "profile", label: PROFILE_ITEM_LABEL },
          ...docs.map((d) => ({ value: `es:${d.id}`, label: `ES 최신 버전 「${d.title}」` })),
          ...careers.map((c) => ({ value: `career:${c.id}`, label: `職務経歴書 「${c.title}」` })),
        ].map((o) => (
          <label key={o.value} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              value={o.value}
              checked={items.includes(o.value)}
              onChange={(e) => toggle(o.value, e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <section aria-labelledby="consent-heading" className="grid gap-2">
        <h2 id="consent-heading" className="font-semibold">
          동의 내용
        </h2>
        <pre
          className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/40 p-4 font-sans text-sm leading-6"
          data-testid="consent-text"
          tabIndex={0}
        >
          {consentText}
        </pre>
      </section>

      <fieldset className="grid gap-2">
        <legend className="sr-only">필수 동의</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agreeProvide" className="mt-0.5 size-4 accent-primary" />
          (필수) 위 제휴사에 선택한 개인정보를 제공하는 데 동의합니다.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agreeTransfer" className="mt-0.5 size-4 accent-primary" />
          (필수) 개인정보가 국외({COUNTRY_LABELS[partner.country] ?? partner.country})로 이전되는 데
          동의합니다.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agreeRead" className="mt-0.5 size-4 accent-primary" />
          (필수) 제공 목적·보유 기간·철회 방법을 확인했습니다.
        </label>
      </fieldset>
      {state.message ? <Alert variant="destructive">{state.message}</Alert> : null}
      <Button type="submit" className="w-fit" disabled={pending || items.length === 0}>
        {pending ? "기록 중…" : "동의하고 연결 신청"}
      </Button>
    </form>
  );
}
