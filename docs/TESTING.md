# Testes

## Filosofia

- **Cubra o que dói se quebrar.** Healthcheck, fluxos críticos, regras de negócio.
- **Não persiga 100% de coverage.** Persiga confiança.
- **Teste comportamento, não implementação.** Refatorar não deve quebrar testes.
- **Testes ruins são piores que nenhum.** Flaky test perde credibilidade rápido.

## Backend (NestJS)

Stack: Jest + `@nestjs/testing` + Supertest (e2e).

### Unit
Mock dependências via `Test.createTestingModule`. Veja `apps/api/src/health/health.controller.spec.ts`.

```bash
pnpm --filter @app/api test
```

### E2E (quando adicionar)
Crie `apps/api/test/` com testes que sobem a app inteira via `INestApplication` e chamam endpoints reais.

## Frontend (Next.js)

Por padrão **não vem configurado** — adicione conforme a necessidade:

- **Unit/integração de componentes:** Vitest + React Testing Library.
- **E2E navegador:** Playwright.

Quando adicionar, documente aqui o comando padrão.

## CI

`.github/workflows/ci.yml` roda `pnpm typecheck` + `pnpm lint` + `pnpm test` em cada push/PR.

## Regras

- Teste novo acompanha feature nova quando há lógica não-trivial.
- Bug que escapou ganha teste de regressão antes do fix.
- Testes ficam ao lado do código (`*.spec.ts`), não numa pasta `tests/` distante.
