import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { db, tradingConfig } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { isDemoMode } from '@/lib/demo-data';
import { respostaErro } from '@/lib/investimentos/http';
import { carregarConfig, registrarAuditoria, origemDaRequisicao } from '@/lib/trading/servico';
import { normalizarLimites } from '@/lib/trading/limites';
import { randomUUID } from 'crypto';

/**
 * GET: configuração de trading do usuário (flag, modo, limites).
 * PUT: o usuário ajusta limites e modo. A flag só muda pela conta tech.
 *   body: { quantidadeMaxima?, perdaDiariaMaxima? (reais), modo?, confirmacaoReal? }
 *   Trocar para 'real' exige confirmacaoReal === 'OPERAR COM DINHEIRO REAL'.
 */
export async function GET() {
  if (isDemoMode) return NextResponse.json({ config: null });
  try {
    const { lojaId, userId } = await requireInvestidor();
    const cfg = await carregarConfig(lojaId, userId);
    return NextResponse.json({ config: cfg });
  } catch (error) {
    return respostaErro(error, 'config de trading');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const atual = await carregarConfig(lojaId, userId);
    const body = await request.json();

    const limites = normalizarLimites(body, atual);
    if ('error' in limites) return NextResponse.json({ error: limites.error }, { status: 400 });

    let modo = atual.modo;
    let modoRealAceitoEm = atual.modoRealAceitoEm;
    if (body.modo === 'simulacao' || body.modo === 'real') {
      if (body.modo === 'real' && atual.modo !== 'real') {
        if (!atual.tradingHabilitado) return NextResponse.json({ error: 'Envio de ordens não habilitado' }, { status: 403 });
        if (body.confirmacaoReal !== 'OPERAR COM DINHEIRO REAL') {
          return NextResponse.json({ error: 'Para ligar o modo real, digite exatamente: OPERAR COM DINHEIRO REAL' }, { status: 400 });
        }
        modoRealAceitoEm = new Date();
      }
      modo = body.modo;
    }

    await db
      .update(tradingConfig)
      .set({ quantidadeMaxima: limites.quantidadeMaxima, perdaDiariaMaxima: limites.perdaDiariaMaxima, modo, modoRealAceitoEm, atualizadoEm: new Date() })
      .where(eq(tradingConfig.id, atual.id));

    if (modo !== atual.modo || limites.quantidadeMaxima !== atual.quantidadeMaxima || limites.perdaDiariaMaxima !== atual.perdaDiariaMaxima) {
      await registrarAuditoria({
        conta: { lojaId, usuarioId: userId, contaCorretoraId: null }, ordemRef: randomUUID(), evento: 'config_alterada', modo,
        mensagem: `modo=${modo} qtdMax=${limites.quantidadeMaxima} perdaMax=${limites.perdaDiariaMaxima}`,
        detalhes: { antes: { modo: atual.modo, quantidadeMaxima: atual.quantidadeMaxima, perdaDiariaMaxima: atual.perdaDiariaMaxima } },
        origem: origemDaRequisicao(request.headers),
      });
    }
    const cfg = await carregarConfig(lojaId, userId);
    return NextResponse.json({ config: cfg });
  } catch (error) {
    return respostaErro(error, 'atualizar config de trading');
  }
}
