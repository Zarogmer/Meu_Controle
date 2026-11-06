/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Idempotent migration for trading (Fase 4): feature flag/limites por
 * usuário e log de auditoria imutável de ordens.
 *
 * Uso local: node scripts/migrate-trading.js
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
        CREATE TYPE modo_trading AS ENUM ('simulacao', 'real');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS trading_config (
        id SERIAL PRIMARY KEY,
        loja_id INTEGER NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        trading_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
        habilitado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        habilitado_em TIMESTAMPTZ,
        modo modo_trading NOT NULL DEFAULT 'simulacao',
        quantidade_maxima INTEGER NOT NULL DEFAULT 1,
        perda_diaria_maxima INTEGER NOT NULL DEFAULT 10000,
        modo_real_aceito_em TIMESTAMPTZ,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_trading_config_usuario ON trading_config (usuario_id, loja_id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS auditoria_ordens (
        id SERIAL PRIMARY KEY,
        loja_id INTEGER NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        conta_corretora_id INTEGER REFERENCES contas_corretora(id) ON DELETE SET NULL,
        ordem_ref TEXT NOT NULL,
        evento TEXT NOT NULL,
        modo modo_trading NOT NULL,
        ativo TEXT,
        bolsa TEXT,
        lado TEXT,
        tipo TEXT,
        quantidade INTEGER,
        preco NUMERIC(18, 6),
        preco_stop NUMERIC(18, 6),
        local_order_id TEXT,
        cl_order_id TEXT,
        mensagem TEXT,
        detalhes TEXT,
        ip_origem TEXT,
        user_agent TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_auditoria_ordens_usuario ON auditoria_ordens (loja_id, usuario_id, criado_em)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_auditoria_ordens_ref ON auditoria_ordens (ordem_ref)`;

    // Imutabilidade garantida no banco: nenhum UPDATE/DELETE passa, nem pelo app.
    await sql`
      CREATE OR REPLACE FUNCTION auditoria_ordens_imutavel() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'auditoria_ordens é imutável (append-only)';
      END;
      $$ LANGUAGE plpgsql
    `;
    await sql`
      DO $$ BEGIN
        CREATE TRIGGER trg_auditoria_ordens_imutavel
          BEFORE UPDATE OR DELETE ON auditoria_ordens
          FOR EACH ROW EXECUTE FUNCTION auditoria_ordens_imutavel();
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `;

    console.log('[migrate] trading ok');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[migrate] falhou:', err);
  process.exit(1);
});
