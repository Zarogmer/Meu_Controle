import { NextRequest, NextResponse } from 'next/server';
import { requireInvestidor } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo-data';
import { respostaErro } from '@/lib/investimentos/http';
import { listarAuditoria } from '@/lib/trading/servico';

/** GET ?limite=&desde= — log imutável de ordens do usuário (só leitura; não existe PUT/DELETE). */
export async function GET(request: NextRequest) {
  if (isDemoMode) return NextResponse.json({ eventos: [] });
  try {
    const { lojaId, userId } = await requireInvestidor();
    const limite = Math.min(500, Math.max(1, parseInt(request.nextUrl.searchParams.get('limite') || '100', 10) || 100));
    const desde = request.nextUrl.searchParams.get('desde') || undefined;
    const eventos = await listarAuditoria(lojaId, userId, limite, desde);
    return NextResponse.json({ eventos: eventos.map((e) => ({ ...e, preco: e.preco !== null ? Number(e.preco) : null, precoStop: e.precoStop !== null ? Number(e.precoStop) : null })) });
  } catch (error) {
    return respostaErro(error, 'auditoria de ordens');
  }
}
