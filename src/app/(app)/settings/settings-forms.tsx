"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { controlClass } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { requestPro, updatePrivacy, type SettingsState } from "./actions";

export function PrivacyForm({ allowTrainingUse }: { allowTrainingUse: boolean }) {
  const [state, action] = useActionState<SettingsState, FormData>(updatePrivacy, {});
  return (
    <form action={action} className="grid gap-2 border-t pt-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="allowTrainingUse"
          defaultChecked={allowTrainingUse}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          (선택) 서비스 품질 개선을 위해 AI 입력·출력 원문을 저장·활용하는 데 동의합니다. 동의하지
          않아도 모든 기능을 쓸 수 있습니다.
        </span>
      </label>
      {state.message ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {state.message}
        </p>
      ) : null}
      <SubmitButton size="sm" variant="outline" className="w-fit">
        저장
      </SubmitButton>
    </form>
  );
}

export function ProRequestForm() {
  const [state, action] = useActionState<SettingsState, FormData>(requestPro, {});
  return (
    <form action={action} className="grid gap-2 border-t pt-3">
      <p className="text-sm text-muted-foreground">
        현재 결제는 운영자가 확인 후 수동으로 활성화합니다. 신청하시면 결제 방법을 이메일로
        안내드립니다.
      </p>
      <label htmlFor="pro-message" className="text-sm font-medium">
        문의 사항 (선택)
      </label>
      <textarea
        id="pro-message"
        name="message"
        rows={2}
        maxLength={1000}
        className={cn(controlClass, "py-2")}
      />
      {state.message ? (
        <Alert variant={state.ok ? "info" : "destructive"}>{state.message}</Alert>
      ) : null}
      <SubmitButton className="w-fit">프로 플랜 신청</SubmitButton>
    </form>
  );
}
