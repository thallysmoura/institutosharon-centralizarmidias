# Fluxo de trabalho com Claude Code

> Como conduzir uma sessão de trabalho usando Claude Code neste boilerplate. Este documento define **o ritual**. Não improvise.

## Princípio guia

> _Pense primeiro, codifique depois, verifique sempre._

## Antes de pedir qualquer coisa ao Claude

1. **Saiba o que você quer.** "Cria uma tela de login" é vago. "Cria a tela `/login` com email + senha, validação client-side, post pra `POST /auth/login`, salva token em cookie HttpOnly" é claro.
2. **Tenha o stack na cabeça.** Web é Next.js App Router; API é Nest com módulos. Não aceite código que ignore esse padrão.
3. **Leia o `CLAUDE.md` do app que vai mexer.**

## Ciclo recomendado por feature

```
1. PLAN     →  Claude descreve a abordagem antes de codar
2. SCAFFOLD →  cria estrutura de arquivos
3. IMPLEMENT→  preenche um arquivo por vez
4. VERIFY   →  typecheck + lint + test localmente
5. REVIEW   →  você lê o diff e questiona
6. COMMIT   →  commit pequeno, mensagem clara
```

### 1. PLAN
Peça ao Claude para **planejar antes**:
> "Vou criar [feature]. Antes de codar, liste:
> - arquivos a criar/editar
> - decisões de design (endpoint, schema, tipos compartilhados)
> - dependências novas (justifique cada uma)
> - riscos / pontos de atenção"

Revise o plano. Aprove. Só então: "vai".

### 2. SCAFFOLD
Crie a estrutura vazia primeiro. Mais fácil revisar a árvore do que ler 500 linhas de uma vez.

### 3. IMPLEMENT
Um arquivo de cada vez. **Não aceite "aqui está tudo de uma vez"**. Você perde o controle.

### 4. VERIFY (obrigatório)
```bash
pnpm typecheck
pnpm lint
pnpm test
```
Se algum falhar, **Claude conserta antes de seguir**. Nunca acumule erros.

### 5. REVIEW
- O código segue `docs/CONVENTIONS.md`?
- Tem `any` solto? Pergunte por quê.
- Adicionou dependência? Justifica?
- Não tocou em coisas além do escopo?

### 6. COMMIT
Commits pequenos e atômicos. Mensagem no padrão convencional.

## Anti-padrões que o Claude tende a cometer aqui

| Anti-padrão | Como cortar |
|---|---|
| Duplicar tipos entre web e api | Mande pro `@app/shared-types` |
| Usar `getServerSideProps` | É App Router. Server Component + fetch direto. |
| `process.env.X` espalhado no Nest | Use `ConfigService` |
| Criar `utils.ts` genérico | Coloca perto do uso, ou em `lib/<dominio>.ts` |
| Cliente sem `'use client'` mas com `useState` | Adicione o diretivo |
| Mexer no Dockerfile "pra simplificar" | Pergunte por quê. Geralmente é regressão. |
| Adicionar lib (lodash, moment, axios) sem precisar | Native APIs primeiro |
| Refactor de oportunidade no PR de feature | PR separado |

## Quando o Claude estiver "perdido"

- Reabra o `CLAUDE.md` raiz na sessão (referencie explicitamente).
- Diga **o que o resultado certo se parece** (ex.: "no final, devo conseguir rodar `pnpm dev` e abrir `/login` que faz POST pra `/auth/login` da api").
- Peça o **plano** de novo, mais detalhado.

## Comandos úteis para auditar uma sessão

```bash
git diff                    # o que mudou
git status                  # o que está pendente
pnpm typecheck              # quebrou tipos em algum canto?
pnpm lint                   # quebrou regra?
pnpm --filter <app> build   # builda? (descobre problema do prod)
```

## Termo de aceitação de uma feature

Antes de declarar "feito":

- [ ] Especificação cumprida (compare com o pedido original)
- [ ] `pnpm typecheck` passa
- [ ] `pnpm lint` passa
- [ ] `pnpm test` passa (incluindo o teste novo, se houver)
- [ ] Manual: feature funciona quando você roda `pnpm dev`
- [ ] `.env.example` atualizado se adicionou variável
- [ ] Documentação relevante atualizada (`docs/` ou README)
- [ ] Commit com mensagem clara
