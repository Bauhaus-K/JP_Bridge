import { z } from "zod";

export const PERSONA_OPTIONS = [
  { value: "new_grad", label: "新卒 (졸업 예정·졸업 1년 이내)" },
  { value: "second_new_grad", label: "第二新卒 (경력 1~3년, 직무 전환 포함)" },
  { value: "it_career", label: "IT 경력직 (中途採用)" },
] as const;

export const JLPT_OPTIONS = [
  { value: "N1", label: "N1" },
  { value: "N2", label: "N2" },
  { value: "N3", label: "N3" },
  { value: "N4", label: "N4" },
  { value: "N5", label: "N5" },
  { value: "none", label: "없음 / 준비 중" },
] as const;

export const ROLE_PRESETS = [
  "ソフトウェアエンジニア (개발)",
  "インフラ・クラウド (인프라)",
  "データ・AI (데이터)",
  "総合職 (종합직)",
  "商社・営業 (상사·영업)",
  "マーケティング (마케팅)",
  "企画・コンサル (기획·컨설팅)",
  "その他 (기타)",
] as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "YYYY-MM" → "YYYY-MM-01" */
export function monthToDate(month: string): string {
  return `${month}-01`;
}

/** "YYYY-MM-DD" → "YYYY-MM" (month input 기본값용) */
export function dateToMonth(date: string | null | undefined): string {
  return date ? date.slice(0, 7) : "";
}

function monthIndex(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function buildOnboardingSchema(now: Date = new Date()) {
  const currentMonth = now.getFullYear() * 12 + now.getMonth();

  return z
    .object({
      displayName: z
        .string()
        .trim()
        .min(1, "이름(닉네임)을 입력해 주세요.")
        .max(40, "40자 이내로 입력해 주세요."),
      personaType: z.enum(["new_grad", "second_new_grad", "it_career"], {
        error: "준비 유형을 선택해 주세요.",
      }),
      jlptLevel: z.enum(["N1", "N2", "N3", "N4", "N5", "none"], {
        error: "일본어 수준을 선택해 주세요.",
      }),
      graduationMonth: z
        .string()
        .trim()
        .optional()
        .transform((v) => v || undefined)
        .refine(
          (v) => v === undefined || MONTH_RE.test(v),
          "졸업 (예정) 월 형식이 올바르지 않습니다.",
        ),
      careerYears: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? Number(v) : undefined))
        .refine(
          (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 50),
          "경력 연차는 0~50 사이의 정수로 입력해 주세요.",
        ),
      targetStartMonth: z
        .string()
        .trim()
        .regex(MONTH_RE, "목표 입사 시기를 선택해 주세요.")
        .refine(
          (v) => monthIndex(v) >= currentMonth && monthIndex(v) <= currentMonth + 36,
          "목표 입사 시기는 이번 달부터 3년 이내로 선택해 주세요.",
        ),
      desiredRoles: z
        .array(z.string().trim().min(1).max(40))
        .min(1, "희망 직종을 하나 이상 선택해 주세요.")
        .max(10, "희망 직종은 최대 10개까지 선택할 수 있습니다.")
        .transform((roles) => Array.from(new Set(roles))),
      aiNoticeAck: z.literal(true, { error: "AI 활용 안내를 확인해 주세요." }),
      allowTrainingUse: z.boolean().default(false),
    })
    .superRefine((v, ctx) => {
      if (v.personaType === "new_grad" && !v.graduationMonth) {
        ctx.addIssue({
          code: "custom",
          path: ["graduationMonth"],
          message: "졸업 (예정) 월을 입력해 주세요.",
        });
      }
      if (v.personaType !== "new_grad" && v.careerYears === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["careerYears"],
          message: "경력 연차를 입력해 주세요.",
        });
      }
    });
}

export type OnboardingInput = z.infer<ReturnType<typeof buildOnboardingSchema>>;

/** FormData → 스키마 입력 객체 */
export function onboardingFormToObject(form: FormData) {
  const customRole = String(form.get("customRole") ?? "").trim();
  const roles = form.getAll("desiredRoles").map(String);
  if (customRole) roles.push(customRole);
  return {
    displayName: String(form.get("displayName") ?? ""),
    personaType: String(form.get("personaType") ?? "") || undefined,
    jlptLevel: String(form.get("jlptLevel") ?? "") || undefined,
    graduationMonth: String(form.get("graduationMonth") ?? ""),
    careerYears: String(form.get("careerYears") ?? ""),
    targetStartMonth: String(form.get("targetStartMonth") ?? ""),
    desiredRoles: roles,
    aiNoticeAck: form.get("aiNoticeAck") === "on",
    allowTrainingUse: form.get("allowTrainingUse") === "on",
  };
}

/** 검증된 입력 → profiles 업데이트 값 */
export function onboardingToProfileUpdate(input: OnboardingInput, now: Date = new Date()) {
  const isNewGrad = input.personaType === "new_grad";
  return {
    display_name: input.displayName,
    persona_type: input.personaType,
    jlpt_level: input.jlptLevel,
    graduation_date: isNewGrad && input.graduationMonth ? monthToDate(input.graduationMonth) : null,
    career_years: isNewGrad ? null : (input.careerYears ?? null),
    target_start: monthToDate(input.targetStartMonth),
    desired_roles: input.desiredRoles,
    allow_training_use: input.allowTrainingUse,
    ai_notice_ack_at: now.toISOString(),
  };
}
