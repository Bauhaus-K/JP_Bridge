"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createPartner, type PartnerFormState } from "./actions";

export function PartnerForm() {
  const [state, action] = useActionState<PartnerFormState, FormData>(createPartner, {});
  return (
    <form action={action} className="grid gap-3">
      <Field id="p-name" label="회사명" required>
        {(aria) => <Input {...aria} name="name" required />}
      </Field>
      <Field id="p-country" label="국가 코드" hint="JP, KR 등 2자리">
        {(aria) => <Input {...aria} name="country" defaultValue="JP" maxLength={2} />}
      </Field>
      <Field id="p-email" label="전달·연락 이메일" required>
        {(aria) => <Input {...aria} name="contactEmail" type="email" required />}
      </Field>
      <Field id="p-license" label="유료직업소개 허가번호">
        {(aria) => <Input {...aria} name="licenseNo" />}
      </Field>
      <Field id="p-privacy" label="개인정보 문의처">
        {(aria) => <Input {...aria} name="privacyContact" />}
      </Field>
      <Field id="p-desc" label="소개 (사용자에게 표시)">
        {(aria) => <Input {...aria} name="description" />}
      </Field>
      {state.message ? (
        <Alert variant={state.ok ? "info" : "destructive"}>{state.message}</Alert>
      ) : null}
      <SubmitButton className="w-fit">등록</SubmitButton>
    </form>
  );
}
