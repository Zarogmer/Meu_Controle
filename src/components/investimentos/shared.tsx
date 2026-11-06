'use client';

import type { Mercado, Modalidade, Lado, EstatisticasDayTrade, ResultadoDia, ResultadoMes } from '@/lib/investimentos/calculos';

export interface ContaCorretora {
  id: number;
  corretora: string;
  apelido: string;
  conta: string | null;
  origem: 'manual' | 'nelogica';
  ativa: boolean;
  criadoEm: string;
  totalOperacoes: number;
}

export interface OperacaoLista {
  id: number;
  contaCorretoraId: number;
  contaApelido: string | null;
  ativo: string;
  mercado: Mercado;
  lado: Lado;
  quantidade: number;
  preco: number;
  multiplicador: number;
  taxas: number;
  dataOperacao: string;
  horario: string | null;
  modalidade: Modalidade;
  origem: 'manual' | 'importacao' | 'nelogica';
  idExterno: string | null;
  observacao: string | null;
  precoMedioAntes: number;
  quantidadeFechada: number;
  resultadoBruto: number;
  resultadoLiquido: number;
}

export interface PosicaoLista {
  ativo: string;
  mercado: Mercado;
  multiplicador: number;
  quantidade: number;
  precoMedio: number;
  custoTotal: number;
  resultadoRealizado: number;
  taxasTotal: number;
  ultimaOperacao: string;
  cotacao: number | null;
  cotacaoEm: string | null;
  valorMercado: number | null;
  resultadoNaoRealizado: number | null;
}

export interface ResumoInvestimentos {
  competencia: string;
  ano: string;
  periodo: 'mes' | 'ano' | 'tudo';
  totalOperacoes: number;
  posicoes: PosicaoLista[];
  patrimonio: { custoTotal: number; valorAtual: number; resultadoNaoRealizado: number; posicoesSemCotacao: number };
  mes: ResultadoMes;
  anoResumo: { daytrade: number; swing: number; total: number; taxas: number };
  totalRealizado: number;
  taxasTotal: number;
  diario: ResultadoDia[];
  porMes: ResultadoMes[];
  dayTrade: { mes: EstatisticasDayTrade; ano: EstatisticasDayTrade };
}

export const MERCADO_LABEL: Record<Mercado, string> = {
  acoes: 'Ações',
  futuros: 'Futuros',
  opcoes: 'Opções',
  fii: 'FII',
  outros: 'Outros',
};

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  daytrade: 'Day trade',
  swing: 'Swing',
};

export const CORRETORA_LABEL: Record<string, string> = {
  agora: 'Ágora',
  xp: 'XP',
  clear: 'Clear',
  rico: 'Rico',
  btg: 'BTG Pactual',
  nuinvest: 'NuInvest',
  inter: 'Inter',
  genial: 'Genial',
  outra: 'Outra',
};

export function formatCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Resultado com sinal explícito: "+R$ 1.200,00" / "−R$ 50,00". */
export function formatResultado(centavos: number): string {
  const abs = formatCentavos(Math.abs(centavos));
  if (centavos > 0) return `+${abs}`;
  if (centavos < 0) return `−${abs}`;
  return abs;
}

export function corResultado(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || centavos === 0) return 'text-muted-foreground';
  return centavos > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
}

/** Preço em unidades do ativo (reais ou pontos). */
export function formatPreco(preco: number, mercado?: Mercado): string {
  const inteiro = mercado === 'futuros' && Number.isInteger(preco);
  return preco.toLocaleString('pt-BR', {
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: inteiro ? 0 : 4,
  });
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [a, m, d] = dateStr.split('-');
  return `${d}/${m}/${a}`;
}

export function formatPercent(fracao: number): string {
  return `${(fracao * 100).toFixed(0)}%`;
}

export const nativeSelectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

/** Mesmo visual, mas com largura do conteúdo (barras de filtro). */
export const nativeSelectInline = nativeSelectClass.replace('w-full', 'w-auto');
