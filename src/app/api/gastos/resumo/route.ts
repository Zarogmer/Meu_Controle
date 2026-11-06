import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { db, gastos } from '@/lib/db';
import { and, asc, eq, gt, gte, isNotNull, lt, lte, sql, type SQL } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-data';
import { gastosVisiveis, contasSemLancamento } from '@/lib/contas-recorrentes';
import {
  CATEGORIA_CONTA_LABEL,
  competenciaAtual,
  hojeISO,
  isCompetencia,
  somarDias,
} from '@/lib/contas';

/**
 * GET /api/gastos/resumo?ano=YYYY&competencia=YYYY-MM&tipo=pessoal|empresa
 *
 * - anual: total pago no ano por mês e por categoria
 * - previsaoMes: pago + pendente + contas fixas ainda não lançadas
 * - vencimentos: atrasados e próximos 7 dias
 */

const competenciaEfetiva = sql<string>`COALESCE(${gastos.competencia}, LEFT(${gastos.dataGasto}, 7))`;
const categoriaOuSem = sql<string>`COALESCE(NULLIF(TRIM(${gastos.categoria}), ''), 'Sem categoria')`;

interface VencimentoItem {
  id: number;
  descricao: string;
  categoria: string | null;
  tipo: 'pessoal' | 'empresa';
  valor: number;
  dataVencimento: string | null;
  contaRecorrenteId: number | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const hoje = hojeISO();
  const anoParam = searchParams.get('ano') || '';
  const ano = /^\d{4}$/.test(anoParam) ? anoParam : hoje.slice(0, 4);
  const compParam = searchParams.get('competencia') || '';
  const competencia = isCompetencia(compParam) ? compParam : competenciaAtual();

  if (isDemoMode) {
    return NextResponse.json(resumoVazio(ano, competencia));
  }

  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();
    const auth = { lojaId, userId, role };
    const tipo = searchParams.get('tipo') || '';

    const base: SQL[] = [gastosVisiveis(auth)];
    if (tipo === 'pessoal' || tipo === 'empresa') {
      base.push(eq(gastos.tipo, tipo));
    }

    // ── Visão anual: por mês (pago x pendente) e por categoria × mês ──
    const porMesRows = await db
      .select({
        competencia: competenciaEfetiva,
        status: gastos.status,
        total: sql<number>`COALESCE(SUM(${gastos.valor}), 0)`,
      })
      .from(gastos)
      .where(and(...base, sql`${competenciaEfetiva} LIKE ${`${ano}-%`}`))
      .groupBy(competenciaEfetiva, gastos.status);

    const porMes = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      competencia: `${ano}-${String(i + 1).padStart(2, '0')}`,
      pago: 0,
      pendente: 0,
    }));
    for (const row of porMesRows) {
      const idx = Number(row.competencia.slice(5, 7)) - 1;
      if (idx < 0 || idx > 11) continue;
      if (row.status === 'pago') porMes[idx].pago += Number(row.total);
      else porMes[idx].pendente += Number(row.total);
    }

    const porCategoriaRows = await db
      .select({
        categoria: categoriaOuSem,
        competencia: competenciaEfetiva,
        total: sql<number>`COALESCE(SUM(${gastos.valor}), 0)`,
      })
      .from(gastos)
      .where(and(...base, eq(gastos.status, 'pago'), sql`${competenciaEfetiva} LIKE ${`${ano}-%`}`))
      .groupBy(categoriaOuSem, competenciaEfetiva);

    const catMap = new Map<string, { categoria: string; total: number; porMes: number[] }>();
    for (const row of porCategoriaRows) {
      const entry = catMap.get(row.categoria) ?? {
        categoria: row.categoria,
        total: 0,
        porMes: Array(12).fill(0) as number[],
      };
      const idx = Number(row.competencia.slice(5, 7)) - 1;
      const valor = Number(row.total);
      entry.total += valor;
      if (idx >= 0 && idx < 12) entry.porMes[idx] += valor;
      catMap.set(row.categoria, entry);
    }
    const porCategoria = Array.from(catMap.values()).sort((a, b) => b.total - a.total);
    const totalPagoAno = porMes.reduce((s, m) => s + m.pago, 0);
    const totalPendenteAno = porMes.reduce((s, m) => s + m.pendente, 0);

    // ── Previsão do mês ──────────────────────────────────────────
    const [mesRow] = await db
      .select({
        pago: sql<number>`COALESCE(SUM(CASE WHEN ${gastos.status} = 'pago' THEN ${gastos.valor} ELSE 0 END), 0)`,
        pendente: sql<number>`COALESCE(SUM(CASE WHEN ${gastos.status} = 'pendente' THEN ${gastos.valor} ELSE 0 END), 0)`,
        qtdPendentes: sql<number>`SUM(CASE WHEN ${gastos.status} = 'pendente' THEN 1 ELSE 0 END)`,
        qtdPagos: sql<number>`SUM(CASE WHEN ${gastos.status} = 'pago' THEN 1 ELSE 0 END)`,
      })
      .from(gastos)
      .where(and(...base, eq(competenciaEfetiva, competencia)));

    const naoLancadasRaw = await contasSemLancamento(auth, competencia);
    const naoLancadas = naoLancadasRaw
      .filter((c) => !(tipo === 'pessoal' || tipo === 'empresa') || c.tipo === tipo)
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        categoria: CATEGORIA_CONTA_LABEL[c.categoria],
        tipo: c.tipo,
        valorEstimado: c.valorEstimado,
        diaVencimento: c.diaVencimento,
      }));
    const naoLancado = naoLancadas.reduce((s, c) => s + c.valorEstimado, 0);

    const pago = Number(mesRow?.pago ?? 0);
    const pendente = Number(mesRow?.pendente ?? 0);

    // ── Vencimentos (só gastos pendentes com data de vencimento) ──
    const vencimentoSelect = {
      id: gastos.id,
      descricao: gastos.descricao,
      categoria: gastos.categoria,
      tipo: gastos.tipo,
      valor: gastos.valor,
      dataVencimento: gastos.dataVencimento,
      contaRecorrenteId: gastos.contaRecorrenteId,
    };
    const pendentesComVencimento = and(
      ...base,
      eq(gastos.status, 'pendente'),
      isNotNull(gastos.dataVencimento),
    );

    const atrasados: VencimentoItem[] = await db
      .select(vencimentoSelect)
      .from(gastos)
      .where(and(pendentesComVencimento, lt(gastos.dataVencimento, hoje)))
      .orderBy(asc(gastos.dataVencimento))
      .limit(50);

    const proximos: VencimentoItem[] = await db
      .select(vencimentoSelect)
      .from(gastos)
      .where(
        and(
          pendentesComVencimento,
          gte(gastos.dataVencimento, hoje),
          lte(gastos.dataVencimento, somarDias(hoje, 7)),
        ),
      )
      .orderBy(asc(gastos.dataVencimento))
      .limit(50);

    const [futuros] = await db
      .select({ qtd: sql<number>`COUNT(*)` })
      .from(gastos)
      .where(and(pendentesComVencimento, gt(gastos.dataVencimento, somarDias(hoje, 7))));

    return NextResponse.json({
      ano,
      competencia,
      hoje,
      anual: {
        totalPago: totalPagoAno,
        totalPendente: totalPendenteAno,
        porMes,
        porCategoria,
      },
      previsaoMes: {
        competencia,
        pago,
        pendente,
        naoLancado,
        total: pago + pendente + naoLancado,
        qtdPagos: Number(mesRow?.qtdPagos ?? 0),
        qtdPendentes: Number(mesRow?.qtdPendentes ?? 0),
        contasNaoLancadas: naoLancadas,
      },
      vencimentos: {
        atrasados,
        proximos,
        valorAtrasado: atrasados.reduce((s, g) => s + g.valor, 0),
        valorProximos: proximos.reduce((s, g) => s + g.valor, 0),
        qtdFuturos: Number(futuros?.qtd ?? 0),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao montar resumo de gastos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

function resumoVazio(ano: string, competencia: string) {
  return {
    ano,
    competencia,
    hoje: hojeISO(),
    anual: {
      totalPago: 0,
      totalPendente: 0,
      porMes: Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        competencia: `${ano}-${String(i + 1).padStart(2, '0')}`,
        pago: 0,
        pendente: 0,
      })),
      porCategoria: [],
    },
    previsaoMes: {
      competencia,
      pago: 0,
      pendente: 0,
      naoLancado: 0,
      total: 0,
      qtdPagos: 0,
      qtdPendentes: 0,
      contasNaoLancadas: [],
    },
    vencimentos: { atrasados: [], proximos: [], valorAtrasado: 0, valorProximos: 0, qtdFuturos: 0 },
  };
}
