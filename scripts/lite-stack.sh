#!/usr/bin/env bash
# Supabase CLI(supabase start)를 쓸 수 없는 환경(이미지 일부만 받을 수 있는 CI·컨테이너 등)용 경량 로컬 스택.
# Postgres + GoTrue(Auth) + PostgREST + Mailpit 컨테이너를 띄우고 마이그레이션을 적용한 뒤 .env.local 을 만든다.
# 게이트웨이(scripts/lite-gateway.mjs)는 별도로 실행한다:  node scripts/lite-gateway.mjs
#
# 사용:  bash scripts/lite-stack.sh up | down | migrate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NET=jpb
JWT_SECRET="${LITE_JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PG_IMAGE="${LITE_PG_IMAGE:-supabase/postgres:17.11.0.004}"
AUTH_IMAGE="${LITE_AUTH_IMAGE:-supabase/gotrue:v2.197.0}"
REST_IMAGE="${LITE_REST_IMAGE:-postgrest/postgrest:v16.4}"
MAIL_IMAGE="${LITE_MAIL_IMAGE:-axllent/mailpit:v1.31.3}"
SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

migrate() {
  for f in "$ROOT"/supabase/migrations/*.sql; do
    local name
    name="$(basename "$f")"
    if psql "$DB_URL" -At -c "select 1 from public._lite_migrations where name = '$name'" 2>/dev/null | grep -q 1; then
      continue
    fi
    echo "apply $name"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
    psql "$DB_URL" -q -c "insert into public._lite_migrations(name) values ('$name')"
  done
  docker restart jpb-rest >/dev/null 2>&1 || true
}

up() {
  docker network create "$NET" >/dev/null 2>&1 || true
  if ! docker ps -a --format '{{.Names}}' | grep -q '^jpb-db$'; then
    docker run -d --name jpb-db --network "$NET" -e POSTGRES_PASSWORD=postgres -p 54322:5432 "$PG_IMAGE" >/dev/null
  else
    docker start jpb-db >/dev/null
  fi
  for _ in $(seq 1 60); do docker exec jpb-db pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
  sleep 2
  docker exec jpb-db psql -U supabase_admin -d postgres -q -c \
    "alter user authenticator with password 'postgres'; alter user supabase_auth_admin with password 'postgres'; alter user postgres with password 'postgres';"

  docker start jpb-mail >/dev/null 2>&1 || docker run -d --name jpb-mail --network "$NET" -p 54324:8025 "$MAIL_IMAGE" >/dev/null

  if ! docker start jpb-auth >/dev/null 2>&1; then
    docker run -d --name jpb-auth --network "$NET" -p 9999:9999 \
      -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://127.0.0.1:54321 \
      -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@jpb-db:5432/postgres" \
      -e GOTRUE_SITE_URL="$SITE_URL" -e GOTRUE_URI_ALLOW_LIST="$SITE_URL/**" \
      -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_AUD=authenticated \
      -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_SECRET="$JWT_SECRET" \
      -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false \
      -e GOTRUE_SMTP_HOST=jpb-mail -e GOTRUE_SMTP_PORT=1025 -e GOTRUE_SMTP_ADMIN_EMAIL=admin@example.com \
      -e GOTRUE_SMTP_SENDER_NAME=JPBridge -e GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify \
      -e GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify -e GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify \
      -e GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify -e GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 \
      -e GOTRUE_SMTP_MAX_FREQUENCY=1s "$AUTH_IMAGE" >/dev/null
  fi
  for _ in $(seq 1 30); do curl -s localhost:9999/health | grep -q version && break; sleep 1; done

  psql "$DB_URL" -q -c "create table if not exists public._lite_migrations (name text primary key, applied_at timestamptz default now()); revoke all on public._lite_migrations from anon, authenticated;"
  migrate

  docker start jpb-rest >/dev/null 2>&1 || docker run -d --name jpb-rest --network "$NET" -p 3001:3000 \
    -e PGRST_DB_URI="postgres://authenticator:postgres@jpb-db:5432/postgres" -e PGRST_DB_SCHEMAS=public \
    -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT_SECRET" "$REST_IMAGE" >/dev/null

  if [[ ! -f "$ROOT/.env.local" ]]; then
    {
      echo "NEXT_PUBLIC_SITE_URL=$SITE_URL"
      echo "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"
      node "$ROOT/scripts/lite-keys.mjs" "$JWT_SECRET"
      echo "ADMIN_EMAILS=ops@example.com"
      echo "FEATURE_REFERRAL=false"
    } > "$ROOT/.env.local"
    echo ".env.local 생성"
  fi
  echo "lite stack up. 게이트웨이: node scripts/lite-gateway.mjs (:54321)"
}

down() {
  docker rm -f jpb-rest jpb-auth jpb-mail jpb-db >/dev/null 2>&1 || true
}

case "${1:-up}" in
  up) up ;;
  down) down ;;
  migrate) migrate ;;
  *) echo "usage: $0 up|down|migrate" >&2; exit 1 ;;
esac
