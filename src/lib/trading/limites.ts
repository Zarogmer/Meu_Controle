/**
 * Regras de proteção do envio de ordens. Funções puras, testadas em
 * limites.test.ts. Toda ordem passa por `validarOrdem` antes de chegar
 * ao conector.
 */

export type ModoTrading = 'simulacao' | 'real';

export interface ConfigTrading {
  tradingHabilitado: boolean;
  modo: ModoTrading;
  quantidadeMaxima: number;
  /** centavos; perda do dia (resultado realizado + taxas) a partir da qual novas ordens são bloqueadas */
  perdaDiariaMaxima: number;
  modoRealAceitoEm: Date | string | null;
}

export interface PedidoOrdem {
  ativo: string;
  bolsa: 'F' | 'B';
  lado: 'compra' | 'venda';
  tipo: 'mercado' | 'limite' | 'stop_limite';
  quantidade: number;
  preco?: number | null;
  precoStop?: number | null;
  /** true quando a ordem só reduz/zera posição (permitida mesmo com limite diário batido) */
  reduzRisco?: boolean;
}

export interface ContextoRisco {
  /** resultado líquido realizado hoje, em centavos (negativo = prejuízo) */
  resultadoHoje: number;
  /** modo informado pelo conector no /health: 'dll' ou 'simulacao' */
  modoConector: 'dll' | 'simulacao' | 'manual' | null;
  conectorPronto: boolean;
}

export interface Validacao {
  ok: boolean;
  motivo: string | null;
  codigo: string | null;
}

const OK: Validacao = { ok: true, motivo: null, codigo: null };
const falha = (codigo: string, motivo: string): Validacao => ({ ok: false, motivo, codigo });

export const LIMITES = {
  quantidadeMaximaAbsoluta: 1000,
  perdaDiariaMaximaAbsoluta: 100_000_00, // R$ 100.000,00
};

export const TICKERS_AGREGADORES = /^(WIN|WDO|IND|DOL|BIT)FUT$/;

/** Valida flag, modo, limites e coerência do pedido. Primeira falha vence. */
export function validarOrdem(config: ConfigTrading, pedido: PedidoOrdem, ctx: ContextoRisco): Validacao {
  if (!config.tradingHabilitado) return falha('flag', 'Envio de ordens não está habilitado para esta conta');
  if (config.modo === 'real' && !config.modoRealAceitoEm) return falha('modo_real', 'Modo real ainda não foi confirmado nas configurações');

  if (!ctx.conectorPronto) return falha('conector', 'Conector não está pronto para rotear ordens');
  if (config.modo === 'simulacao' && ctx.modoConector !== 'simulacao') {
    return falha('modo_mismatch', 'Modo simulação exige um conector em simulação (PROFIT_SIMULATION=1)');
  }
  if (config.modo === 'real' && ctx.modoConector !== 'dll') {
    return falha('modo_mismatch', 'Modo real exige o conector com a ProfitDLL, não em simulação');
  }

  const ativo = pedido.ativo.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(ativo)) return falha('ativo', 'Ativo inválido');
  if (TICKERS_AGREGADORES.test(ativo)) return falha('ativo', 'Use o código do contrato vigente (ex.: WINZ26), não o agregador');
  if (pedido.bolsa !== 'F' && pedido.bolsa !== 'B') return falha('bolsa', 'Bolsa deve ser F (BM&F) ou B (Bovespa)');
  if (pedido.lado !== 'compra' && pedido.lado !== 'venda') return falha('lado', 'Lado inválido');

  if (!Number.isInteger(pedido.quantidade) || pedido.quantidade <= 0) return falha('quantidade', 'Quantidade deve ser inteira e maior que zero');
  if (pedido.quantidade > config.quantidadeMaxima) {
    return falha('quantidade_maxima', `Quantidade acima do seu limite por ordem (${config.quantidadeMaxima})`);
  }

  if (pedido.tipo === 'mercado') {
    // preço ignorado
  } else if (pedido.tipo === 'limite') {
    if (!pedido.preco || pedido.preco <= 0) return falha('preco', 'Ordem limitada precisa de preço');
  } else if (pedido.tipo === 'stop_limite') {
    if (!pedido.preco || pedido.preco <= 0) return falha('preco', 'Stop limite precisa do preço da ordem');
    if (!pedido.precoStop || pedido.precoStop <= 0) return falha('preco_stop', 'Stop limite precisa do preço de disparo');
    // Em stop de venda o preço costuma ficar abaixo do disparo; em stop de compra, acima (doc Nelogica).
    if (pedido.lado === 'venda' && pedido.preco > pedido.precoStop) return falha('stop_invertido', 'Em stop de venda, o preço deve ser menor ou igual ao disparo');
    if (pedido.lado === 'compra' && pedido.preco < pedido.precoStop) return falha('stop_invertido', 'Em stop de compra, o preço deve ser maior ou igual ao disparo');
  } else {
    return falha('tipo', 'Tipo de ordem inválido');
  }

  if (!pedido.reduzRisco && ctx.resultadoHoje <= -config.perdaDiariaMaxima) {
    return falha('perda_diaria', 'Perda diária máxima atingida; só é permitido reduzir ou zerar posição');
  }

  return OK;
}

/** Normaliza os limites editáveis pelo usuário, dentro dos tetos da plataforma. */
export function normalizarLimites(input: { quantidadeMaxima?: unknown; perdaDiariaMaxima?: unknown }, atual: { quantidadeMaxima: number; perdaDiariaMaxima: number }) {
  const q = input.quantidadeMaxima === undefined ? atual.quantidadeMaxima : parseInt(String(input.quantidadeMaxima), 10);
  const p = input.perdaDiariaMaxima === undefined ? atual.perdaDiariaMaxima : Math.round(parseFloat(String(input.perdaDiariaMaxima)) * 100);
  if (!Number.isInteger(q) || q < 1 || q > LIMITES.quantidadeMaximaAbsoluta) {
    return { error: `Quantidade máxima deve ser entre 1 e ${LIMITES.quantidadeMaximaAbsoluta}` } as const;
  }
  if (!Number.isFinite(p) || p < 100 || p > LIMITES.perdaDiariaMaximaAbsoluta) {
    return { error: 'Perda diária máxima deve ser entre R$ 1,00 e R$ 100.000,00' } as const;
  }
  return { quantidadeMaxima: q, perdaDiariaMaxima: p } as const;
}

/** Fração do limite diário já consumida (0..1), para a barra da tela. */
export function usoDoLimiteDiario(resultadoHoje: number, perdaDiariaMaxima: number): number {
  if (perdaDiariaMaxima <= 0 || resultadoHoje >= 0) return 0;
  return Math.min(1, -resultadoHoje / perdaDiariaMaxima);
}
