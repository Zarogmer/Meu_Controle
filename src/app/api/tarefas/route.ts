import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, tarefas } from '@/lib/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isDemoMode, demoTarefasPendentes } from '@/lib/demo-data';

export async function GET(request: NextRequest) {
  if (isDemoMode) {
    return NextResponse.json({
      tarefas: [
        { id: 1, titulo: 'Repor estoque de camisetas', descricao: 'Verificar fornecedor principal', prioridade: 'alta', status: 'pendente', criadoEm: new Date().toISOString(), concluidoEm: null },
        { id: 2, titulo: 'Conferir entrega do fornecedor', descricao: 'Entrega prevista para amanha', prioridade: 'media', status: 'pendente', criadoEm: new Date().toISOString(), concluidoEm: null },
        { id: 3, titulo: 'Atualizar precos da vitrine', descricao: null, prioridade: 'baixa', status: 'pendente', criadoEm: new Date().toISOString(), concluidoEm: null },
        { id: 4, titulo: 'Organizar deposito', descricao: 'Separar por categoria', prioridade: 'media', status: 'concluida', criadoEm: new Date().toISOString(), concluidoEm: new Date().toISOString() },
      ],
    });
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';

    const conditions = [eq(tarefas.lojaId, lojaId)];

    if (status && status !== 'todas') {
      conditions.push(eq(tarefas.status, status as 'pendente' | 'concluida'));
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select()
      .from(tarefas)
      .where(whereClause)
      .orderBy(
        sql`CASE ${tarefas.status} WHEN 'pendente' THEN 0 ELSE 1 END`,
        sql`CASE ${tarefas.prioridade} WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END`,
        desc(tarefas.criadoEm)
      );

    return NextResponse.json({ tarefas: rows });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao listar tarefas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireAuthWithTenant();

    const body = await request.json();
    const { titulo, descricao, prioridade } = body;

    if (!titulo || !titulo.trim()) {
      return NextResponse.json({ error: 'Titulo e obrigatorio' }, { status: 400 });
    }

    const [tarefa] = await db
      .insert(tarefas)
      .values({
        lojaId,
        usuarioId: userId,
        titulo: titulo.trim(),
        descricao: descricao?.trim() || null,
        prioridade: prioridade || 'media',
        status: 'pendente',
      })
      .returning();

    return NextResponse.json({ tarefa }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao criar tarefa:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
