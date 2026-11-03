# Pré-requisitos — criar um projeto novo com o Claude

Este guia é para quem vai usar o boilerplate do jeito mais simples: **entregar o link ao Claude
e deixar ele criar o projeto**. Na prática, o Claude mesmo verifica e resolve quase tudo sozinho
(Node, pnpm, e-mail, credencial de push) — você só precisa garantir **Git** instalado e o
**GitHub conectado** (`gh auth login`, ou o conector de GitHub do Claude Code). O resto, se faltar,
o próprio Claude tenta corrigir antes de te incomodar.

O repositório e o banco de dados são criados por uma **API de provisionamento** da organização —
você não precisa de permissão para criar repositórios na org, só precisar estar logado no GitHub
de alguma forma (`gh` CLI ou conector) pra ele conseguir dar push.

## 1. O que precisa estar pronto

| Ferramenta | Obrigatório? | Como conferir | Se faltar |
|---|---|---|---|
| Git | **sim** (só isso o Claude não resolve sozinho) | `git --version` | https://git-scm.com |
| GitHub conectado | **sim** | `gh auth status` | O Claude roda `gh auth login` pra você na hora |
| Node.js | não — o Claude segue mesmo com outra versão | `node -v` | Só se estiver **totalmente ausente** |
| pnpm | não | `pnpm -v` | O Claude roda `corepack enable` sozinho |

## 2. Identidade do git e e-mail — não precisa configurar nada

Se você já rodou `gh auth login` alguma vez, o Claude descobre seu e-mail sozinho (do `git config`
ou direto da sua conta do GitHub) e também resolve a credencial de push automaticamente
(`gh auth setup-git`) — essa é a causa mais comum de "o push falhou" quando alguém pula esse passo
manualmente, então deixe o Claude cuidar disso.

Só se o Claude não conseguir descobrir nada (sem git config, sem GitHub conectado) é que ele vai
perguntar seu e-mail diretamente.

## 3. Confirmar que a API está no ar

O Claude cria o repositório e o banco chamando a API de provisionamento. Confirme que ela responde:

```bash
curl https://api-provisionamento.apps.ham.org.br/health   # deve responder {"status":"ok"}
```

Se precisar apontar para outra URL, defina a variável de ambiente `PROVISION_API_URL` antes de rodar.

## 4. Como iniciar (a "frase mágica")

1. Abra o Claude Code.
2. Cole o link do boilerplate e peça, por exemplo:

   > "Clona esse repositório e cria um projeto novo pra mim: https://github.com/Hospital-Adventista-de-Manaus/ham-boilerplate-ia"

3. O Claude vai ler o `CLAUDE.md` do repositório, entrar em **modo bootstrap**, verificar/corrigir
   o ambiente sozinho (git conectado ao GitHub, pnpm, credencial de push) e **perguntar só o nome
   do projeto**. Responda.
4. Ele então cria uma pasta nova com esse nome, chama a API (que cria o repositório privado na
   organização e provisiona o banco) e envia o código para a branch **`staging`** — pedindo sua
   confirmação antes das ações externas. As credenciais do banco são gravadas automaticamente em
   `apps/api/.env`.

Ao final, o Claude te devolve o **link do repositório**, **onde o projeto ficou na sua máquina**, e
já deixa `pnpm install && pnpm dev` rodado pra você ver funcionando.

## 5. Se algo falhar

- **API fora do ar** (`/health` não responde) → avise o time responsável pela API de provisionamento.
- **Projeto já existe** → a API recusa nomes repetidos; escolha outro nome de projeto.
- **Push falhou mesmo com GitHub conectado** → o Claude já tenta `gh auth setup-git` e refaz o push
  sozinho; se ainda assim falhar, ele investiga o erro antes de te envolver — o commit local e o
  repositório já existem, então nada se perde.
- **Node/pnpm na versão errada** → normalmente não trava o bootstrap; se travar mesmo, a `.nvmrc`
  do projeto ajuda (`nvm use`).
- Em qualquer falha, o projeto local fica pronto com o commit na branch `staging` e o push pode ser refeito depois.
