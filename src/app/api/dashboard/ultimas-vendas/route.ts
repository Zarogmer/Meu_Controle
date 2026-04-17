import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, vendas, produtos } from '@/lib/db';
import { eq, desc, sql } from 'drizzle-orm';
import { isDemoMode, demoUltimasVendas } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoUltimasVendas);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const rows = await db
      .select({
        id: vendas.id,
        produtoNome: produtos.nome,
        quantidade: vendas.quantidade,
        total: sql<number>`${vendas.precoUnitarioVenda} * ${vendas.quantidade}`,
        dataVenda: vendas.dataVenda,
      })
      .from(vendas)
      .innerJoin(produtos, eq(vendas.produtoId, produtos.id))
      .where(eq(vendas.lojaId, lojaId))
      .orderBy(desc(vendas.dataVenda), desc(vendas.id))
      .limit(5);

    return NextResponse.json({ vendas: rows.map(r => ({ ...r, total: Number(r.total) })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
