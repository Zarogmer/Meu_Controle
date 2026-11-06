import { and, eq, inArray } from 'drizzle-orm';
import { db, integracoesCorretora, operacoes, cotacoesCache } from '@/lib/db';
import { providerDaIntegracao, type IntegracaoRow, type OperacaoProvider } from '@/lib/brokers';
import { ConectorError } from '@/lib/brokers/nelogica';
import { classificarModalidade, mercadoSugerido, multiplicadorSugerido, processarCarteira, normalizarAtivo } from './calculos';
import { carregarOperacoes } from './servidor';

/**
 * Sincronização de uma integração: puxa as execuções desde o último
 * cursor e grava em `operacoes` (origem 'nelogica', idExterno = id da
 * execução), depois atualiza as cotações das posições abertas.
 *
 * Chamada pelo botão "Sincronizar agora" e pelo cron do Railway
 * (POST /api/cron/sincronizar-corretoras).
 */

export interface ResultadoSync {
  integracaoId: number;
  contaCorretoraId: number;
  ok: boolean;
  novas: number;
  duplicadas: number;
  cotacoesAtualizadas: number;
  cursor: string | null;
  erro: string | null;
  pronto: boolean;
}

const MERCADO_POR_BOLSA: Record<string, 'futuros' | 'acoes'> = { F: 'futuros', B: 'acoes' };

/** Converte ISO com fuso em data/horário locais de pregão (America/Sao_Paulo). */
export function dataHorarioPregao(iso: string): { data: string; horario: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const hoje = new Date();
    return { data: hoje.toISOString().slice(0, 10), horario: '00:00:00' };
  }
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? '00';
  const hora = get('hour') === '24' ? '00' : get('hour');
  return { data: `${get('year')}-${get('month')}-${get('day')}`, horario: `${hora}:${get('minute')}:${get('second')}` };
}

export async function sincronizarIntegracao(integracao: IntegracaoRow): Promise<ResultadoSync> {
  const conta = { contaCorretoraId: integracao.contaCorretoraId, lojaId: integracao.lojaId, usuarioId: integracao.usuarioId };
  const provider = providerDaIntegracao(integracao);
  const base: ResultadoSync = {
    integracaoId: integracao.id, contaCorretoraId: integracao.contaCorretoraId,
    ok: false, novas: 0, duplicadas: 0, cotacoesAtualizadas: 0, cursor: integracao.cursorTrades, erro: null, pronto: false,
  };

  try {
    const status = await provider.status(conta);
    base.pronto = status.pronto;

    // 1) Execuções novas
    const { trades, proximoCursor } = await provider.getTrades(conta, integracao.cursorTrades);
    const { novas, duplicadas } = await gravarExecucoes(integracao, trades);
    base.novas = novas;
    base.duplicadas = duplicadas;
    base.cursor = proximoCursor ?? integracao.cursorTrades;

    // 2) Cotações das posições abertas
    base.cotacoesAtualizadas = await atualizarCotacoes(integracao, provider);

    await db
      .update(integracoesCorretora)
      .set({
        status: 'conectado',
        ultimoSyncEm: new Date(),
        ultimoErro: null,
        cursorTrades: base.cursor,
        ultimoHealth: JSON.stringify({ ...status, sincronizadoEm: new Date().toISOString() }),
        atualizadoEm: new Date(),
      })
      .where(eq(integracoesCorretora.id, integracao.id));
    base.ok = true;
    return base;
  } catch (err) {
    const mensagem = err instanceof ConectorError ? err.message : err instanceof Error ? err.message : String(err);
    await db
      .update(integracoesCorretora)
      .set({ status: 'erro', ultimoErro: mensagem.slice(0, 500), atualizadoEm: new Date() })
      .where(eq(integracoesCorretora.id, integracao.id));
    base.erro = mensagem;
    return base;
  }
}

async function gravarExecucoes(integracao: IntegracaoRow, trades: OperacaoProvider[]): Promise<{ novas: number; duplicadas: number }> {
  if (trades.length === 0) return { novas: 0, duplicadas: 0 };

  const ids = Array.from(new Set(trades.map((t) => t.idExterno)));
  const existentes = await db
    .select({ idExterno: operacoes.idExterno })
    .from(operacoes)
    .where(and(eq(operacoes.contaCorretoraId, integracao.contaCorretoraId), inArray(operacoes.idExterno, ids)));
  const vistos = new Set(existentes.map((e) => e.idExterno));

  const candidatas = [];
  let duplicadas = 0;
  for (const t of trades) {
    if (vistos.has(t.idExterno)) { duplicadas += 1; continue; }
    vistos.add(t.idExterno);
    const ativo = normalizarAtivo(t.ativo);
    const mercado = (t.bolsa && MERCADO_POR_BOLSA[t.bolsa]) || mercadoSugerido(ativo);
    const { data, horario } = dataHorarioPregao(t.executadoEm);
    candidatas.push({
      id: `n-${t.idExterno}`, linha: 0, ativo, mercado, lado: t.lado,
      quantidade: Math.abs(Math.round(t.quantidade)), preco: Number(t.preco),
      multiplicador: multiplicadorSugerido(ativo, mercado), taxas: t.taxas ?? 0,
      dataOperacao: data, horario, idExterno: t.idExterno,
      modalidade: undefined as 'daytrade' | 'swing' | undefined,
    });
  }
  if (candidatas.length === 0) return { novas: 0, duplicadas };

  // Day trade x swing: olha também o que já existe nos mesmos dias.
  const datas = Array.from(new Set(candidatas.map((c) => c.dataOperacao)));
  const existentesDias = await db
    .select({ ativo: operacoes.ativo, lado: operacoes.lado, dataOperacao: operacoes.dataOperacao })
    .from(operacoes)
    .where(and(eq(operacoes.contaCorretoraId, integracao.contaCorretoraId), inArray(operacoes.dataOperacao, datas)));
  const contexto = existentesDias.map((e, i) => ({
    id: `e-${i}`, linha: 0, ativo: e.ativo, mercado: 'outros' as const, lado: e.lado, quantidade: 0, preco: 0,
    multiplicador: 1, taxas: 0, dataOperacao: e.dataOperacao, horario: null as string | null, idExterno: null as string | null,
    modalidade: 'swing' as 'daytrade' | 'swing' | undefined,
  }));
  const classificadas = classificarModalidade([...candidatas, ...contexto]).filter((c) => c.id.startsWith('n-'));

  await db.insert(operacoes).values(
    classificadas.map((c) => ({
      lojaId: integracao.lojaId,
      usuarioId: integracao.usuarioId,
      contaCorretoraId: integracao.contaCorretoraId,
      ativo: c.ativo,
      mercado: c.mercado,
      lado: c.lado,
      quantidade: c.quantidade,
      preco: String(c.preco),
      multiplicador: String(c.multiplicador),
      taxas: c.taxas,
      dataOperacao: c.dataOperacao,
      horario: c.horario,
      modalidade: c.modalidade,
      origem: 'nelogica' as const,
      idExterno: c.idExterno,
      hashDedupe: null,
    })),
  ).onConflictDoNothing();

  return { novas: classificadas.length, duplicadas };
}

async function atualizarCotacoes(integracao: IntegracaoRow, provider: ReturnType<typeof providerDaIntegracao>): Promise<number> {
  const ops = await carregarOperacoes({ lojaId: integracao.lojaId, userId: integracao.usuarioId }, { contaCorretoraId: integracao.contaCorretoraId });
  const posicoes = processarCarteira(ops).posicoes;
  let n = 0;
  for (const p of posicoes.slice(0, 50)) {
    try {
      const c = await provider.getQuote({ contaCorretoraId: integracao.contaCorretoraId, lojaId: integracao.lojaId, usuarioId: integracao.usuarioId }, p.ativo);
      if (c.ultimo && c.ultimo > 0) {
        await db
          .insert(cotacoesCache)
          .values({ ativo: p.ativo, preco: String(c.ultimo), atualizadoEm: new Date() })
          .onConflictDoUpdate({ target: cotacoesCache.ativo, set: { preco: String(c.ultimo), atualizadoEm: new Date() } });
        n += 1;
      }
    } catch {
      // cotação é complementar; não derruba a sincronização
    }
  }
  return n;
}

/** Sincroniza todas as integrações ativas (cron). */
export async function sincronizarTodas(): Promise<ResultadoSync[]> {
  const todas = await db.select().from(integracoesCorretora);
  const resultados: ResultadoSync[] = [];
  for (const i of todas) {
    resultados.push(await sincronizarIntegracao(i));
  }
  return resultados;
}
