import type { Metadata } from "next";
import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { safeNextPath } from "@/lib/auth/redirect";
import { signInWithGoogle } from "./actions";
import { EmailLoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인" };

const ERROR_MESSAGES: Record<string, string> = {
  oauth: "Google 로그인을 시작하지 못했습니다. 다시 시도해 주세요.",
  callback: "로그인 링크가 만료되었거나 올바르지 않습니다. 새 링크를 요청해 주세요.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const errorKey = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.callback) : null;

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10"
    >
      <div className="flex justify-center">
        <Brand />
      </div>
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold leading-tight">로그인 / 가입</h1>
          <CardDescription>
            처음이라면 자동으로 가입됩니다. 비밀번호는 필요 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {errorMessage ? <Alert variant="destructive">{errorMessage}</Alert> : null}
          <EmailLoginForm next={next} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            또는
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <SubmitButton variant="outline" className="w-full" pendingText="Google로 이동 중…">
              Google 계정으로 계속하기
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        계속하면{" "}
        <Link href="/legal/terms" className="underline underline-offset-4">
          이용약관
        </Link>
        과{" "}
        <Link href="/legal/privacy" className="underline underline-offset-4">
          개인정보처리방침
        </Link>
        에 동의하게 됩니다. AI 기능의 동작 방식은{" "}
        <Link href="/legal/ai-notice" className="underline underline-offset-4">
          AI 활용 안내
        </Link>
        에서 확인할 수 있습니다.
      </p>
    </main>
  );
}
