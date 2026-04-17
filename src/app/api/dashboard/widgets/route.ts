import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, vendas } from '@/lib/db';
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import { isDemoMode, demoWidgets } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoWidgets);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Meta Diaria -- last 7 days of daily sales
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since7d = sevenDaysAgo.toISOString().split('T')[0];

    const dailySales = await db
      .select({
        dia: vendas.dataVenda,
        total: sql<number>`SUM(${vendas.precoUnitarioVenda} * ${vendas.quantidade})`,
      })
      .from(vendas)
      .where(
        sql`${vendas.lojaId} = ${lojaId} AND ${vendas.dataVenda} >= ${since7d}`
      )
      .groupBy(vendas.dataVenda)
      .orderBy(sql`${vendas.dataVenda} ASC`);

    const vendasHoje = Number(dailySales.find(d => d.dia === today)?.total ?? 0);
    const totalDays = dailySales.length || 1;
    const mediaDiaria = dailySales.reduce((sum, d) => sum + Number(d.total), 0) / totalDays;
    const percentual = mediaDiaria > 0 ? Math.round((vendasHoje / mediaDiaria) * 100) : 0;
    const maxPercent = Math.max(...dailySales.map(d => mediaDiaria > 0 ? Math.round((Number(d.total) / mediaDiaria) * 100) : 0), percentual);

    // Faturamento -- last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since30d = thirtyDaysAgo.toISOString().split('T')[0];

    const faturamentoGrafico = await db
      .select({
        dia: vendas.dataVenda,
        total: sql<number>`SUM(${vendas.precoUnitarioVenda} * ${vendas.quantidade})`,
      })
      .from(vendas)
      .where(
        sql`${vendas.lojaId} = ${lojaId} AND ${vendas.dataVenda} >= ${since30d}`
      )
      .groupBy(vendas.dataVenda)
      .orderBy(sql`${vendas.dataVenda} ASC`);

    const faturamentoTotal = faturamentoGrafico.reduce((s, d) => s + Number(d.total), 0);

    // Previous 30 days for variation
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const since60d = sixtyDaysAgo.toISOString().split('T')[0];

    const [faturamentoAnteriorResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${vendas.precoUnitarioVenda} * ${vendas.quantidade}), 0)`,
      })
      .from(vendas)
      .where(
        sql`${vendas.lojaId} = ${lojaId} AND ${vendas.dataVenda} >= ${since60d} AND ${vendas.dataVenda} < ${since30d}`
      );
    const faturamentoAnterior = Number(faturamentoAnteriorResult.total);

    const variacao = faturamentoAnterior > 0
      ? Math.round(((faturamentoTotal - faturamentoAnterior) / faturamentoAnterior) * 1000) / 10
      : 0;

    // Calendario -- days with sales this month
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const diasComVendaRows = await db
      .select({
        dia: sql<number>`EXTRACT(DAY FROM ${vendas.dataVenda}::date)::int`,
      })
      .from(vendas)
      .where(
        sql`${vendas.lojaId} = ${lojaId} AND ${vendas.dataVenda} >= ${monthStart}`
      )
      .groupBy(sql`EXTRACT(DAY FROM ${vendas.dataVenda}::date)`)
      .orderBy(sql`EXTRACT(DAY FROM ${vendas.dataVenda}::date)`);

    const diasComVenda = diasComVendaRows.map(d => Number(d.dia));

    return NextResponse.json({
      metaDiaria: {
        percentual,
        maxPercent,
        vendasHoje,
        mediaDiaria: Math.round(mediaDiaria),
        grafico: dailySales.map(d => ({ dia: d.dia, total: Number(d.total) })),
      },
      faturamento: {
        total: faturamentoTotal,
        variacao,
        grafico: faturamentoGrafico.map(d => ({ dia: d.dia, total: Number(d.total) })),
      },
      calendario: {
        mes: now.getMonth(),
        ano: now.getFullYear(),
        diaAtual: now.getDate(),
        diasComVenda,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro widgets:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
