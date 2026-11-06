/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Idempotent migration for contas fixas / faturas (Fase 1 de finanças).
 *
 * - Creates enum categoria_conta and the contas_recorrentes table.
 * - Adds conta_recorrente_id, data_vencimento, competencia and anexo_url
 *   to gastos (all nullable, so existing rows keep working).
 *
 * Safe to run on every deploy.
 *
 * Uso local: node scripts/migrate-contas-recorrentes.js
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
        CREATE TYPE categoria_conta AS ENUM ('luz', 'agua', 'internet', 'aluguel', 'cartao', 'outros');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS contas_recorrentes (
        id SERIAL PRIMARY KEY,
        loja_id INTEGER NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        tipo tipo_gasto NOT NULL DEFAULT 'empresa',
        nome TEXT NOT NULL,
        categoria categoria_conta NOT NULL DEFAULT 'outros',
        valor_estimado INTEGER NOT NULL DEFAULT 0,
        dia_vencimento INTEGER NOT NULL DEFAULT 10,
        ativa BOOLEAN NOT NULL DEFAULT TRUE,
        observacao TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_contas_recorrentes_loja ON contas_recorrentes (loja_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_contas_recorrentes_loja_tipo ON contas_recorrentes (loja_id, tipo)`;

    // Novas colunas em gastos (ligação com a conta fixa + fatura/boleto).
    await sql`
      ALTER TABLE gastos
        ADD COLUMN IF NOT EXISTS conta_recorrente_id INTEGER REFERENCES contas_recorrentes(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS data_vencimento TEXT,
        ADD COLUMN IF NOT EXISTS competencia TEXT,
        ADD COLUMN IF NOT EXISTS anexo_url TEXT
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_gastos_loja_competencia ON gastos (loja_id, competencia)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_gastos_conta_recorrente ON gastos (conta_recorrente_id)`;

    console.log('[migrate] contas_recorrentes ok');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[migrate] falhou:', err);
  process.exit(1);
});
