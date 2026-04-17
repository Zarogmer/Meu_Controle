import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, dividas } from '@/lib/db';
import { eq, and, ilike, asc, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { lojaId } = await requireAuthWithTenant();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const busca = searchParams.get('busca') || '';

    const conditions = [eq(dividas.lojaId, lojaId)];

    if (status && status !== 'todos') {
      conditions.push(eq(dividas.status, status));
    }

    if (busca) {
      conditions.push(ilike(dividas.nomeDevedor, `%${busca}%`));
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select()
      .from(dividas)
      .where(whereClause)
      .orderBy(
        sql`CASE ${dividas.status} WHEN 'pendente' THEN 0 WHEN 'parcial' THEN 1 ELSE 2 END`,
        asc(dividas.dataVencimento),
        desc(dividas.criadoEm)
      );

    return NextResponse.json({ dividas: rows });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao listar dividas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId } = await requireAuthWithTenant();

    const body = await request.json();
    const { nomeDevedor, telefone, descricao, valorTotal, valorPago, dataCompra, dataVencimento, observacoes } = body;

    if (!nomeDevedor || !nomeDevedor.trim()) {
      return NextResponse.json({ error: 'Nome do devedor e obrigatorio' }, { status: 400 });
    }

    if (!valorTotal || valorTotal <= 0) {
      return NextResponse.json({ error: 'Valor total deve ser maior que zero' }, { status: 400 });
    }

    const valorTotalCentavos = Math.round(parseFloat(valorTotal) * 100);
    const valorPagoCentavos = Math.round(parseFloat(valorPago || '0') * 100);

    let statusDivida = 'pendente';
    if (valorPagoCentavos >= valorTotalCentavos) {
      statusDivida = 'pago';
    } else if (valorPagoCentavos > 0) {
      statusDivida = 'parcial';
    }

    const [divida] = await db
      .insert(dividas)
      .values({
        lojaId,
        nomeDevedor: nomeDevedor.trim(),
        telefone: telefone?.trim() || null,
        descricao: descricao?.trim() || null,
        valorTotal: valorTotalCentavos,
        valorPago: valorPagoCentavos,
        dataCompra: dataCompra || new Date().toISOString().split('T')[0],
        dataVencimento: dataVencimento || null,
        status: statusDivida,
        observacoes: observacoes?.trim() || null,
      })
      .returning();

    return NextResponse.json({ divida }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao criar divida:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
