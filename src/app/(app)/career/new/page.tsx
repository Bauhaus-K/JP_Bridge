import type { Metadata } from "next";

import { CareerForm } from "./career-form";

export const metadata: Metadata = { title: "새 경력 번역" };

export default function NewCareerPage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold">새 경력 번역</h1>
        <p className="mt-1 text-muted-foreground">
          회사·기간·직급·담당 업무·성과를 한국어로 적어 주세요. 쓰지 않은 성과나 수치는 추가하지
          않습니다.
        </p>
      </div>
      <CareerForm />
    </div>
  );
}
