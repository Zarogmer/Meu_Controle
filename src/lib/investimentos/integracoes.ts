import { and, eq } from 'drizzle-orm';
import { db, integracoesCorretora } from '@/lib/db';
import { decryptSecret, mascararSegredo } from '@/lib/crypto';

/** Integração sem segredos, no formato da tela de conexões. */
export function serializarIntegracao(row: typeof integracoesCorretora.$inferSelect) {
  let health: unknown = null;
  try { health = row.ultimoHealth ? JSON.parse(row.ultimoHealth) : null; } catch { health = null; }
  let tokenMascarado = '••••';
  try { tokenMascarado = mascararSegredo(decryptSecret(row.tokenCriptografado)); } catch { /* chave trocada */ }
  return {
    id: row.id,
    contaCorretoraId: row.contaCorretoraId,
    provider: row.provider,
    urlConector: row.urlConector,
    tokenMascarado,
    temChaveAtivacao: !!row.chaveAtivacaoCriptografada,
    status: row.status,
    ultimoSyncEm: row.ultimoSyncEm,
    ultimoErro: row.ultimoErro,
    cursorTrades: row.cursorTrades,
    ultimoHealth: health,
    atualizadoEm: row.atualizadoEm,
  };
}


export type IntegracaoSerializada = ReturnType<typeof serializarIntegracao>;

/** Integração pelo id, só se for do usuário logado. */
export async function integracaoDoUsuario(id: number, lojaId: number, userId: number) {
  const [row] = await db
    .select()
    .from(integracoesCorretora)
    .where(and(eq(integracoesCorretora.id, id), eq(integracoesCorretora.lojaId, lojaId), eq(integracoesCorretora.usuarioId, userId)))
    .limit(1);
  return row ?? null;
}

