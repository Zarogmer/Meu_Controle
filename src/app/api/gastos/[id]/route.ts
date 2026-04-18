import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, gastos } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();
    const { id } = await params;
    const gastoId = parseInt(id, 10);

    const [existing] = await db
      .select()
      .from(gastos)
      .where(and(eq(gastos.id, gastoId), eq(gastos.lojaId, lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Gasto não encontrado' }, { status: 404 });
    }

    // Só o dono do gasto pessoal pode editá-lo; funcionários não mexem em gastos pessoais.
    if (existing.tipo === 'pessoal' && existing.usuarioId !== userId && role !== 'super_admin') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await request.json();
    const { descricao, valor, tipo, status, categoria, dataGasto, observacao } = body;

    if (!descricao || !descricao.trim()) {
      return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });
    }

    const tipoFinal: 'pessoal' | 'empresa' =
      tipo === 'pessoal' ? 'pessoal' : tipo === 'empresa' ? 'empresa' : existing.tipo;
    const valorCentavos = Math.round(parseFloat(valor) * 100);

    await db
      .update(gastos)
      .set({
        descricao: descricao.trim(),
        valor: valorCentavos,
        tipo: tipoFinal,
        status: status === 'pendente' ? 'pendente' : status === 'pago' ? 'pago' : existing.status,
        categoria: categoria?.trim() || null,
        dataGasto: dataGasto || existing.dataGasto,
        observacao: observacao?.trim() || null,
        usuarioId: tipoFinal === 'pessoal' ? existing.usuarioId ?? userId ?? null : null,
        atualizadoEm: new Date(),
      })
      .where(and(eq(gastos.id, gastoId), eq(gastos.lojaId, lojaId)));

    const [gasto] = await db
      .select()
      .from(gastos)
      .where(and(eq(gastos.id, gastoId), eq(gastos.lojaId, lojaId)))
      .limit(1);

    return NextResponse.json({ gasto });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao atualizar gasto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();
    const { id } = await params;
    const gastoId = parseInt(id, 10);

    const [existing] = await db
      .select()
      .from(gastos)
      .where(and(eq(gastos.id, gastoId), eq(gastos.lojaId, lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Gasto não encontrado' }, { status: 404 });
    }

    if (existing.tipo === 'pessoal' && existing.usuarioId !== userId && role !== 'super_admin') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    await db
      .delete(gastos)
      .where(and(eq(gastos.id, gastoId), eq(gastos.lojaId, lojaId)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao excluir gasto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
