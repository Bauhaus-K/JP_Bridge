import { z } from "zod";

const booleanFlag = z
  .string()
  .optional()
  .transform((v) => ["1", "true", "on", "yes"].includes((v ?? "").trim().toLowerCase()));

const emailList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
  ANTHROPIC_MODEL_FAST: z.string().min(1).default("claude-haiku-5-5"),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default("JP Bridge <noreply@example.com>"),
  FEATURE_REFERRAL: booleanFlag,
  ADMIN_EMAILS: emailList,
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

/** 빈 문자열은 미설정으로 취급한다 (.env 템플릿의 `KEY=` 대응). */
function blankToUndefined(source: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]));
}

function formatIssues(error: z.ZodError) {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicSchema.safeParse(blankToUndefined(source));
  if (!result.success) {
    throw new Error(`공개 환경변수 설정 오류 — ${formatIssues(result.error)}`);
  }
  return result.data;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(blankToUndefined(source));
  if (!result.success) {
    throw new Error(`서버 환경변수 설정 오류 — ${formatIssues(result.error)}`);
  }
  return result.data;
}

let publicCache: PublicEnv | undefined;
let serverCache: ServerEnv | undefined;

/** NEXT_PUBLIC_* 는 빌드 시 인라인되므로 반드시 리터럴로 참조한다. */
export function publicEnv(): PublicEnv {
  publicCache ??= parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  return publicCache;
}

/** 서버 전용. 클라이언트 컴포넌트에서 import 하지 않는다. */
export function serverEnv(): ServerEnv {
  serverCache ??= parseServerEnv(process.env);
  return serverCache;
}
