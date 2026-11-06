import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { respostaErro } from '@/lib/investimentos/http';
import { contaDoUsuario } from '@/lib/investimentos/servidor';
import { zerarPosicao, origemDaRequisicao, respostaTradingErro } from '@/lib/trading/servico';

/** POST { contaCorretoraId, ativo, bolsa, tipoPosicao (1 day trade | 2 consolidada), confirmado: true } */
export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const body = await request.json().catch(() => ({}));
    if (body.confirmado !== true) return NextResponse.json({ error: 'Confirme antes de zerar a posição', codigo: 'confirmacao' }, { status: 400 });
    const contaId = parseInt(String(body.contaCorretoraId ?? ''), 10);
    const conta = Number.isInteger(contaId) ? await contaDoUsuario({ lojaId, userId }, contaId) : null;
    if (!conta) return NextResponse.json({ error: 'Conta de corretora não encontrada' }, { status: 404 });
    const ativo = String(body.ativo ?? '').trim();
    if (!ativo) return NextResponse.json({ error: 'Informe o ativo' }, { status: 400 });
    const tipoPosicao: 1 | 2 = Number(body.tipoPosicao) === 2 ? 2 : 1;
    try {
      const r = await zerarPosicao({ contaCorretoraId: conta.id, lojaId, usuarioId: userId }, ativo, body.bolsa === 'F' ? 'F' : 'B', tipoPosicao, origemDaRequisicao(request.headers));
      return NextResponse.json({ resultado: r });
    } catch (err) {
      const te = respostaTradingErro(err);
      if (te) return NextResponse.json(te.body, { status: te.status });
      throw err;
    }
  } catch (error) {
    return respostaErro(error, 'zerar posição');
  }
}
