/**
 * Helpers compartilhados (cliente e servidor) do módulo de contas fixas.
 *
 * Datas de negócio são strings `YYYY-MM-DD`; competência é `YYYY-MM`
 * (o mês a que a conta se refere, que pode ser diferente do mês em que
 * ela foi paga).
 */

export const CATEGORIAS_CONTA = ['luz', 'agua', 'internet', 'aluguel', 'cartao', 'outros'] as const;
export type CategoriaConta = (typeof CATEGORIAS_CONTA)[number];

export const CATEGORIA_CONTA_LABEL: Record<CategoriaConta, string> = {
  luz: 'Luz',
  agua: 'Água',
  internet: 'Internet',
  aluguel: 'Aluguel',
  cartao: 'Cartão',
  outros: 'Outros',
};

export function isCategoriaConta(value: unknown): value is CategoriaConta {
  return typeof value === 'string' && (CATEGORIAS_CONTA as readonly string[]).includes(value);
}

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Data de hoje no fuso local, como YYYY-MM-DD. */
export function hojeISO(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Competência (YYYY-MM) do mês corrente. */
export function competenciaAtual(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function isCompetencia(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const mes = Number(value.slice(5, 7));
  return mes >= 1 && mes <= 12;
}

export function isDataISO(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Competência (YYYY-MM) de uma data YYYY-MM-DD. */
export function competenciaDeData(dataISO: string): string {
  return dataISO.slice(0, 7);
}

export function diasNoMes(competencia: string): number {
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  return new Date(ano, mes, 0).getDate();
}

/**
 * Data de vencimento de uma conta em uma competência. Dia 31 em um mês
 * de 30 dias vira dia 30 (último dia do mês).
 */
export function dataVencimentoNaCompetencia(competencia: string, diaVencimento: number): string {
  const dia = Math.min(Math.max(1, Math.round(diaVencimento)), diasNoMes(competencia));
  return `${competencia}-${pad2(dia)}`;
}

/** Soma `dias` a uma data YYYY-MM-DD. */
export function somarDias(dataISO: string, dias: number): string {
  const [a, m, d] = dataISO.split('-').map(Number);
  const date = new Date(a, m - 1, d + dias);
  return hojeISO(date);
}

/** Avança/retrocede uma competência em `n` meses. */
export function somarMeses(competencia: string, n: number): string {
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  const date = new Date(ano, mes - 1 + n, 1);
  return competenciaAtual(date);
}

/** "Mar/2026" */
export function formatCompetencia(competencia: string): string {
  const mes = Number(competencia.slice(5, 7));
  return `${MESES_CURTOS[mes - 1] ?? '?'}/${competencia.slice(0, 4)}`;
}

/** "Março de 2026" */
export function formatCompetenciaLonga(competencia: string): string {
  const mes = Number(competencia.slice(5, 7));
  return `${MESES_LONGOS[mes - 1] ?? '?'} de ${competencia.slice(0, 4)}`;
}

export type SituacaoVencimento = 'vencido' | 'vence_hoje' | 'vence_em_breve' | 'no_prazo' | null;

/**
 * Situação de um gasto pendente em relação ao vencimento. Gastos pagos
 * (ou sem vencimento) não têm situação.
 */
export function situacaoVencimento(
  gasto: { status: 'pago' | 'pendente'; dataVencimento: string | null },
  hoje: string = hojeISO(),
): SituacaoVencimento {
  if (gasto.status !== 'pendente' || !gasto.dataVencimento) return null;
  if (gasto.dataVencimento < hoje) return 'vencido';
  if (gasto.dataVencimento === hoje) return 'vence_hoje';
  if (gasto.dataVencimento <= somarDias(hoje, 7)) return 'vence_em_breve';
  return 'no_prazo';
}
