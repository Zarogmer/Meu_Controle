"""Estado em memória do conector, seguro para acesso concorrente.

Os callbacks da DLL rodam na ConnectorThread; o servidor HTTP roda no
loop asyncio. Tudo que cruza essa fronteira passa por aqui, sempre
copiado (nunca ponteiros nativos).
"""
from __future__ import annotations

import asyncio
import threading
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone


def agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@dataclass
class Quote:
    ticker: str
    exchange: str
    last: float | None = None
    bid: float | None = None
    ask: float | None = None
    last_qty: int | None = None
    trade_number: int | None = None
    updated_at: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class Order:
    local_order_id: int | None
    cl_order_id: str | None
    ticker: str
    exchange: str | None
    side: int  # 1 compra, 2 venda
    order_type: int  # 1 market, 2 limit, 4 stop limit
    quantity: int
    traded_quantity: int
    price: float | None
    stop_price: float | None
    average_price: float | None
    status: int
    updated_at: str = field(default_factory=agora_iso)

    @property
    def key(self) -> str:
        return self.cl_order_id or f"local:{self.local_order_id}"

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class Fill:
    id: str
    ticker: str
    exchange: str | None
    side: int
    quantity: int
    price: float
    executed_at: str
    order_cl_id: str | None
    order_local_id: int | None
    fees: float | None = None

    def as_dict(self) -> dict:
        return asdict(self)


class EventBus:
    """Entrega eventos (dict) para WebSockets abertos, a partir de qualquer thread."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subs: list[tuple[asyncio.AbstractEventLoop, asyncio.Queue]] = []

    def subscribe(self, loop: asyncio.AbstractEventLoop) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        with self._lock:
            self._subs.append((loop, q))
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        with self._lock:
            self._subs = [(l, qq) for (l, qq) in self._subs if qq is not q]

    def publish(self, evento: dict) -> None:
        with self._lock:
            subs = list(self._subs)
        for loop, q in subs:
            try:
                loop.call_soon_threadsafe(_put_nowait_safe, q, evento)
            except RuntimeError:
                pass  # loop fechado


def _put_nowait_safe(q: asyncio.Queue, item: dict) -> None:
    try:
        q.put_nowait(item)
    except asyncio.QueueFull:
        pass  # cliente lento: descarta


class Store:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.states: dict[int, int] = {}
        self.quotes: dict[str, Quote] = {}
        self.orders: dict[str, Order] = {}
        self.fills: deque[Fill] = deque(maxlen=50_000)
        self.subscriptions: set[tuple[str, str]] = set()
        self.account: dict | None = None
        self.dll_version: str | None = None
        self.started_at = agora_iso()
        self.errors: deque[str] = deque(maxlen=50)
        self.bus = EventBus()

    # ── estados ──
    def set_state(self, tipo: int, resultado: int) -> None:
        with self._lock:
            self.states[int(tipo)] = int(resultado)
        self.bus.publish({"type": "state", "state_type": int(tipo), "result": int(resultado), "at": agora_iso()})

    def states_snapshot(self) -> dict[int, int]:
        with self._lock:
            return dict(self.states)

    # ── cotações ──
    @staticmethod
    def chave(ticker: str, exchange: str) -> str:
        return f"{ticker.upper()}:{exchange.upper()}"

    def update_quote(self, ticker: str, exchange: str, **campos) -> Quote:
        with self._lock:
            k = self.chave(ticker, exchange)
            q = self.quotes.get(k) or Quote(ticker=ticker.upper(), exchange=exchange.upper())
            for nome, valor in campos.items():
                if valor is not None:
                    setattr(q, nome, valor)
            q.updated_at = agora_iso()
            self.quotes[k] = q
            snapshot = q.as_dict()
        self.bus.publish({"type": "quote", **snapshot})
        return q

    def get_quote(self, ticker: str, exchange: str) -> Quote | None:
        with self._lock:
            return self.quotes.get(self.chave(ticker, exchange))

    # ── ordens e execuções ──
    def upsert_order(self, order: Order) -> tuple[Order, int]:
        """Grava a ordem e devolve (ordem, quantidade executada NOVA desde o último snapshot)."""
        with self._lock:
            anterior = self.orders.get(order.key)
            if anterior is None and order.local_order_id is not None:
                anterior = self.orders.pop(f"local:{order.local_order_id}", None)
            delta = order.traded_quantity - (anterior.traded_quantity if anterior else 0)
            order.updated_at = agora_iso()
            self.orders[order.key] = order
        self.bus.publish({"type": "order", **order.as_dict()})
        return order, max(delta, 0)

    def add_fill(self, fill: Fill) -> None:
        with self._lock:
            self.fills.append(fill)
        self.bus.publish({"type": "fill", **fill.as_dict()})

    def fills_since(self, since_iso: str | None) -> list[Fill]:
        with self._lock:
            lista = list(self.fills)
        if not since_iso:
            return lista
        return [f for f in lista if f.executed_at > since_iso]

    def orders_list(self, since_iso: str | None = None, ticker: str | None = None) -> list[Order]:
        with self._lock:
            lista = list(self.orders.values())
        if since_iso:
            lista = [o for o in lista if o.updated_at > since_iso]
        if ticker:
            lista = [o for o in lista if o.ticker.upper() == ticker.upper()]
        return sorted(lista, key=lambda o: o.updated_at)

    def positions_from_fills(self) -> list[dict]:
        """Posição por ativo calculada só a partir das execuções vistas pelo conector."""
        with self._lock:
            fills = list(self.fills)
        pos: dict[str, dict] = {}
        for f in sorted(fills, key=lambda x: x.executed_at):
            p = pos.setdefault(f.ticker, {"ticker": f.ticker, "exchange": f.exchange, "quantity": 0, "average_price": 0.0})
            sinal = 1 if f.side == 1 else -1
            q_atual, pm = p["quantity"], p["average_price"]
            if q_atual == 0 or (q_atual > 0) == (sinal > 0):
                total = abs(q_atual) + f.quantity
                p["average_price"] = (abs(q_atual) * pm + f.quantity * f.price) / total if total else 0.0
                p["quantity"] = q_atual + sinal * f.quantity
            else:
                fechar = min(f.quantity, abs(q_atual))
                restante = f.quantity - fechar
                p["quantity"] = q_atual + sinal * fechar
                if p["quantity"] == 0:
                    p["average_price"] = 0.0
                if restante:
                    p["quantity"] += sinal * restante
                    p["average_price"] = f.price
        return [dict(p, source="fills") for p in pos.values() if p["quantity"] != 0]

    def add_error(self, msg: str) -> None:
        with self._lock:
            self.errors.append(f"{agora_iso()} {msg}")
