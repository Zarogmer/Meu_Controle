import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTenant } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo-data';
import { competenciaAtual, isCompetencia } from '@/lib/contas';
import { gerarFaturasDaCompetencia } from '@/lib/contas-recorrentes';

/**
 * POST /api/contas-recorrentes/gerar?competencia=YYYY-MM
 *
 * Cria um gasto `pendente` para cada conta ativa que ainda não tenha
 * lançamento na competência. Idempotente — a tela chama ao abrir e o
 * botão "Gerar faturas do mês" chama de novo sem risco de duplicar.
 */
export async function POST(request: NextRequest) {
  if (isDemoMode) {
    return NextResponse.json({ competencia: competenciaAtual(), criadas: 0, contasAtivas: 0 });
  }

  try {
    const { lojaId, userId, role } = await requireAuthWithTenant();
    const param = request.nextUrl.searchParams.get('competencia');
    const competencia = param && param.length > 0 ? param : competenciaAtual();

    if (!isCompetencia(competencia)) {
      return NextResponse.json({ error: 'Competência inválida (use YYYY-MM)' }, { status: 400 });
    }

    const result = await gerarFaturasDaCompetencia({ lojaId, userId, role }, competencia);
    return NextResponse.json({ competencia, ...result });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Não autorizado') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    console.error('Erro ao gerar faturas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
