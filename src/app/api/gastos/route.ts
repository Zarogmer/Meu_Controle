import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, gastos } from '@/lib/db';
import { eq, and, desc, ilike, or, gte, lte, sql, type SQL } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-data';
import { gastosVisiveis } from '@/lib/contas-recorrentes';
import { isCompetencia, isDataISO, competenciaDeData } from '@/lib/contas';

/**
 * Competência efetiva de um gasto: a competência informada ou, na falta
 * dela, o mês da data do gasto. Filtros de ano/mês e resumos usam isso
 * para que a conta de março paga em abril continue contando em março.
 */
const competenciaEfetiva = sql<string>`COALESCE(${gastos.competencia}, LEFT(${gastos.dataGasto}, 7))`;

export async function GET(request: NextRequest) {
  if (isDemoMode) {
    return NextResponse.json({ gastos: [] });
  }

  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();

    const { searchParams } = request.nextUrl;
    const tipo = searchParams.get('tipo') || '';
    const status = searchParams.get('status') || '';
    const busca = searchParams.get('busca') || '';
    const ano = searchParams.get('ano') || '';
    const mes = searchParams.get('mes') || '';
    const categoria = searchParams.get('categoria') || '';
    const contaRecorrenteId = searchParams.get('contaRecorrenteId') || '';
    const dataInicio = searchParams.get('dataInicio') || '';
    const dataFim = searchParams.get('dataFim') || '';

    // Isolamento por loja + regra de gasto pessoal (só o próprio usuário;
    // funcionário nunca vê pessoal).
    const conditions: SQL[] = [gastosVisiveis({ lojaId, userId, role })];

    if (tipo === 'pessoal' || tipo === 'empresa') {
      conditions.push(eq(gastos.tipo, tipo));
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

    // ano + mes → competência exata; só ano → prefixo do ano.
    if (/^\d{4}$/.test(ano)) {
      const mesNum = parseInt(mes, 10);
      if (Number.isInteger(mesNum) && mesNum >= 1 && mesNum <= 12) {
        conditions.push(eq(competenciaEfetiva, `${ano}-${String(mesNum).padStart(2, '0')}`));
      } else {
        conditions.push(sql`${competenciaEfetiva} LIKE ${`${ano}-%`}`);
      }
    } else if (isCompetencia(mes)) {
      conditions.push(eq(competenciaEfetiva, mes));
    }

    if (categoria) {
      conditions.push(ilike(gastos.categoria, categoria));
    }

    const contaId = parseInt(contaRecorrenteId, 10);
    if (Number.isInteger(contaId) && contaId > 0) {
      conditions.push(eq(gastos.contaRecorrenteId, contaId));
    }

    if (isDataISO(dataInicio)) {
      conditions.push(gte(gastos.dataGasto, dataInicio));
    }
    if (isDataISO(dataFim)) {
      conditions.push(lte(gastos.dataGasto, dataFim));
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
    const { lojaId, userId, role } = await requireAuthWithTenant();

    const body = await request.json();
    const {
      descricao, valor, tipo, status, categoria, dataGasto, observacao,
      contaRecorrenteId, dataVencimento, competencia,
    } = body;

    if (!descricao || !descricao.trim()) {
      return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });
    }

    if (!valor || parseFloat(valor) <= 0) {
      return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 });
    }

    const tipoFinal: 'pessoal' | 'empresa' = tipo === 'pessoal' ? 'pessoal' : 'empresa';
    if (tipoFinal === 'pessoal' && role === 'employee') {
      return NextResponse.json({ error: 'Sem permissão para gastos pessoais' }, { status: 403 });
    }
    const valorCentavos = Math.round(parseFloat(valor) * 100);
    const dataFinal = isDataISO(dataGasto) ? dataGasto : new Date().toISOString().split('T')[0];

    const contaId = parseInt(String(contaRecorrenteId ?? ''), 10);
    const vencimento = isDataISO(dataVencimento) ? dataVencimento : null;
    const competenciaFinal = isCompetencia(competencia)
      ? competencia
      : vencimento
        ? competenciaDeData(vencimento)
        : null;

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
        dataGasto: dataFinal,
        observacao: observacao?.trim() || null,
        contaRecorrenteId: Number.isInteger(contaId) && contaId > 0 ? contaId : null,
        dataVencimento: vencimento,
        competencia: competenciaFinal,
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
