# CLAUDE.md — apps/api (NestJS)

> Contexto específico do backend. Use junto com o `CLAUDE.md` raiz.

## Stack

- NestJS 10 (Express adapter)
- `@nestjs/config` (variáveis de ambiente)
- TypeScript estrito
- Jest (testes unitários)
- Tipos compartilhados via `@app/shared-types`

## Layout dentro de `src/`

```
src/
├── main.ts            # Bootstrap (CORS, ValidationPipe, listen)
├── app.module.ts      # Módulo raiz — importa os feature modules
├── health/            # Módulo de exemplo (GET /health)
│   ├── health.module.ts
│   ├── health.controller.ts
│   └── health.controller.spec.ts
└── common/            # Filtros, guards, pipes, interceptors compartilhados
```

## Convenções obrigatórias

- **Um módulo por domínio.** Ex.: `users/`, `auth/`, `appointments/`. Cada módulo tem `*.module.ts`, `*.controller.ts`, `*.service.ts`.
- **DTOs ficam em `<modulo>/dto/`** e usam `class-validator` (adicione a dependência quando precisar de validação).
- **Use `ConfigService`** para ler variáveis de ambiente. Nunca `process.env.X` espalhado pelo código (exceção: `main.ts` no bootstrap).
- **Tipagem de resposta** vem do `@app/shared-types` quando o tipo cruza a fronteira HTTP.
- **CORS** é controlado pela env `CORS_ORIGINS` (vírgula separa).
- **Healthcheck `GET /health`** já existe — Coolify e Docker dependem dele. Não quebre o contrato.
- **Toda nova feature** vira um módulo importado em `AppModule`.

## Variáveis de ambiente (api)

| Variável | Default | Para quê |
|---|---|---|
| `PORT` | `3001` | Porta de escuta |
| `NODE_ENV` | `development` | Ambiente |
| `CORS_ORIGINS` | `http://localhost:3000` | Domínios permitidos (vírgula) |
| `APP_VERSION` | _(opcional)_ | Aparece no `/health` |

Adicione novas variáveis no `.env.example` da raiz.

## Como adicionar um novo módulo

```bash
# manual:
mkdir src/users
# crie: users.module.ts, users.controller.ts, users.service.ts
# importe UsersModule em AppModule
```

Ou via CLI do Nest dentro do app:
```bash
pnpm --filter @app/api exec nest g module users
pnpm --filter @app/api exec nest g controller users
pnpm --filter @app/api exec nest g service users
```

## Comandos

```bash
pnpm --filter @app/api dev        # nest start --watch
pnpm --filter @app/api build      # nest build → dist/
pnpm --filter @app/api start      # node dist/main.js
pnpm --filter @app/api test       # jest
pnpm --filter @app/api typecheck
```

## Build Docker

- Estágio `prod-deps` usa `pnpm deploy` para isolar dependências de produção do workspace.
- Runner executa `node dist/main.js` na porta 3001.
- Healthcheck do container chama `GET /health`.
