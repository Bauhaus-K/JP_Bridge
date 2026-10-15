// Supabase 스키마 타입.
// 로컬 Supabase 가 실행 중이면 `npm run db:types` 로 재생성한다.
// MS1 에서는 CLI 없이 작성했으므로, 앱이 사용하는 테이블만 수동으로 정의한다. (DECISIONS D14)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PersonaType = "new_grad" | "second_new_grad" | "it_career";
export type JlptLevel = "N1" | "N2" | "N3" | "N4" | "N5" | "none";
export type UserRole = "user" | "admin";

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
    };
    Enums: {
      persona_type: PersonaType;
      jlpt_level: JlptLevel;
      user_role: UserRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
