import { NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, tarefas } from '@/lib/db';
import { eq, and, sql, count } from 'drizzle-orm';
import { isDemoMode, demoTarefasPendentes } from '@/lib/demo-data';

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(demoTarefasPendentes);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const [totalResult] = await db
      .select({ total: count() })
      .from(tarefas)
      .where(and(eq(tarefas.lojaId, lojaId), eq(tarefas.status, 'pendente')));

    const top3 = await db
      .select({
        id: tarefas.id,
        titulo: tarefas.titulo,
        prioridade: tarefas.prioridade,
      })
      .from(tarefas)
      .where(and(eq(tarefas.lojaId, lojaId), eq(tarefas.status, 'pendente')))
      .orderBy(
        sql`CASE ${tarefas.prioridade} WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END`
      )
      .limit(3);

    return NextResponse.json({
      total: Number(totalResult.total),
      tarefas: top3,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
