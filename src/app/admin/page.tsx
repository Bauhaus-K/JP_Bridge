import type { Metadata } from "next";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "운영자 콘솔" };

const SECTIONS = [
  { title: "검수 요청 큐", description: "ES·경력 번역 검수 요청 처리", milestone: "MS5" },
  { title: "사용자·플랜", description: "사용자 목록, 유료 플랜 수동 활성화", milestone: "MS6" },
  { title: "지표", description: "가입·활성·유료·기능별 사용량·만족도", milestone: "MS6" },
  { title: "제휴사·리퍼럴", description: "제휴사 관리, 동의 기반 전달 처리", milestone: "MS7" },
];

export default function AdminHomePage() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">운영자 콘솔</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.title}>
            <Card className="h-full opacity-80">
              <CardHeader>
                <CardTitle as="h2">{s.title}</CardTitle>
                <CardDescription>
                  {s.description} · {s.milestone}에서 제공
                </CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
