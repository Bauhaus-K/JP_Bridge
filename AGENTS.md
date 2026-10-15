<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (JP Bridge)

- PRD 기반 MVP. 진행/결정은 `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`에 기록한다.
- 마일스톤 완료 기준: `npm run lint && npm run typecheck && npm test` + `npm run test:db` 통과.
- 사용자 데이터 테이블은 모두 RLS. 새 테이블/정책은 `supabase/tests/rls_test.sql`에 단언을 추가한다.
- 평가·선별·합격 예측 기능 금지. 모든 AI 결과 화면에 `<AiDisclaimer />`.
- UI 문구는 한국어, AI 산출물은 일본어 + 한국어 해설.
