import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo-data';
import { respostaErro } from '@/lib/investimentos/http';
import { contaDoUsuario } from '@/lib/investimentos/servidor';
import { getProvider } from '@/lib/brokers';
import { enviarOrdem, origemDaRequisicao, respostaTradingErro, carregarConfig, resultadoDeHoje } from '@/lib/trading/servico';
import type { PedidoOrdem } from '@/lib/trading/limites';

/**
 * GET  ?contaCorretoraId= → ordens abertas no conector + resultado do dia + config
 * POST → boleta. body: { contaCorretoraId, ativo, bolsa, lado, tipo, quantidade, preco?, precoStop?, confirmado: true }
 */
export async function GET(request: NextRequest) {
  if (isDemoMode) return NextResponse.json({ ordens: [], resultadoHoje: 0 });
  try {
    const { lojaId, userId } = await requireInvestidor();
    const contaId = parseInt(request.nextUrl.searchParams.get('contaCorretoraId') || '', 10);
    const conta = Number.isInteger(contaId) ? await contaDoUsuario({ lojaId, userId }, contaId) : null;
    if (!conta) return NextResponse.json({ error: 'Conta de corretora não encontrada' }, { status: 404 });
    const ref = { contaCorretoraId: conta.id, lojaId, usuarioId: userId };
    const config = await carregarConfig(lojaId, userId);
    const resultadoHoje = await resultadoDeHoje(ref);
    const { provider, integracao } = await getProvider(ref);
    let ordens: unknown[] = [];
    let status: unknown = null;
    let erroConector: string | null = null;
    if (integracao) {
      try {
        status = await provider.status(ref);
        ordens = await provider.getOrders(ref, {});
      } catch (err) {
        erroConector = err instanceof Error ? err.message : String(err);
      }
    }
    return NextResponse.json({ config, resultadoHoje, ordens, status, temConector: !!integracao, erroConector });
  } catch (error) {
    return respostaErro(error, 'listar ordens');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const body = await request.json();
    if (body.confirmado !== true) {
      return NextResponse.json({ error: 'Confirme a ordem antes de enviar', codigo: 'confirmacao' }, { status: 400 });
    }
    const contaId = parseInt(String(body.contaCorretoraId ?? ''), 10);
    const conta = Number.isInteger(contaId) ? await contaDoUsuario({ lojaId, userId }, contaId) : null;
    if (!conta) return NextResponse.json({ error: 'Conta de corretora não encontrada' }, { status: 404 });

    const pedido: PedidoOrdem = {
      ativo: String(body.ativo ?? ''),
      bolsa: body.bolsa === 'F' ? 'F' : 'B',
      lado: body.lado === 'venda' ? 'venda' : 'compra',
      tipo: body.tipo === 'limite' ? 'limite' : body.tipo === 'stop_limite' ? 'stop_limite' : 'mercado',
      quantidade: parseInt(String(body.quantidade ?? ''), 10),
      preco: body.preco !== undefined && body.preco !== null && body.preco !== '' ? parseFloat(String(body.preco).replace(',', '.')) : null,
      precoStop: body.precoStop !== undefined && body.precoStop !== null && body.precoStop !== '' ? parseFloat(String(body.precoStop).replace(',', '.')) : null,
      reduzRisco: body.reduzRisco === true,
    };
    const ref = { contaCorretoraId: conta.id, lojaId, usuarioId: userId };
    try {
      const r = await enviarOrdem(ref, pedido, origemDaRequisicao(request.headers));
      return NextResponse.json(r, { status: r.resultado.aceita ? 201 : 200 });
    } catch (err) {
      const te = respostaTradingErro(err);
      if (te) return NextResponse.json(te.body, { status: te.status });
      throw err;
    }
  } catch (error) {
    return respostaErro(error, 'enviar ordem');
  }
}
