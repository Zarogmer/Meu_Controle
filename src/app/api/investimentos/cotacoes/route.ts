import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, cotacoesCache } from '@/lib/db';
import { respostaErro } from '@/lib/investimentos/http';
import { normalizarAtivo } from '@/lib/investimentos/calculos';

/**
 * PUT /api/investimentos/cotacoes  { ativo, preco }
 * Atualização manual da última cotação (na Fase 3 o conector alimenta
 * isso sozinho). Cache compartilhado — serve para calcular o resultado
 * não realizado das posições.
 */
export async function PUT(request: NextRequest) {
  try {
    await requireInvestidor();
    const body = await request.json();
    const ativo = normalizarAtivo(String(body.ativo ?? ''));
    const preco = parseFloat(String(body.preco ?? ''));
    if (!ativo) return NextResponse.json({ error: 'Informe o ativo' }, { status: 400 });
    if (!Number.isFinite(preco) || preco <= 0) return NextResponse.json({ error: 'Cotação inválida' }, { status: 400 });

    const [row] = await db
      .insert(cotacoesCache)
      .values({ ativo, preco: String(preco), atualizadoEm: new Date() })
      .onConflictDoUpdate({ target: cotacoesCache.ativo, set: { preco: String(preco), atualizadoEm: new Date() } })
      .returning();
    return NextResponse.json({ cotacao: { ativo: row.ativo, preco: Number(row.preco), atualizadoEm: row.atualizadoEm } });
  } catch (error) {
    return respostaErro(error, 'atualizar cotação');
  }
}
