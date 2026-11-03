# syntax=docker/dockerfile:1.7
# Build context esperado: raiz do monorepo
# Coolify: aponte "Base Directory" = / e "Dockerfile Location" = apps/api/Dockerfile

ARG NODE_VERSION=24.16.0-alpine

# ───────────────────────────────────────────────
# 1) Base com pnpm + corepack
# ───────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ───────────────────────────────────────────────
# 2) Instala deps
# ───────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ───────────────────────────────────────────────
# 3) Build do app api
# ───────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /repo /repo
COPY . .
RUN pnpm --filter @app/api build

# ───────────────────────────────────────────────
# 4) Deps de produção apenas
# ───────────────────────────────────────────────
FROM base AS prod-deps
COPY --from=deps /repo /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm --filter @app/api --prod deploy /prod-deploy

# ───────────────────────────────────────────────
# 5) Runner
# ───────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache wget && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=prod-deps --chown=nestjs:nodejs /prod-deploy/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /repo/apps/api/package.json ./package.json

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3001}/health" > /dev/null || exit 1

CMD ["node", "dist/main.js"]
