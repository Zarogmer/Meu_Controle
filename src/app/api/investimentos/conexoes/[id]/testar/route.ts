import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, integracoesCorretora } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { respostaErro } from '@/lib/investimentos/http';
import { integracaoDoUsuario, serializarIntegracao } from '@/lib/investimentos/integracoes';
import { providerDaIntegracao } from '@/lib/brokers';

/** POST: chama /health do conector e grava o resultado. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const { id } = await params;
    const row = await integracaoDoUsuario(parseInt(id, 10), lojaId, userId);
    if (!row) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });

    const provider = providerDaIntegracao(row);
    const conta = { contaCorretoraId: row.contaCorretoraId, lojaId, usuarioId: userId };
    try {
      const status = await provider.status(conta);
      await db
        .update(integracoesCorretora)
        .set({
          status: status.online ? 'conectado' : 'erro',
          ultimoErro: status.online ? null : 'Conector respondeu, mas não está pronto',
          ultimoHealth: JSON.stringify(status),
          atualizadoEm: new Date(),
        })
        .where(eq(integracoesCorretora.id, row.id));
      const [atual] = await db.select().from(integracoesCorretora).where(eq(integracoesCorretora.id, row.id)).limit(1);
      return NextResponse.json({ ok: true, status, integracao: serializarIntegracao(atual) });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      await db
        .update(integracoesCorretora)
        .set({ status: 'erro', ultimoErro: mensagem.slice(0, 500), atualizadoEm: new Date() })
        .where(eq(integracoesCorretora.id, row.id));
      const [atual] = await db.select().from(integracoesCorretora).where(eq(integracoesCorretora.id, row.id)).limit(1);
      return NextResponse.json({ ok: false, error: mensagem, integracao: serializarIntegracao(atual) });
    }
  } catch (error) {
    return respostaErro(error, 'testar conexão');
  }
}
