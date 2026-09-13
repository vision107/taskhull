#!/usr/bin/env bash
# Per-boot startup for the taskhull Cloud Agent environment.
# Ensures PostgreSQL is running and migrations are applied before terminals start.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "$(id -u)" -eq 0 ]; then
	SUDO=""
else
	SUDO="sudo"
fi

PG_VER="$(ls /usr/lib/postgresql | sort -V | tail -1)"
PG_CLUSTER="main"

# Start the PostgreSQL cluster if it is not already online.
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

# Ensure a local .env exists (in case this is a fresh checkout without a snapshot).
[ -f .env ] || cp .env.example .env

# Apply any migrations that are newer than the snapshot (idempotent).
echo "==> Applying database migrations"
npx dotenv -e ./.env -- drizzle-kit migrate --config=drizzle.config.ts

echo "==> Start complete"
