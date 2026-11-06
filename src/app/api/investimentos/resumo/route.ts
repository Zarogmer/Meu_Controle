import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo-data';
import { respostaErro } from '@/lib/investimentos/http';
import { carregarOperacoes, carregarCotacoes } from '@/lib/investimentos/servidor';
import {
  avaliarPosicao,
  estatisticasDayTrade,
  processarCarteira,
  resultadoPorDia,
  resultadoPorMes,
  resumoPorModalidade,
} from '@/lib/investimentos/calculos';
import { competenciaAtual, isCompetencia } from '@/lib/contas';

/**
 * GET /api/investimentos/resumo?contaCorretoraId&competencia=YYYY-MM&periodo=mes|ano|tudo
 *
 * Posições com preço médio e cotação, patrimônio investido, resultado
 * do mês e do ano (day trade x swing), série diária acumulada e
 * estatísticas de day trade.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const compParam = sp.get('competencia') || '';
  const competencia = isCompetencia(compParam) ? compParam : competenciaAtual();
  const ano = competencia.slice(0, 4);
  const periodo = sp.get('periodo') === 'ano' ? 'ano' : sp.get('periodo') === 'tudo' ? 'tudo' : 'mes';

  if (isDemoMode) return NextResponse.json(vazio(competencia, periodo));

  try {
    const { lojaId, userId } = await requireInvestidor();
    const contaId = parseInt(sp.get('contaCorretoraId') || '', 10);
    const ops = await carregarOperacoes(
      { lojaId, userId },
      { contaCorretoraId: Number.isInteger(contaId) && contaId > 0 ? contaId : undefined },
    );

    const carteira = processarCarteira(ops);
    const cotacoes = await carregarCotacoes(carteira.posicoes.map((p) => p.ativo));

    const posicoes = carteira.posicoes.map((p) => {
      const cot = cotacoes[p.ativo];
      const aval = avaliarPosicao(p, cot?.preco);
      return {
        ...p,
        cotacao: cot?.preco ?? null,
        cotacaoEm: cot?.atualizadoEm ?? null,
        valorMercado: aval.valorMercado,
        resultadoNaoRealizado: aval.resultadoNaoRealizado,
      };
    });

    const custoTotal = posicoes.reduce((s, p) => s + p.custoTotal, 0);
    const comCotacao = posicoes.filter((p) => p.valorMercado !== null);
    // Patrimônio = valor de mercado onde há cotação, custo onde não há.
    const valorAtual = posicoes.reduce((s, p) => s + (p.valorMercado ?? p.custoTotal), 0);
    const naoRealizado = comCotacao.reduce((s, p) => s + (p.resultadoNaoRealizado ?? 0), 0);

    const porMesTodos = resultadoPorMes(carteira.operacoes);
    const mes = porMesTodos.find((m) => m.competencia === competencia)
      ?? { competencia, resultado: 0, daytrade: 0, swing: 0, taxas: 0, operacoes: 0 };
    const anoResumo = resumoPorModalidade(carteira.operacoes, (o) => o.dataOperacao.startsWith(`${ano}-`));
    const taxasAno = carteira.operacoes
      .filter((p) => p.operacao.dataOperacao.startsWith(`${ano}-`))
      .reduce((s, p) => s + Math.round(Number(p.operacao.taxas) || 0), 0);

    const filtroPeriodo = (data: string) =>
      periodo === 'tudo' ? true : periodo === 'ano' ? data.startsWith(`${ano}-`) : data.startsWith(competencia);
    const diario = resultadoPorDia(carteira.operacoes.filter((p) => filtroPeriodo(p.operacao.dataOperacao)));

    const dtMes = estatisticasDayTrade(carteira.operacoes.filter((p) => p.operacao.dataOperacao.startsWith(competencia)));
    const dtAno = estatisticasDayTrade(carteira.operacoes.filter((p) => p.operacao.dataOperacao.startsWith(`${ano}-`)));

    return NextResponse.json({
      competencia,
      ano,
      periodo,
      totalOperacoes: ops.length,
      posicoes,
      patrimonio: {
        custoTotal,
        valorAtual,
        resultadoNaoRealizado: naoRealizado,
        posicoesSemCotacao: posicoes.length - comCotacao.length,
      },
      mes,
      anoResumo: { ...anoResumo, taxas: taxasAno },
      totalRealizado: carteira.resultadoRealizadoTotal,
      taxasTotal: carteira.taxasTotal,
      diario,
      porMes: porMesTodos.filter((m) => m.competencia.startsWith(`${ano}-`)),
      dayTrade: { mes: dtMes, ano: dtAno },
    });
  } catch (error) {
    return respostaErro(error, 'resumo de investimentos');
  }
}

function vazio(competencia: string, periodo: string) {
  const dt = { trades: 0, vencedores: 0, perdedores: 0, empates: 0, taxaAcerto: 0, mediaGanho: 0, mediaPerda: 0, payoff: null, melhor: 0, pior: 0, resultado: 0 };
  return {
    competencia,
    ano: competencia.slice(0, 4),
    periodo,
    totalOperacoes: 0,
    posicoes: [],
    patrimonio: { custoTotal: 0, valorAtual: 0, resultadoNaoRealizado: 0, posicoesSemCotacao: 0 },
    mes: { competencia, resultado: 0, daytrade: 0, swing: 0, taxas: 0, operacoes: 0 },
    anoResumo: { daytrade: 0, swing: 0, total: 0, taxas: 0 },
    totalRealizado: 0,
    taxasTotal: 0,
    diario: [],
    porMes: [],
    dayTrade: { mes: dt, ano: dt },
  };
}
