# Convenções de código

## Geral

- **Idioma:** identificadores em inglês; comentários e UX em português.
- **Tipagem estrita.** `any` só com comentário justificando.
- **Imports absolutos** via aliases (`@/*` no web e api). Relativos só dentro do mesmo módulo.
- **Sem console.log em código mergeable.** Use `Logger` (Nest) ou remova.
- **Não adicione dependências sem precisar.** Antes de instalar, busque se já existe algo no monorepo.
- **Comentários explicam o "porquê", não o "o quê".** Código auto-explicativo é a meta.

## TypeScript

- Interface > type para objetos públicos.
- `unknown` > `any` quando o tipo é incerto.
- Funções públicas têm tipo de retorno explícito.
- Não exporte tipos internos.

## Frontend (Next.js)

- Componentes em `PascalCase.tsx`. Hooks em `useCamelCase.ts`.
- Server Component por padrão; cliente só quando necessário (`'use client'` no topo).
- Tailwind primeiro; classes longas viram componente quando passar de ~6 utilities repetidas.
- `<Image>` do Next sempre que possível (otimização).
- Não use `getInitialProps`/`getServerSideProps` (legacy).

## Backend (NestJS)

- Um módulo por domínio (`users/`, `appointments/`, …).
- Controller fino, Service grosso.
- DTOs com `class-validator` (`@IsString()`, `@IsEmail()`, …) — sempre validar input de fora.
- Sem lógica de negócio em controllers.
- Erros: lance `HttpException` do Nest (ou subclasses como `BadRequestException`).
- Logs: `Logger` injetado, com contexto (`new Logger(MyService.name)`).

## Git

- **Branch:** `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`.
- **Commits:** convencionais. `feat: add user invitation flow`, `fix(api): handle null in /health`.
- **PRs pequenos.** Se passa de 400 linhas alteradas, considere dividir.
- **Nunca force-push em `main`.**

## Arquivos novos

- Crie só quando necessário. Reaproveite padrões existentes.
- Evite `index.ts` barrel se for só re-exportar um arquivo.
- Não crie `utils.ts` genérico — coloque o helper perto do uso, ou em `lib/<dominio>.ts`.

## Quando estiver tentado a fazer um "refactor de oportunidade"

Não faça. Termine a feature, abra um PR só pro refactor. Mistura assusta o reviewer.
