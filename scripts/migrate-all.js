/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Runs every idempotent migration script in order.
 *
 * Point Railway's preDeployCommand at this single entry so new migrations
 * only need to be appended to the list below — no Railway config change
 * needed per migration.
 *
 * Uso: node scripts/migrate-all.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const MIGRATIONS = [
  'migrate-profile-fields.js',
  'migrate-gastos.js',
];

for (const script of MIGRATIONS) {
  const full = path.join(__dirname, script);
  console.log(`\n[migrate-all] running ${script}`);
  const result = spawnSync(process.execPath, [full], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[migrate-all] ${script} falhou (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[migrate-all] todas migrações concluídas');
