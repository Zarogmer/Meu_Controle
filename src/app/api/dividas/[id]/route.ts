import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithTenant } from '@/lib/auth';
import { db, dividas } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

// PUT: admin only
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminWithTenant();
    const { id } = await params;
    const dividaId = parseInt(id, 10);

    const [existing] = await db
      .select()
      .from(dividas)
      .where(and(eq(dividas.id, dividaId), eq(dividas.lojaId, auth.lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Divida nao encontrada' }, { status: 404 });
    }

    const body = await request.json();
    const { nomeDevedor, telefone, descricao, valorTotal, valorPago, dataCompra, dataVencimento, observacoes } = body;

    if (!nomeDevedor || !nomeDevedor.trim()) {
      return NextResponse.json({ error: 'Nome do devedor e obrigatorio' }, { status: 400 });
    }

    const valorTotalCentavos = Math.round(parseFloat(valorTotal) * 100);
    const valorPagoCentavos = Math.round(parseFloat(valorPago || '0') * 100);

    let status = 'pendente';
    if (valorPagoCentavos >= valorTotalCentavos) {
      status = 'pago';
    } else if (valorPagoCentavos > 0) {
      status = 'parcial';
    }

    await db
      .update(dividas)
      .set({
        nomeDevedor: nomeDevedor.trim(),
        telefone: telefone?.trim() || null,
        descricao: descricao?.trim() || null,
        valorTotal: valorTotalCentavos,
        valorPago: valorPagoCentavos,
        dataCompra: dataCompra || null,
        dataVencimento: dataVencimento || null,
        status,
        observacoes: observacoes?.trim() || null,
        atualizadoEm: new Date(),
      })
      .where(and(eq(dividas.id, dividaId), eq(dividas.lojaId, auth.lojaId)));

    const [divida] = await db
      .select()
      .from(dividas)
      .where(and(eq(dividas.id, dividaId), eq(dividas.lojaId, auth.lojaId)))
      .limit(1);

    return NextResponse.json({ divida });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    console.error('Erro ao atualizar divida:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE: admin only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminWithTenant();
    const { id } = await params;
    const dividaId = parseInt(id, 10);

    const [existing] = await db
      .select({ id: dividas.id })
      .from(dividas)
      .where(and(eq(dividas.id, dividaId), eq(dividas.lojaId, auth.lojaId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Divida nao encontrada' }, { status: 404 });
    }

    await db
      .delete(dividas)
      .where(and(eq(dividas.id, dividaId), eq(dividas.lojaId, auth.lojaId)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Permissão insuficiente') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }
    console.error('Erro ao excluir divida:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
