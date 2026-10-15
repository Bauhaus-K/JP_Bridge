# 배포 가이드 (Vercel + Supabase)

MVP 운영 환경을 처음부터 올리는 순서입니다. 각 단계 끝의 확인 항목을 통과한 뒤 다음으로 넘어가세요.

## 0. 준비물

- Supabase 계정, Vercel 계정, Anthropic API 키, (선택) Resend 계정과 발신 도메인, (선택) Google Cloud OAuth 클라이언트
- 로컬에 Node.js 20.9+ (22 권장), `npx supabase` 사용 가능

## 1. Supabase 프로젝트

1. 새 프로젝트 생성 — **리전: Northeast Asia (Seoul)** (DECISIONS Q4)
2. 로컬에서 마이그레이션 적용
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push          # supabase/migrations/*.sql 순서대로 적용
   ```
3. **Authentication → URL Configuration**
   - Site URL: `https://<배포 도메인>`
   - Redirect URLs: `https://<배포 도메인>/auth/callback` (프리뷰 배포를 쓰면 `https://*-<팀>.vercel.app/auth/callback` 도 추가)
4. **Authentication → Providers**
   - Email: 사용 (매직링크). "Confirm email" 은 매직링크 흐름에서는 기본값 유지
   - Google(선택): Google Cloud 콘솔에서 OAuth 클라이언트 생성 → 승인된 리디렉션 URI 에 `https://<project-ref>.supabase.co/auth/v1/callback` → Client ID/Secret 입력
5. **Authentication → Emails**
   - SMTP: 기본 메일 발송은 시간당 발송 수가 매우 적습니다. 운영 전 **Custom SMTP(Resend SMTP 등)** 를 반드시 설정하세요.
   - Magic Link 템플릿을 한국어로 수정 (링크는 `{{ .ConfirmationURL }}` 유지)
6. **보관 기한 지난 동의 기록 파기**(DECISIONS D70) — Database → Extensions 에서 `pg_cron` 활성화 후 SQL Editor:
   ```sql
   select cron.schedule('purge-expired-consents', '0 3 * * *', $$select public.purge_expired_consents()$$);
   ```
7. API 키 확인: Project Settings → API 에서 `URL`, `anon` 키, `service_role` 키

**확인**: Table Editor 에 `profiles`, `es_versions`, `consents` 등 테이블이 있고 모두 RLS 가 켜져 있다 (Authentication → Policies).

## 2. 이메일 (Resend, 선택이지만 운영에서는 필수)

1. 발신 도메인 추가 → DNS(SPF/DKIM) 레코드 등록 → Verified 확인
2. API 키 발급 → Vercel 환경변수 `RESEND_API_KEY`, `EMAIL_FROM="JP Bridge <noreply@<도메인>>"`
3. 키가 없으면 앱은 이메일을 실제로 보내지 않고 서버 로그에만 남깁니다 (`email_log.provider = console`)

## 3. Vercel

1. 저장소 연결 → Framework: Next.js (기본 설정 그대로, Node.js 22)
2. 환경변수 (Production / Preview 각각)

   | 이름 | 값 | 비고 |
   |---|---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://<배포 도메인>` | 매직링크·이메일 링크 기준 |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon 키 | |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | **서버 전용, 절대 NEXT_PUBLIC 접두사 금지** |
   | `ANTHROPIC_API_KEY` | Anthropic 키 | 서버 전용 |
   | `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | 기본값과 같으면 생략 가능 |
   | `ANTHROPIC_MODEL_FAST` | `claude-haiku-5-5` | |
   | `RESEND_API_KEY`, `EMAIL_FROM` | | 2단계 |
   | `ADMIN_EMAILS` | `ops@회사.com` | 쉼표 구분. 로그인 시 역할 동기화 |
   | `FEATURE_REFERRAL` | `false` | 제휴·법률 검토 완료 전까지 OFF |

   `ANTHROPIC_BASE_URL` 은 테스트 전용입니다. 운영에 설정하지 마세요.
3. 배포. AI 첨삭·면접 리포트 등 긴 요청은 Route Handler 의 `maxDuration`(120~300초)을 사용하므로, Vercel 플랜의 함수 최대 실행 시간이 이를 허용하는지 확인하세요 (Hobby 플랜은 제한이 짧을 수 있음).
4. 커스텀 도메인 연결 후 1단계의 Site URL / Redirect URLs 를 실제 도메인으로 맞춥니다.

## 4. 배포 후 점검 (스모크 테스트)

- [ ] `/` 랜딩, `/legal/privacy` 가 열린다
- [ ] 매직링크로 가입 → 온보딩 → 대시보드
- [ ] ES 첨삭 1회 → 결과 표시, Supabase `ai_runs` 에 `success` 행, 토큰 수 기록
- [ ] 자기분석 대화 1턴, 경력 번역 1회, 모의면접 질문 생성
- [ ] `ADMIN_EMAILS` 계정으로 `/admin` 접근, 일반 계정은 404
- [ ] 검수 요청 → 운영자 처리 → 사용자 이메일 수신 (`email_log.status = sent`)
- [ ] 설정 → 데이터 내보내기 JSON 다운로드
- [ ] 보안 헤더: `curl -I https://<도메인>` 에 `X-Frame-Options: DENY`, `Strict-Transport-Security` 등

## 5. 운영 메모

- **비용 모니터링**: `ai_runs` 의 `input_tokens`/`output_tokens` 를 기능별로 집계(운영자 지표 화면에 사용량, 토큰은 SQL로 확인). 이상 사용 시 `plans` 의 한도를 조정.
- **프롬프트 변경**: `src/lib/ai/prompts/*.ts` 의 `PROMPT_VERSION` 을 올리면 `ai_runs.prompt_version` 으로 전후 품질·만족도를 비교할 수 있습니다.
- **플랜 한도 변경**: `update public.plans set daily_ai_limit = ... where code = 'free';`
- **리퍼럴 활성화 전 체크**: 법률 검토(직업안정법·개인정보 국외 이전), 제휴사 계약, 동의 문구(`src/content/consent/referral.ts`) 확정 후 버전을 올리고 `FEATURE_REFERRAL=true`
- **백업**: Supabase 유료 플랜의 일일 백업/PITR 활성화 권장
- **CSP**: 현재 기본 보안 헤더만 적용. Content-Security-Policy 는 Next.js 인라인 스크립트 nonce 설정과 함께 도입 예정 (DECISIONS D73)
