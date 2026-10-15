"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { createChecklist, type ChecklistActionState } from "./actions";

export function ChecklistForm({
  options,
  defaultTemplateId,
  defaultMonth,
  submitLabel,
}: {
  options: { id: string; title: string }[];
  defaultTemplateId: string;
  defaultMonth: string;
  submitLabel: string;
}) {
  const [state, action] = useActionState<ChecklistActionState, FormData>(createChecklist, {});
  return (
    <form action={action} className="grid gap-3">
      <Field id="cl-template" label="준비 유형">
        {(aria) => (
          <Select {...aria} name="templateId" defaultValue={defaultTemplateId}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field id="cl-month" label="목표 입사 월" required>
        {(aria) => (
          <Input
            {...aria}
            type="month"
            name="targetStartMonth"
            defaultValue={defaultMonth}
            required
          />
        )}
      </Field>
      {state.message ? <Alert variant="destructive">{state.message}</Alert> : null}
      <SubmitButton className="w-fit">{submitLabel}</SubmitButton>
    </form>
  );
}
