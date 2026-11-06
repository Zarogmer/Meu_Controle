import { describe, expect, it } from 'vitest';
import {
  avaliarPosicao,
  classificarModalidade,
  estatisticasDayTrade,
  mercadoSugerido,
  multiplicadorSugerido,
  ordenarOperacoes,
  processarCarteira,
  resultadoPorDia,
  resultadoPorMes,
  resumoPorModalidade,
  type OperacaoBase,
} from './calculos';

let seq = 0;
function op(partial: Partial<OperacaoBase> & Pick<OperacaoBase, 'ativo' | 'lado' | 'quantidade' | 'preco'>): OperacaoBase {
  seq += 1;
  return {
    id: seq,
    mercado: 'acoes',
    multiplicador: 1,
    taxas: 0,
    dataOperacao: '2026-03-10',
    modalidade: 'swing',
    ...partial,
  };
}

describe('processarCarteira — preço médio', () => {
  it('calcula preço médio ponderado em compras sucessivas', () => {
    const c = processarCarteira([
      op({ ativo: 'PETR4', lado: 'compra', quantidade: 100, preco: 10 }),
      op({ ativo: 'PETR4', lado: 'compra', quantidade: 100, preco: 12 }),
    ]);
    expect(c.posicoes).toHaveLength(1);
    expect(c.posicoes[0]).toMatchObject({ ativo: 'PETR4', quantidade: 200, precoMedio: 11, custoTotal: 220000 });
    expect(c.resultadoRealizadoTotal).toBe(0);
  });

  it('venda parcial realiza resultado e mantém o preço médio', () => {
    const c = processarCarteira([
      op({ ativo: 'PETR4', lado: 'compra', quantidade: 100, preco: 10 }),
      op({ ativo: 'PETR4', lado: 'compra', quantidade: 100, preco: 12 }),
      op({ ativo: 'petr4', lado: 'venda', quantidade: 50, preco: 15, taxas: 250 }),
    ]);
    const venda = c.operacoes[2];
    expect(venda.precoMedioAntes).toBe(11);
    expect(venda.quantidadeFechada).toBe(50);
    expect(venda.resultadoBruto).toBe(20000); // (15 − 11) × 50 = R$ 200
    expect(venda.resultadoLiquido).toBe(19750);
    expect(c.posicoes[0]).toMatchObject({ quantidade: 150, precoMedio: 11 });
    expect(c.realizadoPorAtivo.PETR4).toBe(19750);
    expect(c.taxasTotal).toBe(250);
  });

  it('zerar a posição tira o ativo da lista de posições mas mantém o realizado', () => {
    const c = processarCarteira([
      op({ ativo: 'VALE3', lado: 'compra', quantidade: 10, preco: 60 }),
      op({ ativo: 'VALE3', lado: 'venda', quantidade: 10, preco: 55 }),
    ]);
    expect(c.posicoes).toHaveLength(0);
    expect(c.realizadoPorAtivo.VALE3).toBe(-5000);
  });

  it('vender mais do que tem inverte para posição vendida com PM no preço da venda', () => {
    const c = processarCarteira([
      op({ ativo: 'ABEV3', lado: 'compra', quantidade: 100, preco: 14 }),
      op({ ativo: 'ABEV3', lado: 'venda', quantidade: 150, preco: 16 }),
    ]);
    expect(c.operacoes[1].resultadoBruto).toBe(20000); // 100 × 2
    expect(c.posicoes[0]).toMatchObject({ quantidade: -50, precoMedio: 16, custoTotal: 80000 });
  });

  it('posição vendida fecha com compra: lucro quando compra mais barato', () => {
    const c = processarCarteira([
      op({ ativo: 'ITUB4', lado: 'venda', quantidade: 100, preco: 30 }),
      op({ ativo: 'ITUB4', lado: 'compra', quantidade: 100, preco: 27, taxas: 100 }),
    ]);
    expect(c.operacoes[1].resultadoBruto).toBe(30000);
    expect(c.operacoes[1].resultadoLiquido).toBe(29900);
    expect(c.posicoes).toHaveLength(0);
  });

  it('futuros usam pontos × multiplicador (WIN = R$ 0,20 por ponto)', () => {
    const c = processarCarteira([
      op({ ativo: 'WINZ26', mercado: 'futuros', multiplicador: 0.2, lado: 'compra', quantidade: 2, preco: 120000, modalidade: 'daytrade', horario: '10:00:00' }),
      op({ ativo: 'WINZ26', mercado: 'futuros', multiplicador: 0.2, lado: 'venda', quantidade: 2, preco: 120150, modalidade: 'daytrade', horario: '10:05:00', taxas: 180 }),
    ]);
    expect(c.operacoes[1].resultadoBruto).toBe(6000); // 150 pts × 2 × 0,2 = R$ 60
    expect(c.operacoes[1].resultadoLiquido).toBe(5820);
    expect(c.posicoes).toHaveLength(0);
  });

  it('custo da posição em futuros respeita o multiplicador', () => {
    const c = processarCarteira([
      op({ ativo: 'WDOF27', mercado: 'futuros', multiplicador: 10, lado: 'compra', quantidade: 1, preco: 5500.5 }),
    ]);
    expect(c.posicoes[0].custoTotal).toBe(5500500); // 5500,5 × 10 = R$ 55.005,00
  });

  it('respeita a ordem cronológica mesmo se a lista vier embaralhada', () => {
    const c = processarCarteira([
      op({ id: 'b', ativo: 'BBAS3', lado: 'venda', quantidade: 10, preco: 30, dataOperacao: '2026-03-12' }),
      op({ id: 'a', ativo: 'BBAS3', lado: 'compra', quantidade: 10, preco: 25, dataOperacao: '2026-03-11' }),
    ]);
    expect(c.operacoes[0].operacao.id).toBe('a');
    expect(c.operacoes[1].resultadoBruto).toBe(5000);
  });
});

describe('ordenarOperacoes', () => {
  it('ordena por data, depois horário, depois id', () => {
    const ordenadas = ordenarOperacoes([
      op({ id: 3, ativo: 'X', lado: 'compra', quantidade: 1, preco: 1, dataOperacao: '2026-01-02', horario: '09:00:00' }),
      op({ id: 2, ativo: 'X', lado: 'compra', quantidade: 1, preco: 1, dataOperacao: '2026-01-02', horario: '08:30:00' }),
      op({ id: 1, ativo: 'X', lado: 'compra', quantidade: 1, preco: 1, dataOperacao: '2026-01-01' }),
      op({ id: 0, ativo: 'X', lado: 'compra', quantidade: 1, preco: 1, dataOperacao: '2026-01-02', horario: '08:30:00' }),
    ]);
    expect(ordenadas.map((o) => o.id)).toEqual([1, 0, 2, 3]);
  });
});

describe('agregações', () => {
  const carteira = processarCarteira([
    // dia 10: day trade vencedor em WIN (+R$ 40 − R$ 2 taxas)
    op({ ativo: 'WINZ26', mercado: 'futuros', multiplicador: 0.2, lado: 'compra', quantidade: 1, preco: 120000, modalidade: 'daytrade', dataOperacao: '2026-03-10', horario: '10:00' }),
    op({ ativo: 'WINZ26', mercado: 'futuros', multiplicador: 0.2, lado: 'venda', quantidade: 1, preco: 120200, modalidade: 'daytrade', dataOperacao: '2026-03-10', horario: '10:30', taxas: 200 }),
    // dia 11: day trade perdedor em WIN (−R$ 20)
    op({ ativo: 'WINZ26', mercado: 'futuros', multiplicador: 0.2, lado: 'venda', quantidade: 1, preco: 121000, modalidade: 'daytrade', dataOperacao: '2026-03-11', horario: '11:00' }),
    op({ ativo: 'WINZ26', mercado: 'futuros', multiplicador: 0.2, lado: 'compra', quantidade: 1, preco: 121100, modalidade: 'daytrade', dataOperacao: '2026-03-11', horario: '11:10' }),
    // swing: compra em março, vende em abril com lucro de R$ 100
    op({ ativo: 'PETR4', lado: 'compra', quantidade: 100, preco: 30, dataOperacao: '2026-03-11' }),
    op({ ativo: 'PETR4', lado: 'venda', quantidade: 100, preco: 31, dataOperacao: '2026-04-02' }),
  ]);

  it('resultadoPorDia soma por dia com acumulado', () => {
    const dias = resultadoPorDia(carteira.operacoes);
    expect(dias.map((d) => [d.data, d.resultado, d.acumulado])).toEqual([
      ['2026-03-10', 3800, 3800],
      ['2026-03-11', -2000, 1800],
      ['2026-04-02', 10000, 11800],
    ]);
    expect(dias[1]).toMatchObject({ daytrade: -2000, swing: 0, operacoes: 3 });
  });

  it('resultadoPorMes separa day trade e swing', () => {
    const meses = resultadoPorMes(carteira.operacoes);
    expect(meses).toEqual([
      { competencia: '2026-03', resultado: 1800, daytrade: 1800, swing: 0, taxas: 200, operacoes: 5 },
      { competencia: '2026-04', resultado: 10000, daytrade: 0, swing: 10000, taxas: 0, operacoes: 1 },
    ]);
  });

  it('resumoPorModalidade aceita filtro de período', () => {
    expect(resumoPorModalidade(carteira.operacoes)).toEqual({ daytrade: 1800, swing: 10000, total: 11800 });
    expect(resumoPorModalidade(carteira.operacoes, (o) => o.dataOperacao.startsWith('2026-04')))
      .toEqual({ daytrade: 0, swing: 10000, total: 10000 });
  });

  it('estatisticasDayTrade calcula taxa de acerto e payoff por trade (ativo + dia)', () => {
    const e = estatisticasDayTrade(carteira.operacoes);
    expect(e).toMatchObject({
      trades: 2,
      vencedores: 1,
      perdedores: 1,
      empates: 0,
      taxaAcerto: 0.5,
      mediaGanho: 3800,
      mediaPerda: -2000,
      payoff: 1.9,
      melhor: 3800,
      pior: -2000,
      resultado: 1800,
    });
  });

  it('estatisticasDayTrade sem perdas tem payoff null', () => {
    const c = processarCarteira([
      op({ ativo: 'WINZ26', multiplicador: 0.2, lado: 'compra', quantidade: 1, preco: 100, modalidade: 'daytrade' }),
      op({ ativo: 'WINZ26', multiplicador: 0.2, lado: 'venda', quantidade: 1, preco: 200, modalidade: 'daytrade' }),
    ]);
    expect(estatisticasDayTrade(c.operacoes)).toMatchObject({ trades: 1, taxaAcerto: 1, payoff: null });
    expect(estatisticasDayTrade([])).toMatchObject({ trades: 0, taxaAcerto: 0, payoff: null, melhor: 0, pior: 0 });
  });
});

describe('classificarModalidade', () => {
  it('compra e venda do mesmo ativo no mesmo dia viram day trade; o resto swing', () => {
    const r = classificarModalidade([
      { id: 1, ativo: 'PETR4', mercado: 'acoes', lado: 'compra', quantidade: 100, preco: 10, multiplicador: 1, taxas: 0, dataOperacao: '2026-03-10' },
      { id: 2, ativo: 'petr4', mercado: 'acoes', lado: 'venda', quantidade: 100, preco: 11, multiplicador: 1, taxas: 0, dataOperacao: '2026-03-10' },
      { id: 3, ativo: 'VALE3', mercado: 'acoes', lado: 'compra', quantidade: 10, preco: 60, multiplicador: 1, taxas: 0, dataOperacao: '2026-03-10' },
      { id: 4, ativo: 'VALE3', mercado: 'acoes', lado: 'venda', quantidade: 10, preco: 61, multiplicador: 1, taxas: 0, dataOperacao: '2026-03-11', modalidade: 'daytrade' as const },
    ]);
    expect(r.map((o) => o.modalidade)).toEqual(['daytrade', 'daytrade', 'swing', 'daytrade']);
  });
});

describe('avaliarPosicao', () => {
  it('calcula valor de mercado e não realizado para comprado e vendido', () => {
    const c = processarCarteira([
      op({ ativo: 'PETR4', lado: 'compra', quantidade: 100, preco: 30 }),
      op({ ativo: 'ITUB4', lado: 'venda', quantidade: 100, preco: 30 }),
    ]);
    const petr = c.posicoes.find((p) => p.ativo === 'PETR4')!;
    const itub = c.posicoes.find((p) => p.ativo === 'ITUB4')!;
    expect(avaliarPosicao(petr, 33)).toEqual({ valorMercado: 330000, resultadoNaoRealizado: 30000 });
    expect(avaliarPosicao(itub, 33)).toEqual({ valorMercado: 330000, resultadoNaoRealizado: -30000 });
    expect(avaliarPosicao(petr, null)).toEqual({ valorMercado: null, resultadoNaoRealizado: null });
  });
});

describe('sugestões por código do ativo', () => {
  it('multiplicador e mercado', () => {
    expect(multiplicadorSugerido('WINZ26')).toBe(0.2);
    expect(multiplicadorSugerido('wdof27')).toBe(10);
    expect(multiplicadorSugerido('PETR4')).toBe(1);
    expect(mercadoSugerido('WINZ26')).toBe('futuros');
    expect(mercadoSugerido('HGLG11')).toBe('fii');
    expect(mercadoSugerido('PETR4')).toBe('acoes');
    expect(mercadoSugerido('PETRD250')).toBe('opcoes');
  });
});
