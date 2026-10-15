import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuotaBadge } from "@/components/es/quota-badge";
import { CHAT_OPENING_MESSAGE } from "@/lib/ai/prompts/self-analysis";
import { loadMessages } from "@/lib/analysis/service";
import { createClient } from "@/lib/db/server";
import { getQuotaStatus } from "@/lib/es/queries";
import { ChatClient } from "./chat-client";

export const metadata: Metadata = { title: "자기분석 대화" };

export default async function AnalysisChatPage({ searchParams }: PageProps<"/analysis/chat">) {
  const { c } = await searchParams;
  const conversationId = typeof c === "string" ? c : null;
  let messages = [{ role: "assistant" as const, content: CHAT_OPENING_MESSAGE }];
  if (conversationId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("analysis_conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!data) notFound();
    messages = (await loadMessages(conversationId)) as typeof messages;
  }
  const quota = await getQuotaStatus();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/analysis"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          자기분석
        </Link>
        <QuotaBadge quota={quota} kind="chat" />
      </div>
      <h1 className="sr-only">자기분석 대화</h1>
      <ChatClient
        key={conversationId ?? "new"}
        initialConversationId={conversationId}
        initialMessages={messages}
      />
    </div>
  );
}
