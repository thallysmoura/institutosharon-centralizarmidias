#!/usr/bin/env bash
# Backup do banco (schema "sistema"). Uso: bash scripts/backup-db.sh
# Gera: database/schema.sql (so estrutura, vai para o Git) e backups/sistema-AAAAMMDD-HHMM.dump (estrutura + dados, NAO vai para o Git).
set -euo pipefail
CONTAINER="${DB_CONTAINER:-sharon-db}"; DB="${DB_NAME:-sharon}"; USUARIO="${DB_USER:-sharon}"
cd "$(dirname "$0")/.."
mkdir -p database backups
docker exec "$CONTAINER" pg_dump -U "$USUARIO" -d "$DB" --schema-only -n sistema --no-owner --no-privileges > database/schema.sql
ARQ="backups/sistema-$(date +%Y%m%d-%H%M).dump"
docker exec "$CONTAINER" pg_dump -U "$USUARIO" -d "$DB" -n sistema --no-owner --no-privileges -Fc > "$ARQ"
echo "Estrutura: database/schema.sql"
echo "Backup completo: $ARQ"
