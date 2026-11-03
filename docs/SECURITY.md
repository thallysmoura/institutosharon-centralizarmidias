# Segurança

> Lista mínima. Não substitui review humana.

## Segredos

- **Nada de segredo no Git.** `.env` está no `.gitignore`. `.env.example` é o único arquivo de env versionado.
- **Em produção:** todas as variáveis ficam nas configs do Coolify (criptografadas no banco do Coolify).
- **Rotacione** chaves quando alguém com acesso sair do time.

## CORS

- API libera **apenas** origens listadas em `CORS_ORIGINS` (env, vírgula).
- Em prod, **nunca** use `*`. Liste explicitamente os domínios do front.

## Headers HTTP

Coolify + Traefik por padrão já forçam HTTPS. Considere adicionar (no Nest):

```ts
import helmet from 'helmet';
app.use(helmet());
```

Quando precisar, instale: `pnpm --filter @app/api add helmet`.

## Inputs

- **Toda** request da API valida o body com `class-validator` via DTO.
- `ValidationPipe({ whitelist: true })` (já configurado em `main.ts`) descarta campos não-declarados.
- Frontend valida antes de enviar (UX), mas **a fonte da verdade é a API**.

## Autenticação (quando adicionar)

- Use JWT em cookie **HttpOnly + Secure + SameSite=Lax** (não localStorage).
- Tokens com TTL curto (1h) + refresh token rotativo.
- Hash de senha com `argon2` ou `bcrypt` (cost ≥ 12).

## SQL / DB

- Use ORM/Query builder (Prisma, Drizzle, TypeORM) — nunca string-concat de SQL.
- Migrations versionadas no repo.
- Backup automatizado configurado no Coolify (databases têm setting próprio).

## Dependências

- Roda `pnpm audit` antes de release significativo.
- Dependabot/Renovate recomendado para PRs automáticos de update.

## Logs

- **Não logue** senhas, tokens, CPF, dados de cartão.
- Logs estruturados em JSON em produção (use `nestjs-pino` quando precisar).

## Em caso de incidente

1. Rotacione segredos no Coolify.
2. Force redeploy.
3. Investigue logs (Coolify guarda, mas também replique pra um sink externo se for crítico).
4. Documente o incidente num arquivo `docs/incidents/YYYY-MM-DD-slug.md`.
