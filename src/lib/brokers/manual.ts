import { carregarOperacoes, carregarCotacoes } from '@/lib/investimentos/servidor';
import { processarCarteira } from '@/lib/investimentos/calculos';
import type { BrokerProvider, ContaRef, Cotacao, Ordem, OperacaoProvider, PosicaoProvider, StatusProvider } from './types';
import { bolsaSugerida } from './types';

/**
 * Provedor "manual": tudo que o sistema já sabe pelas operações
 * lançadas/importadas (Fase 2). Não há ordens nem execuções novas —
 * serve de base e de fallback quando não há integração.
 */
export class ManualProvider implements BrokerProvider {
  id = 'manual' as const;

  async status(): Promise<StatusProvider> {
    return { online: true, modo: 'manual', pronto: true, detalhes: {}, verificadoEm: new Date().toISOString() };
  }

  async getPositions(conta: ContaRef): Promise<PosicaoProvider[]> {
    const ops = await carregarOperacoes({ lojaId: conta.lojaId, userId: conta.usuarioId }, { contaCorretoraId: conta.contaCorretoraId });
    const carteira = processarCarteira(ops);
    return carteira.posicoes.map((p) => ({
      ativo: p.ativo,
      bolsa: bolsaSugerida(p.ativo),
      quantidade: p.quantidade,
      precoMedio: p.precoMedio,
      origem: 'calculado',
    }));
  }

  async getOrders(): Promise<Ordem[]> {
    return [];
  }

  async getTrades(_conta: ContaRef, desde: string | null): Promise<{ trades: OperacaoProvider[]; proximoCursor: string | null }> {
    return { trades: [], proximoCursor: desde };
  }

  async getQuote(_conta: ContaRef, ativo: string, bolsa?: string): Promise<Cotacao> {
    const a = ativo.trim().toUpperCase();
    const cache = await carregarCotacoes([a]);
    const c = cache[a];
    return {
      ativo: a,
      bolsa: bolsa ?? bolsaSugerida(a),
      ultimo: c?.preco ?? null,
      compra: null,
      venda: null,
      atualizadoEm: c?.atualizadoEm ?? null,
    };
  }
}
