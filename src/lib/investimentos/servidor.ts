import { createHash } from 'crypto';
import { and, asc, eq, gte, ilike, lte, type SQL } from 'drizzle-orm';
import { db, contasCorretora, operacoes, cotacoesCache } from '@/lib/db';
import type { OperacaoBase } from './calculos';
import { chaveDedupe } from './csv';

/**
 * Acesso a dados de investimentos. Toda query filtra por lojaId E
 * usuarioId — a carteira é do dono, não da loja.
 */

export interface AuthInvestidor {
  lojaId: number;
  userId: number;
}

export type OperacaoRow = typeof operacoes.$inferSelect;

/** Linha do banco → formato dos cálculos (numeric vem como string). */
export function rowParaOperacao(row: OperacaoRow): OperacaoBase & { row: OperacaoRow } {
  return {
    id: row.id,
    ativo: row.ativo,
    mercado: row.mercado,
    lado: row.lado,
    quantidade: row.quantidade,
    preco: Number(row.preco),
    multiplicador: Number(row.multiplicador),
    taxas: row.taxas,
    dataOperacao: row.dataOperacao,
    horario: row.horario,
    modalidade: row.modalidade,
    contaCorretoraId: row.contaCorretoraId,
    row,
  };
}

export function hashDedupe(op: Parameters<typeof chaveDedupe>[0]): string {
  return createHash('sha1').update(chaveDedupe(op)).digest('hex');
}

export async function contaDoUsuario(auth: AuthInvestidor, contaId: number) {
  const [conta] = await db
    .select()
    .from(contasCorretora)
    .where(and(eq(contasCorretora.id, contaId), eq(contasCorretora.lojaId, auth.lojaId), eq(contasCorretora.usuarioId, auth.userId)))
    .limit(1);
  return conta ?? null;
}

export interface FiltrosOperacoes {
  contaCorretoraId?: number;
  ativo?: string;
  mercado?: string;
  modalidade?: string;
  lado?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function condicoesOperacoes(auth: AuthInvestidor, f: FiltrosOperacoes = {}): SQL {
  const conds: SQL[] = [eq(operacoes.lojaId, auth.lojaId), eq(operacoes.usuarioId, auth.userId)];
  if (f.contaCorretoraId) conds.push(eq(operacoes.contaCorretoraId, f.contaCorretoraId));
  if (f.ativo) conds.push(ilike(operacoes.ativo, `%${f.ativo.trim()}%`));
  if (f.mercado && ['acoes', 'futuros', 'opcoes', 'fii', 'outros'].includes(f.mercado)) {
    conds.push(eq(operacoes.mercado, f.mercado as OperacaoRow['mercado']));
  }
  if (f.modalidade === 'daytrade' || f.modalidade === 'swing') conds.push(eq(operacoes.modalidade, f.modalidade));
  if (f.lado === 'compra' || f.lado === 'venda') conds.push(eq(operacoes.lado, f.lado));
  if (f.dataInicio) conds.push(gte(operacoes.dataOperacao, f.dataInicio));
  if (f.dataFim) conds.push(lte(operacoes.dataOperacao, f.dataFim));
  return and(...conds)!;
}

/** Todas as operações do usuário (ordem cronológica), opcionalmente de uma conta. */
export async function carregarOperacoes(auth: AuthInvestidor, f: FiltrosOperacoes = {}) {
  const rows = await db
    .select()
    .from(operacoes)
    .where(condicoesOperacoes(auth, f))
    .orderBy(asc(operacoes.dataOperacao), asc(operacoes.horario), asc(operacoes.id));
  return rows.map(rowParaOperacao);
}

/** Cotações em cache para uma lista de ativos: ativo → preço. */
export async function carregarCotacoes(ativos: string[]): Promise<Record<string, { preco: number; atualizadoEm: string }>> {
  if (ativos.length === 0) return {};
  const rows = await db.select().from(cotacoesCache);
  const set = new Set(ativos.map((a) => a.toUpperCase()));
  const out: Record<string, { preco: number; atualizadoEm: string }> = {};
  for (const r of rows) {
    if (set.has(r.ativo)) out[r.ativo] = { preco: Number(r.preco), atualizadoEm: r.atualizadoEm.toISOString() };
  }
  return out;
}
