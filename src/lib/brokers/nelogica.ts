import { assinarRequisicao } from '@/lib/crypto';
import type {
  BrokerProvider, ContaRef, Cotacao, FiltrosOrdens, Ordem, OperacaoProvider, PosicaoProvider,
  StatusOrdem, StatusProvider,
} from './types';
import { bolsaSugerida } from './types';

/**
 * Provedor Nelogica: fala com o conector (connectors/nelogica) que roda
 * no Windows do usuário com a ProfitDLL. Toda chamada é assinada com
 * HMAC-SHA256 usando o token da integração (ver src/lib/crypto.ts).
 *
 * Contrato HTTP do conector (JSON):
 *   GET  /health
 *   GET  /positions
 *   GET  /orders?since=&status=
 *   GET  /trades?since=<ISO>          → { trades: [...], next_since }
 *   GET  /quote/{ticker}?exchange=F   → { ticker, exchange, last, bid, ask, updated_at }
 *   POST /subscribe { tickers: [{ticker, exchange}] }
 *   WS   /ws?ts=&sig=                 → cotações e execuções ao vivo
 */

export interface NelogicaConfig {
  urlConector: string;
  token: string;
  timeoutMs?: number;
}

export class ConectorError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ConectorError';
  }
}

const STATUS_MAP: Record<number, StatusOrdem> = {
  0: 'nova', 1: 'parcial', 2: 'executada', 4: 'cancelada', 5: 'substituida', 6: 'pendente_cancel',
  7: 'disparada', 8: 'rejeitada', 9: 'suspensa', 10: 'pendente_nova', 12: 'expirada', 14: 'pendente_alteracao',
  15: 'parcial_cancelada', 16: 'recebida', 18: 'parcial_rejeitada', 200: 'desconhecida', 205: 'cancelada_admin',
};

export function normalizarUrlConector(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  u = u.replace(/\/+$/, '');
  const parsed = new URL(u);
  const permitirHttp = process.env.NELOGICA_ALLOW_HTTP === '1' || process.env.NODE_ENV !== 'production';
  if (parsed.protocol !== 'https:' && !permitirHttp) {
    throw new ConectorError('A URL do conector precisa usar HTTPS');
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
}

export class NelogicaProvider implements BrokerProvider {
  id = 'nelogica' as const;

  constructor(private readonly cfg: NelogicaConfig) {}

  /** Caminho + query assinados; o path assinado é o que o conector vê. */
  private async chamar<T>(metodo: 'GET' | 'POST', pathEQuery: string, body?: unknown): Promise<T> {
    const base = normalizarUrlConector(this.cfg.urlConector);
    const baseUrl = new URL(base);
    const prefixo = baseUrl.pathname === '/' ? '' : baseUrl.pathname;
    const pathAssinado = `${prefixo}${pathEQuery}`;
    const corpo = body === undefined ? '' : JSON.stringify(body);
    const ts = Math.floor(Date.now() / 1000);
    const sig = assinarRequisicao(this.cfg.token, metodo, pathAssinado, corpo, ts);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs ?? 15000);
    try {
      const res = await fetch(`${baseUrl.origin}${pathAssinado}`, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': String(ts),
          'X-Signature': sig,
          Accept: 'application/json',
        },
        body: body === undefined ? undefined : corpo,
        signal: controller.signal,
        cache: 'no-store',
      });
      const texto = await res.text();
      if (!res.ok) {
        let msg = `Conector respondeu ${res.status}`;
        try {
          const j = JSON.parse(texto);
          if (j?.error) msg = `${msg}: ${j.error}`;
        } catch { /* texto cru */ }
        throw new ConectorError(msg, res.status);
      }
      return (texto ? JSON.parse(texto) : {}) as T;
    } catch (err) {
      if (err instanceof ConectorError) throw err;
      const m = err instanceof Error ? err.message : String(err);
      throw new ConectorError(m.includes('abort') ? 'Conector não respondeu a tempo' : `Não foi possível falar com o conector (${m})`);
    } finally {
      clearTimeout(timer);
    }
  }

  async status(): Promise<StatusProvider> {
    const h = await this.chamar<{
      ok: boolean; mode: 'dll' | 'simulation'; ready: boolean; states?: Record<string, unknown>;
      version?: string; dll_version?: string | null; subscriptions?: string[]; account?: unknown; uptime_s?: number;
    }>('GET', '/health');
    return {
      online: !!h.ok,
      modo: h.mode === 'simulation' ? 'simulacao' : 'dll',
      pronto: !!h.ready,
      detalhes: {
        estados: h.states ?? {},
        versaoConector: h.version ?? null,
        versaoDll: h.dll_version ?? null,
        assinaturas: h.subscriptions ?? [],
        conta: h.account ?? null,
        uptimeSegundos: h.uptime_s ?? null,
      },
      verificadoEm: new Date().toISOString(),
    };
  }

  async getPositions(): Promise<PosicaoProvider[]> {
    const r = await this.chamar<{ positions: { ticker: string; exchange: string | null; quantity: number; average_price: number; source?: string }[] }>('GET', '/positions');
    return (r.positions ?? []).map((p) => ({
      ativo: p.ticker.toUpperCase(),
      bolsa: p.exchange ?? bolsaSugerida(p.ticker),
      quantidade: Number(p.quantity),
      precoMedio: Number(p.average_price),
      origem: p.source === 'broker' ? 'corretora' : 'calculado',
    }));
  }

  async getOrders(_conta: ContaRef, filtros: FiltrosOrdens = {}): Promise<Ordem[]> {
    const q = new URLSearchParams();
    if (filtros.desde) q.set('since', filtros.desde);
    if (filtros.ativo) q.set('ticker', filtros.ativo.toUpperCase());
    const r = await this.chamar<{ orders: Record<string, unknown>[] }>('GET', `/orders${q.size ? `?${q}` : ''}`);
    const lista = (r.orders ?? []).map((o) => {
      const statusNum = Number(o.status);
      const status: StatusOrdem = STATUS_MAP[statusNum] ?? (typeof o.status === 'string' ? (o.status as StatusOrdem) : 'desconhecida');
      const tipoNum = Number(o.order_type);
      return {
        id: String(o.cl_order_id ?? o.local_order_id ?? ''),
        localOrderId: o.local_order_id !== undefined && o.local_order_id !== null ? String(o.local_order_id) : null,
        ativo: String(o.ticker ?? '').toUpperCase(),
        bolsa: (o.exchange as string | null) ?? null,
        lado: Number(o.side) === 2 || o.side === 'venda' || o.side === 'sell' ? 'venda' : 'compra',
        tipo: tipoNum === 1 ? 'mercado' : tipoNum === 2 ? 'limite' : tipoNum === 4 ? 'stop_limite' : 'desconhecido',
        quantidade: Number(o.quantity ?? 0),
        quantidadeExecutada: Number(o.traded_quantity ?? 0),
        preco: o.price !== undefined && o.price !== null && Number(o.price) >= 0 ? Number(o.price) : null,
        precoStop: o.stop_price !== undefined && o.stop_price !== null && Number(o.stop_price) >= 0 ? Number(o.stop_price) : null,
        precoMedio: o.average_price !== undefined && o.average_price !== null ? Number(o.average_price) : null,
        status,
        atualizadoEm: String(o.updated_at ?? new Date().toISOString()),
      } satisfies Ordem;
    });
    return filtros.status?.length ? lista.filter((o) => filtros.status!.includes(o.status)) : lista;
  }

  async getTrades(_conta: ContaRef, desde: string | null): Promise<{ trades: OperacaoProvider[]; proximoCursor: string | null }> {
    const q = new URLSearchParams();
    if (desde) q.set('since', desde);
    const r = await this.chamar<{
      trades: { id: string; ticker: string; exchange?: string | null; side: string | number; quantity: number; price: number; executed_at: string; order_cl_id?: string | null; order_local_id?: string | number | null; fees?: number | null }[];
      next_since?: string | null;
    }>('GET', `/trades${q.size ? `?${q}` : ''}`);
    const trades = (r.trades ?? []).map((t) => ({
      idExterno: String(t.id),
      ativo: String(t.ticker).toUpperCase(),
      bolsa: t.exchange ?? null,
      lado: (Number(t.side) === 2 || t.side === 'venda' || t.side === 'sell' ? 'venda' : 'compra') as 'compra' | 'venda',
      quantidade: Math.abs(Number(t.quantity)),
      preco: Number(t.price),
      executadoEm: String(t.executed_at),
      ordemId: t.order_cl_id ? String(t.order_cl_id) : t.order_local_id !== undefined && t.order_local_id !== null ? String(t.order_local_id) : null,
      taxas: t.fees !== undefined && t.fees !== null ? Math.round(Number(t.fees) * 100) : undefined,
    }));
    return { trades, proximoCursor: r.next_since ?? desde };
  }

  async getQuote(_conta: ContaRef, ativo: string, bolsa?: string): Promise<Cotacao> {
    const a = ativo.trim().toUpperCase();
    const b = bolsa ?? bolsaSugerida(a);
    const r = await this.chamar<{ ticker: string; exchange: string; last: number | null; bid: number | null; ask: number | null; updated_at: string | null }>(
      'GET', `/quote/${encodeURIComponent(a)}?exchange=${encodeURIComponent(b)}`,
    );
    return { ativo: a, bolsa: r.exchange ?? b, ultimo: r.last ?? null, compra: r.bid ?? null, venda: r.ask ?? null, atualizadoEm: r.updated_at ?? null };
  }

  async subscribe(tickers: { ativo: string; bolsa?: string }[]): Promise<void> {
    await this.chamar('POST', '/subscribe', {
      tickers: tickers.map((t) => ({ ticker: t.ativo.toUpperCase(), exchange: t.bolsa ?? bolsaSugerida(t.ativo) })),
    });
  }

  /** URL assinada do WebSocket de cotações (válida pela janela do HMAC). */
  ticketWebSocket(): { url: string; expiraEm: string } {
    const base = normalizarUrlConector(this.cfg.urlConector);
    const u = new URL(base);
    const prefixo = u.pathname === '/' ? '' : u.pathname;
    const ts = Math.floor(Date.now() / 1000);
    const path = `${prefixo}/ws`;
    const sig = assinarRequisicao(this.cfg.token, 'GET', path, '', ts);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return {
      url: `${proto}//${u.host}${path}?ts=${ts}&sig=${sig}`,
      expiraEm: new Date((ts + 300) * 1000).toISOString(),
    };
  }

  // sendOrder / cancelOrder: Fase 4 (atrás de feature flag). Não implementados aqui de propósito.
}
