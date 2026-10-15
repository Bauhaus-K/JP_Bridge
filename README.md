# JP Bridge — 한→일 취업 AI 코파일럿 (MVP)

일본 취업(新卒·第二新卒·IT 경력)을 준비하는 한국 청년을 위한 **구직자 측 AI 코칭 도구**입니다.
ES 첨삭, 일본식 모의면접, 자기분석, 職務経歴書 번역, 일정·서류·비자 체크리스트를 제공합니다.

- 지원자 평가·선별·합격 예측 기능은 만들지 않습니다.
- 진행 상황: [docs/PLAN.md](docs/PLAN.md) · 결정 기록: [docs/DECISIONS.md](docs/DECISIONS.md) · 변경 내역: [docs/CHANGELOG.md](docs/CHANGELOG.md)

## 기술 스택

Next.js 16 (App Router, `src/proxy.ts`) · TypeScript · Tailwind CSS 4 · shadcn/ui 호환 컴포넌트 · Supabase (Postgres, Auth, RLS) · Anthropic SDK · zod · Vitest · Playwright

## 로컬 실행

요구 사항: Node.js 20.9+ (22 권장), Docker (Supabase 로컬 스택)

```bash
npm install
npx supabase start            # Postgres, Auth, REST, Mailpit(메일 수신함) 실행 + 마이그레이션 적용
cp .env.example .env.local    # supabase start 출력의 URL / anon key / service_role key 입력
npm run dev                   # http://localhost:3000
```

- 매직링크 메일은 로컬 Mailpit(http://127.0.0.1:54324)에서 확인합니다.
- 관리자 계정: `.env.local` 의 `ADMIN_EMAILS` 에 이메일을 넣고 로그인하면 `admin` 역할로 동기화됩니다.
- Google 로그인(선택): `supabase/config.toml` 의 `[auth.external.google] enabled = true` 와 `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` 설정.

## 환경변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ | 매직링크/OAuth 리다이렉트 기준 URL |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 서버 전용. 역할 동기화, AI 로그, 계정 삭제 |
| `ANTHROPIC_API_KEY` | MS2~ | 서버 전용 |
| `ANTHROPIC_MODEL` | | 기본 `claude-sonnet-5-5` |
| `ANTHROPIC_MODEL_FAST` | | 기본 `claude-haiku-5-5` |
| `RESEND_API_KEY`, `EMAIL_FROM` | | 이메일 발송. 비어 있으면 콘솔 로그 |
| `FEATURE_REFERRAL` | | 제휴사 리퍼럴 플래그. 기본 `false` |
| `ADMIN_EMAILS` | | 쉼표로 구분한 운영자 이메일 |

비밀값은 `.env.local` 에만 두고 커밋하지 않습니다.

## 데이터베이스

- 마이그레이션: `supabase/migrations/*.sql` (모든 사용자 테이블 RLS 적용)
- 로컬 적용: `npx supabase db reset` (마이그레이션 + `supabase/seed.sql`)
- 원격 적용: `npx supabase link --project-ref <ref>` → `npx supabase db push`
- 타입 생성: `npm run db:types` (로컬 Supabase 실행 중)

## 테스트

```bash
npm run lint && npm run typecheck && npm test   # 마일스톤 완료 기준
npm run test:db     # 마이그레이션 + RLS 회귀 테스트
                    #  - 로컬 Postgres 바이너리로 임시 클러스터 생성, 또는
                    #  - TEST_DATABASE_URL=<빈 Postgres> 지정
npm run test:e2e    # Playwright. Supabase 로컬 스택 + Mailpit 필요
                    #  Anthropic API 목 서버(tests/e2e/mock-anthropic.mjs, :4010)를 함께 띄우고
                    #  앱을 ANTHROPIC_BASE_URL=http://127.0.0.1:4010 으로 실행한다 (실제 API 호출 없음)
                    #  E2E_PORT(기본 3100)에서 앱을 빌드·실행. NEXT_PUBLIC_SITE_URL 포트와 맞출 것
                    #  E2E_ADMIN_EMAIL=<ADMIN_EMAILS 중 하나> 로 관리자 시나리오 실행
                    #  PLAYWRIGHT_CHROMIUM_PATH 로 사전 설치 Chromium 지정 가능
```

AI 호출은 테스트에서 항상 mock 처리합니다: 유닛은 가짜 클라이언트 주입, E2E 는 SSE 목 서버.

## 배포 (Vercel)

1. Supabase 프로젝트 생성(리전: 서울) → `npx supabase db push` 로 마이그레이션 적용
2. Supabase Auth 설정: Site URL = 배포 도메인, Redirect URLs 에 `https://<도메인>/auth/callback` 추가, (선택) Google provider 활성화
3. Vercel 에 저장소 연결 → 위 환경변수 등록(`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` 는 서버 전용)
4. 배포 후 `ADMIN_EMAILS` 계정으로 로그인해 `/admin` 접근 확인

## 디렉터리

```
src/app            라우트 ((marketing), (auth), (setup), (app), admin, auth/*)
src/components     ui/, layout/, ai/
src/lib            env, flags, ai/(client·runner·prompts·schemas), es/, text/, pii/, auth/, db/, validation/, content/ (payments/ 는 MS6)
src/content        legal/*.md, (checklists/*.json — MS5)
supabase           config.toml, migrations/, tests/
tests              unit/ (Vitest), e2e/ (Playwright)
docs               PLAN, DECISIONS, CHANGELOG
```
