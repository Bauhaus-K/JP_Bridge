import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { flags } from "@/lib/flags";
import { getShareableTitles } from "@/lib/referral/service";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "제휴사 연결 동의" };

export default async function NewReferralPage({ searchParams }: PageProps<"/referrals/new">) {
  if (!flags.referral()) notFound();
  await requireOnboarded();
  const { partner: partnerId } = await searchParams;
  if (typeof partnerId !== "string") notFound();
  const supabase = await createClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", partnerId)
    .eq("active", true)
    .maybeSingle();
  if (!partner) notFound();
  const { docs, careers } = await getShareableTitles();

  return (
    <div className="grid max-w-3xl gap-6">
      <Link
        href="/referrals"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        제휴사 연결
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{partner.name}에 정보 제공</h1>
        <p className="mt-1 text-muted-foreground">
          공유할 항목을 고르고, 아래 내용을 확인한 뒤 동의해 주세요.
        </p>
      </div>
      <ConsentForm partner={partner} docs={docs} careers={careers} />
    </div>
  );
}
