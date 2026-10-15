import { z } from "zod";

export const QUESTION_TYPE_OPTIONS = [
  { value: "self_pr", label: "自己PR (자기 PR)" },
  { value: "gakuchika", label: "ガクチカ (학창 시절 가장 힘쓴 일)" },
  { value: "shiboudouki", label: "志望動機 (지원 동기)" },
  { value: "free", label: "자유 문항" },
] as const;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => v || null);

export const esDocumentSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(60, "60자 이내로 입력해 주세요."),
  questionType: z.enum(["self_pr", "gakuchika", "shiboudouki", "free"], {
    error: "문항 유형을 선택해 주세요.",
  }),
  company: optionalText(60, "기업명은 60자 이내로 입력해 주세요."),
  questionText: optionalText(300, "문항은 300자 이내로 입력해 주세요."),
  charLimit: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 50 && v <= 5000),
      "글자 수 제한은 50~5000 사이의 정수로 입력해 주세요.",
    ),
});

export type EsDocumentInput = z.infer<typeof esDocumentSchema>;

export function esDocumentFormToObject(form: FormData) {
  return {
    title: String(form.get("title") ?? ""),
    questionType: String(form.get("questionType") ?? "") || undefined,
    company: String(form.get("company") ?? ""),
    questionText: String(form.get("questionText") ?? ""),
    charLimit: String(form.get("charLimit") ?? ""),
  };
}
