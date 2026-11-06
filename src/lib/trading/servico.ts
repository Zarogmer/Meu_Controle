import { randomUUID } from 'crypto';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db, tradingConfig, auditoriaOrdens, operacoes } from '@/lib/db';
import { integracaoDaConta, providerDaIntegracao, type BrokerProvider, type ContaRef, type OrdemEnvio, type ResultadoOrdem } from '@/lib/brokers';
import { processarCarteira } from '@/lib/investimentos/calculos';
import { rowParaOperacao } from '@/lib/investimentos/servidor';
import { hojeISO } from '@/lib/contas';
import { validarOrdem, type ConfigTrading, type PedidoOrdem, type Validacao } from './limites';

/**
 * Orquestração do envio de ordens: carrega a configuração, valida os
 * limites, grava a auditoria ANTES e DEPOIS de falar com o conector e
 * nunca deixa uma ordem sair sem registro.
 */

export type TradingConfigRow = typeof tradingConfig.$inferSelect;

export interface Origem {
  ip: string | null;
  userAgent: string | null;
}

export async function carregarConfig(lojaId: number, usuarioId: number): Promise<TradingConfigRow> {
  const [row] = await db
    .select()
    .from(tradingConfig)
    .where(and(eq(tradingConfig.lojaId, lojaId), eq(tradingConfig.usuarioId, usuarioId)))
    .limit(1);
  if (row) return row;
  const [nova] = await db.insert(tradingConfig).values({ lojaId, usuarioId }).onConflictDoNothing().returning();
  if (nova) return nova;
  const [again] = await db.select().from(tradingConfig).where(and(eq(tradingConfig.lojaId, lojaId), eq(tradingConfig.usuarioId, usuarioId))).limit(1);
  return again;
}

export function paraConfigTrading(row: TradingConfigRow): ConfigTrading {
  return {
    tradingHabilitado: row.tradingHabilitado,
    modo: row.modo,
    quantidadeMaxima: row.quantidadeMaxima,
    perdaDiariaMaxima: row.perdaDiariaMaxima,
    modoRealAceitoEm: row.modoRealAceitoEm,
  };
}

/** Resultado líquido realizado hoje (centavos) na conta. */
export async function resultadoDeHoje(conta: ContaRef): Promise<number> {
  const hoje = hojeISO();
  const rows = await db
    .select()
    .from(operacoes)
    .where(and(eq(operacoes.lojaId, conta.lojaId), eq(operacoes.usuarioId, conta.usuarioId), eq(operacoes.contaCorretoraId, conta.contaCorretoraId)));
  const carteira = processarCarteira(rows.map(rowParaOperacao));
  return carteira.operacoes.filter((p) => p.operacao.dataOperacao === hoje).reduce((s, p) => s + p.resultadoLiquido, 0);
}

export interface RegistroAuditoria {
  conta: { lojaId: number; usuarioId: number; contaCorretoraId: number | null };
  ordemRef: string;
  evento: string;
  modo: 'simulacao' | 'real';
  ativo?: string | null;
  bolsa?: string | null;
  lado?: string | null;
  tipo?: string | null;
  quantidade?: number | null;
  preco?: number | null;
  precoStop?: number | null;
  localOrderId?: string | null;
  clOrderId?: string | null;
  mensagem?: string | null;
  detalhes?: unknown;
  origem?: Origem;
}

export async function registrarAuditoria(r: RegistroAuditoria): Promise<void> {
  await db.insert(auditoriaOrdens).values({
    lojaId: r.conta.lojaId,
    usuarioId: r.conta.usuarioId,
    contaCorretoraId: r.conta.contaCorretoraId || null,
    ordemRef: r.ordemRef,
    evento: r.evento,
    modo: r.modo,
    ativo: r.ativo ?? null,
    bolsa: r.bolsa ?? null,
    lado: r.lado ?? null,
    tipo: r.tipo ?? null,
    quantidade: r.quantidade ?? null,
    preco: r.preco !== undefined && r.preco !== null ? String(r.preco) : null,
    precoStop: r.precoStop !== undefined && r.precoStop !== null ? String(r.precoStop) : null,
    localOrderId: r.localOrderId ?? null,
    clOrderId: r.clOrderId ?? null,
    mensagem: r.mensagem ?? null,
    detalhes: r.detalhes === undefined ? null : JSON.stringify(r.detalhes).slice(0, 4000),
    ipOrigem: r.origem?.ip ?? null,
    userAgent: r.origem?.userAgent?.slice(0, 300) ?? null,
  });
}

export class TradingError extends Error {
  constructor(message: string, public readonly codigo: string, public readonly status = 400) {
    super(message);
    this.name = 'TradingError';
  }
}

/** Provider com roteamento, ou erro claro. */
async function providerComRoteamento(conta: ContaRef): Promise<{ provider: BrokerProvider; modoConector: 'dll' | 'simulacao'; pronto: boolean }> {
  const integracao = await integracaoDaConta(conta);
  if (!integracao) throw new TradingError('Esta conta não tem conector configurado (Investimentos → Conexões)', 'sem_conector');
  const provider = providerDaIntegracao(integracao);
  if (!provider.sendOrder) throw new TradingError('O provedor desta conta não roteia ordens', 'sem_roteamento');
  const status = await provider.status(conta);
  const modoConector = status.modo === 'simulacao' ? 'simulacao' : 'dll';
  return { provider, modoConector, pronto: status.online && status.pronto };
}

export async function enviarOrdem(conta: ContaRef, pedido: PedidoOrdem, origem: Origem): Promise<{ ordemRef: string; resultado: ResultadoOrdem; validacao: Validacao }> {
  const cfgRow = await carregarConfig(conta.lojaId, conta.usuarioId);
  const cfg = paraConfigTrading(cfgRow);
  const ordemRef = randomUUID();
  const base = {
    conta, ordemRef, modo: cfg.modo,
    ativo: pedido.ativo.toUpperCase(), bolsa: pedido.bolsa, lado: pedido.lado, tipo: pedido.tipo,
    quantidade: pedido.quantidade, preco: pedido.tipo === 'mercado' ? null : pedido.preco ?? null,
    precoStop: pedido.tipo === 'stop_limite' ? pedido.precoStop ?? null : null, origem,
  };

  if (!cfg.tradingHabilitado) {
    await registrarAuditoria({ ...base, evento: 'envio_recusado', mensagem: 'Envio de ordens não habilitado' });
    throw new TradingError('Envio de ordens não está habilitado para esta conta', 'flag', 403);
  }

  let ctxProvider: Awaited<ReturnType<typeof providerComRoteamento>>;
  try {
    ctxProvider = await providerComRoteamento(conta);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await registrarAuditoria({ ...base, evento: 'envio_recusado', mensagem: msg });
    throw err instanceof TradingError ? err : new TradingError(msg, 'conector', 502);
  }

  const resultadoHoje = await resultadoDeHoje(conta);
  const validacao = validarOrdem(cfg, pedido, { resultadoHoje, modoConector: ctxProvider.modoConector, conectorPronto: ctxProvider.pronto });
  if (!validacao.ok) {
    await registrarAuditoria({ ...base, evento: 'envio_recusado', mensagem: validacao.motivo, detalhes: { codigo: validacao.codigo, resultadoHoje } });
    throw new TradingError(validacao.motivo ?? 'Ordem recusada', validacao.codigo ?? 'validacao');
  }

  // Registro ANTES de enviar: se o processo cair no meio, fica o rastro.
  await registrarAuditoria({ ...base, evento: 'envio', mensagem: `Enviando ao conector (${ctxProvider.modoConector})`, detalhes: { resultadoHoje } });

  const ordem: OrdemEnvio = {
    ativo: base.ativo, bolsa: pedido.bolsa, lado: pedido.lado, tipo: pedido.tipo, quantidade: pedido.quantidade,
    preco: base.preco, precoStop: base.precoStop, referencia: ordemRef,
  };
  let resultado: ResultadoOrdem;
  try {
    resultado = await ctxProvider.provider.sendOrder!(conta, ordem);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await registrarAuditoria({ ...base, evento: 'erro', mensagem: msg });
    throw new TradingError(`Falha ao enviar ao conector: ${msg}`, 'conector', 502);
  }
  await registrarAuditoria({
    ...base, evento: resultado.aceita ? 'enviada' : 'rejeitada',
    localOrderId: resultado.localOrderId, clOrderId: resultado.clOrderId ?? null, mensagem: resultado.mensagem, detalhes: resultado,
  });
  return { ordemRef, resultado, validacao };
}

export async function cancelarOrdem(conta: ContaRef, ordemId: string, origem: Origem): Promise<ResultadoOrdem> {
  const cfg = await carregarConfig(conta.lojaId, conta.usuarioId);
  const ordemRef = randomUUID();
  if (!cfg.tradingHabilitado) throw new TradingError('Envio de ordens não está habilitado para esta conta', 'flag', 403);
  const { provider } = await providerComRoteamento(conta);
  await registrarAuditoria({ conta, ordemRef, evento: 'cancelamento', modo: cfg.modo, localOrderId: ordemId, mensagem: 'Cancelamento solicitado', origem });
  try {
    const r = await provider.cancelOrder!(conta, ordemId);
    await registrarAuditoria({ conta, ordemRef, evento: 'resposta_conector', modo: cfg.modo, localOrderId: ordemId, mensagem: r.mensagem, detalhes: r, origem });
    return r;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await registrarAuditoria({ conta, ordemRef, evento: 'erro', modo: cfg.modo, localOrderId: ordemId, mensagem: msg, origem });
    throw new TradingError(`Falha ao cancelar: ${msg}`, 'conector', 502);
  }
}

export async function cancelarTodas(conta: ContaRef, origem: Origem): Promise<ResultadoOrdem> {
  const cfg = await carregarConfig(conta.lojaId, conta.usuarioId);
  const ordemRef = randomUUID();
  if (!cfg.tradingHabilitado) throw new TradingError('Envio de ordens não está habilitado para esta conta', 'flag', 403);
  const { provider } = await providerComRoteamento(conta);
  await registrarAuditoria({ conta, ordemRef, evento: 'cancelar_todas', modo: cfg.modo, mensagem: 'Kill switch: cancelar todas as ordens', origem });
  try {
    const r = await provider.cancelAllOrders!(conta);
    await registrarAuditoria({ conta, ordemRef, evento: 'resposta_conector', modo: cfg.modo, mensagem: r.mensagem, detalhes: r, origem });
    return r;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await registrarAuditoria({ conta, ordemRef, evento: 'erro', modo: cfg.modo, mensagem: msg, origem });
    throw new TradingError(`Falha ao cancelar todas: ${msg}`, 'conector', 502);
  }
}

export async function zerarPosicao(conta: ContaRef, ativo: string, bolsa: 'F' | 'B', tipoPosicao: 1 | 2, origem: Origem): Promise<ResultadoOrdem> {
  const cfg = await carregarConfig(conta.lojaId, conta.usuarioId);
  const ordemRef = randomUUID();
  const a = ativo.toUpperCase();
  if (!cfg.tradingHabilitado) throw new TradingError('Envio de ordens não está habilitado para esta conta', 'flag', 403);
  const ctx = await providerComRoteamento(conta);
  // Zerar sempre reduz risco: passa mesmo com a perda diária batida, mas respeita modo e conector.
  const validacao = validarOrdem(paraConfigTrading(cfg), { ativo: a, bolsa, lado: 'venda', tipo: 'mercado', quantidade: 1, reduzRisco: true },
    { resultadoHoje: 0, modoConector: ctx.modoConector, conectorPronto: ctx.pronto });
  if (!validacao.ok) {
    await registrarAuditoria({ conta, ordemRef, evento: 'envio_recusado', modo: cfg.modo, ativo: a, bolsa, mensagem: validacao.motivo, origem });
    throw new TradingError(validacao.motivo ?? 'Zeragem recusada', validacao.codigo ?? 'validacao');
  }
  await registrarAuditoria({ conta, ordemRef, evento: 'zerar_posicao', modo: cfg.modo, ativo: a, bolsa, mensagem: `Zerar posição a mercado (tipo ${tipoPosicao})`, origem });
  try {
    const r = await ctx.provider.zeroPosition!(conta, { ativo: a, bolsa, tipoPosicao, preco: null });
    await registrarAuditoria({ conta, ordemRef, evento: r.aceita ? 'enviada' : 'rejeitada', modo: cfg.modo, ativo: a, bolsa, localOrderId: r.localOrderId, mensagem: r.mensagem, detalhes: r, origem });
    return r;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await registrarAuditoria({ conta, ordemRef, evento: 'erro', modo: cfg.modo, ativo: a, bolsa, mensagem: msg, origem });
    throw new TradingError(`Falha ao zerar: ${msg}`, 'conector', 502);
  }
}

export async function listarAuditoria(lojaId: number, usuarioId: number, limite = 100, desde?: string) {
  const conds = [eq(auditoriaOrdens.lojaId, lojaId), eq(auditoriaOrdens.usuarioId, usuarioId)];
  if (desde) conds.push(gte(auditoriaOrdens.criadoEm, new Date(desde)));
  return db.select().from(auditoriaOrdens).where(and(...conds)).orderBy(desc(auditoriaOrdens.criadoEm), desc(auditoriaOrdens.id)).limit(limite);
}

export function origemDaRequisicao(headers: Headers): Origem {
  const fwd = headers.get('x-forwarded-for');
  return { ip: fwd ? fwd.split(',')[0].trim() : headers.get('x-real-ip'), userAgent: headers.get('user-agent') };
}

export function respostaTradingErro(err: unknown) {
  if (err instanceof TradingError) return { body: { error: err.message, codigo: err.codigo }, status: err.status };
  return null;
}
