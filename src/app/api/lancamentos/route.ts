import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, lancamentos } from '@/lib/db';
import { eq, and, desc, ilike, or } from 'drizzle-orm';
import { isDemoMode, demoLancamentosRecentes } from '@/lib/demo-data';

export async function GET(request: NextRequest) {
  if (isDemoMode) {
    return NextResponse.json(demoLancamentosRecentes);
  }

  try {
    const { lojaId } = await requireAuthWithTenant();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const tipo = searchParams.get('tipo') || '';
    const busca = searchParams.get('busca') || '';

    const conditions = [eq(lancamentos.lojaId, lojaId)];

    if (status && status !== 'todos') {
      conditions.push(eq(lancamentos.status, status as 'pago' | 'aguardando_pagamento' | 'em_processo'));
    }

    if (tipo && tipo !== 'todos') {
      conditions.push(eq(lancamentos.tipo, tipo as 'produto' | 'servico'));
    }

    if (busca) {
      conditions.push(
        or(
          ilike(lancamentos.descricao, `%${busca}%`),
          ilike(lancamentos.clienteNome, `%${busca}%`),
        )!
      );
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select()
      .from(lancamentos)
      .where(whereClause)
      .orderBy(desc(lancamentos.dataLancamento), desc(lancamentos.criadoEm));

    return NextResponse.json({ lancamentos: rows });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao listar lancamentos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId } = await requireAuthWithTenant();

    const body = await request.json();
    const { descricao, valor, tipo, status, dataLancamento, observacao, clienteNome } = body;

    if (!descricao || !descricao.trim()) {
      return NextResponse.json({ error: 'Descricao e obrigatoria' }, { status: 400 });
    }

    if (!valor || parseFloat(valor) <= 0) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 });
    }

    const valorCentavos = Math.round(parseFloat(valor) * 100);

    const [lancamento] = await db
      .insert(lancamentos)
      .values({
        lojaId,
        descricao: descricao.trim(),
        valor: valorCentavos,
        tipo: tipo || 'produto',
        status: status || 'aguardando_pagamento',
        dataLancamento: dataLancamento || new Date().toISOString().split('T')[0],
        observacao: observacao?.trim() || null,
        clienteNome: clienteNome?.trim() || null,
      })
      .returning();

    return NextResponse.json({ lancamento }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao criar lancamento:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
