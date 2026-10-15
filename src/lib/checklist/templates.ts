import { z } from "zod";

import itCareer from "@/content/checklists/it-career.json";
import newGrad from "@/content/checklists/new-grad.json";
import secondNewGrad from "@/content/checklists/second-new-grad.json";
import type { PersonaType } from "@/lib/db/database.types";

export const checklistTemplateSchema = z.object({
  id: z.string(),
  version: z.string(),
  last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string(),
  personas: z.array(z.enum(["new_grad", "second_new_grad", "it_career"])),
  note: z.string(),
  items: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        category: z.enum(["schedule", "documents", "visa"]),
        offset_months: z.number().int().min(-36).max(6),
        title: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .min(1),
});

export type ChecklistTemplate = z.infer<typeof checklistTemplateSchema>;
export type ChecklistCategory = ChecklistTemplate["items"][number]["category"];

/** 정적 템플릿 (AI 생성 아님, DECISIONS D10). 빌드 시 번들되며 테스트에서 스키마를 검증한다. */
export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  newGrad,
  secondNewGrad,
  itCareer,
] as ChecklistTemplate[];

export function templateForPersona(persona: PersonaType | null | undefined): ChecklistTemplate {
  return (
    CHECKLIST_TEMPLATES.find((t) => persona && t.personas.includes(persona)) ??
    CHECKLIST_TEMPLATES[0]
  );
}

export function templateById(id: string): ChecklistTemplate | undefined {
  return CHECKLIST_TEMPLATES.find((t) => t.id === id);
}

export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  schedule: "일정",
  documents: "서류",
  visa: "비자",
};

export const VISA_DISCLAIMER =
  "비자·법령 관련 내용은 일반 정보이며, 최종 확인은 출입국재류관리청과 고용주의 안내를 따르세요.";
