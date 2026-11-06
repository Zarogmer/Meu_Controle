import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { respostaErro } from '@/lib/investimentos/http';
import { contaDoUsuario } from '@/lib/investimentos/servidor';
import { cancelarOrdem, origemDaRequisicao, respostaTradingErro } from '@/lib/trading/servico';

/** POST { contaCorretoraId } — cancela a ordem (id local ou ClOrderID). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const contaId = parseInt(String(body.contaCorretoraId ?? ''), 10);
    const conta = Number.isInteger(contaId) ? await contaDoUsuario({ lojaId, userId }, contaId) : null;
    if (!conta) return NextResponse.json({ error: 'Conta de corretora não encontrada' }, { status: 404 });
    try {
      const r = await cancelarOrdem({ contaCorretoraId: conta.id, lojaId, usuarioId: userId }, id, origemDaRequisicao(request.headers));
      return NextResponse.json({ resultado: r });
    } catch (err) {
      const te = respostaTradingErro(err);
      if (te) return NextResponse.json(te.body, { status: te.status });
      throw err;
    }
  } catch (error) {
    return respostaErro(error, 'cancelar ordem');
  }
}
