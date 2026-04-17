import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, vendas, produtos } from '@/lib/db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { isDemoMode, demoTopProdutos } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoTopProdutos);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const rows = await db
      .select({
        nome: produtos.nome,
        totalVendido: sql<number>`SUM(${vendas.quantidade})`,
        faturamento: sql<number>`SUM(${vendas.precoUnitarioVenda} * ${vendas.quantidade})`,
      })
      .from(vendas)
      .innerJoin(produtos, eq(vendas.produtoId, produtos.id))
      .where(eq(vendas.lojaId, lojaId))
      .groupBy(produtos.id, produtos.nome)
      .orderBy(sql`SUM(${vendas.quantidade}) DESC`)
      .limit(5);

    return NextResponse.json({ produtos: rows.map(r => ({ ...r, totalVendido: Number(r.totalVendido), faturamento: Number(r.faturamento) })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
