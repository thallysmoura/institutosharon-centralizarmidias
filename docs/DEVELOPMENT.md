# Desenvolvimento local

## Pré-requisitos

- Node.js 24.16.0 (use `nvm use` na raiz — `.nvmrc` fixa a versão)
- pnpm 9.12+ (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker + Docker Compose (opcional, para subir o stack inteiro)

## Setup inicial

```bash
git clone <repo-url>
cd <repo>
cp .env.example .env
pnpm install
```

## Rodando

### Opção A — Tudo nativo (recomendado para dev iterativo)

```bash
pnpm dev
```

Sobe web (:3000) e api (:3001) em paralelo via Turborepo.

### Opção B — Containers (mais próximo do prod)

```bash
pnpm docker:up
```

### Opção C — Um app por vez

```bash
pnpm --filter @app/web dev
pnpm --filter @app/api dev
```

## Verificações antes de commit

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Os três passam? Pode commitar.

## Adicionando dependências

```bash
# Em um app específico (correto):
pnpm --filter @app/web add zod
pnpm --filter @app/api add @nestjs/jwt

# Dependência da raiz (raro — só ferramentas globais):
pnpm add -D -w prettier
```

❌ Não rode `pnpm add` dentro de `apps/web/` — sempre use `--filter` da raiz para manter o lockfile coerente.

## Tipos compartilhados

Quando precisar de um tipo usado em ambos os lados, coloque em `packages/shared-types/src/`:

```ts
// packages/shared-types/src/user.ts
export interface User {
  id: string;
  name: string;
  email: string;
}
```

E re-exporte em `packages/shared-types/src/index.ts`. Os apps já dependem do package — basta importar:

```ts
import type { User } from '@app/shared-types';
```

## Banco de dados

Não vem com banco por padrão. Quando precisar:

1. Descomente o serviço `db` em `docker-compose.yml`.
2. Adicione `prisma` (ou similar) em `apps/api`.
3. Adicione `DATABASE_URL` no `.env.example`.
4. Documente o setup adicional em `docs/DEPLOYMENT.md`.

## Limpando

```bash
pnpm clean                                    # remove builds + node_modules
docker compose down -v                        # remove containers + volumes
```
