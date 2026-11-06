import { createCipheriv, createDecipheriv, randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Criptografia de segredos de integração (token do conector, chave de
 * ativação). AES-256-GCM com a chave em INTEGRATIONS_ENC_KEY.
 *
 * Formato armazenado: "v1:<iv base64>:<tag base64>:<cifra base64>".
 * A chave pode ser 32 bytes em hex (64 chars) ou base64 (44 chars); em
 * desenvolvimento, qualquer string é derivada via SHA-256 (nunca em
 * produção).
 */

function carregarChave(): Buffer {
  const raw = process.env.INTEGRATIONS_ENC_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('INTEGRATIONS_ENC_KEY precisa estar definida em produção');
    }
    return createHash('sha256').update('meu-controle-dev-integrations-key').digest();
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const b64 = Buffer.from(raw, 'base64');
  if (b64.length === 32) return b64;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('INTEGRATIONS_ENC_KEY deve ter 32 bytes (hex de 64 chars ou base64)');
  }
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const key = carregarChave();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  const [v, ivB64, tagB64, encB64] = stored.split(':');
  if (v !== 'v1' || !ivB64 || !tagB64 || !encB64) {
    throw new Error('Segredo em formato inválido');
  }
  const key = carregarChave();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]).toString('utf8');
}

/** Mostra só o fim do segredo, para a tela ("••••••a1b2"). */
export function mascararSegredo(plain: string): string {
  if (plain.length <= 4) return '••••';
  return `••••••${plain.slice(-4)}`;
}

export function gerarToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

// ── Assinatura HMAC das chamadas ao conector ────────────────────
// Mesmo esquema do conector (connectors/nelogica/connector/auth.py):
//   mensagem  = "<timestamp>.<MÉTODO>.<path>.<sha256(body) hex>"
//   assinatura = hex(HMAC-SHA256(token, mensagem))
// O token nunca trafega; só a assinatura. Janela de replay: 300 s.

export const JANELA_ASSINATURA_SEGUNDOS = 300;

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function assinarRequisicao(token: string, metodo: string, path: string, body: string | Buffer, timestamp: number): string {
  const mensagem = `${timestamp}.${metodo.toUpperCase()}.${path}.${sha256Hex(body)}`;
  return createHmac('sha256', token).update(mensagem).digest('hex');
}

export function verificarAssinatura(
  token: string,
  metodo: string,
  path: string,
  body: string | Buffer,
  timestamp: number,
  assinatura: string,
  agora: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!Number.isFinite(timestamp) || Math.abs(agora - timestamp) > JANELA_ASSINATURA_SEGUNDOS) return false;
  const esperada = assinarRequisicao(token, metodo, path, body, timestamp);
  const a = Buffer.from(esperada, 'hex');
  const b = Buffer.from(assinatura || '', 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
