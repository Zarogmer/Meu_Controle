import { and, eq, inArray, or, type SQL } from 'drizzle-orm';
import { db, contasRecorrentes, gastos, type UserRole } from '@/lib/db';
import {
  CATEGORIA_CONTA_LABEL,
  dataVencimentoNaCompetencia,
} from '@/lib/contas';

/**
 * Lógica de servidor das contas fixas.
 *
 * Regras de visibilidade (iguais às de gastos):
 * - toda query filtra por lojaId;
 * - conta pessoal só é vista pelo próprio usuário;
 * - employee nunca vê conta pessoal.
 */

export interface AuthContext {
  lojaId: number;
  userId: number;
  role: UserRole;
}

/** Condição de visibilidade de gastos para o usuário logado. */
export function gastosVisiveis({ lojaId, userId, role }: AuthContext): SQL {
  if (role === 'employee') {
    return and(eq(gastos.lojaId, lojaId), eq(gastos.tipo, 'empresa'))!;
  }
  return and(
    eq(gastos.lojaId, lojaId),
    or(
      eq(gastos.tipo, 'empresa'),
      and(eq(gastos.tipo, 'pessoal'), eq(gastos.usuarioId, userId)),
    ),
  )!;
}

/** Condição de visibilidade de contas recorrentes para o usuário logado. */
export function contasVisiveis({ lojaId, userId, role }: AuthContext): SQL {
  if (role === 'employee') {
    return and(eq(contasRecorrentes.lojaId, lojaId), eq(contasRecorrentes.tipo, 'empresa'))!;
  }
  return and(
    eq(contasRecorrentes.lojaId, lojaId),
    or(
      eq(contasRecorrentes.tipo, 'empresa'),
      and(eq(contasRecorrentes.tipo, 'pessoal'), eq(contasRecorrentes.usuarioId, userId)),
    ),
  )!;
}

/**
 * Gera a fatura (gasto `pendente`) do mês para cada conta ativa visível
 * que ainda não tenha gasto naquela competência. Idempotente: chamar
 * duas vezes não duplica nada.
 *
 * Retorna quantas faturas foram criadas.
 */
export async function gerarFaturasDaCompetencia(
  auth: AuthContext,
  competencia: string,
  opts: { contaIds?: number[] } = {},
): Promise<{ criadas: number; contasAtivas: number }> {
  const conds: SQL[] = [contasVisiveis(auth), eq(contasRecorrentes.ativa, true)];
  if (opts.contaIds && opts.contaIds.length > 0) {
    conds.push(inArray(contasRecorrentes.id, opts.contaIds));
  }

  const contas = await db.select().from(contasRecorrentes).where(and(...conds));
  if (contas.length === 0) return { criadas: 0, contasAtivas: 0 };

  const jaGeradas = await db
    .select({ contaRecorrenteId: gastos.contaRecorrenteId })
    .from(gastos)
    .where(
      and(
        eq(gastos.lojaId, auth.lojaId),
        eq(gastos.competencia, competencia),
        inArray(gastos.contaRecorrenteId, contas.map((c) => c.id)),
      ),
    );
  const geradas = new Set(jaGeradas.map((g) => g.contaRecorrenteId));

  const novas = contas
    .filter((c) => !geradas.has(c.id))
    .map((c) => {
      const vencimento = dataVencimentoNaCompetencia(competencia, c.diaVencimento);
      return {
        lojaId: auth.lojaId,
        usuarioId: c.tipo === 'pessoal' ? c.usuarioId ?? auth.userId : null,
        tipo: c.tipo,
        descricao: c.nome,
        categoria: CATEGORIA_CONTA_LABEL[c.categoria],
        valor: c.valorEstimado,
        dataGasto: vencimento,
        status: 'pendente' as const,
        observacao: null,
        contaRecorrenteId: c.id,
        dataVencimento: vencimento,
        competencia,
        anexoUrl: null,
      };
    });

  if (novas.length > 0) {
    await db.insert(gastos).values(novas);
  }

  return { criadas: novas.length, contasAtivas: contas.length };
}

/** Lista contas ativas visíveis que ainda não têm gasto na competência. */
export async function contasSemLancamento(auth: AuthContext, competencia: string) {
  const contas = await db
    .select()
    .from(contasRecorrentes)
    .where(and(contasVisiveis(auth), eq(contasRecorrentes.ativa, true)));
  if (contas.length === 0) return [];

  const lancadas = await db
    .select({ contaRecorrenteId: gastos.contaRecorrenteId })
    .from(gastos)
    .where(
      and(
        eq(gastos.lojaId, auth.lojaId),
        eq(gastos.competencia, competencia),
        inArray(gastos.contaRecorrenteId, contas.map((c) => c.id)),
      ),
    );
  const set = new Set(lancadas.map((l) => l.contaRecorrenteId));
  return contas.filter((c) => !set.has(c.id));
}
