# ham-boilerplate-ia

Boilerplate monorepo do **HAM** para projetos construídos com **Claude Code**. Deploy automático via **Coolify** ao dar `git push` no GitHub.

```
Next.js 15 (web) ──HTTP──► NestJS 10 (api)
   ↑                            ↑
   └────── Coolify ◄── git push ┘
```

## 🚀 Começar um projeto novo com IA (recomendado)

Não precisa entender o código. Instale os pré-requisitos, entregue o link deste repositório ao
Claude Code e peça para criar seu projeto:

> "Clona esse repositório e cria um projeto novo pra mim."

O Claude vai perguntar o **nome do projeto**, criar uma pasta nova, criar o **repositório privado
na organização** e publicar na branch **`staging`** — tudo guiado.

👉 Antes, siga o **[`docs/PRE_REQUISITOS.md`](./docs/PRE_REQUISITOS.md)** (o que instalar e como
autenticar no GitHub). Quem preferir o comando explícito pode usar `/novo-projeto` no Claude Code.

---

## TL;DR

```bash
pnpm install
cp .env.example .env
pnpm dev                  # web :3000 · api :3001
```

Para o stack completo containerizado:
```bash
pnpm docker:up
```

## Estrutura

```
apps/web/      → Next.js 15 (App Router, Tailwind)
apps/api/      → NestJS 10 (Express, ConfigService)
packages/      → shared-types (workspace)
docs/          → documentação detalhada
```

## Por onde começar (humano)

👉 **Primeira vez? Siga o [`IMPLEMENTACAO.md`](./IMPLEMENTACAO.md)** — passo-a-passo do zero até deploy no Coolify.

Para referência rápida:
1. Leia `CLAUDE.md` na raiz.
2. Leia `docs/DEVELOPMENT.md` para setup.
3. Leia `docs/DEPLOYMENT.md` antes de plugar no Coolify.

## Por onde começar (Claude Code)

O agente já tem instruções em `CLAUDE.md`. Em uma nova sessão, basta:

> "Leia `CLAUDE.md` e `docs/AI_WORKFLOW.md` antes de me responder."

## Documentação

| Documento | Para que serve |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | Contexto principal pro agente |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Visão de sistema |
| [docs/STACK.md](./docs/STACK.md) | Versões fixadas e por quê |
| [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) | Padrões de código |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Setup local |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Coolify, env, domínios |
| [docs/AI_WORKFLOW.md](./docs/AI_WORKFLOW.md) | Como conduzir sessões com Claude |
| [docs/TESTING.md](./docs/TESTING.md) | Estratégia de testes |
| [docs/SECURITY.md](./docs/SECURITY.md) | Checklist mínimo |

## Deploy (resumo)

No Coolify, crie **2 Applications** apontando para este repositório:

| App | Dockerfile Location | Porta |
|---|---|---|
| Web | `apps/web/Dockerfile` | 3000 |
| API | `apps/api/Dockerfile` | 3001 |

Configure as variáveis listadas em `.env.example`. Cada `git push` na `main` dispara redeploy automático.

Detalhes completos em [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Licença

Uso interno — Hospital Adventista de Manaus.
