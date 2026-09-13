#!/usr/bin/env bash
# Idempotent bootstrap for the taskhull Cloud Agent environment.
# Installs PostgreSQL, prepares the database, installs Node deps, and applies migrations.
set -euo pipefail

# Resolve repo root (this script lives in <repo>/.cursor).
cd "$(dirname "$0")/.."

if [ "$(id -u)" -eq 0 ]; then
	SUDO=""
else
	SUDO="sudo"
fi

# 1. Install PostgreSQL if it is not already present.
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
	echo "==> Installing PostgreSQL"
	$SUDO apt-get update -qq
	$SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

# Detect the installed PostgreSQL major version and the default cluster name.
PG_VER="$(ls /usr/lib/postgresql | sort -V | tail -1)"
PG_CLUSTER="main"

# 2. Start the cluster if it is not already online (apt does not start it in this VM).
if ! $SUDO pg_lsclusters -h 2>/dev/null | awk '{print $4}' | grep -q online; then
	echo "==> Starting PostgreSQL cluster ${PG_VER}/${PG_CLUSTER}"
	$SUDO pg_ctlcluster "$PG_VER" "$PG_CLUSTER" start
fi

# Wait until the server accepts connections.
for _ in $(seq 1 30); do
	if pg_isready -h localhost -p 5432 -q; then
		break
	fi
	sleep 1
done

# 3. Ensure the role password and application database exist (idempotent).
$SUDO -u postgres psql -tAc "ALTER USER postgres WITH PASSWORD 'password';"
if ! $SUDO -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='database'" | grep -q 1; then
	echo "==> Creating database 'database'"
	$SUDO -u postgres createdb database
fi

# 4. Create a local .env from the example if one is not present.
if [ ! -f .env ]; then
	echo "==> Creating .env from .env.example"
	cp .env.example .env
fi

# 5. Install Node dependencies from the lockfile.
echo "==> Installing Node dependencies"
npm ci

# 6. Apply database migrations (idempotent).
echo "==> Applying database migrations"
npx dotenv -e ./.env -- drizzle-kit migrate --config=drizzle.config.ts

echo "==> Install complete"
