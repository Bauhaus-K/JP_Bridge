"use client";

import { MailCheck } from "lucide-react";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { signInWithEmail, type LoginState } from "./actions";

export function EmailLoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(signInWithEmail, { status: "idle" });

  if (state.status === "sent") {
    return (
      <Alert variant="info" aria-live="polite" className="flex gap-3">
        <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">{state.email}로 로그인 링크를 보냈습니다.</p>
          <p className="mt-1">
            메일함(스팸함 포함)을 확인하고 링크를 눌러 주세요. 이 창은 닫아도 됩니다.
          </p>
        </div>
      </Alert>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field
        id="email"
        label="이메일"
        required
        error={state.status === "error" ? state.fieldError : undefined}
      >
        {(aria) => (
          <Input
            {...aria}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        )}
      </Field>
      {state.status === "error" && !state.fieldError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <SubmitButton pendingText="보내는 중…" className="w-full">
        이메일로 로그인 링크 받기
      </SubmitButton>
    </form>
  );
}
