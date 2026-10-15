"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { JLPT_OPTIONS, PERSONA_OPTIONS, ROLE_PRESETS } from "@/lib/validation/onboarding";
import { saveOnboarding, type OnboardingState, type OnboardingValues } from "./actions";

type Props = {
  initial: OnboardingValues;
  isFirst: boolean;
  minMonth: string;
  maxMonth: string;
};

export function OnboardingForm({ initial, isFirst, minMonth, maxMonth }: Props) {
  const [state, action] = useActionState<OnboardingState, FormData>(saveOnboarding, {});
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};
  const [persona, setPersona] = useState<string>(String(values.personaType ?? ""));

  const presetSet = new Set<string>(ROLE_PRESETS);
  const customRole = values.desiredRoles.find((r) => !presetSet.has(r)) ?? "";

  return (
    <form action={action} className="grid gap-6" noValidate>
      {state.message ? <Alert variant="destructive">{state.message}</Alert> : null}

      <Field id="displayName" label="이름(닉네임)" required error={errors.displayName}>
        {(aria) => (
          <Input
            {...aria}
            name="displayName"
            autoComplete="nickname"
            maxLength={40}
            defaultValue={values.displayName}
          />
        )}
      </Field>

      <fieldset
        className="grid gap-3"
        aria-describedby={errors.personaType ? "personaType-error" : undefined}
      >
        <legend className="text-sm font-medium">
          준비 유형
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        </legend>
        <div className="grid gap-2">
          {PERSONA_OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
            >
              <input
                type="radio"
                name="personaType"
                value={o.value}
                defaultChecked={values.personaType === o.value}
                onChange={(e) => setPersona(e.target.value)}
                className="size-4 accent-primary"
              />
              {o.label}
            </label>
          ))}
        </div>
        {errors.personaType ? (
          <p id="personaType-error" className="text-sm text-destructive">
            {errors.personaType}
          </p>
        ) : null}
      </fieldset>

      <Field id="jlptLevel" label="일본어 수준 (JLPT)" required error={errors.jlptLevel}>
        {(aria) => (
          <Select {...aria} name="jlptLevel" defaultValue={String(values.jlptLevel ?? "")}>
            <option value="" disabled>
              선택하세요
            </option>
            {JLPT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {persona === "new_grad" ? (
        <Field id="graduationMonth" label="졸업 (예정) 월" required error={errors.graduationMonth}>
          {(aria) => (
            <Input
              {...aria}
              name="graduationMonth"
              type="month"
              defaultValue={values.graduationMonth}
            />
          )}
        </Field>
      ) : persona ? (
        <Field
          id="careerYears"
          label="경력 연차 (년)"
          required
          hint="인턴을 제외한 정규·계약직 경력 기준으로 입력하세요. 1년 미만은 0."
          error={errors.careerYears}
        >
          {(aria) => (
            <Input
              {...aria}
              name="careerYears"
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              defaultValue={values.careerYears}
            />
          )}
        </Field>
      ) : null}

      <Field
        id="targetStartMonth"
        label="목표 입사 시기"
        required
        hint="일정 체크리스트가 이 시기를 기준으로 만들어집니다."
        error={errors.targetStartMonth}
      >
        {(aria) => (
          <Input
            {...aria}
            name="targetStartMonth"
            type="month"
            min={minMonth}
            max={maxMonth}
            defaultValue={values.targetStartMonth}
          />
        )}
      </Field>

      <fieldset
        className="grid gap-3"
        aria-describedby={errors.desiredRoles ? "desiredRoles-error" : undefined}
      >
        <legend className="text-sm font-medium">
          희망 직종
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
          <span className="ml-2 font-normal text-muted-foreground">(복수 선택)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {ROLE_PRESETS.map((r) => (
            <label
              key={r}
              className="cursor-pointer rounded-full border bg-card px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
            >
              <input
                type="checkbox"
                name="desiredRoles"
                value={r}
                defaultChecked={values.desiredRoles.includes(r)}
                className="sr-only"
              />
              {r}
            </label>
          ))}
        </div>
        <div className="grid gap-2">
          <label htmlFor="customRole" className="text-sm text-muted-foreground">
            직접 입력 (선택)
          </label>
          <Input id="customRole" name="customRole" maxLength={40} defaultValue={customRole} />
        </div>
        {errors.desiredRoles ? (
          <p id="desiredRoles-error" className="text-sm text-destructive">
            {errors.desiredRoles}
          </p>
        ) : null}
      </fieldset>

      <section
        aria-labelledby="ai-notice-heading"
        className="grid gap-3 rounded-lg border bg-muted/50 p-4"
      >
        <h2 id="ai-notice-heading" className="text-sm font-semibold">
          AI 활용 안내
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            입력하신 ES·경력·면접 답변은 코칭 결과를 만들기 위해 AI(Anthropic API)로 전송됩니다.
          </li>
          <li>
            AI는 지원자를 평가하거나 합격을 예측하지 않으며, 결과는 참고용 코칭입니다. 최종 판단은
            본인이 합니다.
          </li>
          <li>주민등록번호·여권번호·계좌번호 등은 입력하지 마세요.</li>
        </ul>
        <a
          href="/legal/ai-notice"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          AI 활용 안내 전문 보기 (새 창)
        </a>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="aiNoticeAck"
            defaultChecked={values.aiNoticeAck}
            aria-invalid={errors.aiNoticeAck ? true : undefined}
            aria-describedby={errors.aiNoticeAck ? "aiNoticeAck-error" : undefined}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            위 내용을 확인했습니다.
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          </span>
        </label>
        {errors.aiNoticeAck ? (
          <p id="aiNoticeAck-error" className="text-sm text-destructive">
            {errors.aiNoticeAck}
          </p>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="allowTrainingUse"
            defaultChecked={values.allowTrainingUse}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            (선택) 서비스 품질 개선을 위해 내 입력 원문을 활용하는 데 동의합니다. 동의하지 않아도
            모든 기능을 이용할 수 있으며, 설정에서 언제든 바꿀 수 있습니다.
          </span>
        </label>
      </section>

      <SubmitButton size="lg" pendingText="저장 중…">
        {isFirst ? "시작하기" : "저장"}
      </SubmitButton>
    </form>
  );
}
