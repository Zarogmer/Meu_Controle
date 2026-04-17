import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, vendas } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { isDemoMode, demoLucroMensal } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoLucroMensal);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    // Last 6 months of profit
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const since = sixMonthsAgo.toISOString().split('T')[0];

    const lucros = await db
      .select({
        mes: sql<string>`TO_CHAR(${vendas.dataVenda}::date, 'YYYY-MM')`,
        lucro: sql<number>`SUM((${vendas.precoUnitarioVenda} - ${vendas.precoUnitarioCusto}) * ${vendas.quantidade})`,
      })
      .from(vendas)
      .where(
        sql`${vendas.lojaId} = ${lojaId} AND ${vendas.dataVenda} >= ${since}`
      )
      .groupBy(sql`TO_CHAR(${vendas.dataVenda}::date, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${vendas.dataVenda}::date, 'YYYY-MM') ASC`);

    return NextResponse.json({ lucros: lucros.map(l => ({ mes: l.mes, lucro: Number(l.lucro) })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
