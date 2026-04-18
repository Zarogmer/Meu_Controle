/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Idempotent migration for the gastos (expenses) feature.
 *
 * Creates enums tipo_gasto / status_gasto and the gastos table if missing.
 * Safe to run on every deploy.
 *
 * Uso local: node scripts/migrate-gastos.js
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
        CREATE TYPE tipo_gasto AS ENUM ('pessoal', 'empresa');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `;
    await sql`
      DO $$ BEGIN
        CREATE TYPE status_gasto AS ENUM ('pago', 'pendente');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS gastos (
        id SERIAL PRIMARY KEY,
        loja_id INTEGER NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        tipo tipo_gasto NOT NULL DEFAULT 'empresa',
        descricao TEXT NOT NULL,
        categoria TEXT,
        valor INTEGER NOT NULL,
        data_gasto TEXT NOT NULL,
        status status_gasto NOT NULL DEFAULT 'pago',
        observacao TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_gastos_loja ON gastos (loja_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_gastos_loja_tipo ON gastos (loja_id, tipo)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_gastos_loja_data ON gastos (loja_id, data_gasto)`;

    console.log('[migrate] gastos ok');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[migrate] falhou:', err);
  process.exit(1);
});
