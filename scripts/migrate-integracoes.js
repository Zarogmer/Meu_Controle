/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Idempotent migration for integrações de corretora (Fase 3 — conector Nelogica).
 *
 * Uso local: node scripts/migrate-integracoes.js
 * Requer: DATABASE_URL
 */
const dotenv = require('dotenv');
const postgres = require('postgres');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());
dotenv.config({ path: '.env.local', override: false });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL nao configurada.');
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL, { max: 1 });

  try {
    await sql`
      DO $$ BEGIN
        CREATE TYPE status_integracao AS ENUM ('desconectado', 'conectado', 'erro');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS integracoes_corretora (
        id SERIAL PRIMARY KEY,
        loja_id INTEGER NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        conta_corretora_id INTEGER NOT NULL REFERENCES contas_corretora(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'nelogica',
        url_conector TEXT NOT NULL,
        token_criptografado TEXT NOT NULL,
        chave_ativacao_criptografada TEXT,
        status status_integracao NOT NULL DEFAULT 'desconectado',
        ultimo_sync_em TIMESTAMPTZ,
        ultimo_erro TEXT,
        cursor_trades TEXT,
        ultimo_health TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_integracoes_loja_usuario ON integracoes_corretora (loja_id, usuario_id)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_integracoes_conta ON integracoes_corretora (conta_corretora_id)`;

    console.log('[migrate] integracoes_corretora ok');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[migrate] falhou:', err);
  process.exit(1);
});
