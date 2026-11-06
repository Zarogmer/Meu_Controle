"""Autenticação das chamadas do Meu Controle.

Esquema (idêntico a src/lib/crypto.ts no app):
    mensagem   = "<timestamp>.<MÉTODO>.<path+query>.<sha256(body) hex>"
    assinatura = hex(HMAC-SHA256(token, mensagem))
Cabeçalhos: X-Timestamp, X-Signature. Janela de replay: 300 s.
O token nunca trafega. Para o WebSocket, ts e sig vão na query string
(GET, path "/ws", corpo vazio).
"""
from __future__ import annotations

import hashlib
import hmac
import time

JANELA_SEGUNDOS = 300


def sha256_hex(corpo: bytes) -> str:
    return hashlib.sha256(corpo).hexdigest()


def assinar(token: str, metodo: str, caminho: str, corpo: bytes, timestamp: int) -> str:
    mensagem = f"{timestamp}.{metodo.upper()}.{caminho}.{sha256_hex(corpo)}"
    return hmac.new(token.encode("utf-8"), mensagem.encode("utf-8"), hashlib.sha256).hexdigest()


def verificar(
    token: str,
    metodo: str,
    caminho: str,
    corpo: bytes,
    timestamp: str | int | None,
    assinatura: str | None,
    agora: float | None = None,
) -> tuple[bool, str]:
    """Devolve (ok, motivo)."""
    if not timestamp or not assinatura:
        return False, "assinatura ausente"
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False, "timestamp inválido"
    agora = agora if agora is not None else time.time()
    if abs(agora - ts) > JANELA_SEGUNDOS:
        return False, "assinatura expirada"
    esperada = assinar(token, metodo, caminho, corpo, ts)
    if not hmac.compare_digest(esperada, assinatura.lower()):
        return False, "assinatura inválida"
    return True, "ok"
