# Changelog

## MS1 — 프로젝트 셋업, 인증, 온보딩, 대시보드 골격, DB + RLS (2026-10-15)

### 추가
- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui 호환 컴포넌트(Button, Input, Select, Card, Badge, Alert, Field 등)
- 환경변수 zod 검증(`src/lib/env.ts`), `.env.example`, 기능 플래그(`FEATURE_REFERRAL`, 기본 OFF)
- Supabase 인증: 이메일 매직링크 + Google OAuth, `/auth/callback`(PKCE·token_hash), 로그아웃, 오픈 리다이렉트 방지
- `src/proxy.ts`: 세션 갱신, 보호 경로 리다이렉트
- Data Access Layer(`requireUser` / `requireOnboarded` / `requireAdmin`), 로그인 시 `ADMIN_EMAILS` 기반 역할 동기화
- 온보딩(준비 유형, JLPT, 졸업 월/경력 연차, 목표 입사 시기, 희망 직종, AI 활용 안내 확인, 원문 활용 옵트인)
- 대시보드 골격(준비 현황, 마감 임박 자리, 코칭 도구 카드), 모바일 하단 탭 + 데스크톱 사이드바, 건너뛰기 링크
- 운영자 콘솔 골격(`/admin`, admin 외 404)
- 랜딩 페이지, 법적 문서 플레이스홀더(`/legal/{ai-notice,privacy,terms}`, "법률 검토 필요" 배너), AI 고지 컴포넌트
- DB 마이그레이션 4개: 전체 MVP 스키마(23 테이블) + RLS + 역할 보호·동의 로그 불변·가명화 트리거 + 플랜 시드
- 테스트: Vitest 유닛 32개, SQL RLS 회귀 테스트(`npm run test:db`), Playwright E2E(매직링크 가입 → 온보딩 → 대시보드, 관리자 접근)
- GitHub Actions CI (lint, typecheck, unit, RLS)
