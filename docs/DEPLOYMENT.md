# Deploy via Coolify

> Fluxo: você dá `git push` → GitHub dispara webhook → Coolify constrói imagens Docker e sobe os containers.

## Pré-requisitos

- Servidor Coolify acessível.
- Repositório conectado ao Coolify (GitHub App ou Deploy Key).
- Branch monitorada definida (geralmente `main`).

## Modelo escolhido: 2 aplicações no Coolify

O monorepo expõe duas apps independentes. Cada uma vira uma **Application** separada no Coolify, apontando para o mesmo repositório mas com Dockerfiles diferentes.

### Aplicação 1 — Web (Next.js)

| Campo | Valor |
|---|---|
| Source | GitHub (seu repo) |
| Branch | `main` |
| Build Pack | **Dockerfile** |
| Base Directory | `/` |
| Dockerfile Location | `apps/web/Dockerfile` |
| Ports Exposes | `3000` |
| Healthcheck Path | `/` |

Variáveis de ambiente:
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.seu-dominio.com
INTERNAL_API_URL=http://<nome-do-serviço-api-no-coolify>:3001
```

> `INTERNAL_API_URL` resolve via rede interna do Coolify. Use o **nome do serviço/container** da app api, não o domínio público (evita hop extra e funciona mesmo sem internet).

### Aplicação 2 — API (NestJS)

| Campo | Valor |
|---|---|
| Source | GitHub (mesmo repo) |
| Branch | `main` |
| Build Pack | **Dockerfile** |
| Base Directory | `/` |
| Dockerfile Location | `apps/api/Dockerfile` |
| Ports Exposes | `3001` |
| Healthcheck Path | `/health` |

Variáveis de ambiente:
```
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://app.seu-dominio.com
# DATABASE_URL=postgresql://...
```

## Webhook automático

Ao conectar o repositório via GitHub App, o Coolify cria o webhook por conta própria. Cada push na branch monitorada dispara um build incremental usando cache do BuildKit.

Para forçar rebuild sem mudar código: `Force rebuild` no painel.

## Domínios e TLS

- Configure o domínio em cada Application no Coolify.
- Coolify gera certificado Let's Encrypt automaticamente (se DNS apontando).
- Use subdomínios separados: `app.dominio.com` (web) e `api.dominio.com` (api).

## Banco de dados (quando adicionar)

1. No Coolify, crie um **Resource → Database → PostgreSQL** no mesmo projeto.
2. Pegue a string interna (`postgres://user:pass@<service-name>:5432/db`).
3. Configure `DATABASE_URL` na app api.

## Rollback

Coolify guarda histórico de deploys. No painel da application: **Deployments** → escolha a versão anterior → **Redeploy**.

## Troubleshooting

| Sintoma | Provável causa |
|---|---|
| `web` 502 no `/` | API down — verifique healthcheck do container `api` |
| Build cresce indefinidamente | `.dockerignore` não está respeitado — confira se o arquivo está na raiz |
| `CORS error` no browser | `CORS_ORIGINS` da api não inclui o domínio do web |
| `INTERNAL_API_URL` não resolve | Use o **service name**, não o domínio público |
| Healthcheck `/health` falha em produção | Veja logs com `docker logs <container>` no servidor |

## Boas práticas

- Mantenha as variáveis de ambiente **só no Coolify** (nunca commitadas).
- Use **branches de release** se quiser aprovação manual: configure a app no Coolify para a branch `release` e dê merge quando quiser deployar.
- Tenha um ambiente **staging** separado: outra app no Coolify apontando para a branch `staging`.
