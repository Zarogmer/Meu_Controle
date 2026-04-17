import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, produtos, vendas } from '@/lib/db';
import { eq, gte, sql, count } from 'drizzle-orm';
import { isDemoMode, demoResumo } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoResumo);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const [prodCount] = await db
      .select({ c: count() })
      .from(produtos)
      .where(eq(produtos.lojaId, lojaId));
    const totalProdutos = prodCount.c;

    const [estoqueResult] = await db
      .select({
        v: sql<number>`COALESCE(SUM(${produtos.precoVenda} * ${produtos.quantidade}), 0)`,
      })
      .from(produtos)
      .where(eq(produtos.lojaId, lojaId));
    const valorEstoque = Number(estoqueResult.v);

    // Vendas dos ultimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split('T')[0];

    const [vendasPeriodo] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${vendas.precoUnitarioVenda} * ${vendas.quantidade}), 0)`,
        lucro: sql<number>`COALESCE(SUM((${vendas.precoUnitarioVenda} - ${vendas.precoUnitarioCusto}) * ${vendas.quantidade}), 0)`,
      })
      .from(vendas)
      .where(
        sql`${vendas.lojaId} = ${lojaId} AND ${vendas.dataVenda} >= ${since}`
      );

    return NextResponse.json({
      totalProdutos,
      valorEstoque,
      totalVendasPeriodo: Number(vendasPeriodo.total),
      lucroPeriodo: Number(vendasPeriodo.lucro),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
