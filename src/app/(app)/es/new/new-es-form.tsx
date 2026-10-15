"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { QUESTION_TYPE_OPTIONS } from "@/lib/validation/es";
import { createEsDocument, type CreateEsState } from "../actions";

export function NewEsForm() {
  const [state, action] = useActionState<CreateEsState, FormData>(createEsDocument, {});
  const v = state.values;
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.message ? <Alert variant="destructive">{state.message}</Alert> : null}
      <Field id="questionType" label="문항 유형" required error={e.questionType}>
        {(aria) => (
          <Select {...aria} name="questionType" defaultValue={v?.questionType ?? ""}>
            <option value="" disabled>
              선택하세요
            </option>
            {QUESTION_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        id="title"
        label="제목"
        required
        hint="목록에서 구분하기 위한 이름입니다. 예: ○○商事 志望動機"
        error={e.title}
      >
        {(aria) => <Input {...aria} name="title" maxLength={60} defaultValue={v?.title} />}
      </Field>
      <Field
        id="company"
        label="지원 기업 (선택)"
        hint="입력하면 기업 적합성 관점으로 첨삭합니다."
        error={e.company}
      >
        {(aria) => <Input {...aria} name="company" maxLength={60} defaultValue={v?.company} />}
      </Field>
      <Field
        id="questionText"
        label="문항 원문 (선택)"
        hint="예: 学生時代に最も力を入れたことを教えてください。"
        error={e.questionText}
      >
        {(aria) => (
          <Input
            {...aria}
            name="questionText"
            lang="ja"
            maxLength={300}
            defaultValue={v?.questionText}
          />
        )}
      </Field>
      <Field
        id="charLimit"
        label="글자 수 제한 (선택)"
        hint="예: 400. 수정본도 이 제한 안에서 작성됩니다."
        error={e.charLimit}
      >
        {(aria) => (
          <Input
            {...aria}
            name="charLimit"
            type="number"
            inputMode="numeric"
            min={50}
            max={5000}
            defaultValue={v?.charLimit}
          />
        )}
      </Field>
      <SubmitButton pendingText="만드는 중…">만들기</SubmitButton>
    </form>
  );
}
