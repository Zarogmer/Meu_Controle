import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// Re-export schema and types for convenience
export * from './schema';

let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Get your connection string from your Supabase project.'
    );
  }

  const client = postgres(url, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

/**
 * Lazy-initialized Drizzle database instance.
 * Uses a Proxy so that `db.select()`, `db.insert()`, etc. work
 * without calling `getDb()` explicitly in every route.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

// ── Tenant Isolation Helper ────────────────────────────────────
// Garante que toda query inclui o filtro de lojaId,
// prevenindo acesso entre tenants.
//
// Uso:
//   import { withTenant } from '@/lib/db';
//   const rows = await db.select().from(produtos).where(withTenant(produtos.lojaId, lojaId));
//   const rows = await db.select().from(produtos).where(withTenant(produtos.lojaId, lojaId, eq(produtos.ativo, true)));

/**
 * Cria uma condição WHERE que sempre inclui o filtro de tenant (loja_id).
 * Use em TODAS as queries de tabelas tenant para garantir isolamento.
 *
 * @param column - A coluna lojaId da tabela (ex: produtos.lojaId)
 * @param lojaId - O ID da loja do usuário autenticado
 * @param extraCondition - Condição adicional opcional (ex: eq(produtos.id, 5))
 * @returns SQL condition com lojaId + condição extra
 *
 * @example
 * // Query simples — filtra por loja
 * db.select().from(produtos).where(withTenant(produtos.lojaId, lojaId))
 *
 * // Com condição extra — filtra por loja E por id
 * db.select().from(produtos).where(withTenant(produtos.lojaId, lojaId, eq(produtos.id, produtoId)))
 *
 * // Múltiplas condições extras
 * db.select().from(produtos).where(withTenant(produtos.lojaId, lojaId, and(eq(produtos.categoriaId, catId), gte(produtos.quantidade, 0))))
 */
export function withTenant(
  column: PgColumn,
  lojaId: number,
  extraCondition?: SQL | undefined
): SQL {
  const tenantFilter = eq(column, lojaId);
  return extraCondition ? and(tenantFilter, extraCondition)! : tenantFilter;
}
