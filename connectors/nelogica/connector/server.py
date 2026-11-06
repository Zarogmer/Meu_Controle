"""Servidor HTTP/WebSocket do conector (FastAPI).

Rotas (todas exigem assinatura HMAC — ver auth.py):
  GET  /health
  GET  /positions
  GET  /orders?since=&ticker=
  GET  /trades?since=<ISO>
  GET  /quote/{ticker}?exchange=F
  POST /subscribe        {"tickers": [{"ticker": "WINZ26", "exchange": "F"}]}
  POST /unsubscribe      idem
  WS   /ws?ts=&sig=      eventos {"type": "quote"|"fill"|"order"|"state", ...}
  POST /sim/fill         só em PROFIT_SIMULATION=1
"""
from __future__ import annotations

import asyncio
import json
import logging
import time

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import __version__
from .auth import verificar
from .config import Config
from .store import Store, agora_iso

log = logging.getLogger("conector.http")


class TickerRef(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    exchange: str = Field(default="B", min_length=1, max_length=2)


class SubscribeBody(BaseModel):
    tickers: list[TickerRef]


class OrderBody(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    exchange: str = Field(default="B", min_length=1, max_length=2)
    side: int = Field(ge=1, le=2)
    order_type: int = Field(default=1)  # 1 market, 2 limit, 4 stop limit
    quantity: int = Field(ge=1, le=100_000)
    price: float | None = None
    stop_price: float | None = None
    client_ref: str | None = Field(default=None, max_length=64)


class ZeroBody(BaseModel):
    exchange: str = Field(default="B", min_length=1, max_length=2)
    position_type: int = Field(default=1, ge=1, le=2)
    price: float | None = None


class SimFillBody(BaseModel):
    ticker: str
    exchange: str = "F"
    side: int = Field(ge=1, le=2)
    quantity: int = Field(ge=1)
    price: float | None = None


def criar_app(cfg: Config, store: Store, backend) -> FastAPI:
    app = FastAPI(title="Conector Nelogica — Meu Controle", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    iniciado_em = time.time()

    def caminho_assinado(request: Request) -> str:
        # O app assina "<prefixo><path><?query>" — o mesmo que o túnel entrega aqui.
        path = request.url.path
        if cfg.path_prefix and not path.startswith(cfg.path_prefix):
            path = cfg.path_prefix + path
        return f"{path}?{request.url.query}" if request.url.query else path

    @app.middleware("http")
    async def autenticar(request: Request, call_next):
        corpo = await request.body()
        ok, motivo = verificar(cfg.token, request.method, caminho_assinado(request), corpo, request.headers.get("x-timestamp"), request.headers.get("x-signature"))
        if not ok:
            log.warning("recusado %s %s: %s", request.method, request.url.path, motivo)
            return JSONResponse({"error": f"não autorizado: {motivo}"}, status_code=401)
        return await call_next(request)

    @app.get("/health")
    async def health():
        h = backend.health()
        return {
            "ok": True,
            "version": __version__,
            "dll_version": store.dll_version,
            "uptime_s": int(time.time() - iniciado_em),
            "subscriptions": [f"{t}/{e}" for t, e in sorted(store.subscriptions)],
            "errors": list(store.errors)[-5:],
            "at": agora_iso(),
            **h,
        }

    @app.get("/positions")
    async def positions():
        return backend.positions()

    @app.get("/orders")
    async def orders(since: str | None = None, ticker: str | None = None):
        return {"orders": [o.as_dict() for o in store.orders_list(since, ticker)]}

    @app.get("/trades")
    async def trades(since: str | None = None):
        fills = store.fills_since(since)
        proximo = fills[-1].executed_at if fills else since
        return {"trades": [f.as_dict() for f in fills], "next_since": proximo}

    @app.get("/quote/{ticker}")
    async def quote(ticker: str, exchange: str = "B"):
        ticker, exchange = ticker.upper(), exchange.upper()
        if (ticker, exchange) not in store.subscriptions:
            backend.subscribe(ticker, exchange)
        q = store.get_quote(ticker, exchange)
        if q is None:
            return {"ticker": ticker, "exchange": exchange, "last": None, "bid": None, "ask": None, "updated_at": None}
        return q.as_dict()

    @app.post("/subscribe")
    async def subscribe(body: SubscribeBody):
        for t in body.tickers:
            backend.subscribe(t.ticker, t.exchange)
        return {"subscriptions": [f"{t}/{e}" for t, e in sorted(store.subscriptions)]}

    @app.post("/unsubscribe")
    async def unsubscribe(body: SubscribeBody):
        for t in body.tickers:
            backend.unsubscribe(t.ticker, t.exchange)
        return {"subscriptions": [f"{t}/{e}" for t, e in sorted(store.subscriptions)]}

    # ── Roteamento (só com PROFIT_TRADING_ENABLED=1) ─────────────
    def erro_roteamento(exc: Exception):
        if isinstance(exc, PermissionError):
            return JSONResponse({"error": str(exc), "accepted": False}, status_code=403)
        return JSONResponse({"error": str(exc), "accepted": False}, status_code=409)

    @app.post("/orders")
    async def send_order(body: OrderBody):
        if body.order_type not in (1, 2, 4):
            return JSONResponse({"error": "order_type deve ser 1 (mercado), 2 (limite) ou 4 (stop limite)"}, status_code=400)
        if body.order_type != 1 and (body.price is None or body.price <= 0):
            return JSONResponse({"error": "price obrigatório para ordens limitadas"}, status_code=400)
        if body.order_type == 4 and (body.stop_price is None or body.stop_price <= 0):
            return JSONResponse({"error": "stop_price obrigatório para stop limite"}, status_code=400)
        try:
            log.info("ordem recebida ref=%s %s/%s side=%s type=%s qty=%s", body.client_ref, body.ticker, body.exchange, body.side, body.order_type, body.quantity)
            return backend.send_order(body.ticker, body.exchange, body.side, body.order_type, body.quantity, body.price, body.stop_price, body.client_ref)
        except (PermissionError, RuntimeError) as exc:
            return erro_roteamento(exc)

    @app.post("/orders/cancel-all")
    async def cancel_all():
        try:
            log.info("cancelar todas as ordens")
            return backend.cancel_all_orders()
        except (PermissionError, RuntimeError) as exc:
            return erro_roteamento(exc)

    @app.post("/orders/{order_id}/cancel")
    async def cancel_order(order_id: str):
        try:
            log.info("cancelar ordem %s", order_id)
            return backend.cancel_order(order_id)
        except (PermissionError, RuntimeError) as exc:
            return erro_roteamento(exc)

    @app.post("/positions/{ticker}/zero")
    async def zero_position(ticker: str, body: ZeroBody):
        try:
            log.info("zerar posição %s/%s tipo=%s", ticker, body.exchange, body.position_type)
            return backend.zero_position(ticker, body.exchange, body.position_type, body.price)
        except (PermissionError, RuntimeError) as exc:
            return erro_roteamento(exc)

    if cfg.simulation:
        @app.post("/sim/fill")
        async def sim_fill(body: SimFillBody):
            fill = backend.simular_execucao(body.ticker, body.exchange, body.side, body.quantity, body.price)
            return {"fill": fill.as_dict()}

    @app.websocket("/ws")
    async def ws(websocket: WebSocket):
        # Assinatura na query (GET /ws, corpo vazio) — o navegador não manda cabeçalhos no WS.
        path = cfg.path_prefix + "/ws" if cfg.path_prefix else "/ws"
        ok, motivo = verificar(cfg.token, "GET", path, b"", websocket.query_params.get("ts"), websocket.query_params.get("sig"))
        if not ok:
            await websocket.close(code=4401, reason=motivo)
            return
        await websocket.accept()
        loop = asyncio.get_running_loop()
        fila = store.bus.subscribe(loop)
        try:
            # Snapshot inicial das cotações conhecidas
            for q in list(store.quotes.values()):
                await websocket.send_text(json.dumps({"type": "quote", **q.as_dict()}))

            async def receber():
                while True:
                    msg = await websocket.receive_text()
                    try:
                        data = json.loads(msg)
                    except json.JSONDecodeError:
                        continue
                    for t in data.get("subscribe", []) or []:
                        backend.subscribe(str(t.get("ticker", "")), str(t.get("exchange", "B")))
                    if data.get("ping"):
                        await websocket.send_text(json.dumps({"type": "pong", "at": agora_iso()}))

            tarefa = asyncio.create_task(receber())
            while True:
                evento = await fila.get()
                await websocket.send_text(json.dumps(evento))
        except WebSocketDisconnect:
            pass
        finally:
            store.bus.unsubscribe(fila)
            try:
                tarefa.cancel()
            except Exception:  # noqa: BLE001
                pass

    return app
