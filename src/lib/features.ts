import type { LucideIcon } from "lucide-react";
import { ClipboardList, FileText, Home, Languages, MessagesSquare, Sparkles } from "lucide-react";

export type FeatureKey = "dashboard" | "es" | "analysis" | "interview" | "career" | "checklist";

export type Feature = {
  key: FeatureKey;
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** 해당 기능이 제공되는 마일스톤. 아직이면 UI 에서 '준비 중'으로 표시한다. */
  available: boolean;
  /** 모바일 하단 탭 노출 여부 (최대 5개) */
  mobileTab: boolean;
};

export const FEATURES: Feature[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    label: "대시보드",
    shortLabel: "홈",
    description: "진행 상황과 마감 임박 항목",
    icon: Home,
    available: true,
    mobileTab: true,
  },
  {
    key: "es",
    href: "/es",
    label: "ES 첨삭",
    shortLabel: "ES",
    description: "自己PR・ガクチカ・志望動機 작성과 AI 첨삭",
    icon: FileText,
    available: true,
    mobileTab: true,
  },
  {
    key: "analysis",
    href: "/analysis",
    label: "자기분석",
    shortLabel: "자기분석",
    description: "대화로 에피소드를 모아 강점 카드로 정리",
    icon: Sparkles,
    available: true,
    mobileTab: true,
  },
  {
    key: "interview",
    href: "/interview",
    label: "모의면접",
    shortLabel: "면접",
    description: "일본식 면접 질문과 경어·논리 피드백",
    icon: MessagesSquare,
    available: true,
    mobileTab: true,
  },
  {
    key: "career",
    href: "/career",
    label: "경력 번역",
    shortLabel: "경력",
    description: "한국식 경력을 職務経歴書 표현으로",
    icon: Languages,
    available: true,
    mobileTab: false,
  },
  {
    key: "checklist",
    href: "/checklist",
    label: "체크리스트",
    shortLabel: "체크",
    description: "일정·서류·비자 준비 항목",
    icon: ClipboardList,
    available: true,
    mobileTab: true,
  },
];
