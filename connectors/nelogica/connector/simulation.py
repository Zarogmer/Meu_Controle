"""Backend de simulação: não carrega a DLL.

Gera cotações (passeio aleatório) para os tickers assinados e, com
SIM_AUTO_FILLS=1, uma execução de compra e outra de venda por minuto.
Serve para testar o Meu Controle ponta a ponta (inclusive no Linux) e
para validar a instalação do serviço antes de ligar a licença.
"""
from __future__ import annotations

import logging
import random
import threading
import time

from . import profit_types as T
from .config import Config
from .store import Fill, Order, Store, agora_iso

log = logging.getLogger("conector.sim")

PRECO_BASE = {"WIN": 141_250.0, "IND": 141_250.0, "WDO": 5_412.5, "DOL": 5_412.5, "PETR4": 38.40, "VALE3": 61.20, "HGLG11": 162.0}


class SimulationBackend:
    mode = "simulation"

    def __init__(self, cfg: Config, store: Store) -> None:
        self.cfg = cfg
        self.store = store
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._seq = 0
        self._lock = threading.Lock()

    def start(self) -> None:
        for tipo, res in ((T.CONNECTION_STATE_LOGIN, T.LOGIN_CONNECTED), (T.CONNECTION_STATE_MARKET_DATA, T.MARKET_CONNECTED),
                          (T.CONNECTION_STATE_MARKET_LOGIN, T.CONNECTION_ACTIVATE_VALID), (T.CONNECTION_STATE_ROTEAMENTO, T.ROTEAMENTO_BROKER_CONNECTED)):
            self.store.set_state(tipo, res)
        self.store.account = {"broker_id": 999, "account_id": "SIM-0001", "simulated": True}
        self.store.dll_version = "simulacao"
        self._thread = threading.Thread(target=self._loop, name="sim-loop", daemon=True)
        self._thread.start()
        log.info("modo simulação ativo (nenhuma DLL carregada)")

    def stop(self) -> None:
        self._stop.set()

    def ready(self) -> bool:
        return True

    def health(self) -> dict:
        s = self.store.states_snapshot()
        return {
            "mode": self.mode, "ready": True,
            "states": {str(k): {"result": v, "label": T.STATE_LABELS.get(k, {}).get(v, str(v))} for k, v in s.items()},
            "routing": True, "trading_enabled": self.cfg.trading_enabled, "sdk_types": True, "sdk_types_error": None, "account": self.store.account, "dll_dir": None,
        }

    def subscribe(self, ticker: str, exchange: str) -> None:
        self.store.subscriptions.add((ticker.upper(), exchange.upper()))
        self._tick(ticker.upper(), exchange.upper())

    def unsubscribe(self, ticker: str, exchange: str) -> None:
        self.store.subscriptions.discard((ticker.upper(), exchange.upper()))

    def positions(self) -> dict:
        return {"positions": self.store.positions_from_fills(), "source": "fills", "note": "simulação"}

    # ── geração ──
    def _preco_inicial(self, ticker: str) -> float:
        for prefixo, base in PRECO_BASE.items():
            if ticker.startswith(prefixo):
                return base
        return 100.0

    def _tick(self, ticker: str, exchange: str) -> None:
        q = self.store.get_quote(ticker, exchange)
        last = q.last if q and q.last else self._preco_inicial(ticker)
        passo = 5.0 if ticker.startswith(("WIN", "IND")) else 0.5 if ticker.startswith(("WDO", "DOL")) else 0.01
        novo = round(last + random.choice((-1, 0, 1)) * passo * random.randint(1, 3), 2)
        with self._lock:
            self._seq += 1
            seq = self._seq
        self.store.update_quote(ticker, exchange, last=novo, bid=round(novo - passo, 2), ask=round(novo + passo, 2), last_qty=random.randint(1, 10), trade_number=seq)

    def _loop(self) -> None:
        ultimo_fill = time.time()
        while not self._stop.is_set():
            for ticker, exchange in list(self.store.subscriptions):
                self._tick(ticker, exchange)
            if self.cfg.sim_auto_fills and time.time() - ultimo_fill > 60:
                ultimo_fill = time.time()
                self.simular_execucao("WINZ26", "F", side=1, quantity=1)
                self.simular_execucao("WINZ26", "F", side=2, quantity=1)
            self._stop.wait(1.0)

    # ── Roteamento simulado ──────────────────────────────────────
    def _exigir_roteamento(self) -> None:
        if not self.cfg.trading_enabled:
            raise PermissionError("roteamento desligado neste conector (PROFIT_TRADING_ENABLED=0)")

    def send_order(self, ticker: str, exchange: str, side: int, order_type: int, quantity: int,
                   price: float | None, stop_price: float | None, client_ref: str | None) -> dict:
        self._exigir_roteamento()
        ticker, exchange = ticker.upper(), exchange.upper()
        if (ticker, exchange) not in self.store.subscriptions:
            self.subscribe(ticker, exchange)
        q = self.store.get_quote(ticker, exchange)
        ultimo = q.last if q and q.last else self._preco_inicial(ticker)
        with self._lock:
            self._seq += 1
            seq = self._seq
        local_id, cl_id = 10_000 + seq, f"SIM{seq:06d}"
        # A mercado executa na hora no último preço; limitada executa se já estiver "dentro"; senão fica aberta.
        executa = order_type == T.ORDER_TYPE_MARKET or (order_type == T.ORDER_TYPE_LIMIT and price is not None and ((side == 1 and price >= ultimo) or (side == 2 and price <= ultimo)))
        preco_exec = ultimo if order_type == T.ORDER_TYPE_MARKET else price
        order = Order(local_order_id=local_id, cl_order_id=cl_id, ticker=ticker, exchange=exchange, side=side, order_type=order_type,
                      quantity=quantity, traded_quantity=quantity if executa else 0, price=None if order_type == T.ORDER_TYPE_MARKET else price,
                      stop_price=stop_price if order_type == T.ORDER_TYPE_STOP_LIMIT else None, average_price=preco_exec if executa else None,
                      status=2 if executa else 0, client_ref=client_ref)
        self.store.upsert_order(order)
        if executa:
            self.store.add_fill(Fill(id=f"{cl_id}-{quantity}", ticker=ticker, exchange=exchange, side=side, quantity=quantity, price=float(preco_exec),
                                     executed_at=agora_iso(), order_cl_id=cl_id, order_local_id=local_id, fees=round(0.9 * quantity, 2)))
        return {"accepted": True, "local_order_id": local_id, "cl_order_id": cl_id, "message": "executada (simulação)" if executa else "aberta (simulação)", "mode": self.mode}

    def cancel_order(self, order_id: str) -> dict:
        self._exigir_roteamento()
        alvo = None
        for o in self.store.orders_list():
            if str(o.local_order_id) == order_id or o.cl_order_id == order_id:
                alvo = o
        if alvo is None:
            return {"accepted": False, "local_order_id": order_id, "message": T.descrever_retorno(-2147483636), "mode": self.mode}
        if alvo.status in (2, 4):
            return {"accepted": False, "local_order_id": order_id, "message": "ordem já finalizada", "mode": self.mode}
        alvo.status = 4
        self.store.upsert_order(alvo)
        return {"accepted": True, "local_order_id": order_id, "message": "cancelada (simulação)", "mode": self.mode}

    def cancel_all_orders(self) -> dict:
        self._exigir_roteamento()
        n = 0
        for o in self.store.orders_list():
            if o.status in (0, 1, 10, 16):
                o.status = 4
                self.store.upsert_order(o)
                n += 1
        return {"accepted": True, "local_order_id": None, "message": f"{n} ordem(ns) cancelada(s) (simulação)", "mode": self.mode}

    def zero_position(self, ticker: str, exchange: str, position_type: int, price: float | None) -> dict:
        self._exigir_roteamento()
        pos = next((p for p in self.store.positions_from_fills() if p["ticker"] == ticker.upper()), None)
        if not pos:
            return {"accepted": False, "local_order_id": None, "message": T.descrever_retorno(-2147483637), "mode": self.mode}
        side = 2 if pos["quantity"] > 0 else 1
        return self.send_order(ticker, exchange, side, T.ORDER_TYPE_MARKET, abs(int(pos["quantity"])), None, None, "zeragem")

    def simular_execucao(self, ticker: str, exchange: str, side: int, quantity: int, price: float | None = None) -> Fill:
        """Injeta uma execução (POST /sim/fill)."""
        ticker, exchange = ticker.upper(), exchange.upper()
        if (ticker, exchange) not in self.store.subscriptions:
            self.subscribe(ticker, exchange)
        q = self.store.get_quote(ticker, exchange)
        preco = price if price is not None else (q.last if q and q.last else self._preco_inicial(ticker))
        with self._lock:
            self._seq += 1
            seq = self._seq
        local_id = 10_000 + seq
        cl_id = f"SIM{seq:06d}"
        order = Order(local_order_id=local_id, cl_order_id=cl_id, ticker=ticker, exchange=exchange, side=side,
                      order_type=T.ORDER_TYPE_MARKET, quantity=quantity, traded_quantity=quantity, price=None, stop_price=None,
                      average_price=preco, status=2)
        self.store.upsert_order(order)
        fill = Fill(id=f"{cl_id}-{quantity}", ticker=ticker, exchange=exchange, side=side, quantity=quantity, price=preco,
                    executed_at=agora_iso(), order_cl_id=cl_id, order_local_id=local_id, fees=round(0.9 * quantity, 2))
        self.store.add_fill(fill)
        return fill
