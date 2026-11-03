#!/usr/bin/env bash
# Build e subida (ou atualizacao) do front e da API no Docker. Uso: bash scripts/subir-docker.sh [api|web]
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/gerar-env-docker.sh
docker compose up -d --build "$@"
docker compose ps
