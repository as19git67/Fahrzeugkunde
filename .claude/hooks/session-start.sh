#!/bin/bash
# SessionStart hook für Claude Code on the web.
# Installiert Node-Dependencies und bringt einen lokalen PostgreSQL-Server
# hoch, sodass die DB-Integrationstests (vitest) out-of-the-box laufen.
#
# Nur in Remote-Sessions aktiv, damit lokale Entwicklung davon unberührt bleibt.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# --- 1) Node dependencies --------------------------------------------------
if [ -f package-lock.json ] || [ -f package.json ]; then
  echo "📦 Installing npm dependencies..."
  npm install --no-audit --no-fund
fi

# --- 2) PostgreSQL --------------------------------------------------------
# Das Image hat Postgres 16 vorinstalliert, aber nicht gestartet. Wir bringen
# den Cluster hoch, setzen ein bekanntes Passwort und exportieren den
# Connection-String für die Tests.

if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "🛠  Installing PostgreSQL..."
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-client
fi

# Cluster-Version dynamisch ermitteln (16, 17, …)
PG_VERSION="$(pg_lsclusters -h | awk 'NR==1 {print $1}')"
PG_CLUSTER="$(pg_lsclusters -h | awk 'NR==1 {print $2}')"

if [ -z "${PG_VERSION:-}" ]; then
  echo "‼️  Kein PostgreSQL-Cluster gefunden." >&2
  exit 1
fi

PG_STATUS="$(pg_lsclusters -h | awk 'NR==1 {print $4}')"
if [ "$PG_STATUS" != "online" ]; then
  echo "🐘 Starting PostgreSQL $PG_VERSION/$PG_CLUSTER..."
  pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" start
fi

# Warten bis PG antwortet (max 30 s)
for i in $(seq 1 30); do
  if pg_isready -q; then break; fi
  sleep 1
done

if ! pg_isready -q; then
  echo "‼️  PostgreSQL wurde nicht rechtzeitig bereit." >&2
  exit 1
fi

# Passwort idempotent setzen
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -c \
  "ALTER USER postgres WITH PASSWORD 'postgres';" >/dev/null

# Per-Session DATABASE_URL exportieren, damit Tests sie direkt nutzen
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export DATABASE_URL='postgres://postgres:postgres@localhost:5432/fahrzeugkunde'"
    echo "export POSTGRES_TEST_CONNECTION_STRING='postgres://postgres:postgres@localhost:5432/fahrzeugkunde_test'"
  } >> "$CLAUDE_ENV_FILE"
fi

echo "✅ Setup complete. Postgres ready on localhost:5432 (user=postgres, pw=postgres)."
echo "   → npm test will now run the full suite including DB integration tests."
