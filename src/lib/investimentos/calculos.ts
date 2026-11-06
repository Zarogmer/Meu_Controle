/**
 * Cálculos da carteira de investimentos. Funções puras, sem banco,
 * cobertas por testes em calculos.test.ts.
 *
 * Convenções:
 * - `preco` em unidades do ativo (reais para ações, pontos para futuros);
 * - `multiplicador` = reais por unidade e por contrato (ações 1, WIN 0,2, WDO 10);
 * - `taxas` e todo resultado em **centavos** (inteiro);
 * - quantidade de posição é assinada: positiva comprada, negativa vendida.
 */

export type Mercado = 'acoes' | 'futuros' | 'opcoes' | 'fii' | 'outros';
export type Lado = 'compra' | 'venda';
export type Modalidade = 'daytrade' | 'swing';

export interface OperacaoBase {
  id: number | string;
  ativo: string;
  mercado: Mercado;
  lado: Lado;
  quantidade: number;
  preco: number;
  multiplicador: number;
  taxas: number;
  dataOperacao: string; // YYYY-MM-DD
  horario?: string | null; // HH:MM[:SS]
  modalidade: Modalidade;
  contaCorretoraId?: number;
}

export interface OperacaoProcessada<T extends OperacaoBase = OperacaoBase> {
  operacao: T;
  /** Preço médio da posição antes desta operação (0 se estava zerado). */
  precoMedioAntes: number;
  /** Quantidade assinada da posição depois desta operação. */
  posicaoDepois: number;
  /** Quantidade desta operação que fechou posição (realizou resultado). */
  quantidadeFechada: number;
  /** Resultado bruto realizado nesta operação, em centavos (sem taxas). */
  resultadoBruto: number;
  /** Resultado líquido = bruto − taxas, em centavos. */
  resultadoLiquido: number;
}

export interface Posicao {
  ativo: string;
  mercado: Mercado;
  multiplicador: number;
  /** Assinada: > 0 comprado, < 0 vendido. */
  quantidade: number;
  precoMedio: number;
  /** |quantidade| × precoMedio × multiplicador, em centavos. */
  custoTotal: number;
  /** Resultado líquido realizado acumulado do ativo, em centavos. */
  resultadoRealizado: number;
  taxasTotal: number;
  ultimaOperacao: string;
}

export interface Carteira<T extends OperacaoBase = OperacaoBase> {
  operacoes: OperacaoProcessada<T>[];
  posicoes: Posicao[];
  /** Resultado líquido realizado por ativo (inclui ativos já zerados). */
  realizadoPorAtivo: Record<string, number>;
  resultadoRealizadoTotal: number;
  taxasTotal: number;
}

export function paraCentavos(valor: number): number {
  return Math.round(valor * 100);
}

function chaveOrdem(op: OperacaoBase): string {
  const hora = (op.horario ?? '').padEnd(8, '0');
  return `${op.dataOperacao}T${hora}`;
}

/** Ordena por data, horário (vazio primeiro) e id — a ordem em que a corretora executou. */
export function ordenarOperacoes<T extends OperacaoBase>(ops: T[]): T[] {
  return [...ops].sort((a, b) => {
    const ka = chaveOrdem(a);
    const kb = chaveOrdem(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    const ia = typeof a.id === 'number' ? a.id : Number.MAX_SAFE_INTEGER;
    const ib = typeof b.id === 'number' ? b.id : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
}

export function normalizarAtivo(ativo: string): string {
  return ativo.trim().toUpperCase();
}

/**
 * Reproduz a carteira operação a operação: preço médio ponderado,
 * resultado realizado em cada fechamento (parcial ou total) e posição
 * final por ativo. Suporta inversão de posição (vender mais do que tem
 * abre posição vendida com PM no preço da venda).
 */
export function processarCarteira<T extends OperacaoBase>(ops: T[]): Carteira<T> {
  const ordenadas = ordenarOperacoes(ops);
  const estado = new Map<string, Posicao>();
  const processadas: OperacaoProcessada<T>[] = [];
  const realizadoPorAtivo: Record<string, number> = {};
  let resultadoRealizadoTotal = 0;
  let taxasTotal = 0;

  for (const op of ordenadas) {
    const ativo = normalizarAtivo(op.ativo);
    const mult = Number(op.multiplicador) || 1;
    const preco = Number(op.preco);
    const qtd = Math.abs(Number(op.quantidade));
    const taxas = Math.round(Number(op.taxas) || 0);
    const sinal = op.lado === 'compra' ? 1 : -1;

    const pos = estado.get(ativo) ?? {
      ativo,
      mercado: op.mercado,
      multiplicador: mult,
      quantidade: 0,
      precoMedio: 0,
      custoTotal: 0,
      resultadoRealizado: 0,
      taxasTotal: 0,
      ultimaOperacao: op.dataOperacao,
    };

    const precoMedioAntes = pos.precoMedio;
    let restante = qtd;
    let quantidadeFechada = 0;
    let resultadoBruto = 0;

    // 1) Fecha posição contrária, se houver.
    if (pos.quantidade !== 0 && Math.sign(pos.quantidade) !== sinal) {
      const fechar = Math.min(restante, Math.abs(pos.quantidade));
      // Comprado fechando com venda: (venda − PM); vendido fechando com compra: (PM − compra).
      const direcao = Math.sign(pos.quantidade);
      resultadoBruto += paraCentavos((preco - pos.precoMedio) * fechar * mult * direcao);
      pos.quantidade -= direcao * fechar;
      restante -= fechar;
      quantidadeFechada = fechar;
      if (pos.quantidade === 0) pos.precoMedio = 0;
    }

    // 2) O que sobrou abre/aumenta posição no sentido da operação.
    if (restante > 0) {
      const atual = Math.abs(pos.quantidade);
      pos.precoMedio = atual === 0
        ? preco
        : (atual * pos.precoMedio + restante * preco) / (atual + restante);
      pos.quantidade += sinal * restante;
    }

    const resultadoLiquido = resultadoBruto - taxas;
    pos.resultadoRealizado += resultadoLiquido;
    pos.taxasTotal += taxas;
    pos.multiplicador = mult;
    pos.mercado = op.mercado;
    pos.ultimaOperacao = op.dataOperacao;
    pos.custoTotal = paraCentavos(Math.abs(pos.quantidade) * pos.precoMedio * mult);
    estado.set(ativo, pos);

    realizadoPorAtivo[ativo] = (realizadoPorAtivo[ativo] ?? 0) + resultadoLiquido;
    resultadoRealizadoTotal += resultadoLiquido;
    taxasTotal += taxas;

    processadas.push({
      operacao: op,
      precoMedioAntes,
      posicaoDepois: pos.quantidade,
      quantidadeFechada,
      resultadoBruto,
      resultadoLiquido,
    });
  }

  const posicoes = Array.from(estado.values())
    .filter((p) => p.quantidade !== 0)
    .map((p) => ({ ...p, precoMedio: Number(p.precoMedio.toFixed(6)) }))
    .sort((a, b) => a.ativo.localeCompare(b.ativo));

  return { operacoes: processadas, posicoes, realizadoPorAtivo, resultadoRealizadoTotal, taxasTotal };
}

export interface ResultadoDia {
  data: string;
  resultado: number;
  daytrade: number;
  swing: number;
  acumulado: number;
  operacoes: number;
}

/** Resultado líquido por dia (só dias com operação), com acumulado. */
export function resultadoPorDia(processadas: OperacaoProcessada[]): ResultadoDia[] {
  const mapa = new Map<string, ResultadoDia>();
  for (const p of processadas) {
    const data = p.operacao.dataOperacao;
    const dia = mapa.get(data) ?? { data, resultado: 0, daytrade: 0, swing: 0, acumulado: 0, operacoes: 0 };
    dia.resultado += p.resultadoLiquido;
    if (p.operacao.modalidade === 'daytrade') dia.daytrade += p.resultadoLiquido;
    else dia.swing += p.resultadoLiquido;
    dia.operacoes += 1;
    mapa.set(data, dia);
  }
  const dias = Array.from(mapa.values()).sort((a, b) => a.data.localeCompare(b.data));
  let acumulado = 0;
  for (const d of dias) {
    acumulado += d.resultado;
    d.acumulado = acumulado;
  }
  return dias;
}

export interface ResultadoMes {
  competencia: string;
  resultado: number;
  daytrade: number;
  swing: number;
  taxas: number;
  operacoes: number;
}

/** Resultado líquido por mês (YYYY-MM), separado por modalidade. */
export function resultadoPorMes(processadas: OperacaoProcessada[]): ResultadoMes[] {
  const mapa = new Map<string, ResultadoMes>();
  for (const p of processadas) {
    const competencia = p.operacao.dataOperacao.slice(0, 7);
    const mes = mapa.get(competencia) ?? { competencia, resultado: 0, daytrade: 0, swing: 0, taxas: 0, operacoes: 0 };
    mes.resultado += p.resultadoLiquido;
    mes.taxas += Math.round(Number(p.operacao.taxas) || 0);
    if (p.operacao.modalidade === 'daytrade') mes.daytrade += p.resultadoLiquido;
    else mes.swing += p.resultadoLiquido;
    mes.operacoes += 1;
    mapa.set(competencia, mes);
  }
  return Array.from(mapa.values()).sort((a, b) => a.competencia.localeCompare(b.competencia));
}

export interface ResumoModalidade {
  daytrade: number;
  swing: number;
  total: number;
}

/** Soma do resultado líquido por modalidade (base para o IR). */
export function resumoPorModalidade(
  processadas: OperacaoProcessada[],
  filtro?: (op: OperacaoBase) => boolean,
): ResumoModalidade {
  const r = { daytrade: 0, swing: 0, total: 0 };
  for (const p of processadas) {
    if (filtro && !filtro(p.operacao)) continue;
    if (p.operacao.modalidade === 'daytrade') r.daytrade += p.resultadoLiquido;
    else r.swing += p.resultadoLiquido;
    r.total += p.resultadoLiquido;
  }
  return r;
}

export interface EstatisticasDayTrade {
  /** Um "trade" = todas as operações day trade de um ativo em um dia. */
  trades: number;
  vencedores: number;
  perdedores: number;
  empates: number;
  /** 0..1 */
  taxaAcerto: number;
  mediaGanho: number;
  mediaPerda: number;
  /** mediaGanho / |mediaPerda|; null quando não há perda. */
  payoff: number | null;
  melhor: number;
  pior: number;
  resultado: number;
}

/** Taxa de acerto e payoff do day trade, agrupando por ativo + dia. */
export function estatisticasDayTrade(processadas: OperacaoProcessada[]): EstatisticasDayTrade {
  const porTrade = new Map<string, number>();
  for (const p of processadas) {
    if (p.operacao.modalidade !== 'daytrade') continue;
    const chave = `${p.operacao.dataOperacao}|${normalizarAtivo(p.operacao.ativo)}`;
    porTrade.set(chave, (porTrade.get(chave) ?? 0) + p.resultadoLiquido);
  }
  const resultados = Array.from(porTrade.values());
  const ganhos = resultados.filter((r) => r > 0);
  const perdas = resultados.filter((r) => r < 0);
  const soma = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const mediaGanho = ganhos.length ? Math.round(soma(ganhos) / ganhos.length) : 0;
  const mediaPerda = perdas.length ? Math.round(soma(perdas) / perdas.length) : 0;
  return {
    trades: resultados.length,
    vencedores: ganhos.length,
    perdedores: perdas.length,
    empates: resultados.length - ganhos.length - perdas.length,
    taxaAcerto: resultados.length ? ganhos.length / resultados.length : 0,
    mediaGanho,
    mediaPerda,
    payoff: mediaPerda !== 0 ? Number((mediaGanho / Math.abs(mediaPerda)).toFixed(2)) : null,
    melhor: resultados.length ? Math.max(...resultados) : 0,
    pior: resultados.length ? Math.min(...resultados) : 0,
    resultado: soma(resultados),
  };
}

/**
 * Classifica automaticamente a modalidade quando a fonte não informa:
 * se no mesmo dia houve compra E venda do mesmo ativo, as operações
 * daquele dia são day trade; senão, swing. (Aproximação simples: um dia
 * com compra de 100 e venda de 50 vira inteiro day trade.)
 */
export function classificarModalidade<T extends Omit<OperacaoBase, 'modalidade'> & { modalidade?: Modalidade }>(
  ops: T[],
): (T & { modalidade: Modalidade })[] {
  const lados = new Map<string, Set<Lado>>();
  for (const op of ops) {
    const chave = `${op.dataOperacao}|${normalizarAtivo(op.ativo)}`;
    const set = lados.get(chave) ?? new Set<Lado>();
    set.add(op.lado);
    lados.set(chave, set);
  }
  return ops.map((op) => {
    if (op.modalidade) return { ...op, modalidade: op.modalidade };
    const chave = `${op.dataOperacao}|${normalizarAtivo(op.ativo)}`;
    const set = lados.get(chave);
    const modalidade: Modalidade = set && set.has('compra') && set.has('venda') ? 'daytrade' : 'swing';
    return { ...op, modalidade };
  });
}

/** Valor de mercado e resultado não realizado de uma posição, em centavos. */
export function avaliarPosicao(pos: Posicao, cotacao: number | null | undefined) {
  if (cotacao === null || cotacao === undefined || !Number.isFinite(cotacao)) {
    return { valorMercado: null as number | null, resultadoNaoRealizado: null as number | null };
  }
  const direcao = Math.sign(pos.quantidade);
  const valorMercado = paraCentavos(Math.abs(pos.quantidade) * cotacao * pos.multiplicador);
  const resultadoNaoRealizado = paraCentavos((cotacao - pos.precoMedio) * Math.abs(pos.quantidade) * pos.multiplicador * direcao);
  return { valorMercado, resultadoNaoRealizado };
}

/** Multiplicador padrão por ativo da B3 (usado como sugestão no cadastro/importação). */
export function multiplicadorSugerido(ativo: string, mercado?: Mercado): number {
  const a = normalizarAtivo(ativo);
  if (/^WIN[FGHJKMNQUVXZ]\d{2}$/.test(a)) return 0.2;
  if (/^IND[FGHJKMNQUVXZ]\d{2}$/.test(a)) return 1;
  if (/^WDO[FGHJKMNQUVXZ]\d{2}$/.test(a)) return 10;
  if (/^DOL[FGHJKMNQUVXZ]\d{2}$/.test(a)) return 50;
  if (/^BIT[FGHJKMNQUVXZ]\d{2}$/.test(a)) return 0.1;
  if (mercado === 'futuros') return 1;
  return 1;
}

/** Mercado sugerido pelo código do ativo. */
export function mercadoSugerido(ativo: string): Mercado {
  const a = normalizarAtivo(ativo);
  if (/^(WIN|IND|WDO|DOL|BIT|BGI|CCM|ICF|DI1)[FGHJKMNQUVXZ]\d{2}$/.test(a)) return 'futuros';
  if (/^[A-Z]{4}11$/.test(a)) return 'fii';
  if (/^[A-Z]{4}[A-X]\d{2,3}[A-Z]?$/.test(a) && !/^[A-Z]{4}\d{1,2}$/.test(a)) return 'opcoes';
  if (/^[A-Z]{4}\d{1,2}[FB]?$/.test(a)) return 'acoes';
  return 'outros';
}
