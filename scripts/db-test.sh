#!/usr/bin/env bash
# 마이그레이션 + RLS 회귀 테스트.
# - TEST_DATABASE_URL 이 있으면 그 (빈) 데이터베이스를 사용한다.
# - 없으면 로컬 Postgres 바이너리로 임시 클러스터를 띄운다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILES=("$ROOT/supabase/tests/auth_shim.sql")
for f in "$ROOT"/supabase/migrations/*.sql; do SQL_FILES+=("$f"); done
SQL_FILES+=("$ROOT/supabase/tests/rls_test.sql")

run_psql() {
  local url="$1"
  for f in "${SQL_FILES[@]}"; do
    psql "$url" -v ON_ERROR_STOP=1 -q -X -o /dev/null -f "$f"
  done
}

if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  run_psql "$TEST_DATABASE_URL"
  exit 0
fi

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "Postgres 바이너리를 찾을 수 없습니다. PG_BIN 또는 TEST_DATABASE_URL 을 지정하세요." >&2
  exit 1
fi

TMP="$(mktemp -d)"
PORT="${PG_TEST_PORT:-54329}"
AS=()
if [[ "$(id -u)" == "0" ]]; then
  chown postgres "$TMP"
  AS=(runuser -u postgres --)
fi

cleanup() {
  "${AS[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

"${AS[@]}" "$PG_BIN/initdb" -D "$TMP/data" -U postgres --auth=trust -E UTF8 >/dev/null
"${AS[@]}" "$PG_BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null

run_psql "postgresql://postgres@/postgres?host=$TMP&port=$PORT"
