import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { isDemoMode } from '@/lib/demo-data';
import { sincronizarTodas } from '@/lib/investimentos/sync';

/**
 * Job de sincronização chamado pelo cron do Railway (ou qualquer
 * agendador): GET ou POST com o header `x-cron-secret` igual a CRON_SECRET.
 *
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<app>/api/cron/sincronizar-corretoras
 */
function autorizado(request: NextRequest): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const recebido = request.headers.get('x-cron-secret') ?? request.nextUrl.searchParams.get('secret') ?? '';
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function executar(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  if (isDemoMode) return NextResponse.json({ resultados: [] });
  try {
    const resultados = await sincronizarTodas();
    return NextResponse.json({
      executadoEm: new Date().toISOString(),
      total: resultados.length,
      comErro: resultados.filter((r) => !r.ok).length,
      novas: resultados.reduce((s, r) => s + r.novas, 0),
      resultados,
    });
  } catch (error) {
    console.error('Erro no cron de sincronização:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return executar(request);
}

export async function GET(request: NextRequest) {
  return executar(request);
}
