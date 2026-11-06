/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Idempotent migration for investimentos (Fase 2):
 * contas_corretora, operacoes e cotacoes_cache.
 *
 * Safe to run on every deploy.
 *
 * Uso local: node scripts/migrate-investimentos.js
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
    const enums = [
      ['origem_conta_corretora', "'manual', 'nelogica'"],
      ['mercado_operacao', "'acoes', 'futuros', 'opcoes', 'fii', 'outros'"],
      ['lado_operacao', "'compra', 'venda'"],
      ['modalidade_operacao', "'daytrade', 'swing'"],
      ['origem_operacao', "'manual', 'importacao', 'nelogica'"],
    ];
    for (const [name, values] of enums) {
      await sql.unsafe(`
        DO $$ BEGIN
          CREATE TYPE ${name} AS ENUM (${values});
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `);
    }

    await sql`
      CREATE TABLE IF NOT EXISTS contas_corretora (
        id SERIAL PRIMARY KEY,
        loja_id INTEGER NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        corretora TEXT NOT NULL DEFAULT 'outra',
        apelido TEXT NOT NULL,
        conta TEXT,
        origem origem_conta_corretora NOT NULL DEFAULT 'manual',
        ativa BOOLEAN NOT NULL DEFAULT TRUE,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_contas_corretora_loja_usuario ON contas_corretora (loja_id, usuario_id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS operacoes (
        id SERIAL PRIMARY KEY,
        loja_id INTEGER NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        conta_corretora_id INTEGER NOT NULL REFERENCES contas_corretora(id) ON DELETE CASCADE,
        ativo TEXT NOT NULL,
        mercado mercado_operacao NOT NULL DEFAULT 'acoes',
        lado lado_operacao NOT NULL,
        quantidade INTEGER NOT NULL,
        preco NUMERIC(18, 6) NOT NULL,
        multiplicador NUMERIC(12, 4) NOT NULL DEFAULT 1,
        taxas INTEGER NOT NULL DEFAULT 0,
        data_operacao TEXT NOT NULL,
        horario TEXT,
        modalidade modalidade_operacao NOT NULL DEFAULT 'swing',
        origem origem_operacao NOT NULL DEFAULT 'manual',
        id_externo TEXT,
        hash_dedupe TEXT,
        observacao TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_operacoes_loja_usuario ON operacoes (loja_id, usuario_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_operacoes_conta_data ON operacoes (conta_corretora_id, data_operacao)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_operacoes_usuario_ativo ON operacoes (usuario_id, ativo)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_operacoes_conta_id_externo ON operacoes (conta_corretora_id, id_externo)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_operacoes_conta_hash ON operacoes (conta_corretora_id, hash_dedupe)`;

    await sql`
      CREATE TABLE IF NOT EXISTS cotacoes_cache (
        ativo TEXT PRIMARY KEY,
        preco NUMERIC(18, 6) NOT NULL,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    console.log('[migrate] investimentos ok');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[migrate] falhou:', err);
  process.exit(1);
});
