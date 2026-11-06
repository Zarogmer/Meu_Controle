import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, operacoes } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { respostaErro } from '@/lib/investimentos/http';
import { contaDoUsuario } from '@/lib/investimentos/servidor';
import { validarOperacao } from '@/lib/investimentos/validacao';

async function carregar(id: number, lojaId: number, userId: number) {
  const [op] = await db
    .select()
    .from(operacoes)
    .where(and(eq(operacoes.id, id), eq(operacoes.lojaId, lojaId), eq(operacoes.usuarioId, userId)))
    .limit(1);
  return op ?? null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const { id } = await params;
    const opId = parseInt(id, 10);
    const existing = await carregar(opId, lojaId, userId);
    if (!existing) return NextResponse.json({ error: 'Operação não encontrada' }, { status: 404 });

    const body = await request.json();
    const validado = validarOperacao({
      contaCorretoraId: existing.contaCorretoraId,
      ativo: existing.ativo,
      lado: existing.lado,
      quantidade: existing.quantidade,
      preco: existing.preco,
      mercado: existing.mercado,
      multiplicador: existing.multiplicador,
      taxas: existing.taxas / 100,
      dataOperacao: existing.dataOperacao,
      horario: existing.horario,
      modalidade: existing.modalidade,
      observacao: existing.observacao,
      ...body,
    });
    if ('error' in validado) return NextResponse.json({ error: validado.error }, { status: 400 });

    if (validado.contaCorretoraId !== existing.contaCorretoraId) {
      const conta = await contaDoUsuario({ lojaId, userId }, validado.contaCorretoraId);
      if (!conta) return NextResponse.json({ error: 'Conta de corretora não encontrada' }, { status: 404 });
    }

    await db
      .update(operacoes)
      .set({
        contaCorretoraId: validado.contaCorretoraId,
        ativo: validado.ativo,
        mercado: validado.mercado,
        lado: validado.lado,
        quantidade: validado.quantidade,
        preco: String(validado.preco),
        multiplicador: String(validado.multiplicador),
        taxas: validado.taxas,
        dataOperacao: validado.dataOperacao,
        horario: validado.horario,
        modalidade: validado.modalidade,
        observacao: validado.observacao,
      })
      .where(eq(operacoes.id, opId));

    const atualizada = await carregar(opId, lojaId, userId);
    return NextResponse.json({ operacao: atualizada });
  } catch (error) {
    return respostaErro(error, 'atualizar operação');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const { id } = await params;
    const opId = parseInt(id, 10);
    const existing = await carregar(opId, lojaId, userId);
    if (!existing) return NextResponse.json({ error: 'Operação não encontrada' }, { status: 404 });
    await db.delete(operacoes).where(eq(operacoes.id, opId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return respostaErro(error, 'excluir operação');
  }
}
