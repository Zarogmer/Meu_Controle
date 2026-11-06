import { describe, expect, it } from 'vitest';
import { assinarRequisicao, decryptSecret, encryptSecret, mascararSegredo, verificarAssinatura } from './crypto';

describe('segredos AES-256-GCM', () => {
  it('cifra e decifra, com IV diferente a cada vez', () => {
    const a = encryptSecret('token-secreto');
    const b = encryptSecret('token-secreto');
    expect(a).not.toBe(b);
    expect(a.startsWith('v1:')).toBe(true);
    expect(decryptSecret(a)).toBe('token-secreto');
    expect(decryptSecret(b)).toBe('token-secreto');
  });

  it('rejeita conteúdo adulterado', () => {
    const c = encryptSecret('abc');
    const partes = c.split(':');
    partes[3] = Buffer.from('xx' + Buffer.from(partes[3], 'base64').toString('binary').slice(2), 'binary').toString('base64');
    expect(() => decryptSecret(partes.join(':'))).toThrow();
    expect(() => decryptSecret('lixo')).toThrow();
  });

  it('mascara', () => {
    expect(mascararSegredo('abcdef1234')).toBe('••••••1234');
    expect(mascararSegredo('ab')).toBe('••••');
  });
});

describe('assinatura HMAC (compatível com o conector)', () => {
  // Vetor fixo — o mesmo caso está em connectors/nelogica/tests/test_auth.py.
  const token = 'tok';
  const ts = 1_700_000_000;

  it('gera a assinatura esperada', () => {
    const sig = assinarRequisicao(token, 'GET', '/trades?since=2026-01-01', '', ts);
    expect(sig).toBe('11fabe36265616c1bcb6dfd9284bab9715ab977e3e1d269de1180399bc47f826');
    // determinística
    expect(assinarRequisicao(token, 'get', '/trades?since=2026-01-01', '', ts)).toBe(sig);
  });

  it('verifica dentro da janela e rejeita fora dela ou com token errado', () => {
    const sig = assinarRequisicao(token, 'POST', '/subscribe', '{"a":1}', ts);
    expect(verificarAssinatura(token, 'POST', '/subscribe', '{"a":1}', ts, sig, ts + 10)).toBe(true);
    expect(verificarAssinatura(token, 'POST', '/subscribe', '{"a":1}', ts, sig, ts + 301)).toBe(false);
    expect(verificarAssinatura('outro', 'POST', '/subscribe', '{"a":1}', ts, sig, ts)).toBe(false);
    expect(verificarAssinatura(token, 'POST', '/subscribe', '{"a":2}', ts, sig, ts)).toBe(false);
    expect(verificarAssinatura(token, 'POST', '/subscribe', '{"a":1}', ts, 'zz', ts)).toBe(false);
  });
});
