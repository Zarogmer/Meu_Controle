/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Remove todos os dados de lojistas e preserva somente a conta tech.
 * Uso:
 *   node scripts/reset-platform.js
 */
const dotenv = require('dotenv');
const postgres = require('postgres');
const bcrypt = require('bcrypt');

dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;
const TECH_ADMIN_NAME = process.env.TECH_ADMIN_NAME || 'Guilherme';
const TECH_ADMIN_EMAIL = process.env.TECH_ADMIN_EMAIL || 'guilherme@meucontrole.com';
const TECH_ADMIN_PASSWORD = process.env.TECH_ADMIN_PASSWORD || 'admin123';

if (!DATABASE_URL) {
  console.error('DATABASE_URL nao configurada.');
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL, { prepare: false });

  try {
    const senhaHash = await bcrypt.hash(TECH_ADMIN_PASSWORD, 10);

    await sql.begin(async (tx) => {
      await tx`delete from vendas`;
      await tx`delete from lancamentos`;
      await tx`delete from dividas`;
      await tx`delete from tarefas`;
      await tx`delete from produtos`;
      await tx`delete from categorias`;
      await tx`delete from usuarios where email <> ${TECH_ADMIN_EMAIL}`;
      await tx`delete from lojas`;

      const existingTech = await tx`
        select id
        from usuarios
        where email = ${TECH_ADMIN_EMAIL}
        limit 1
      `;

      if (existingTech.length > 0) {
        await tx`
          update usuarios
          set
            loja_id = null,
            nome = ${TECH_ADMIN_NAME},
            senha_hash = ${senhaHash},
            role = 'super_admin',
            ativo = true
          where email = ${TECH_ADMIN_EMAIL}
        `;
      } else {
        await tx`
          insert into usuarios (loja_id, nome, email, senha_hash, role, ativo)
          values (null, ${TECH_ADMIN_NAME}, ${TECH_ADMIN_EMAIL}, ${senhaHash}, 'super_admin', true)
        `;
      }
    });

    console.log('Plataforma resetada com sucesso. Apenas a conta tech foi mantida.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('Erro ao resetar plataforma:', error);
  process.exit(1);
});
