import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, dividas } from '@/lib/db';
import { eq, and, ne, asc, sql } from 'drizzle-orm';
import { isDemoMode, demoDividasResumo } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoDividasResumo);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDays = sevenDaysLater.toISOString().split('T')[0];

    const [resumo] = await db
      .select({
        totalAReceber: sql<number>`COALESCE(SUM(${dividas.valorTotal} - ${dividas.valorPago}), 0)`,
        totalDevedores: sql<number>`COUNT(DISTINCT ${dividas.nomeDevedor})`,
        dividasVencidas: sql<number>`SUM(CASE WHEN ${dividas.dataVencimento} IS NOT NULL AND ${dividas.dataVencimento} < ${today} AND ${dividas.status} != 'pago' THEN 1 ELSE 0 END)`,
        valorVencido: sql<number>`COALESCE(SUM(CASE WHEN ${dividas.dataVencimento} IS NOT NULL AND ${dividas.dataVencimento} < ${today} AND ${dividas.status} != 'pago' THEN ${dividas.valorTotal} - ${dividas.valorPago} ELSE 0 END), 0)`,
        dividasHoje: sql<number>`SUM(CASE WHEN ${dividas.dataVencimento} = ${today} AND ${dividas.status} != 'pago' THEN 1 ELSE 0 END)`,
        dividasProximos7Dias: sql<number>`SUM(CASE WHEN ${dividas.dataVencimento} BETWEEN ${today} AND ${sevenDays} AND ${dividas.status} != 'pago' THEN 1 ELSE 0 END)`,
      })
      .from(dividas)
      .where(and(eq(dividas.lojaId, lojaId), ne(dividas.status, 'pago')));

    const devedoresRecentes = await db
      .select({
        nome: dividas.nomeDevedor,
        valor: sql<number>`${dividas.valorTotal} - ${dividas.valorPago}`,
        vencimento: dividas.dataVencimento,
        status: dividas.status,
      })
      .from(dividas)
      .where(and(eq(dividas.lojaId, lojaId), ne(dividas.status, 'pago')))
      .orderBy(asc(dividas.dataVencimento))
      .limit(4);

    return NextResponse.json({
      totalAReceber: Number(resumo.totalAReceber),
      totalDevedores: Number(resumo.totalDevedores),
      dividasVencidas: Number(resumo.dividasVencidas),
      valorVencido: Number(resumo.valorVencido),
      dividasHoje: Number(resumo.dividasHoje),
      dividasProximos7Dias: Number(resumo.dividasProximos7Dias),
      devedoresRecentes: devedoresRecentes.map(d => ({ ...d, valor: Number(d.valor) })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
