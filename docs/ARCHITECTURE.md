# Arquitetura

## Visão geral

```
                    ┌──────────────────────────┐
                    │      Coolify (VPS)       │
                    │                          │
   Usuário ─HTTPS─► │  ┌────────────────────┐  │
                    │  │  web (Next.js)     │  │
                    │  │  :3000             │──┼──► chamadas server-side
                    │  └─────────┬──────────┘  │    via INTERNAL_API_URL
                    │            │              │
                    │            ▼              │
                    │  ┌────────────────────┐  │
                    │  │  api (NestJS)      │  │
                    │  │  :3001             │  │
                    │  └────────────────────┘  │
                    │            │              │
                    │            ▼              │
                    │     [DB opcional]         │
                    └──────────────────────────┘
                            ▲
                            │ git push → webhook
                            │
                    ┌───────┴────────┐
                    │     GitHub     │
                    └────────────────┘
```

## Princípios

1. **Separação clara front/back.** O `web` consome o `api`. Sem código compartilhado além de **tipos** (`@app/shared-types`).
2. **Stateless onde possível.** A API não guarda sessão em memória — use JWT, Redis, ou DB para estado.
3. **Healthcheck obrigatório.** Todo serviço expõe `/health` ou equivalente para Coolify e Docker monitorarem.
4. **Variáveis de ambiente são contrato.** Toda env nova entra no `.env.example` da raiz.
5. **Build determinístico.** `pnpm-lock.yaml` versionado. `--frozen-lockfile` em CI/CD.

## Comunicação entre web e api

- **Server Components (Next):** chamam a API via `INTERNAL_API_URL` (hostname interno — `api` no docker compose, hostname do serviço no Coolify).
- **Client Components:** chamam a API via `NEXT_PUBLIC_API_URL` (URL pública resolvida pelo browser).

Mantenha essa distinção: vazar `INTERNAL_API_URL` para o cliente quebra em produção.

## Camadas dentro da API

```
Controller   → recebe HTTP, valida DTO (class-validator)
Service      → lógica de negócio
Repository   → acesso a dados (DB, APIs externas)
DTO/Entity   → contratos
```

Quando adicionar persistência (Prisma/TypeORM/Drizzle), siga essa estrutura.

## Decisões registradas

| Decisão | Motivo |
|---|---|
| pnpm workspaces + Turborepo | melhor cache, simples, sem lock-in |
| Next.js `output: 'standalone'` | imagem Docker enxuta, sem `node_modules` redundante |
| Nest com Express adapter | maturidade do ecossistema, mais material/exemplos |
| Tipos compartilhados num pacote | evita drift entre client e server |
| Dockerfile por app | Coolify trata cada app como aplicação independente |
| Healthcheck no `/health` | Coolify/Docker conseguem reiniciar containers automaticamente |
