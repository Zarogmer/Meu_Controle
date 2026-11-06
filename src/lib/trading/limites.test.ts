import { describe, expect, it } from 'vitest';
import { normalizarLimites, usoDoLimiteDiario, validarOrdem, type ConfigTrading, type ContextoRisco, type PedidoOrdem } from './limites';

const config: ConfigTrading = { tradingHabilitado: true, modo: 'simulacao', quantidadeMaxima: 5, perdaDiariaMaxima: 50000, modoRealAceitoEm: null };
const ctx: ContextoRisco = { resultadoHoje: 0, modoConector: 'simulacao', conectorPronto: true };
const pedido: PedidoOrdem = { ativo: 'WINZ26', bolsa: 'F', lado: 'compra', tipo: 'mercado', quantidade: 1 };

describe('validarOrdem', () => {
  it('aceita ordem a mercado dentro dos limites', () => {
    expect(validarOrdem(config, pedido, ctx)).toEqual({ ok: true, motivo: null, codigo: null });
  });

  it('bloqueia sem flag, sem conector pronto e com modo incompatível', () => {
    expect(validarOrdem({ ...config, tradingHabilitado: false }, pedido, ctx).codigo).toBe('flag');
    expect(validarOrdem(config, pedido, { ...ctx, conectorPronto: false }).codigo).toBe('conector');
    expect(validarOrdem(config, pedido, { ...ctx, modoConector: 'dll' }).codigo).toBe('modo_mismatch');
    expect(validarOrdem({ ...config, modo: 'real', modoRealAceitoEm: new Date() }, pedido, ctx).codigo).toBe('modo_mismatch');
    expect(validarOrdem({ ...config, modo: 'real' }, pedido, { ...ctx, modoConector: 'dll' }).codigo).toBe('modo_real');
    expect(validarOrdem({ ...config, modo: 'real', modoRealAceitoEm: new Date() }, pedido, { ...ctx, modoConector: 'dll' }).ok).toBe(true);
  });

  it('valida ativo, agregador, bolsa, lado e quantidade', () => {
    expect(validarOrdem(config, { ...pedido, ativo: 'WINFUT' }, ctx).codigo).toBe('ativo');
    expect(validarOrdem(config, { ...pedido, ativo: 'x' }, ctx).codigo).toBe('ativo');
    expect(validarOrdem(config, { ...pedido, bolsa: 'X' as 'F' }, ctx).codigo).toBe('bolsa');
    expect(validarOrdem(config, { ...pedido, quantidade: 0 }, ctx).codigo).toBe('quantidade');
    expect(validarOrdem(config, { ...pedido, quantidade: 1.5 }, ctx).codigo).toBe('quantidade');
    expect(validarOrdem(config, { ...pedido, quantidade: 6 }, ctx).codigo).toBe('quantidade_maxima');
  });

  it('exige preços coerentes em limite e stop', () => {
    expect(validarOrdem(config, { ...pedido, tipo: 'limite' }, ctx).codigo).toBe('preco');
    expect(validarOrdem(config, { ...pedido, tipo: 'limite', preco: 141000 }, ctx).ok).toBe(true);
    expect(validarOrdem(config, { ...pedido, tipo: 'stop_limite', preco: 141000 }, ctx).codigo).toBe('preco_stop');
    // stop de venda: preço <= disparo
    expect(validarOrdem(config, { ...pedido, lado: 'venda', tipo: 'stop_limite', preco: 140900, precoStop: 141000 }, ctx).ok).toBe(true);
    expect(validarOrdem(config, { ...pedido, lado: 'venda', tipo: 'stop_limite', preco: 141100, precoStop: 141000 }, ctx).codigo).toBe('stop_invertido');
    // stop de compra: preço >= disparo
    expect(validarOrdem(config, { ...pedido, lado: 'compra', tipo: 'stop_limite', preco: 141100, precoStop: 141000 }, ctx).ok).toBe(true);
    expect(validarOrdem(config, { ...pedido, lado: 'compra', tipo: 'stop_limite', preco: 140900, precoStop: 141000 }, ctx).codigo).toBe('stop_invertido');
  });

  it('perda diária bloqueia ordens novas, mas deixa reduzir risco', () => {
    const noLimite = { ...ctx, resultadoHoje: -50000 };
    expect(validarOrdem(config, pedido, noLimite).codigo).toBe('perda_diaria');
    expect(validarOrdem(config, { ...pedido, reduzRisco: true }, noLimite).ok).toBe(true);
    expect(validarOrdem(config, pedido, { ...ctx, resultadoHoje: -49999 }).ok).toBe(true);
  });
});

describe('normalizarLimites', () => {
  it('aplica tetos e converte reais em centavos', () => {
    expect(normalizarLimites({ quantidadeMaxima: '10', perdaDiariaMaxima: '250.50' }, { quantidadeMaxima: 1, perdaDiariaMaxima: 10000 }))
      .toEqual({ quantidadeMaxima: 10, perdaDiariaMaxima: 25050 });
    expect(normalizarLimites({}, { quantidadeMaxima: 3, perdaDiariaMaxima: 500 })).toEqual({ quantidadeMaxima: 3, perdaDiariaMaxima: 500 });
    expect('error' in normalizarLimites({ quantidadeMaxima: 0 }, { quantidadeMaxima: 1, perdaDiariaMaxima: 10000 })).toBe(true);
    expect('error' in normalizarLimites({ quantidadeMaxima: 5000 }, { quantidadeMaxima: 1, perdaDiariaMaxima: 10000 })).toBe(true);
    expect('error' in normalizarLimites({ perdaDiariaMaxima: '0.5' }, { quantidadeMaxima: 1, perdaDiariaMaxima: 10000 })).toBe(true);
  });
});

describe('usoDoLimiteDiario', () => {
  it('fração consumida', () => {
    expect(usoDoLimiteDiario(0, 10000)).toBe(0);
    expect(usoDoLimiteDiario(500, 10000)).toBe(0);
    expect(usoDoLimiteDiario(-2500, 10000)).toBe(0.25);
    expect(usoDoLimiteDiario(-20000, 10000)).toBe(1);
  });
});
