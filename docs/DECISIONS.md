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
| D19 | 무료/유료 기본 한도 | free: AI 10회/일·3회/분·검수 **1회/월**(MS2에서 0→1, 컨시어지 체험), pro: 100회/일·10회/분·검수 4회/월, 19,900원. 일·월 경계는 한국 시간 기준 |
| D20 | 접근 차단 응답 | 비관리자의 `/admin` 접근은 403 대신 404 로 존재 자체를 숨김 |
| D21 | RLS 테스트 | pgTAP 대신 순수 SQL 단언(`supabase/tests/rls_test.sql`). 순수 Postgres + auth 셈 또는 실제 Supabase DB(트랜잭션 롤백) 양쪽에서 실행 가능 |

## MS2 결정

| ID | 결정 | 내용 |
|---|---|---|
| D22 | 구조화 출력 방식 | Sonnet 5.5 는 강제 `tool_choice`(any/tool)를 400 으로 거부하므로 tool use 대신 **structured outputs**(`output_config.format` JSON schema)를 사용. 스키마는 zod 에서 생성(SDK 가 미지원 제약 제거)하고 응답은 우리가 zod 로 다시 검증 |
| D23 | SDK 자동 파싱 미사용 | `betaZodOutputFormat()` 의 `parse` 를 넘기면 `finalMessage()` 가 스키마 불일치에서 자체 예외를 던져 재시도가 불가능해진다(E2E 로 발견). JSON schema 만 넘기고 파싱·검증·재시도는 직접 처리 |
| D24 | 재시도 정책 | 스키마 불일치·JSON 오류·`max_tokens` 잘림·추가 검증(글자 수 초과) 실패 시 직전 출력과 문제점을 대화로 이어 붙여 1회 재시도. refusal 은 재시도하지 않음. 네트워크/5xx 재시도는 SDK 기본(2회) |
| D25 | 사용량 환불 | AI 결과를 주지 못한 모든 실패(서버 혼잡, 형식 실패, refusal 등)는 일일 사용량 1회 환불(service_role 전용 RPC). 한도 초과는 모델 호출 없이 거절 |
| D26 | 거절 폴백 | `claude-sonnet-5-5`/`opus-5-5` 등 지원 모델에는 서버측 refusal 폴백(`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`)을 기본 활성화. 지원하지 않는 모델(Haiku 등)에는 보내지 않음 |
| D27 | ES 첨삭 결과 저장 | 첨삭 결과는 `source='ai'` 새 버전(내용=수정본, `ai_feedback`=코멘트·변경 이유·질문, `scores`=원본 점수, parent=첨삭한 버전)으로 **서버만** 기록. 사용자는 `user` 출처만 직접 추가 가능(위조 방지). 버전 번호는 트리거가 직렬화해 부여 |
| D28 | 저장 중복 방지 | 편집 내용이 기준 버전과 같으면 새 버전을 만들지 않고 기존 버전을 재사용 |
| D29 | 진행 표시 | 첨삭 응답은 NDJSON 스트림(saved → progress(생성 글자 수) → result/error). 부분 JSON 렌더링은 하지 않음 |
| D30 | 첨삭 전후 만족도 | 첨삭 전(선택, 초안 만족도 `phase=before`)과 첨삭 후(`phase=after`, 결과 평가)를 `feedback_ratings` 에 기록 |
| D31 | effort | ES 첨삭은 `effort: medium`(Sonnet 5.5). 품질 평가 후 조정 |
| D32 | 함수 권한 | Supabase 는 public 함수에 anon/authenticated 실행 권한을 기본 부여하므로 `revoke ... from public` 만으로는 부족. 역할을 명시해 회수하고, RLS 테스트에 security definer 함수 실행 권한 허용 목록 검사를 추가 |
| D33 | AI 목 | E2E 는 Anthropic Messages API SSE 를 흉내 내는 목 서버(`tests/e2e/mock-anthropic.mjs`)에 `ANTHROPIC_BASE_URL` 로 연결. 앱 코드에는 목 분기가 없음 |
| D34 | 검수 요청 | `request_review` RPC 로만 생성(소유권·중복·월 한도 원자적 검사). 이메일 알림·처리 화면은 MS5 |

## MS3 결정

| ID | 결정 | 내용 |
|---|---|---|
| D35 | 한도 2종 | `ai`(ES 첨삭·경력 번역·카드 정리·면접 요약)와 `chat`(자기분석 대화·면접 질문/피드백)을 분리. free: ai 10/일, chat 40/일 · pro: ai 100/일, chat 300/일. chat 분당 10회 |
| D36 | 자기분석 대화 모델 | 대화 턴은 `ANTHROPIC_MODEL_FAST`(effort low)로 텍스트 스트리밍, 카드 정리는 메인 모델 구조화 출력 |
| D37 | 실패한 대화 턴 | AI 응답 실패 시 저장했던 사용자 메시지를 삭제(새 대화였다면 대화째 삭제)하고 입력창에 되돌려 재시도 가능하게 함. 사용량은 환불 |
| D38 | 카드 저장 흐름 | AI가 정리한 카드는 바로 저장하지 않고 사용자가 확인·수정·선택한 뒤 저장. 카드 내용은 한국어 STAR, 키워드는 일본어, 강점은 `日本語(한국어)` |
| D39 | ES 에피소드 참고 | ES 문서별 최대 5개 카드를 연결(`es_document_episodes`), 첨삭 프롬프트에 "본인이 등록한 사실"로만 전달 |
| D40 | 경력 번역 저장 | 변환 결과를 `career_translations.output` 에 그대로 저장, 사용자 편집본은 `output.edited_text_ja` 로 추가 저장(원본 구조 보존). 한국 직급은 일본 직급으로 단순 치환하지 않고 "代理（主任〜係長相当）"처럼 보충 + `term_notes` |
| D41 | 경량 로컬 스택 | Supabase CLI 이미지 일부를 받을 수 없는 환경을 위해 `scripts/lite-stack.sh` + `scripts/lite-gateway.mjs` 제공 (Postgres·GoTrue·PostgREST·Mailpit) |

## MS4 결정

| ID | 결정 | 내용 |
|---|---|---|
| D42 | 면접 모델·한도 | 질문 생성은 FAST 모델(effort low), 답변 피드백은 메인 모델(effort low) — 둘 다 chat 한도. 종료 리포트는 메인 모델(effort medium), ai 한도 |
| D43 | 꼬리질문 | 본질문 답변 피드백이 꼬리질문을 제안하면 1회만 추가(같은 idx, kind=followup). 꼬리질문 답변에는 꼬리질문을 만들지 않음(서버에서 강제 null) |
| D44 | 점수 없음 | 면접에는 숫자 점수·합격 판정이 없다. 피드백은 내용·경어·논리 서술 + 표현 수정 + 개선 예시 답변 |
| D45 | 공정 채용 | 국적·가족·종교·출신지 등 적성과 무관한 질문을 만들지 않도록 프롬프트에 명시 |
| D46 | 질문 메타 | 질문의 의도·답변 팁은 `interview_turns.meta` 에 저장, 사용자가 원할 때 펼쳐 봄 |
| D47 | 중간 종료 | 한 문항 이상 답하면 언제든 종료하고 리포트를 받을 수 있음 |
| D48 | 음성 확장 | `AnswerInput` 컴포넌트의 `mode`(text/voice)와 `interview_sessions.input_mode`, `interview_turns.audio_path` 로 확장 지점만 마련 |

## MS5 결정

| ID | 결정 | 내용 |
|---|---|---|
| D49 | 체크리스트 템플릿 | `src/content/checklists/{new-grad,second-new-grad,it-career}.json` 정적 관리. 항목은 목표 입사 월 기준 `offset_months`, 각 템플릿에 `version`·`last_reviewed`. 빌드 시 번들, 테스트에서 스키마·id 중복 검증 |
| D50 | 체크리스트 재생성 | 사용자당 활성 체크리스트 1개. 목표 시기·유형을 바꿔 다시 만들면 이전 것을 지우되 같은 `template_item_id` 의 완료 표시는 유지 |
| D51 | 마감 임박 | 미완료 + (지남 또는 14일 이내). 날짜는 한국 시간 기준 |
| D52 | 비자 고지 | 체크리스트 상단에 "일반 정보이며 최종 확인은 출입국재류관리청·고용주 안내를 따를 것" 상시 표시 |
| D53 | 검수 처리 | 운영자는 검수 시작(in_review) → 코멘트(필수)·ES 수정본(선택, `source=admin` 새 버전) → 완료 시 사용자에게 이메일. 이메일 실패해도 검수 완료는 유지하고 `email_log`·`notified_at` 으로 추적 |
| D54 | 이메일 | `EmailProvider` 인터페이스(Resend REST / 콘솔). 로그에는 수신 도메인만 저장. 관리자 화면의 이메일 표시는 service_role 로 auth 사용자 조회 |
| D55 | 관리자 데이터 접근 | 검수 대상 내용은 사용자 세션 RLS(admin_can_view*)로 읽어 범위를 DB가 강제. service_role 은 이메일 조회·발송 로그 등 필요한 곳에만 |

## MS6 결정

| ID | 결정 | 내용 |
|---|---|---|
| D56 | 결제 | `PaymentProvider` 인터페이스(activate/cancel) + `ManualPaymentProvider`(운영자 수동 활성화, service_role 로 subscriptions 기록). `TossPaymentProvider` 는 빌링 연동 절차를 주석으로 남긴 스텁. 사업자 계약·키 발급 후 구현 |
| D57 | 업그레이드 신청 | 사용자는 `plan_requests` 로 프로를 신청(대기 1건 제한, 직접 승인 불가, 취소 가능) → 운영자에게 이메일 → 운영자가 1/3/6/12개월 활성화(남은 기간에 이어 연장) → 사용자에게 이메일 |
| D58 | 지표 집계 | `admin_metrics()` SQL 함수(service_role 전용)가 가입·WAU·유료·주별 가입·기능별 사용량·만족도·검수·리퍼럴을 한 번에 집계. 서버가 requireAdmin 후 호출 |
| D59 | 지표 시각화 | KPI 는 스탯 타일, 유료 목표(30명)는 히어로 숫자 + 미터, 주별 가입은 단일 색 세로 막대(호버·포커스 툴팁 + 표 보기), 기능별 사용량은 표 + 인라인 막대. 차트 색 `--chart-1` 은 검증 스크립트로 라이트/다크 밝기 대역·대비 통과 값 사용 |
| D60 | WAU 정의 | 최근 7일 `events` 또는 `ai_runs` 에 기록이 있는 고유 사용자 |

## MS7 결정

| ID | 결정 | 내용 |
|---|---|---|
| D61 | 동의 기록 | 리퍼럴 생성과 동의 로그는 `record_referral_consent`(service_role 전용 SQL 함수) 한 트랜잭션으로 기록. 서버가 사용자에게 보여 준 것과 같은 함수로 문구를 다시 만들어 `text_version` + SHA-256 `text_hash` 를 저장. 제휴사 정보는 동의 시점 스냅샷(`partner_snapshot`) |
| D62 | 동의 항목 | 제3자 제공·국외 이전·내용 확인을 각각 체크(모두 필수). 문구에 제공받는 자·국가·연락처·허가번호·목적·항목·보유기간·이전 방법/시기·거부권·철회 방법 포함 (Q2) |
| D63 | 동의 폼 제출 | 공유 항목은 화면의 동의 문구와 같은 상태에서 hidden input 으로 제출하고, `onSubmit` + transition 으로 액션을 호출해 React 의 자동 폼 초기화를 피함. (초기화되면 화면 문구와 제출 항목이 어긋나는 문제를 E2E 로 발견·수정) |
| D64 | 전달 방식 | 운영자가 동의 항목만으로 만든 전달 자료(프로필·ES 최신 사용자/운영자 버전·職務経歴書)를 확인 후 이메일 발송. 전달 자료는 동의가 유효(consented/sent)할 때만 생성·표시 |
| D65 | 철회 | 사용자 철회 시 revoke 동의 로그 추가 + 상태 revoked. 이미 전달된 경우 제휴사에 삭제 요청 메일 자동 발송. 계정 삭제 시 진행 중인 리퍼럴을 먼저 모두 철회 |
| D66 | 결과 보고 | 사용자는 `report_referral_outcome` RPC 로 본인 리퍼럴 결과만 보고, 운영자는 콘솔에서 입력 (`outcome_reported_by`) |
| D67 | IP 기록 | 동의 로그의 IP 는 원문을 저장하지 않고 SHA-256 해시(앞 32자)만 저장 |
| D68 | 데이터 내보내기 | `/api/account/export`: 사용자 테이블은 RLS 로, 이벤트·AI 실행 메타데이터는 service_role 로 본인 것만 모아 JSON 다운로드 |
| D69 | 계정 삭제 | '탈퇴' 입력 확인 → 리퍼럴 철회 → `auth.admin.deleteUser` (모든 사용자 데이터 cascade, 동의 로그는 가명화 보관) → 로그아웃 |
| D70 | 보관 기한 파기 | `purge_expired_consents()`(service_role 전용)를 주기 실행 (배포 가이드에 pg_cron 예시) |
