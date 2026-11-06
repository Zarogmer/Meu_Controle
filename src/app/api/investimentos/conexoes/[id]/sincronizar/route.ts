import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, integracoesCorretora } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { respostaErro } from '@/lib/investimentos/http';
import { integracaoDoUsuario, serializarIntegracao } from '@/lib/investimentos/integracoes';
import { sincronizarIntegracao } from '@/lib/investimentos/sync';

/** POST: "Sincronizar agora" — puxa execuções e cotações do conector. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const { id } = await params;
    const row = await integracaoDoUsuario(parseInt(id, 10), lojaId, userId);
    if (!row) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });

    const resultado = await sincronizarIntegracao(row);
    const [atual] = await db.select().from(integracoesCorretora).where(eq(integracoesCorretora.id, row.id)).limit(1);
    return NextResponse.json({ resultado, integracao: serializarIntegracao(atual) });
  } catch (error) {
    return respostaErro(error, 'sincronizar conexão');
  }
}
