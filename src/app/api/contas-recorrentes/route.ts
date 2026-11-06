import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, contasRecorrentes } from '@/lib/db';
import { and, asc, eq } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-data';
import { isCategoriaConta, competenciaAtual } from '@/lib/contas';
import { contasVisiveis, gerarFaturasDaCompetencia } from '@/lib/contas-recorrentes';

export async function GET(request: NextRequest) {
  if (isDemoMode) {
    return NextResponse.json({ contas: [] });
  }

  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();
    const { searchParams } = request.nextUrl;
    const tipo = searchParams.get('tipo') || '';
    const ativa = searchParams.get('ativa') || '';

    const conditions = [contasVisiveis({ lojaId, userId, role })];
    if (tipo === 'pessoal' || tipo === 'empresa') {
      conditions.push(eq(contasRecorrentes.tipo, tipo));
    }
    if (ativa === 'true' || ativa === 'false') {
      conditions.push(eq(contasRecorrentes.ativa, ativa === 'true'));
    }

    const rows = await db
      .select()
      .from(contasRecorrentes)
      .where(and(...conditions))
      .orderBy(asc(contasRecorrentes.diaVencimento), asc(contasRecorrentes.nome));

    return NextResponse.json({ contas: rows });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao listar contas recorrentes:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();

    const body = await request.json();
    const { nome, tipo, categoria, valorEstimado, diaVencimento, ativa, observacao } = body;

    if (!nome || !String(nome).trim()) {
      return NextResponse.json({ error: 'Nome da conta é obrigatório' }, { status: 400 });
    }

    const tipoFinal: 'pessoal' | 'empresa' = tipo === 'pessoal' ? 'pessoal' : 'empresa';
    if (tipoFinal === 'pessoal' && role === 'employee') {
      return NextResponse.json({ error: 'Sem permissão para contas pessoais' }, { status: 403 });
    }

    if (!isCategoriaConta(categoria)) {
      return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 });
    }

    const valorCentavos = Math.round(parseFloat(String(valorEstimado ?? '0')) * 100);
    if (!Number.isFinite(valorCentavos) || valorCentavos < 0) {
      return NextResponse.json({ error: 'Valor estimado inválido' }, { status: 400 });
    }

    const dia = parseInt(String(diaVencimento ?? ''), 10);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      return NextResponse.json({ error: 'Dia de vencimento deve ser entre 1 e 31' }, { status: 400 });
    }

    const [conta] = await db
      .insert(contasRecorrentes)
      .values({
        lojaId,
        usuarioId: tipoFinal === 'pessoal' ? userId : null,
        tipo: tipoFinal,
        nome: String(nome).trim(),
        categoria,
        valorEstimado: valorCentavos,
        diaVencimento: dia,
        ativa: ativa === false ? false : true,
        observacao: observacao ? String(observacao).trim() || null : null,
      })
      .returning();

    // Já deixa a fatura do mês corrente pronta para a conta recém-criada.
    let faturaGerada = false;
    if (conta.ativa) {
      const { criadas } = await gerarFaturasDaCompetencia(
        { lojaId, userId, role },
        competenciaAtual(),
        { contaIds: [conta.id] },
      );
      faturaGerada = criadas > 0;
    }

    return NextResponse.json({ conta, faturaGerada }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao criar conta recorrente:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
