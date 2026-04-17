/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Bootstrap do super admin da plataforma em PostgreSQL.
 * Uso:
 *   node scripts/create-super-admin.js
 *
 * Requer:
 *   DATABASE_URL
 *
 * Opcional:
 *   TECH_ADMIN_NAME
 *   TECH_ADMIN_EMAIL
 *   TECH_ADMIN_PASSWORD
 */
const dotenv = require('dotenv');
const postgres = require('postgres');
const bcrypt = require('bcrypt');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());
dotenv.config({ path: '.env.local', override: false });

const DATABASE_URL = process.env.DATABASE_URL;
const TECH_ADMIN_NAME = process.env.TECH_ADMIN_NAME || 'Guilherme';
const TECH_ADMIN_EMAIL = process.env.TECH_ADMIN_EMAIL || 'guilherme@meuestoque.com';
const TECH_ADMIN_PASSWORD = process.env.TECH_ADMIN_PASSWORD || 'admin123';

if (!DATABASE_URL) {
  console.error('DATABASE_URL nao configurada.');
  process.exit(1);
}

if (TECH_ADMIN_PASSWORD.length < 8) {
  console.error('TECH_ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.');
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL, { prepare: false });

  try {
    const existing = await sql`
      select id, email, role
      from usuarios
      where email = ${TECH_ADMIN_EMAIL}
      limit 1
    `;

    if (existing.length > 0) {
      console.log(`Super admin ja existe: ${TECH_ADMIN_EMAIL}`);
      return;
    }

    const senhaHash = await bcrypt.hash(TECH_ADMIN_PASSWORD, 10);

    const inserted = await sql`
      insert into usuarios (loja_id, nome, email, senha_hash, role, ativo)
      values (null, ${TECH_ADMIN_NAME}, ${TECH_ADMIN_EMAIL}, ${senhaHash}, 'super_admin', true)
      returning id, nome, email, role
    `;

    console.log('Super admin criado com sucesso.');
    console.log(inserted[0]);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('Erro ao criar super admin:', error);
  process.exit(1);
});
