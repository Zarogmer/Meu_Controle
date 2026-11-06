import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { respostaErro } from '@/lib/investimentos/http';
import { integracaoDoUsuario } from '@/lib/investimentos/integracoes';
import { NelogicaProvider } from '@/lib/brokers/nelogica';
import { decryptSecret } from '@/lib/crypto';
import { carregarOperacoes } from '@/lib/investimentos/servidor';
import { processarCarteira } from '@/lib/investimentos/calculos';
import { bolsaSugerida } from '@/lib/brokers/types';

/**
 * GET: URL assinada do WebSocket do conector (válida por 5 min) para o
 * navegador receber cotações ao vivo. O token nunca sai do servidor —
 * só a assinatura HMAC. Também pede ao conector que assine os ativos
 * das posições abertas.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { lojaId, userId } = await requireInvestidor();
    const { id } = await params;
    const row = await integracaoDoUsuario(parseInt(id, 10), lojaId, userId);
    if (!row) return NextResponse.json({ error: 'Conexão não encontrada' }, { status: 404 });

    const provider = new NelogicaProvider({ urlConector: row.urlConector, token: decryptSecret(row.tokenCriptografado) });
    const ops = await carregarOperacoes({ lojaId, userId }, { contaCorretoraId: row.contaCorretoraId });
    const ativos = processarCarteira(ops).posicoes.map((p) => ({ ativo: p.ativo, bolsa: bolsaSugerida(p.ativo) }));
    let assinados = false;
    try {
      if (ativos.length > 0) await provider.subscribe(ativos);
      assinados = true;
    } catch {
      // o WS ainda pode ser aberto; o cliente pode assinar por mensagem
    }
    const ticket = provider.ticketWebSocket();
    return NextResponse.json({ ...ticket, ativos, assinados });
  } catch (error) {
    return respostaErro(error, 'ticket do websocket');
  }
}
