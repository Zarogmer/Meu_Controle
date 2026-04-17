import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, vendas } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { isDemoMode, demoVendasSemana } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoVendasSemana);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
    const since = twentyEightDaysAgo.toISOString().split('T')[0];

    // Last 4 weeks of sales grouped by ISO week
    const rows = await db
      .select({
        semana: sql<string>`TO_CHAR(${vendas.dataVenda}::date, 'IW')`,
        total: sql<number>`SUM(${vendas.precoUnitarioVenda} * ${vendas.quantidade})`,
      })
      .from(vendas)
      .where(
        sql`${vendas.lojaId} = ${lojaId} AND ${vendas.dataVenda} >= ${since}`
      )
      .groupBy(sql`TO_CHAR(${vendas.dataVenda}::date, 'IW')`)
      .orderBy(sql`TO_CHAR(${vendas.dataVenda}::date, 'IW') ASC`);

    return NextResponse.json({ vendas: rows.map(r => ({ semana: r.semana, total: Number(r.total) })) });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
