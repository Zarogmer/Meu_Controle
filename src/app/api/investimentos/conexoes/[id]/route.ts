import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, integracoesCorretora, contasCorretora } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { integracaoDoUsuario } from '@/lib/investimentos/integracoes';
import { respostaErro } from '@/lib/investimentos/http';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const { id } = await params;
    const row = await integracaoDoUsuario(parseInt(id, 10), lojaId, userId);
    if (!row) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });
    await db.delete(integracoesCorretora).where(eq(integracoesCorretora.id, row.id));
    await db.update(contasCorretora).set({ origem: 'manual', atualizadoEm: new Date() }).where(eq(contasCorretora.id, row.contaCorretoraId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return respostaErro(error, 'remover conexão');
  }
}
