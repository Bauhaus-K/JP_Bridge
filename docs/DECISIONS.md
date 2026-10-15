# 결정 기록 (DECISIONS)

PRD의 모호한 부분을 기본값으로 정한 내역입니다. 되돌리기 어려운 결정(Q*)은 사업자 확인을 받았습니다.

## 사업자 확인 결정 (2026-10-15 승인)

| ID | 결정 | 근거 / 영향 |
|---|---|---|
| Q1 | 리퍼럴에 수수료·정산 필드를 두지 않는다 | 유료직업소개 해당 소지 최소화. 코드는 동의·로그·철회만 구현 |
| Q2 | 리퍼럴 동의는 "제3자 제공 + 국외 이전" 동의로 설계 | 개인정보보호법 제28조의8, 일본 APPI 外国第三者提供. `consents.partner_snapshot` 에 수신자·국가·연락처 보존 |
| Q3 | 계정 삭제 시 동의 로그는 가명화해 3년 보관 후 파기 | `consents.user_id` → NULL, `subject_hash`(sha256) 유지, `retain_until` 경과 전 DELETE 차단 |
| Q4 | Supabase 리전: 서울(ap-northeast-2) | 사용자 대부분 한국 거주. 국외 이전은 리퍼럴로 한정 |

## 기술 기본값

| ID | 결정 | 내용 |
|---|---|---|
| D1 | 글자 수 계산 | grapheme 1개 = 1자, 줄바꿈 기본 제외(옵션). 반각=0.5 모드 지원 (MS2) |
| D2 | 역할 상승 방지 | `profiles.role` 은 트리거로 service_role 외 변경 불가. `ADMIN_EMAILS` 기준으로 로그인 시 양방향 동기화(목록에서 빠지면 user 로 강등) |
| D3 | 레이트리밋 저장소 | Postgres `usage_counters` + security definer RPC (MS2). 외부 Redis 미사용 |
| D4 | 스트리밍·구조화 출력 | 대화형은 텍스트 스트리밍, 첨삭·번역은 tool use JSON → zod 검증, 실패 시 1회 재시도 (MS2) |
| D5 | 민감정보 감지 | 정규식 감지 후 경고(차단 아님) + 마스킹 선택, 서버 재검사 (MS2) |
| D6 | 면접 피드백 | 숫자 점수·합격 판정 없음. ES 점수는 "글 완성도 코칭 지표"로 표기 |
| D7 | `ai_runs` 원문 | 기본 메타데이터만. `profiles.allow_training_use` 옵트인 시에만 `raw` 저장. `raw` 컬럼은 authenticated(관리자 포함)에 SELECT 권한 없음 |
| D8 | 이메일 | `EmailProvider` 인터페이스 + Resend. 키 없으면 콘솔 로그 (MS5) |
| D9 | E2E 인증 | 로컬 Supabase + Mailpit 으로 실제 매직링크를 받아 로그인. 테스트 전용 우회 로그인 라우트는 만들지 않음 |
| D10 | 체크리스트 날짜 | 템플릿은 입사월 기준 오프셋, 날짜는 코드로 계산 (MS5) |
| D11 | 버전 비교 | 「。」「！」「？」·줄바꿈 기준 문장 분할 후 diff (MS2) |
| D12 | 폼 처리 | Server Action + `useActionState` + 서버측 zod 검증. 오류 시 입력값을 상태로 돌려줘 유지. react-hook-form 은 필요해질 때 도입 |
| D13 | Next.js 16 캐싱 | `cacheComponents`·`partialPrefetching` 비활성. 화면 대부분이 사용자별 동적 데이터라 이득보다 복잡도가 큼. 미들웨어는 Next 16 규약인 `src/proxy.ts` 사용 |
| D14 | DB 타입 | MS1 은 `src/lib/db/database.types.ts` 를 수동 작성(사용 테이블만). 로컬 Supabase 실행 시 `npm run db:types` 로 생성본 교체 |
| D15 | 폰트 | 빌드 시 외부 다운로드 없이 한·일 시스템 폰트 스택 사용 |
| D16 | 프로필 필드 | PRD 의 `grad_or_career` 를 `graduation_date`(新卒) / `career_years`(第二新卒·IT 경력)로 분리. `ai_notice_ack_at`·`onboarded_at` 추가 |
| D17 | 관리자 데이터 접근 | admin 은 프로필·운영 테이블은 읽되, ES·경력 번역·면접은 **검수 요청이 걸린 대상만** 읽기 (`admin_can_view*` 함수). 자기분석 대화는 접근 불가 |
| D18 | ES 버전 불변 | `es_versions` 는 UPDATE/DELETE 정책 없음(히스토리 보존). 사용자는 `user`/`ai` 출처만, admin 은 검수 대상 문서에 `admin` 출처만 추가 |
| D19 | 무료/유료 기본 한도 | free: AI 10회/일·3회/분·검수 0회/월, pro: 100회/일·10회/분·검수 4회/월, 19,900원 (시드값, 운영 중 조정) |
| D20 | 접근 차단 응답 | 비관리자의 `/admin` 접근은 403 대신 404 로 존재 자체를 숨김 |
| D21 | RLS 테스트 | pgTAP 대신 순수 SQL 단언(`supabase/tests/rls_test.sql`). 순수 Postgres + auth 셈 또는 실제 Supabase DB(트랜잭션 롤백) 양쪽에서 실행 가능 |
