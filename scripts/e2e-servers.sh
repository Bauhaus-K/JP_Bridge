#!/usr/bin/env bash
# 이미 빌드된 앱(next start)과 Anthropic 목 서버를 함께 띄운다. Ctrl+C 로 둘 다 종료.
# 사용: npm run build && bash scripts/e2e-servers.sh [port]
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-3000}"
node tests/e2e/mock-anthropic.mjs &
MOCK=$!
trap 'kill $MOCK 2>/dev/null || true' EXIT
ANTHROPIC_BASE_URL=http://127.0.0.1:4010 ANTHROPIC_API_KEY=e2e-mock-key FEATURE_REFERRAL="${FEATURE_REFERRAL:-false}" \
  npx next start -p "$PORT"
