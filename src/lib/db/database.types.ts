// Supabase 스키마 타입.
// 로컬 Supabase 가 실행 중이면 `npm run db:types` 로 재생성한다.
// MS1 에서는 CLI 없이 작성했으므로, 앱이 사용하는 테이블만 수동으로 정의한다. (DECISIONS D14)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PersonaType = "new_grad" | "second_new_grad" | "it_career";
export type JlptLevel = "N1" | "N2" | "N3" | "N4" | "N5" | "none";
export type UserRole = "user" | "admin";
export type EsQuestionType = "self_pr" | "gakuchika" | "shiboudouki" | "free";
export type ContentSource = "user" | "ai" | "admin";
export type ReviewTargetType = "es_version" | "career_translation" | "interview_session";
export type ReviewStatus = "pending" | "in_review" | "done" | "cancelled";
export type AiRunStatus = "success" | "validation_error" | "api_error" | "quota_exceeded";

export type QuotaResult = {
  allowed: boolean;
  reason: "minute" | "day" | null;
  plan: string;
  day_limit: number;
  day_used: number;
};

export type QuotaStatus = {
  plan: string;
  plan_name: string;
  day_limit: number;
  day_used: number;
  chat_limit: number;
  chat_used: number;
  review_limit: number;
  review_used: number;
};

export type RequestReviewResult = {
  ok: boolean;
  reason: "limit" | "not_found" | "duplicate" | null;
  id?: string;
  limit?: number;
  used?: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          persona_type: PersonaType | null;
          jlpt_level: JlptLevel | null;
          graduation_date: string | null;
          career_years: number | null;
          target_start: string | null;
          desired_roles: string[];
          role: UserRole;
          allow_training_use: boolean;
          ai_notice_ack_at: string | null;
          onboarded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          persona_type?: PersonaType | null;
          jlpt_level?: JlptLevel | null;
          graduation_date?: string | null;
          career_years?: number | null;
          target_start?: string | null;
          desired_roles?: string[];
          role?: UserRole;
          allow_training_use?: boolean;
          ai_notice_ack_at?: string | null;
          onboarded_at?: string | null;
        };
        Update: {
          display_name?: string | null;
          persona_type?: PersonaType | null;
          jlpt_level?: JlptLevel | null;
          graduation_date?: string | null;
          career_years?: number | null;
          target_start?: string | null;
          desired_roles?: string[];
          role?: UserRole;
          allow_training_use?: boolean;
          ai_notice_ack_at?: string | null;
          onboarded_at?: string | null;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          code: string;
          name: string;
          daily_ai_limit: number;
          per_minute_ai_limit: number;
          monthly_review_limit: number;
          price_krw: number;
          sort_order: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      analysis_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; user_id?: string; title?: string | null };
        Update: { title?: string | null; updated_at?: string };
        Relationships: [];
      };
      analysis_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id?: string;
          role: "user" | "assistant";
          content: string;
        };
        Update: never;
        Relationships: [];
      };
      episodes: {
        Row: {
          id: string;
          user_id: string;
          source_conversation_id: string | null;
          title: string;
          situation: string;
          task: string;
          action: string;
          result: string;
          keywords: string[];
          strengths: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          source_conversation_id?: string | null;
          title: string;
          situation?: string;
          task?: string;
          action?: string;
          result?: string;
          keywords?: string[];
          strengths?: string[];
        };
        Update: {
          title?: string;
          situation?: string;
          task?: string;
          action?: string;
          result?: string;
          keywords?: string[];
          strengths?: string[];
        };
        Relationships: [];
      };
      es_document_episodes: {
        Row: { doc_id: string; episode_id: string; user_id: string };
        Insert: { doc_id: string; episode_id: string; user_id?: string };
        Update: never;
        Relationships: [];
      };
      career_translations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          input: string;
          output: Json | null;
          source: ContentSource;
          prompt_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          title: string;
          input: string;
          output?: Json | null;
          source?: ContentSource;
          prompt_version?: string | null;
        };
        Update: { title?: string; output?: Json | null };
        Relationships: [];
      };
      es_documents: {
        Row: {
          id: string;
          user_id: string;
          company: string | null;
          question_type: EsQuestionType;
          question_text: string | null;
          char_limit: number | null;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          company?: string | null;
          question_type: EsQuestionType;
          question_text?: string | null;
          char_limit?: number | null;
          title: string;
        };
        Update: {
          company?: string | null;
          question_type?: EsQuestionType;
          question_text?: string | null;
          char_limit?: number | null;
          title?: string;
        };
        Relationships: [];
      };
      es_versions: {
        Row: {
          id: string;
          doc_id: string;
          user_id: string;
          version_no: number;
          parent_version_id: string | null;
          content: string;
          char_count: number;
          ai_feedback: Json | null;
          scores: Json | null;
          source: ContentSource;
          prompt_version: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          doc_id: string;
          /** 트리거가 문서 소유자로 채운다 */
          user_id?: string;
          /** 트리거가 자동 부여한다 */
          version_no?: number;
          parent_version_id?: string | null;
          content: string;
          char_count?: number;
          ai_feedback?: Json | null;
          scores?: Json | null;
          source?: ContentSource;
          prompt_version?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      review_requests: {
        Row: {
          id: string;
          user_id: string;
          target_type: ReviewTargetType;
          target_id: string;
          user_note: string | null;
          status: ReviewStatus;
          admin_comment: string | null;
          admin_version_id: string | null;
          reviewed_by: string | null;
          notified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          status?: ReviewStatus;
          admin_comment?: string | null;
          admin_version_id?: string | null;
          reviewed_by?: string | null;
          notified_at?: string | null;
        };
        Relationships: [];
      };
      feedback_ratings: {
        Row: {
          id: string;
          user_id: string;
          feature: string;
          target_id: string | null;
          phase: "before" | "after";
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          feature: string;
          target_id?: string | null;
          phase?: "before" | "after";
          rating: number;
          comment?: string | null;
        };
        Update: { rating?: number; comment?: string | null };
        Relationships: [];
      };
      ai_runs: {
        Row: {
          id: string;
          user_id: string | null;
          feature: string;
          model: string;
          prompt_version: string;
          input_tokens: number | null;
          output_tokens: number | null;
          latency_ms: number | null;
          status: AiRunStatus;
          error_code: string | null;
          attempt: number;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          feature: string;
          model: string;
          prompt_version: string;
          input_tokens?: number | null;
          output_tokens?: number | null;
          latency_ms?: number | null;
          status: AiRunStatus;
          error_code?: string | null;
          attempt?: number;
          raw?: Json | null;
        };
        Update: never;
        Relationships: [];
      };
      events: {
        Row: {
          id: number;
          user_id: string | null;
          name: string;
          props: Json;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          name: string;
          props?: Json;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      consume_ai_quota: { Args: { p_kind?: "ai" | "chat" }; Returns: QuotaResult };
      refund_ai_quota: { Args: { p_user: string; p_kind?: "ai" | "chat" }; Returns: undefined };
      my_quota_status: { Args: Record<string, never>; Returns: QuotaStatus };
      request_review: {
        Args: { p_target_type: ReviewTargetType; p_target_id: string; p_note?: string | null };
        Returns: RequestReviewResult;
      };
    };
    Enums: {
      persona_type: PersonaType;
      jlpt_level: JlptLevel;
      user_role: UserRole;
      es_question_type: EsQuestionType;
      content_source: ContentSource;
      review_target_type: ReviewTargetType;
      review_status: ReviewStatus;
      ai_run_status: AiRunStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type EsDocument = Database["public"]["Tables"]["es_documents"]["Row"];
export type EsVersion = Database["public"]["Tables"]["es_versions"]["Row"];
export type ReviewRequest = Database["public"]["Tables"]["review_requests"]["Row"];
export type Episode = Database["public"]["Tables"]["episodes"]["Row"];
export type CareerTranslationRow = Database["public"]["Tables"]["career_translations"]["Row"];
