# Stack

> Versões fixadas. Não mude sem registrar a razão num commit dedicado.

## Runtime / tooling

| Tool | Versão | Por quê |
|---|---|---|
| Node.js | 24.16.0 LTS | LTS atual, suportado pelo Next 15 e Nest 10 |
| pnpm | 9.12+ | Workspaces eficientes, instalações reproduzíveis |
| Turborepo | 2.x | Pipeline incremental + cache |
| TypeScript | 5.6+ | Tipagem estrita |

## Frontend (`apps/web`)

| Pacote | Versão | Observações |
|---|---|---|
| `next` | 15.0.3 | App Router obrigatório |
| `react` / `react-dom` | 19.0.0 | Server Components estáveis |
| `tailwindcss` | 3.4 | Plugin do PostCSS |
| `eslint-config-next` | 15.0.3 | Lint pronto |

## Backend (`apps/api`)

| Pacote | Versão | Observações |
|---|---|---|
| `@nestjs/core` | 10.4 | LTS atual |
| `@nestjs/common` | 10.4 | Decorators, pipes |
| `@nestjs/config` | 3.3 | `ConfigService` (NÃO use `process.env` solto) |
| `@nestjs/platform-express` | 10.4 | Express adapter (preferido a Fastify por compatibilidade) |
| `rxjs` | 7.8 | Dependência transitiva do Nest |
| `jest` | 29 | Testes unitários |

## Shared (`packages/shared-types`)

Pacote sem dependências externas — só TypeScript. Sai do build do app via `transpilePackages` (Next) e `module-alias` / `paths` (Nest).

## Quando atualizar

- **Patch/minor:** OK sem ritual, basta CI verde.
- **Major:** sempre num PR dedicado. Atualize este arquivo, rode `pnpm build && pnpm test`, e teste Dockerfile localmente.

## O que evitar

- Adicionar runtime alternativo (Bun, Deno) sem revisar Dockerfiles.
- Trocar Express por Fastify na API "porque é mais rápido" — só se houver gargalo medido.
- Pacotes com manutenção parada (>1 ano sem release) sem justificativa.
