import { NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, vendas, lancamentos, gastos } from '@/lib/db';
import { and, eq, sql } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-data';
import { respostaErro } from '@/lib/investimentos/http';
import { carregarOperacoes, carregarCotacoes } from '@/lib/investimentos/servidor';
import { avaliarPosicao, processarCarteira } from '@/lib/investimentos/calculos';
import { gastosVisiveis, contasSemLancamento } from '@/lib/contas-recorrentes';
import { competenciaAtual } from '@/lib/contas';

/**
 * GET /api/dashboard/patrimonio  (só owner / super_admin)
 *
 * Visão consolidada: Patrimônio = caixa + investimentos − contas pendentes do mês.
 * - caixa: vendas registradas + lançamentos pagos − gastos da empresa pagos (desde sempre);
 * - investimentos: posições abertas a valor de mercado (ou custo, sem cotação);
 * - contas pendentes: gastos pendentes do mês + contas fixas ainda não lançadas.
 */
export async function GET() {
  if (isDemoMode) {
    return NextResponse.json({ caixa: 0, investimentos: 0, contasPendentes: 0, patrimonio: 0, detalhes: null });
  }
  try {
    const auth = await requireInvestidor();
    const { lojaId, userId, role } = auth;
    const competencia = competenciaAtual();

    const [v] = await db
      .select({ total: sql<number>`COALESCE(SUM(${vendas.precoUnitarioVenda} * ${vendas.quantidade}), 0)` })
      .from(vendas)
      .where(eq(vendas.lojaId, lojaId));
    const [l] = await db
      .select({ total: sql<number>`COALESCE(SUM(${lancamentos.valor}), 0)` })
      .from(lancamentos)
      .where(and(eq(lancamentos.lojaId, lojaId), eq(lancamentos.status, 'pago')));
    const [g] = await db
      .select({ total: sql<number>`COALESCE(SUM(${gastos.valor}), 0)` })
      .from(gastos)
      .where(and(eq(gastos.lojaId, lojaId), eq(gastos.tipo, 'empresa'), eq(gastos.status, 'pago')));

    const entradasVendas = Number(v.total);
    const entradasLancamentos = Number(l.total);
    const saidasGastos = Number(g.total);
    const caixa = entradasVendas + entradasLancamentos - saidasGastos;

    const ops = await carregarOperacoes({ lojaId, userId });
    const carteira = processarCarteira(ops);
    const cotacoes = await carregarCotacoes(carteira.posicoes.map((p) => p.ativo));
    const investimentos = carteira.posicoes.reduce((s, p) => {
      const aval = avaliarPosicao(p, cotacoes[p.ativo]?.preco);
      return s + (aval.valorMercado ?? p.custoTotal);
    }, 0);

    const competenciaEfetiva = sql<string>`COALESCE(${gastos.competencia}, LEFT(${gastos.dataGasto}, 7))`;
    const [pend] = await db
      .select({ total: sql<number>`COALESCE(SUM(${gastos.valor}), 0)` })
      .from(gastos)
      .where(and(gastosVisiveis({ lojaId, userId, role }), eq(gastos.status, 'pendente'), eq(competenciaEfetiva, competencia)));
    const naoLancadas = await contasSemLancamento({ lojaId, userId, role }, competencia);
    const contasPendentes = Number(pend.total) + naoLancadas.reduce((s, c) => s + c.valorEstimado, 0);

    return NextResponse.json({
      caixa,
      investimentos,
      contasPendentes,
      patrimonio: caixa + investimentos - contasPendentes,
      detalhes: {
        entradasVendas,
        entradasLancamentos,
        saidasGastos,
        posicoesAbertas: carteira.posicoes.length,
        resultadoRealizado: carteira.resultadoRealizadoTotal,
        competencia,
      },
    });
  } catch (error) {
    return respostaErro(error, 'patrimônio consolidado');
  }
}
