#!/usr/bin/env bash
# Gera, a partir dos .env locais, os arquivos usados pelo Docker (ambos ignorados pelo Git):
#   apps/api/.env.docker  (segredos da API, com host do banco, URL publica e cookies seguros)
#   .env                  (so valores publicos do Firebase para o build do front)
set -euo pipefail
cd "$(dirname "$0")/.."
DOMINIO="${DOMINIO:-https://institutosharonfotos.mouora.com}"
grep -vE '^(DEV_LOGIN|DEV_LOGIN_PUBLICO|DEV_LOGIN_ATE|DATABASE_URL|CORS_ORIGINS|APP_URL|COOKIE_SECURE|COOKIE_REFRESH_PATH|TRUST_PROXY|PORT|FIREBASE_SERVICE_ACCOUNT_PATH|STORAGE_LOCAL_DIR)=' apps/api/.env > apps/api/.env.docker
DB_URL="$(grep -E '^DATABASE_URL=' apps/api/.env | sed -E 's#@(localhost|127\.0\.0\.1):5433/#@sharon-db:5432/#')"
{
  echo "$DB_URL"
  echo "PORT=3001"
  echo "CORS_ORIGINS=$DOMINIO"
  echo "APP_URL=$DOMINIO"
  echo "COOKIE_SECURE=true"
  echo "COOKIE_REFRESH_PATH=/backend/auth"
  echo "TRUST_PROXY=1"
  echo "FIREBASE_SERVICE_ACCOUNT_PATH=/app/secrets/firebase-adminsdk.json"
  echo "STORAGE_LOCAL_DIR=/tmp/storage"
} >> apps/api/.env.docker
grep -E '^NEXT_PUBLIC_FIREBASE_' apps/web/.env.local > .env || : > .env
# TEMPORARIO e opt-in: DEV_LOGIN_HORAS=24 bash scripts/subir-docker.sh libera os botoes de login rapido (Administrador/Aluno) por N horas.
# Sem essa variavel o deploy NUNCA inclui o atalho.
if [ -n "${DEV_LOGIN_HORAS:-}" ]; then
  ATE=$(( ($(date +%s) + DEV_LOGIN_HORAS * 3600) * 1000 ))
  { echo "DEV_LOGIN=1"; echo "DEV_LOGIN_PUBLICO=1"; echo "DEV_LOGIN_ATE=$ATE"; } >> apps/api/.env.docker
  echo "NEXT_PUBLIC_DEV_LOGIN=1" >> .env
  echo "ATENCAO: login rapido liberado por ${DEV_LOGIN_HORAS}h (expira sozinho)"
fi
echo "Gerados: apps/api/.env.docker e .env"
