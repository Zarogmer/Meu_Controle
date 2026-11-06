import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, contasCorretora } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { respostaErro, CORRETORAS } from '@/lib/investimentos/http';
import { contaDoUsuario } from '@/lib/investimentos/servidor';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const { id } = await params;
    const contaId = parseInt(id, 10);
    const existing = await contaDoUsuario({ lojaId, userId }, contaId);
    if (!existing) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    const body = await request.json();
    const { apelido, corretora, conta, ativa } = body;
    if (apelido !== undefined && !String(apelido).trim()) {
      return NextResponse.json({ error: 'Dê um apelido para a conta' }, { status: 400 });
    }

    await db
      .update(contasCorretora)
      .set({
        apelido: apelido === undefined ? existing.apelido : String(apelido).trim(),
        corretora: corretora === undefined ? existing.corretora
          : (CORRETORAS as readonly string[]).includes(corretora) ? corretora : 'outra',
        conta: conta === undefined ? existing.conta : String(conta ?? '').trim() || null,
        ativa: typeof ativa === 'boolean' ? ativa : existing.ativa,
        atualizadoEm: new Date(),
      })
      .where(eq(contasCorretora.id, contaId));

    const atualizada = await contaDoUsuario({ lojaId, userId }, contaId);
    return NextResponse.json({ conta: atualizada });
  } catch (error) {
    return respostaErro(error, 'atualizar conta de corretora');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const { id } = await params;
    const contaId = parseInt(id, 10);
    const existing = await contaDoUsuario({ lojaId, userId }, contaId);
    if (!existing) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });

    // ON DELETE CASCADE leva as operações junto.
    await db.delete(contasCorretora).where(eq(contasCorretora.id, contaId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return respostaErro(error, 'excluir conta de corretora');
  }
}
