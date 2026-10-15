import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { requireOnboarded } from "@/lib/auth/session";
import { getActiveChecklist } from "@/lib/checklist/queries";
import { todayKst } from "@/lib/checklist/schedule";
import {
  CHECKLIST_TEMPLATES,
  templateById,
  templateForPersona,
  VISA_DISCLAIMER,
} from "@/lib/checklist/templates";
import { formatYearMonthKo } from "@/lib/dates";
import { dateToMonth } from "@/lib/validation/onboarding";
import { ChecklistForm } from "./checklist-form";
import { ChecklistItems } from "./checklist-items";

export const metadata: Metadata = { title: "체크리스트" };

export default async function ChecklistPage() {
  const { profile } = await requireOnboarded();
  const data = await getActiveChecklist();
  const template = data
    ? templateById(data.checklist.template_id)
    : templateForPersona(profile.persona_type);
  const options = CHECKLIST_TEMPLATES.map((t) => ({ id: t.id, title: t.title }));

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">일정·서류·비자 체크리스트</h1>
        <p className="text-muted-foreground">
          목표 입사 시기에서 거꾸로 계산한 준비 항목입니다. 완료한 항목을 체크하세요.
        </p>
      </div>
      <Alert variant="warning">{VISA_DISCLAIMER}</Alert>

      {data && template ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
            <div className="grid gap-1">
              <p className="font-medium">{template.title}</p>
              <p className="text-muted-foreground">
                목표 입사 {formatYearMonthKo(data.checklist.target_start)} · 내용 검토일{" "}
                {template.last_reviewed}
              </p>
              <p className="text-xs text-muted-foreground">{template.note}</p>
            </div>
            <details className="w-full sm:w-auto">
              <summary className="cursor-pointer text-primary">
                목표 시기·유형 바꿔서 다시 만들기
              </summary>
              <div className="mt-3">
                <ChecklistForm
                  options={options}
                  defaultTemplateId={data.checklist.template_id}
                  defaultMonth={dateToMonth(data.checklist.target_start)}
                  submitLabel="다시 만들기 (완료 표시는 유지)"
                />
              </div>
            </details>
          </div>
          <ChecklistItems items={data.items} today={todayKst()} />
        </>
      ) : (
        <section
          aria-labelledby="create-heading"
          className="grid max-w-md gap-3 rounded-xl border bg-card p-4"
        >
          <h2 id="create-heading" className="font-semibold">
            체크리스트 만들기
          </h2>
          <ChecklistForm
            options={options}
            defaultTemplateId={templateForPersona(profile.persona_type).id}
            defaultMonth={dateToMonth(profile.target_start)}
            submitLabel="만들기"
          />
        </section>
      )}
    </div>
  );
}
