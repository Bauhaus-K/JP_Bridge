# Changelog

## MS3 — 자기분석 + 경력 번역 (2026-10-17)

### 추가
- 자기분석(M3): 코치와의 스트리밍 대화(한 번에 질문 하나, 날조 금지), 대화 기록, "카드로 정리"(상황·과제·행동·결과·키워드·강점 태그) → 확인·수정 후 저장, 카드 목록·직접 추가·수정·삭제
- ES 첨삭에서 참고 에피소드 선택(최대 5개) → 첨삭 프롬프트에 반영
- 경력 번역(M6): 한국어 경력 → 職務経歴書(職務要約・職務内容・活かせる経験・技術) 변환, 한국 직급·제도 용어 주석, 확인 질문, 텍스트 복사·편집 저장, 운영자 검수 요청
- AI 레이어: 텍스트 스트리밍(`createTextStreamer`), 한도 종류(ai/chat) 분리, 공통 NDJSON 응답·클라이언트 헬퍼
- 경량 로컬 스택 스크립트(`scripts/lite-stack.sh`, `scripts/lite-gateway.mjs`)
- 테스트: 유닛 87개(스키마 JSON 변환, 텍스트 스트리머, 경력 포맷, 카드 입력 등), RLS(chat 한도), E2E(자기분석→카드→ES 참고, 경력 번역·편집·검수 요청, 대화 실패 롤백)

## MS2 — AI 레이어 + ES 첨삭 (2026-10-16)

### 추가
- AI 레이어(`src/lib/ai`): Anthropic SDK 클라이언트, 모델 환경변수(`ANTHROPIC_MODEL`/`_FAST`), 구조화 출력 + zod 검증 + 1회 재시도, 스트리밍 진행 표시, 서버측 refusal 폴백, 프롬프트 캐싱, `ai_runs` 기록(기능·프롬프트 버전·토큰·지연·상태, 원문은 옵트인 시에만), 한국어 오류 메시지
- 사용 한도: `consume_ai_quota`(일/분, 플랜별·한국 시간 기준), 실패 시 환불, `my_quota_status`, 화면 표시
- ES 첨삭(M4): 문서 생성(문항 유형·기업·문항·글자 수 제한), 에디터(실시간 글자 수·90% 가이드·민감정보 경고/마스킹), AI 첨삭(종합 코멘트, 4개 항목 점수, 수정본, 문장별 수정 이유, 되묻는 질문), 수정본 적용·저장, 버전 히스토리, 문장 단위 버전 비교, 첨삭 전후 만족도, 운영자 검수 요청(월 한도)
- 프롬프트 `es-review@2026-10-16.1`: 역할·사실 날조 금지·합격 보장 금지·경어·貴社/御社·좋은 예/나쁜 예
- 유틸: 글자 수(grapheme, 반각 0.5 옵션), 문장 분할, 문장/글자 diff, 민감정보 감지(주민번호·여권·카드(Luhn)·계좌)·마스킹, NDJSON 리더
- 테스트: 유닛 73개(러너 재시도·환불·한도·오류 분류 포함), RLS 테스트 확장(한도·환불 권한·버전 번호·검수 한도·함수 권한 허용 목록), E2E(가입→ES 작성→첨삭→적용·저장→버전 비교→검수 요청, 서버 혼잡·형식 오류 재시도), Anthropic API 목 서버

### 수정
- `refund_ai_quota` 등 security definer 함수가 기본 권한으로 authenticated 에 노출되던 문제 (출시 전 테스트에서 발견)
- SDK 자동 파싱 때문에 형식 오류 시 재시도가 동작하지 않던 문제 (E2E 에서 발견)

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
