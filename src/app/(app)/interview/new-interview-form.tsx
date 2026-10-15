"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { createInterviewAction, type CreateInterviewState } from "./actions";

export function NewInterviewForm({ defaultRole }: { defaultRole: string }) {
  const [state, action] = useActionState<CreateInterviewState, FormData>(createInterviewAction, {});
  return (
    <form action={action} className="grid gap-4">
      <Field id="iv-company" label="기업명 (선택)">
        {(aria) => <Input {...aria} name="company" maxLength={60} />}
      </Field>
      <Field id="iv-role" label="직종" required>
        {(aria) => (
          <Input {...aria} name="jobRole" maxLength={60} defaultValue={defaultRole} required />
        )}
      </Field>
      <Field id="iv-stage" label="면접 단계">
        {(aria) => (
          <Select {...aria} name="stage" defaultValue="first">
            <option value="first">1차 면접</option>
            <option value="final">최종 면접</option>
          </Select>
        )}
      </Field>
      <Field id="iv-count" label="질문 수">
        {(aria) => (
          <Select {...aria} name="questionCount" defaultValue="5">
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </Select>
        )}
      </Field>
      {state.message ? <Alert variant="destructive">{state.message}</Alert> : null}
      <SubmitButton pendingText="질문 준비 중…">면접 시작</SubmitButton>
    </form>
  );
}
