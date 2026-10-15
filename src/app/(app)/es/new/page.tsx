import type { Metadata } from "next";

import { NewEsForm } from "./new-es-form";

export const metadata: Metadata = { title: "새 ES" };

export default function NewEsPage() {
  return (
    <div className="grid max-w-xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold">새 ES 만들기</h1>
        <p className="mt-1 text-muted-foreground">
          문항 정보를 알려주시면 기업·문항에 맞춰 첨삭합니다.
        </p>
      </div>
      <NewEsForm />
    </div>
  );
}
