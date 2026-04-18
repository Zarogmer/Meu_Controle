import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, gastos } from '@/lib/db';
import { eq, and, desc, ilike, or } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-data';

export async function GET(request: NextRequest) {
  if (isDemoMode) {
    return NextResponse.json({ gastos: [] });
  }

  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || '';
    const status = searchParams.get('status') || '';
    const busca = searchParams.get('busca') || '';

    const conditions = [eq(gastos.lojaId, lojaId)];

    // Funcionários só veem gastos da empresa; pessoal é do próprio usuário.
    if (role === 'employee') {
      conditions.push(eq(gastos.tipo, 'empresa'));
    }

    if (tipo === 'pessoal' || tipo === 'empresa') {
      conditions.push(eq(gastos.tipo, tipo));
      // Gastos pessoais: só mostra os do próprio usuário logado.
      if (tipo === 'pessoal' && userId) {
        conditions.push(eq(gastos.usuarioId, userId));
      }
    }

    if (status === 'pago' || status === 'pendente') {
      conditions.push(eq(gastos.status, status));
    }

    if (busca) {
      conditions.push(
        or(
          ilike(gastos.descricao, `%${busca}%`),
          ilike(gastos.categoria, `%${busca}%`),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(gastos)
      .where(and(...conditions))
      .orderBy(desc(gastos.dataGasto), desc(gastos.criadoEm));

    return NextResponse.json({ gastos: rows });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao listar gastos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireAuthWithTenant();

    const body = await request.json();
    const { descricao, valor, tipo, status, categoria, dataGasto, observacao } = body;

    if (!descricao || !descricao.trim()) {
      return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });
    }

    if (!valor || parseFloat(valor) <= 0) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 });
    }

    const tipoFinal: 'pessoal' | 'empresa' = tipo === 'pessoal' ? 'pessoal' : 'empresa';
    const valorCentavos = Math.round(parseFloat(valor) * 100);

    const [gasto] = await db
      .insert(gastos)
      .values({
        lojaId,
        usuarioId: tipoFinal === 'pessoal' ? userId ?? null : null,
        descricao: descricao.trim(),
        valor: valorCentavos,
        tipo: tipoFinal,
        status: status === 'pendente' ? 'pendente' : 'pago',
        categoria: categoria?.trim() || null,
        dataGasto: dataGasto || new Date().toISOString().split('T')[0],
        observacao: observacao?.trim() || null,
      })
      .returning();

    return NextResponse.json({ gasto }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao criar gasto:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
