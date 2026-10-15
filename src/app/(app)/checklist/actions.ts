"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { trackEvent } from "@/lib/analytics";
import { requireOnboarded } from "@/lib/auth/session";
import { buildChecklistItems } from "@/lib/checklist/schedule";
import { templateById } from "@/lib/checklist/templates";
import { createClient } from "@/lib/db/server";
import { monthToDate } from "@/lib/validation/onboarding";

export type ChecklistActionState = { message?: string };

const createSchema = z.object({
  templateId: z.string(),
  targetStartMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "목표 입사 월을 선택해 주세요."),
});

/** 체크리스트 생성(또는 다시 만들기). 같은 항목의 완료 표시는 유지한다. */
export async function createChecklist(
  _prev: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  await requireOnboarded();
  const parsed = createSchema.safeParse({
    templateId: formData.get("templateId"),
    targetStartMonth: formData.get("targetStartMonth"),
  });
  if (!parsed.success)
    return { message: parsed.error.issues[0]?.message ?? "입력 내용을 확인해 주세요." };
  const template = templateById(parsed.data.templateId);
  if (!template) return { message: "템플릿을 찾을 수 없습니다." };

  const supabase = await createClient();
  const { data: previous } = await supabase.from("checklists").select("id");
  const prevIds = (previous ?? []).map((p) => p.id);
  const doneIds = new Set<string>();
  if (prevIds.length) {
    const { data: doneItems } = await supabase
      .from("checklist_items")
      .select("template_item_id, done_at")
      .in("checklist_id", prevIds)
      .not("done_at", "is", null);
    (doneItems ?? []).forEach((i) => doneIds.add(i.template_item_id));
  }

  const targetStart = monthToDate(parsed.data.targetStartMonth);
  const { data: checklist, error } = await supabase
    .from("checklists")
    .insert({
      template_id: template.id,
      template_version: template.version,
      target_start: targetStart,
    })
    .select("id")
    .single();
  if (error || !checklist) return { message: "체크리스트를 만들지 못했습니다." };

  const now = new Date().toISOString();
  const { error: itemsError } = await supabase.from("checklist_items").insert(
    buildChecklistItems(template, targetStart).map((item) => ({
      ...item,
      checklist_id: checklist.id,
      done_at: doneIds.has(item.template_item_id) ? now : null,
    })),
  );
  if (itemsError) {
    await supabase.from("checklists").delete().eq("id", checklist.id);
    return { message: "체크리스트 항목을 만들지 못했습니다." };
  }
  if (prevIds.length) await supabase.from("checklists").delete().in("id", prevIds);
  await trackEvent(prevIds.length ? "checklist.regenerated" : "checklist.created", {
    template: template.id,
  });
  revalidatePath("/checklist");
  revalidatePath("/dashboard");
  return {};
}

export async function toggleChecklistItem(itemId: string, done: boolean): Promise<{ ok: boolean }> {
  await requireOnboarded();
  const id = z.uuid().safeParse(itemId);
  if (!id.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_items")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id.data);
  if (error) return { ok: false };
  if (done) await trackEvent("checklist.item_done");
  revalidatePath("/dashboard");
  return { ok: true };
}
