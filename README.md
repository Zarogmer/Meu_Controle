# Meu Estoque

Sistema SaaS multi-tenant para pequenas lojas gerenciarem estoque, vendas e operacao.

## Stack

- Frontend: Next.js 16 + App Router + Tailwind CSS + shadcn/ui
- Backend: Route Handlers do Next.js
- Banco de dados: PostgreSQL
- ORM: Drizzle ORM
- Auth: JWT com cookies httpOnly
- Deploy recomendado: Railway

## Modelo de acesso

- O sistema e multi-tenant.
- Apenas a conta `tech` da plataforma pode criar novas lojas.
- O cadastro publico foi desativado.
- Cada nova loja criada pelo painel admin ja nasce com um usuario `owner`.

Conta inicial padrao:

- Email: `guilherme@meuestoque.com`
- Senha: `admin123`

Esses valores podem ser alterados pelas variaveis:

- `TECH_ADMIN_NAME`
- `TECH_ADMIN_EMAIL`
- `TECH_ADMIN_PASSWORD`

## Variaveis de ambiente

Use o arquivo `.env.example` como base:

```bash
DATABASE_URL=postgresql://postgres:password@host:5432/railway
JWT_SECRET=troque-esta-chave-por-uma-chave-segura
TECH_ADMIN_NAME=Guilherme
TECH_ADMIN_EMAIL=guilherme@meuestoque.com
TECH_ADMIN_PASSWORD=admin123
```

## Como rodar com Railway

```bash
npm install
npm run railway:setup
npm run dev
```

O comando `railway:setup` faz duas coisas:

1. cria/atualiza o schema no PostgreSQL com `drizzle-kit push`
2. garante a criacao da conta `tech`

## Deploy no Railway

Sugestao de fluxo:

1. Conecte este repositorio GitHub ao Railway.
2. Adicione um banco PostgreSQL no mesmo projeto.
3. Na sua service web, crie uma Reference Variable `DATABASE_URL` apontando para o Postgres.
4. Configure tambem `JWT_SECRET` e, se quiser personalizar a conta inicial, `TECH_ADMIN_*`.
5. Em `Settings -> Deploy -> Pre-deploy Command`, defina `npm run railway:setup`.
6. Gere o dominio publico em `Settings -> Networking`.

Configuracao aplicada neste projeto para Railway:

- `next.config.ts` usa `output: "standalone"`
- `npm start` sobe `node .next/standalone/server.js`
- `npm run railway:setup` prepara schema e garante a conta `tech`

## Observacoes

- O upload de imagens continua usando `@vercel/blob`. Se quiser upload em producao, configure o token correspondente.
- O `netlify.toml` ficou legado e pode ser removido depois se voce nao for mais usar Netlify.
