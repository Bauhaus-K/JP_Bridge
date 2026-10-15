"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";

export type PartnerFormState = { message?: string; ok?: boolean };

const partnerSchema = z.object({
  name: z.string().trim().min(1, "회사명을 입력해 주세요.").max(100),
  country: z.string().trim().length(2).default("JP"),
  contactEmail: z.email({ error: "연락 이메일을 확인해 주세요." }),
  licenseNo: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => v || null),
  privacyContact: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
});

export async function createPartner(
  _prev: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  await requireAdmin();
  const parsed = partnerSchema.safeParse({
    name: formData.get("name"),
    country: formData.get("country") || "JP",
    contactEmail: formData.get("contactEmail"),
    licenseNo: formData.get("licenseNo") ?? undefined,
    privacyContact: formData.get("privacyContact") ?? undefined,
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("partners").insert({
    name: parsed.data.name,
    country: parsed.data.country.toUpperCase(),
    contact_email: parsed.data.contactEmail,
    license_no: parsed.data.licenseNo,
    privacy_contact: parsed.data.privacyContact,
    description: parsed.data.description,
  });
  if (error) return { message: "저장하지 못했습니다." };
  revalidatePath("/admin/partners");
  return { ok: true, message: "제휴사를 등록했습니다." };
}

export async function togglePartner(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase
    .from("partners")
    .update({ active: formData.get("active") === "true" })
    .eq("id", id.data);
  revalidatePath("/admin/partners");
}
