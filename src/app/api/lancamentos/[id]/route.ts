import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, lancamentos } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId } = await requireAuthWithTenant();
    const { id } = await params;
    const lancamentoId = parseInt(id, 10);

    const [existing] = await db
      .select()
      .from(lancamentos)
      .where(and(eq(lancamentos.id, lancamentoId), eq(lancamentos.lojaId, lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Lancamento nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { descricao, valor, tipo, status, dataLancamento, observacao, clienteNome } = body;

    if (!descricao || !descricao.trim()) {
      return NextResponse.json({ error: 'Descricao e obrigatoria' }, { status: 400 });
    }

    const valorCentavos = Math.round(parseFloat(valor) * 100);

    await db
      .update(lancamentos)
      .set({
        descricao: descricao.trim(),
        valor: valorCentavos,
        tipo: tipo || existing.tipo,
        status: status || existing.status,
        dataLancamento: dataLancamento || existing.dataLancamento,
        observacao: observacao?.trim() || null,
        clienteNome: clienteNome?.trim() || null,
        atualizadoEm: new Date(),
      })
      .where(and(eq(lancamentos.id, lancamentoId), eq(lancamentos.lojaId, lojaId)));

    const [lancamento] = await db
      .select()
      .from(lancamentos)
      .where(and(eq(lancamentos.id, lancamentoId), eq(lancamentos.lojaId, lojaId)))
      .limit(1);

    return NextResponse.json({ lancamento });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao atualizar lancamento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId } = await requireAuthWithTenant();
    const { id } = await params;
    const lancamentoId = parseInt(id, 10);

    const [existing] = await db
      .select({ id: lancamentos.id })
      .from(lancamentos)
      .where(and(eq(lancamentos.id, lancamentoId), eq(lancamentos.lojaId, lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Lancamento nao encontrado' }, { status: 404 });
    }

    await db
      .delete(lancamentos)
      .where(and(eq(lancamentos.id, lancamentoId), eq(lancamentos.lojaId, lojaId)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao excluir lancamento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
