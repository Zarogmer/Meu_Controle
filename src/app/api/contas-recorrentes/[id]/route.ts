import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, contasRecorrentes, gastos } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { isCategoriaConta } from '@/lib/contas';

async function carregarConta(id: number, lojaId: number) {
  const [conta] = await db
    .select()
    .from(contasRecorrentes)
    .where(and(eq(contasRecorrentes.id, id), eq(contasRecorrentes.lojaId, lojaId)))
    .limit(1);
  return conta ?? null;
}

function podeMexer(
  conta: { tipo: 'pessoal' | 'empresa'; usuarioId: number | null },
  userId: number,
  role: string,
): boolean {
  if (conta.tipo === 'pessoal') {
    return conta.usuarioId === userId || role === 'super_admin';
  }
  return true;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();
    const { id } = await params;
    const contaId = parseInt(id, 10);

    const existing = await carregarConta(contaId, lojaId);
    if (!existing) {
      return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });
    }
    if (!podeMexer(existing, userId, role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await request.json();
    const { nome, tipo, categoria, valorEstimado, diaVencimento, ativa, observacao } = body;

    if (!nome || !String(nome).trim()) {
      return NextResponse.json({ error: 'Nome da conta é obrigatório' }, { status: 400 });
    }

    const tipoFinal: 'pessoal' | 'empresa' =
      tipo === 'pessoal' ? 'pessoal' : tipo === 'empresa' ? 'empresa' : existing.tipo;
    if (tipoFinal === 'pessoal' && role === 'employee') {
      return NextResponse.json({ error: 'Sem permissão para contas pessoais' }, { status: 403 });
    }

    const categoriaFinal = isCategoriaConta(categoria) ? categoria : existing.categoria;

    const valorCentavos =
      valorEstimado === undefined || valorEstimado === null || valorEstimado === ''
        ? existing.valorEstimado
        : Math.round(parseFloat(String(valorEstimado)) * 100);
    if (!Number.isFinite(valorCentavos) || valorCentavos < 0) {
      return NextResponse.json({ error: 'Valor estimado inválido' }, { status: 400 });
    }

    const dia =
      diaVencimento === undefined || diaVencimento === null || diaVencimento === ''
        ? existing.diaVencimento
        : parseInt(String(diaVencimento), 10);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      return NextResponse.json({ error: 'Dia de vencimento deve ser entre 1 e 31' }, { status: 400 });
    }

    await db
      .update(contasRecorrentes)
      .set({
        nome: String(nome).trim(),
        tipo: tipoFinal,
        usuarioId: tipoFinal === 'pessoal' ? existing.usuarioId ?? userId : null,
        categoria: categoriaFinal,
        valorEstimado: valorCentavos,
        diaVencimento: dia,
        ativa: typeof ativa === 'boolean' ? ativa : existing.ativa,
        observacao: observacao === undefined ? existing.observacao : String(observacao ?? '').trim() || null,
        atualizadoEm: new Date(),
      })
      .where(and(eq(contasRecorrentes.id, contaId), eq(contasRecorrentes.lojaId, lojaId)));

    const conta = await carregarConta(contaId, lojaId);
    return NextResponse.json({ conta });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao atualizar conta recorrente:', error);
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
    const contaId = parseInt(id, 10);

    const existing = await carregarConta(contaId, lojaId);
    if (!existing) {
      return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 });
    }
    if (!podeMexer(existing, userId, role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Faturas pendentes ainda não pagas desta conta saem junto; as pagas
    // ficam no histórico (a FK vira NULL via ON DELETE SET NULL).
    await db
      .delete(gastos)
      .where(
        and(
          eq(gastos.lojaId, lojaId),
          eq(gastos.contaRecorrenteId, contaId),
          eq(gastos.status, 'pendente'),
        ),
      );

    await db
      .delete(contasRecorrentes)
      .where(and(eq(contasRecorrentes.id, contaId), eq(contasRecorrentes.lojaId, lojaId)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao excluir conta recorrente:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
