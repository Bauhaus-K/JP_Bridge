import "server-only";

import { modelFor } from "@/lib/ai/client";
import {
  buildFeedbackMessage,
  buildQuestionsMessage,
  buildSummaryMessage,
  FEEDBACK_PROMPT_VERSION,
  FEEDBACK_SYSTEM_PROMPT,
  QUESTIONS_PROMPT_VERSION,
  QUESTIONS_SYSTEM_PROMPT,
  SUMMARY_PROMPT_VERSION,
  SUMMARY_SYSTEM_PROMPT,
  type InterviewContext,
} from "@/lib/ai/prompts/interview";
import { runStructuredForUser } from "@/lib/ai/run";
import {
  interviewFeedbackSchema,
  interviewQuestionsSchema,
  interviewSummarySchema,
  type InterviewFeedback,
} from "@/lib/ai/schemas/interview";
import { trackEvent } from "@/lib/analytics";
import type { InterviewSession, InterviewTurn, Json, Profile } from "@/lib/db/database.types";
import { createClient } from "@/lib/db/server";
import { detectPii } from "@/lib/pii/detect";
import { PERSONA_OPTIONS } from "@/lib/validation/onboarding";
import { orderTurns } from "./turns";

export const ANSWER_MAX = 2000;

export class InterviewError extends Error {
  constructor(
    public readonly code:
      "not_found" | "empty" | "too_long" | "pii" | "save_failed" | "closed" | "answered",
    message: string,
  ) {
    super(message);
  }
}

async function buildContext(
  session: InterviewSession,
  profile: Profile,
): Promise<InterviewContext> {
  const supabase = await createClient();
  const { data: episodes } = await supabase
    .from("episodes")
    .select("title, situation, task, action, result")
    .order("updated_at", { ascending: false })
    .limit(5);
  return {
    company: session.company,
    jobRole: session.job_role,
    stage: session.stage,
    personaLabel: PERSONA_OPTIONS.find((p) => p.value === profile.persona_type)?.label,
    jlptLevel: profile.jlpt_level,
    episodes: episodes ?? [],
  };
}

export async function createInterview(params: {
  userId: string;
  profile: Profile;
  company: string | null;
  jobRole: string;
  stage: "first" | "final";
  questionCount: number;
}): Promise<string> {
  const supabase = await createClient();
  const { data: session, error } = await supabase
    .from("interview_sessions")
    .insert({
      company: params.company,
      job_role: params.jobRole,
      stage: params.stage,
      question_count: params.questionCount,
      input_mode: "text",
      prompt_version: QUESTIONS_PROMPT_VERSION,
    })
    .select("*")
    .single();
  if (error || !session) throw new InterviewError("save_failed", "면접을 시작하지 못했습니다.");

  try {
    const ctx = await buildContext(session, params.profile);
    const result = await runStructuredForUser(params.userId, {
      feature: "interview_questions",
      promptVersion: QUESTIONS_PROMPT_VERSION,
      model: modelFor("fast"),
      system: QUESTIONS_SYSTEM_PROMPT,
      userMessage: buildQuestionsMessage(ctx, params.questionCount),
      schema: interviewQuestionsSchema,
      validate: (d) =>
        d.questions.length !== params.questionCount
          ? `質問は ${params.questionCount} 個ちょうど必要です（現在 ${d.questions.length} 個）。`
          : null,
      quotaKind: "chat",
      effort: "low",
      storeRaw: params.profile.allow_training_use,
    });
    const { error: turnError } = await supabase.from("interview_turns").insert(
      result.data.questions.map((q, i) => ({
        session_id: session.id,
        idx: i + 1,
        kind: "question" as const,
        question: q.question_ja,
        meta: { intent_ko: q.intent_ko, tip_ko: q.tip_ko } as Json,
      })),
    );
    if (turnError) throw new InterviewError("save_failed", "질문을 저장하지 못했습니다.");
  } catch (e) {
    await supabase.from("interview_sessions").delete().eq("id", session.id);
    throw e;
  }
  await trackEvent("interview.started", { stage: params.stage, count: params.questionCount });
  return session.id;
}

async function loadSession(sessionId: string) {
  const supabase = await createClient();
  const [{ data: session }, { data: turns }] = await Promise.all([
    supabase.from("interview_sessions").select("*").eq("id", sessionId).maybeSingle(),
    supabase.from("interview_turns").select("*").eq("session_id", sessionId),
  ]);
  return { session, turns: orderTurns(turns ?? []) };
}

export async function answerTurn(params: {
  userId: string;
  profile: Profile;
  turnId: string;
  answer: string;
  piiConfirmed: boolean;
  onProgress?: (info: { outputChars: number; attempt: number }) => void;
  signal?: AbortSignal;
}): Promise<{ turn: InterviewTurn; followup: InterviewTurn | null }> {
  const answer = params.answer.trim();
  if (!answer) throw new InterviewError("empty", "답변을 입력해 주세요.");
  if (answer.length > ANSWER_MAX)
    throw new InterviewError("too_long", `답변은 ${ANSWER_MAX}자까지 입력할 수 있습니다.`);
  if (!params.piiConfirmed && detectPii(answer).length > 0) {
    throw new InterviewError(
      "pii",
      "민감한 개인정보로 보이는 내용이 있습니다. 지우거나 마스킹한 뒤 다시 시도해 주세요.",
    );
  }

  const supabase = await createClient();
  const { data: turn } = await supabase
    .from("interview_turns")
    .select("*")
    .eq("id", params.turnId)
    .maybeSingle();
  if (!turn) throw new InterviewError("not_found", "질문을 찾을 수 없습니다.");
  if (turn.answered_at) throw new InterviewError("answered", "이미 답변한 질문입니다.");
  const { session, turns } = await loadSession(turn.session_id);
  if (!session) throw new InterviewError("not_found", "면접을 찾을 수 없습니다.");
  if (session.status !== "active") throw new InterviewError("closed", "이미 종료된 면접입니다.");

  const isFollowup = turn.kind === "followup";
  const parent = isFollowup ? turns.find((t) => t.id === turn.parent_turn_id) : null;
  const ctx = await buildContext(session, params.profile);
  const result = await runStructuredForUser(params.userId, {
    feature: "interview_feedback",
    promptVersion: FEEDBACK_PROMPT_VERSION,
    model: modelFor("main"),
    system: FEEDBACK_SYSTEM_PROMPT,
    userMessage: buildFeedbackMessage(ctx, {
      question: turn.question,
      answer,
      isFollowup,
      parent: parent?.answer ? { question: parent.question, answer: parent.answer } : null,
    }),
    schema: interviewFeedbackSchema,
    quotaKind: "chat",
    effort: "low",
    storeRaw: params.profile.allow_training_use,
    onProgress: params.onProgress,
    signal: params.signal,
  });

  const feedback: InterviewFeedback = isFollowup
    ? { ...result.data, followup_question_ja: null }
    : result.data;
  const { data: updated, error } = await supabase
    .from("interview_turns")
    .update({
      answer,
      feedback: feedback as unknown as Json,
      answered_at: new Date().toISOString(),
    })
    .eq("id", turn.id)
    .select("*")
    .single();
  if (error || !updated) throw new InterviewError("save_failed", "답변을 저장하지 못했습니다.");

  let followup: InterviewTurn | null = null;
  const hasFollowup = turns.some((t) => t.parent_turn_id === turn.id);
  if (!isFollowup && feedback.followup_question_ja?.trim() && !hasFollowup) {
    const { data } = await supabase
      .from("interview_turns")
      .insert({
        session_id: session.id,
        idx: turn.idx,
        kind: "followup",
        parent_turn_id: turn.id,
        question: feedback.followup_question_ja.trim(),
      })
      .select("*")
      .single();
    followup = data;
  }
  await trackEvent("interview.answered", { kind: turn.kind });
  return { turn: updated, followup };
}

export async function finishInterview(params: {
  userId: string;
  profile: Profile;
  sessionId: string;
}) {
  const { session, turns } = await loadSession(params.sessionId);
  if (!session) throw new InterviewError("not_found", "면접을 찾을 수 없습니다.");
  if (session.status !== "active") throw new InterviewError("closed", "이미 종료된 면접입니다.");
  const answered = turns.filter((t) => t.answer);
  if (answered.length === 0)
    throw new InterviewError("empty", "한 문항 이상 답변한 뒤 종료할 수 있습니다.");

  const ctx = await buildContext(session, params.profile);
  const result = await runStructuredForUser(params.userId, {
    feature: "interview_summary",
    promptVersion: SUMMARY_PROMPT_VERSION,
    model: modelFor("main"),
    system: SUMMARY_SYSTEM_PROMPT,
    userMessage: buildSummaryMessage(ctx, answered),
    schema: interviewSummarySchema,
    quotaKind: "ai",
    effort: "medium",
    storeRaw: params.profile.allow_training_use,
  });
  const supabase = await createClient();
  const { error } = await supabase
    .from("interview_sessions")
    .update({ status: "completed", summary: result.data as unknown as Json })
    .eq("id", session.id);
  if (error) throw new InterviewError("save_failed", "리포트를 저장하지 못했습니다.");
  await trackEvent("interview.completed", { answered: answered.length });
}
