# Meu Controle

Sistema SaaS multi-tenant para pequenos negócios gerenciarem operação, produtos, caixa e rotina.

## Stack

- Frontend: Next.js 16 + App Router + Tailwind CSS + shadcn/ui
- Backend: Route Handlers do Next.js
- Banco de dados: PostgreSQL
- ORM: Drizzle ORM
- Auth: JWT com cookies httpOnly
- Deploy recomendado: Railway

## Modelo de acesso

- O sistema é multi-tenant.
- Apenas a conta `tech` da plataforma pode criar novas lojas.
- O cadastro público foi desativado.
- Cada nova loja criada pelo painel admin já nasce com um usuário `owner`.

Esses valores podem ser personalizados pelas variáveis:

- `TECH_ADMIN_NAME`
- `TECH_ADMIN_EMAIL`
- `TECH_ADMIN_PASSWORD`

## Variáveis de ambiente

Use o arquivo `.env.example` como base:

```bash
DATABASE_URL=postgresql://postgres:password@host:5432/railway
JWT_SECRET=troque-esta-chave-por-uma-chave-segura
TECH_ADMIN_NAME=Guilherme
TECH_ADMIN_EMAIL=guilherme@meucontrole.com
TECH_ADMIN_PASSWORD=defina-uma-senha-segura
```

Variáveis da integração com corretora (Fase 3 — conector Nelogica):

```bash
# 32 bytes em hex (openssl rand -hex 32). Cifra o token do conector no banco (AES-256-GCM).
INTEGRATIONS_ENC_KEY=
# Segredo do job de sincronização chamado pelo cron (header x-cron-secret).
CRON_SECRET=
# Só em desenvolvimento: aceita URL http:// para o conector. Em produção é sempre https://.
NELOGICA_ALLOW_HTTP=0
```

Testes unitários (cálculos da carteira, parser de CSV, criptografia/HMAC): `npm test`.

## Conector Nelogica (investimentos)

A carteira pode ser alimentada automaticamente pela ProfitDLL (Nelogica/Ágora).
A DLL só roda no Windows, então ela fica em um serviço separado na máquina do
usuário: `connectors/nelogica/` (Python + FastAPI, README próprio com instalação,
NSSM e túnel HTTPS). O app guarda só a URL pública e o token do conector, cifrado.

Sincronização periódica: crie um cron no Railway (ou qualquer agendador) que chame

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<seu-app>/api/cron/sincronizar-corretoras
```

a cada 5 minutos no horário de pregão. O botão "Sincronizar agora" em
Investimentos → Conexões faz o mesmo sob demanda.

## Envio de ordens (feature flag)

Desligado por padrão para todo mundo. A conta tech liga por usuário no
Painel da Plataforma → loja → "Envio de ordens". O usuário começa em
**simulação** (só aceita conector com `PROFIT_SIMULATION=1`), define
quantidade máxima por ordem e perda diária máxima, e só passa para
**real** digitando a confirmação. Toda ordem, cancelamento, zeragem e
mudança de configuração fica em `auditoria_ordens`, tabela append-only com
trigger no banco que bloqueia UPDATE/DELETE. Cada usuário opera apenas a
própria conta com a própria licença — não existe caminho para operar por
terceiros.

## Como rodar com Railway

```bash
npm install
npm run railway:setup
npm run dev
```

O comando `railway:setup` faz duas coisas:

1. cria/atualiza o schema no PostgreSQL com `drizzle-kit push`
2. garante a criação da conta `tech`

## Deploy no Railway

Sugestão de fluxo:

1. Conecte este repositório GitHub ao Railway.
2. Adicione um banco PostgreSQL no mesmo projeto.
3. Na sua service web, crie uma Reference Variable `DATABASE_URL` apontando para o Postgres.
4. Configure também `JWT_SECRET` e, se quiser personalizar a conta inicial, `TECH_ADMIN_*`.
5. Em `Settings -> Deploy -> Pre-deploy Command`, defina `npm run railway:setup`.
6. Gere o domínio público em `Settings -> Networking`.

Configuração aplicada neste projeto para Railway:

- `next.config.ts` usa `output: "standalone"`
- `npm start` sobe `node .next/standalone/server.js`
- `npm run railway:setup` prepara schema e garante a conta `tech`

## Observações

- O upload de imagens continua usando `@vercel/blob`. Se quiser upload em produção, configure o token correspondente.
- O `netlify.toml` ficou legado e pode ser removido depois se você não for mais usar Netlify.
