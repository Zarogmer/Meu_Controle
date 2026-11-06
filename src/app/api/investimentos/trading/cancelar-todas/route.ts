import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { respostaErro } from '@/lib/investimentos/http';
import { contaDoUsuario } from '@/lib/investimentos/servidor';
import { cancelarTodas, origemDaRequisicao, respostaTradingErro } from '@/lib/trading/servico';

/** POST { contaCorretoraId, confirmado: true } — kill switch. */
export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const body = await request.json().catch(() => ({}));
    if (body.confirmado !== true) return NextResponse.json({ error: 'Confirme antes de cancelar todas', codigo: 'confirmacao' }, { status: 400 });
    const contaId = parseInt(String(body.contaCorretoraId ?? ''), 10);
    const conta = Number.isInteger(contaId) ? await contaDoUsuario({ lojaId, userId }, contaId) : null;
    if (!conta) return NextResponse.json({ error: 'Conta de corretora não encontrada' }, { status: 404 });
    try {
      const r = await cancelarTodas({ contaCorretoraId: conta.id, lojaId, usuarioId: userId }, origemDaRequisicao(request.headers));
      return NextResponse.json({ resultado: r });
    } catch (err) {
      const te = respostaTradingErro(err);
      if (te) return NextResponse.json(te.body, { status: te.status });
      throw err;
    }
  } catch (error) {
    return respostaErro(error, 'cancelar todas');
  }
}
