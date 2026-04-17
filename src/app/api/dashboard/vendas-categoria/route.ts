import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, vendas, produtos, categorias } from '@/lib/db';
import { eq, sql, desc } from 'drizzle-orm';
import { isDemoMode, demoVendasCategoria } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoVendasCategoria);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const rows = await db
      .select({
        categoria: sql<string>`COALESCE(${categorias.nome}, 'Sem categoria')`,
        total: sql<number>`SUM(${vendas.precoUnitarioVenda} * ${vendas.quantidade})`,
      })
      .from(vendas)
      .innerJoin(produtos, eq(vendas.produtoId, produtos.id))
      .leftJoin(categorias, eq(produtos.categoriaId, categorias.id))
      .where(eq(vendas.lojaId, lojaId))
      .groupBy(categorias.id, categorias.nome)
      .orderBy(sql`SUM(${vendas.precoUnitarioVenda} * ${vendas.quantidade}) DESC`)
      .limit(5);

    return NextResponse.json({ vendas: rows.map(r => ({ categoria: r.categoria, total: Number(r.total) })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
