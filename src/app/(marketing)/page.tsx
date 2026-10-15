import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { AiDisclaimer } from "@/components/ai/ai-disclaimer";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { visibleFeatures } from "@/lib/features";

const PRINCIPLES = [
  "지원자를 평가하거나 합격을 예측하지 않습니다. 오직 본인의 준비를 돕습니다.",
  "입력하지 않은 경험·수치를 지어내지 않습니다. 부족하면 되묻습니다.",
  "일본어 본문과 한국어 해설을 함께 보여드립니다.",
  "필요할 때 운영자가 직접 검수합니다.",
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  const features = visibleFeatures({ referral: false }).filter((f) => f.key !== "dashboard");
  return (
    <div className="mx-auto max-w-5xl px-4">
      {deleted ? (
        <p role="status" className="mt-6 rounded-lg border bg-card p-4 text-sm">
          계정과 데이터가 삭제되었습니다. 그동안 이용해 주셔서 감사합니다.
        </p>
      ) : null}
      <section className="py-14 sm:py-20">
        <p className="text-sm font-medium text-primary">新卒・第二新卒・IT 경력 일본 취업</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          한국에서의 경험을,
          <br />
          일본 기업이 읽는 언어로.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          JP Bridge는 일본 취업을 준비하는 한국 청년을 위한 AI 코칭 도구입니다. ES 첨삭부터 일본식
          모의면접, 자기분석, 職務経歴書 번역, 일정·비자 체크리스트까지 한 곳에서 준비하세요.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            무료로 시작하기
          </Link>
          <Link
            href="/legal/ai-notice"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            AI 활용 방식 보기
          </Link>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="pb-14">
        <h2 id="features-heading" className="text-xl font-semibold">
          무엇을 도와드리나요
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.key}>
                <Card className="h-full">
                  <CardHeader>
                    <Icon aria-hidden="true" className="size-5 text-primary" />
                    <CardTitle>{f.label}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="principles-heading" className="pb-16">
        <h2 id="principles-heading" className="text-xl font-semibold">
          우리가 지키는 원칙
        </h2>
        <ul className="mt-5 grid gap-3">
          {PRINCIPLES.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <AiDisclaimer className="mt-6" />
      </section>
    </div>
  );
}
