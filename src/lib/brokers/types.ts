/**
 * Interface de provedor de corretora. O sistema fala com qualquer
 * corretora/integração através dela, para não ficar amarrado à
 * Nelogica. Implementações: ManualProvider (dados lançados/importados)
 * e NelogicaProvider (conector ProfitDLL no Windows do usuário).
 */

export interface ContaRef {
  contaCorretoraId: number;
  lojaId: number;
  usuarioId: number;
}

export interface PosicaoProvider {
  ativo: string;
  bolsa: string | null; // 'F' (BM&F) | 'B' (Bovespa) | null
  quantidade: number; // assinada
  precoMedio: number;
  origem: 'calculado' | 'corretora';
}

export type StatusOrdem =
  | 'nova' | 'parcial' | 'executada' | 'cancelada' | 'substituida' | 'pendente_cancel'
  | 'disparada' | 'rejeitada' | 'suspensa' | 'pendente_nova' | 'expirada' | 'pendente_alteracao'
  | 'parcial_cancelada' | 'recebida' | 'parcial_rejeitada' | 'desconhecida' | 'cancelada_admin';

export interface Ordem {
  id: string; // ClOrderID (permanente) ou LocalOrderID
  localOrderId: string | null;
  ativo: string;
  bolsa: string | null;
  lado: 'compra' | 'venda';
  tipo: 'mercado' | 'limite' | 'stop_limite' | 'desconhecido';
  quantidade: number;
  quantidadeExecutada: number;
  preco: number | null;
  precoStop: number | null;
  precoMedio: number | null;
  status: StatusOrdem;
  atualizadoEm: string; // ISO
}

export interface FiltrosOrdens {
  ativo?: string;
  status?: StatusOrdem[];
  desde?: string; // ISO
}

/** Execução (negócio da própria conta), já no formato de `operacoes`. */
export interface OperacaoProvider {
  idExterno: string;
  ativo: string;
  bolsa: string | null;
  lado: 'compra' | 'venda';
  quantidade: number;
  preco: number;
  executadoEm: string; // ISO 8601 com fuso
  ordemId: string | null;
  taxas?: number; // centavos, se a fonte informar
}

export interface Cotacao {
  ativo: string;
  bolsa: string | null;
  ultimo: number | null;
  compra: number | null; // bid
  venda: number | null; // ask
  atualizadoEm: string | null;
}

export interface OrdemEnvio {
  ativo: string;
  bolsa: string;
  lado: 'compra' | 'venda';
  tipo: 'mercado' | 'limite' | 'stop_limite';
  quantidade: number;
  preco?: number | null;
  precoStop?: number | null;
  /** referência interna (uuid) para correlacionar com a auditoria */
  referencia?: string;
}

export interface ResultadoOrdem {
  aceita: boolean;
  localOrderId: string | null;
  clOrderId?: string | null;
  mensagem: string | null;
  /** 'dll' | 'simulacao' — modo em que o conector executou */
  modo?: string;
}

export interface ZeragemEnvio {
  ativo: string;
  bolsa: string;
  /** 1 = day trade, 2 = consolidada (custódia) — enum da ProfitDLL */
  tipoPosicao: 1 | 2;
  /** null = a mercado */
  preco?: number | null;
}

export interface StatusProvider {
  online: boolean;
  modo: 'manual' | 'dll' | 'simulacao';
  pronto: boolean;
  detalhes: Record<string, unknown>;
  verificadoEm: string;
}

export interface BrokerProvider {
  id: 'manual' | 'nelogica' | string;
  status(conta: ContaRef): Promise<StatusProvider>;
  getPositions(conta: ContaRef): Promise<PosicaoProvider[]>;
  getOrders(conta: ContaRef, filtros?: FiltrosOrdens): Promise<Ordem[]>;
  /** Execuções desde o cursor (ISO). Devolve também o próximo cursor. */
  getTrades(conta: ContaRef, desde: string | null): Promise<{ trades: OperacaoProvider[]; proximoCursor: string | null }>;
  getQuote(conta: ContaRef, ativo: string, bolsa?: string): Promise<Cotacao>;
  /** Envio de ordens — Fase 4, atrás de feature flag. Opcional. */
  sendOrder?(conta: ContaRef, ordem: OrdemEnvio): Promise<ResultadoOrdem>;
  cancelOrder?(conta: ContaRef, ordemId: string): Promise<ResultadoOrdem>;
  cancelAllOrders?(conta: ContaRef): Promise<ResultadoOrdem>;
  zeroPosition?(conta: ContaRef, zeragem: ZeragemEnvio): Promise<ResultadoOrdem>;
}

/** Bolsa sugerida pelo código do ativo (B3): futuros em 'F' (BM&F), o resto em 'B' (Bovespa). */
export function bolsaSugerida(ativo: string): 'F' | 'B' {
  const a = ativo.trim().toUpperCase();
  const futuro = /^(WIN|IND|WDO|DOL|BIT|BGI|CCM|ICF|DI1|DAP|FRC|ISP|WSP|SJC|EUR|AUD|JPY|GBP|CAD|CHF|MXN|ETH|SOY|CLP|TRY|ZAR)[FGHJKMNQUVXZ]\d{2}$/.test(a) || /FUT$/.test(a);
  return futuro ? 'F' : 'B';
}
