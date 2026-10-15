import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/db/server";
import { flags } from "@/lib/flags";
import { togglePartner } from "./actions";
import { PartnerForm } from "./partner-form";

export const metadata: Metadata = { title: "제휴사" };

export default async function AdminPartnersPage() {
  const supabase = await createClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("*")
    .order("created_at", { ascending: false });
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">제휴사</h1>
      {!flags.referral() ? (
        <Alert variant="warning">
          FEATURE_REFERRAL 이 꺼져 있어 사용자에게는 제휴사 연결 메뉴가 보이지 않습니다.
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ul className="grid content-start gap-3">
          {(partners ?? []).map((p) => (
            <li key={p.id} className="grid gap-1 rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <Badge variant="outline">{p.country}</Badge>
                <Badge variant={p.active ? "default" : "secondary"}>
                  {p.active ? "활성" : "비활성"}
                </Badge>
                <form action={togglePartner} className="ml-auto">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value={String(!p.active)} />
                  <Button type="submit" size="sm" variant="ghost">
                    {p.active ? "비활성화" : "활성화"}
                  </Button>
                </form>
              </div>
              <p className="text-muted-foreground">
                {p.contact_email} · 허가번호 {p.license_no ?? "-"} · 개인정보 문의{" "}
                {p.privacy_contact ?? "-"}
              </p>
              {p.description ? <p>{p.description}</p> : null}
            </li>
          ))}
          {!partners?.length ? (
            <p className="text-muted-foreground">등록된 제휴사가 없습니다.</p>
          ) : null}
        </ul>
        <section
          aria-labelledby="new-partner"
          className="grid content-start gap-3 rounded-xl border bg-card p-4"
        >
          <h2 id="new-partner" className="font-semibold">
            제휴사 등록
          </h2>
          <PartnerForm />
        </section>
      </div>
    </div>
  );
}
