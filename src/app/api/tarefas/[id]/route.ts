import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, tarefas } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId } = await requireAuthWithTenant();
    const { id } = await params;
    const tarefaId = parseInt(id, 10);

    const [existing] = await db
      .select()
      .from(tarefas)
      .where(and(eq(tarefas.id, tarefaId), eq(tarefas.lojaId, lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Tarefa nao encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { titulo, descricao, prioridade, status } = body;

    // Handle concluidoEm based on status change
    let concluidoEm = existing.concluidoEm;
    if (status === 'concluida' && existing.status !== 'concluida') {
      concluidoEm = new Date();
    } else if (status === 'pendente' && existing.status === 'concluida') {
      concluidoEm = null;
    }

    await db
      .update(tarefas)
      .set({
        titulo: titulo?.trim() || existing.titulo,
        descricao: descricao !== undefined ? (descricao?.trim() || null) : existing.descricao,
        prioridade: prioridade || existing.prioridade,
        status: status || existing.status,
        concluidoEm,
      })
      .where(and(eq(tarefas.id, tarefaId), eq(tarefas.lojaId, lojaId)));

    const [tarefa] = await db
      .select()
      .from(tarefas)
      .where(and(eq(tarefas.id, tarefaId), eq(tarefas.lojaId, lojaId)))
      .limit(1);

    return NextResponse.json({ tarefa });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao atualizar tarefa:', error);
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
    const tarefaId = parseInt(id, 10);

    const [existing] = await db
      .select({ id: tarefas.id })
      .from(tarefas)
      .where(and(eq(tarefas.id, tarefaId), eq(tarefas.lojaId, lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Tarefa nao encontrada' }, { status: 404 });
    }

    await db
      .delete(tarefas)
      .where(and(eq(tarefas.id, tarefaId), eq(tarefas.lojaId, lojaId)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao excluir tarefa:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
