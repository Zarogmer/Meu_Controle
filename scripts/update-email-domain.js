require('dotenv').config({ path: '.env.local' });

const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL;
const OLD_DOMAIN = process.env.OLD_EMAIL_DOMAIN || 'meuestoque.com';
const NEW_DOMAIN = process.env.NEW_EMAIL_DOMAIN || 'meucontrole.com';

if (!DATABASE_URL) {
  console.error('DATABASE_URL não configurada.');
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL, { prepare: false });

  try {
    const users = await sql`
      select id, email
      from usuarios
      where email like ${`%@${OLD_DOMAIN}`}
    `;

    for (const user of users) {
      const updatedEmail = user.email.replace(`@${OLD_DOMAIN}`, `@${NEW_DOMAIN}`);
      await sql`
        update usuarios
        set email = ${updatedEmail}
        where id = ${user.id}
      `;
      console.log(`${user.email} -> ${updatedEmail}`);
    }

    console.log(`Total atualizado: ${users.length}`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('Erro ao atualizar domínios de e-mail:', error);
  process.exit(1);
});
