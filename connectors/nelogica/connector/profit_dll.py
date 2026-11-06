"""Binding da ProfitDLL (backend "dll").

Regras seguidas (documentação oficial, ver profit_types.py):
  - WinDLL (stdcall), nunca CDLL; argtypes/restype declarados antes de usar;
  - callbacks mantidos vivos como atributos da instância;
  - callbacks só copiam dados e enfileiram; nada de chamar a DLL de dentro
    deles, exceto TranslateTrade no callback de trade V2;
  - reconexão é feita pela própria DLL; o conector só acompanha o
    TStateCallback;
  - DLLFinalize ao encerrar; a DLL não deve ser reinicializada no mesmo
    processo (reiniciar o serviço = novo processo).
"""
from __future__ import annotations

import ctypes as C
import logging
import os
import queue
import threading
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from . import profit_types as T
from .config import Config
from .store import Fill, Order, Store, agora_iso

log = logging.getLogger("conector.dll")

TZ_BR = timezone(timedelta(hours=-3))


class ProfitDLLBackend:
    mode = "dll"

    def __init__(self, cfg: Config, store: Store) -> None:
        self.cfg = cfg
        self.store = store
        self.dll: C.WinDLL | None = None
        self._events: queue.Queue = queue.Queue(maxsize=50_000)
        self._worker: threading.Thread | None = None
        self._stop = threading.Event()
        self._initialized = False
        self._translate_gate = threading.Lock()
        self._accept_trades = threading.Event()
        self._account: T.TConnectorAccountIdentifier | None = None
        self._sdk_ok = False

        # Referências vivas dos callbacks (obrigatório).
        self._cb_state = T.TStateCallback(self._on_state)
        self._cb_tiny = T.TTinyBookCallback(self._on_tiny_book)
        self._cb_trade = T.TConnectorTradeCallback(self._on_trade)
        self._cb_order = T.TConnectorOrderCallback(self._on_order)
        self._cb_history_trade = T.THistoryTradeCallback(self._on_history_trade)
        self._cb_progress = T.TProgressCallback(self._on_progress)
        self._cb_msg_result = None  # criado se o SDK trouxer TConnectorTradingMessageResult

    # ── ciclo de vida ────────────────────────────────────────────
    def start(self) -> None:
        self._preflight()
        dll_dir = self.cfg.dll_dir.resolve()
        dll_path = dll_dir / "ProfitDLL.dll"
        if not dll_path.is_file():
            raise RuntimeError(f"ProfitDLL.dll não encontrada em {dll_dir}")

        # A DLL resolve dependências pelo diretório e lê .dat pelo cwd.
        os.chdir(dll_dir)
        if hasattr(os, "add_dll_directory"):
            self._dll_directory = os.add_dll_directory(str(dll_dir))
        self.dll = C.WinDLL(str(dll_path))
        self._sdk_ok = T.carregar_tipos_sdk(dll_dir)
        if not self._sdk_ok:
            log.warning("Tipos do SDK indisponíveis: %s — ordens/contas ficam limitadas (ver /health)", T.SDK_IMPORT_ERROR)
        self._configure_signatures()
        self._check_exports()

        self._worker = threading.Thread(target=self._process_events, name="conector-worker", daemon=True)
        self._worker.start()

        if self.cfg.routing:
            # [PP] DLLInitializeLogin(key, user, pass, state, history, orderChange, account,
            #      newTrade, newDaily, priceBook, offerBook, historyTrade, progress, tinyBook)
            # TODO(nelogica): THistoryCallback, TOrderChangeCallback, TAccountCallback,
            # TNewTradeCallback, TNewDailyCallback, TPriceBookCallback e TOfferBookCallback
            # não têm assinatura nos artigos consultados — passamos None e usamos os
            # Set*Callback documentados (SetTradeCallbackV2, SetOrderCallback,
            # SetHistoryTradeCallback, SetSerieProgressCallback) depois da inicialização.
            ret = self.dll.DLLInitializeLogin(
                self.cfg.activation_key, self.cfg.user, self.cfg.password,
                self._cb_state, None, None, None, None, None, None, None, None, None, self._cb_tiny,
            )
            nome = "DLLInitializeLogin"
        else:
            # [PP] DLLInitializeMarketLogin(key, user, pass, state, newTrade, newDaily,
            #      priceBook, offerBook, historyTrade, progress, tinyBook)
            ret = self.dll.DLLInitializeMarketLogin(
                self.cfg.activation_key, self.cfg.user, self.cfg.password,
                self._cb_state, None, None, None, None, None, None, self._cb_tiny,
            )
            nome = "DLLInitializeMarketLogin"
        if ret != T.NL_OK:
            raise RuntimeError(f"{nome} falhou: {T.descrever_retorno(ret)}")
        self._initialized = True
        log.info("%s aceito; aguardando estados da conexão", nome)

        self._check(self.dll.SetTradeCallbackV2(self._cb_trade), "SetTradeCallbackV2")        # [RT]/[LX]
        self._check(self.dll.SetHistoryTradeCallback(self._cb_history_trade), "SetHistoryTradeCallback")  # [HT]
        self._check(self.dll.SetSerieProgressCallback(self._cb_progress), "SetSerieProgressCallback")     # [HT]
        if self.cfg.routing:
            self._check(self.dll.SetOrderCallback(self._cb_order), "SetOrderCallback")        # [RO]
            if self._sdk_ok:
                tipo = T.SDK_TYPES["TConnectorTradingMessageResult"]
                cb_type = T.WINFUNCTYPE(None, C.POINTER(tipo))                               # [RO] (ponteiro)
                self._cb_msg_result = cb_type(self._on_trading_message_result)
                self.dll.SetTradingMessageResultCallback.argtypes = [cb_type]
                self.dll.SetTradingMessageResultCallback.restype = C.c_int
                self._check(self.dll.SetTradingMessageResultCallback(self._cb_msg_result), "SetTradingMessageResultCallback")

        threading.Thread(target=self._after_ready, name="conector-ready", daemon=True).start()

    def stop(self) -> None:
        self._stop.set()
        self._accept_trades.clear()
        with self._translate_gate:
            pass
        if self.dll and self._initialized:
            for ticker, exchange in list(self.store.subscriptions):
                try:
                    self.dll.UnsubscribeTicker(ticker, exchange)
                except Exception:  # noqa: BLE001
                    pass
            ret = self.dll.DLLFinalize()
            log.info("DLLFinalize: %s", T.descrever_retorno(ret))
            self._initialized = False

    # ── configuração ctypes ──────────────────────────────────────
    def _preflight(self) -> None:
        if not hasattr(C, "WinDLL") or not hasattr(C, "WINFUNCTYPE"):
            raise RuntimeError("Este backend exige Python para Windows (ou python.exe Windows no Wine). Use PROFIT_SIMULATION=1 fora do Windows.")
        if C.sizeof(C.c_void_p) != 8:
            raise RuntimeError("Use Python 64 bits com a ProfitDLL de Win64 (requisito da Nelogica).")
        if C.sizeof(C.c_wchar) != 2:
            raise RuntimeError("wchar_t de 2 bytes é obrigatório (ABI Windows).")
        esperado = {"SystemTime": (C.sizeof(T.SystemTime), 16), "AssetIdentifier": (C.sizeof(T.AssetIdentifierByValue), 32), "ConnectorTrade": (C.sizeof(T.ConnectorTrade), 64)}
        ruim = {k: v for k, v in esperado.items() if v[0] != v[1]}
        if ruim:
            raise RuntimeError(f"Layout de estruturas incompatível: {ruim}")

    def _configure_signatures(self) -> None:
        d = self.dll
        opt = C.c_void_p
        d.DLLInitializeLogin.argtypes = [C.c_wchar_p, C.c_wchar_p, C.c_wchar_p, T.TStateCallback, opt, opt, opt, opt, opt, opt, opt, opt, opt, T.TTinyBookCallback]
        d.DLLInitializeLogin.restype = C.c_int
        d.DLLInitializeMarketLogin.argtypes = [C.c_wchar_p, C.c_wchar_p, C.c_wchar_p, T.TStateCallback, opt, opt, opt, opt, opt, opt, T.TTinyBookCallback]
        d.DLLInitializeMarketLogin.restype = C.c_int
        d.DLLFinalize.argtypes = []
        d.DLLFinalize.restype = C.c_int
        d.SubscribeTicker.argtypes = [C.c_wchar_p, C.c_wchar_p]
        d.SubscribeTicker.restype = C.c_int
        d.UnsubscribeTicker.argtypes = [C.c_wchar_p, C.c_wchar_p]
        d.UnsubscribeTicker.restype = C.c_int
        d.SetTradeCallbackV2.argtypes = [T.TConnectorTradeCallback]
        d.SetTradeCallbackV2.restype = C.c_int
        d.TranslateTrade.argtypes = [C.c_size_t, C.POINTER(T.ConnectorTrade)]
        d.TranslateTrade.restype = C.c_int
        d.SetHistoryTradeCallback.argtypes = [T.THistoryTradeCallback]
        d.SetHistoryTradeCallback.restype = C.c_int
        d.SetSerieProgressCallback.argtypes = [T.TProgressCallback]
        d.SetSerieProgressCallback.restype = C.c_int
        d.GetHistoryTrades.argtypes = [C.c_wchar_p, C.c_wchar_p, C.c_wchar_p, C.c_wchar_p]
        d.GetHistoryTrades.restype = C.c_int
        if self.cfg.routing:
            d.SetOrderCallback.argtypes = [T.TConnectorOrderCallback]
            d.SetOrderCallback.restype = C.c_int
            d.SendOrder.argtypes = [C.POINTER(T.TConnectorSendOrder)]
            d.SendOrder.restype = C.c_int64
            d.SendChangeOrderV2.argtypes = [C.POINTER(T.TConnectorChangeOrder)]
            d.SendChangeOrderV2.restype = C.c_int
            d.SendCancelOrderV2.argtypes = [C.POINTER(T.TConnectorCancelOrder)]
            d.SendCancelOrderV2.restype = C.c_int
            d.SendCancelOrdersV2.argtypes = [C.POINTER(T.TConnectorCancelOrders)]
            d.SendCancelOrdersV2.restype = C.c_int
            d.SendCancelAllOrdersV2.argtypes = [C.POINTER(T.TConnectorCancelAllOrders)]
            d.SendCancelAllOrdersV2.restype = C.c_int
            d.SendZeroPositionV2.argtypes = [C.POINTER(T.TConnectorZeroPosition)]
            d.SendZeroPositionV2.restype = C.c_int64
            d.GetAccountCount.argtypes = []
            d.GetAccountCount.restype = C.c_int
            if self._sdk_ok:
                d.GetOrderDetails.argtypes = [C.POINTER(T.SDK_TYPES["TConnectorOrderOut"])]
                d.GetOrderDetails.restype = C.c_int
                d.GetAccounts.argtypes = [C.c_int, C.c_int, C.c_int, C.POINTER(T.SDK_TYPES["TConnectorAccountIdentifierOut"])]
                d.GetAccounts.restype = C.c_int

    def _check_exports(self) -> None:
        obrigatorios = ["DLLInitializeMarketLogin", "DLLInitializeLogin", "DLLFinalize", "SubscribeTicker", "UnsubscribeTicker", "SetTradeCallbackV2", "TranslateTrade", "SetHistoryTradeCallback", "SetSerieProgressCallback", "GetHistoryTrades"]
        if self.cfg.routing:
            obrigatorios += ["SetOrderCallback", "SendOrder", "SendCancelOrderV2", "SendCancelAllOrdersV2", "SendZeroPositionV2", "GetAccountCount", "GetAccounts", "GetOrderDetails"]
        faltando = [n for n in obrigatorios if not hasattr(self.dll, n)]
        if faltando:
            raise RuntimeError(f"Exports ausentes na DLL: {faltando}")

    @staticmethod
    def _check(ret: int, nome: str) -> None:
        if ret != T.NL_OK:
            raise RuntimeError(f"{nome} falhou: {T.descrever_retorno(ret)}")

    # ── callbacks (ConnectorThread): só copiar e enfileirar ─────
    def _on_state(self, state_type: int, result: int) -> None:
        try:
            self._events.put_nowait(("state", int(state_type), int(result)))
        except queue.Full:
            pass

    def _on_tiny_book(self, asset: T.TAssetID, price: float, qty: int, side: int) -> None:
        try:
            self._events.put_nowait(("tiny", asset.ticker or "", asset.bolsa or "", float(price), int(qty), int(side)))
        except queue.Full:
            pass

    def _on_trade(self, asset: T.AssetIdentifierByValue, trade_ptr: int, flags: int) -> None:
        # Única chamada à DLL permitida dentro de um callback: TranslateTrade. [RT]/[LX]
        self._translate_gate.acquire()
        try:
            if not self._accept_trades.is_set():
                return
            trade = T.ConnectorTrade(Version=0)
            if self.dll.TranslateTrade(trade_ptr, C.byref(trade)) != T.NL_OK:
                return
            ticker = C.cast(asset.Ticker, C.c_wchar_p).value if asset.Ticker else ""
            exchange = C.cast(asset.Exchange, C.c_wchar_p).value if asset.Exchange else ""
            td = trade.TradeDate
            quando = datetime(td.wYear, td.wMonth, td.wDay, td.wHour, td.wMinute, td.wSecond, td.wMilliseconds * 1000, tzinfo=TZ_BR)
            self._events.put_nowait(("trade", ticker, exchange, float(trade.Price), int(trade.Quantity), int(trade.TradeNumber), quando.isoformat(timespec="milliseconds"), bool(flags & 1)))
        except BaseException:  # noqa: BLE001 — exceções não podem escapar de um callback ctypes
            self.store.add_error("erro no callback de trade")
        finally:
            self._translate_gate.release()

    def _on_order(self, order_id: T.TConnectorOrderIdentifier) -> None:
        try:
            self._events.put_nowait(("order", int(order_id.LocalOrderID), order_id.ClOrderID))
        except queue.Full:
            pass

    def _on_history_trade(self, asset, date, trade_number, price, vol, qtd, buy_agent, sell_agent, trade_type) -> None:
        try:
            self._events.put_nowait(("history", asset.ticker or "", asset.bolsa or "", str(date), int(trade_number), float(price), int(qtd), int(trade_type)))
        except queue.Full:
            pass

    def _on_progress(self, asset, progress: int) -> None:
        try:
            self._events.put_nowait(("progress", asset.ticker or "", asset.bolsa or "", int(progress)))
        except queue.Full:
            pass

    def _on_trading_message_result(self, result_ptr) -> None:
        try:
            r = result_ptr.contents
            # Campos citados na documentação: MessageID, BrokerID, ResultCode, Message. [RO]
            self._events.put_nowait(("msg_result", int(getattr(r, "MessageID", 0)), int(getattr(r, "BrokerID", 0)), int(getattr(r, "ResultCode", 200)), str(getattr(r, "Message", "") or "")))
        except BaseException:  # noqa: BLE001
            self.store.add_error("erro no callback de resultado de mensagem")

    # ── worker (fora da ConnectorThread) ─────────────────────────
    def _process_events(self) -> None:
        while not self._stop.is_set():
            try:
                ev = self._events.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                self._handle(ev)
            except Exception as exc:  # noqa: BLE001
                log.exception("erro processando evento %s", ev[0])
                self.store.add_error(f"{ev[0]}: {exc}")

    def _handle(self, ev: tuple) -> None:
        kind = ev[0]
        if kind == "state":
            _, tipo, res = ev
            self.store.set_state(tipo, res)
            log.info("estado %s = %s", tipo, T.STATE_LABELS.get(tipo, {}).get(res, res))
        elif kind == "tiny":
            _, ticker, exchange, price, qty, side = ev
            self.store.update_quote(ticker, exchange, **({"bid": price} if side == 0 else {"ask": price}))
        elif kind == "trade":
            _, ticker, exchange, price, qty, number, quando, is_edit = ev
            if not is_edit:
                self.store.update_quote(ticker, exchange, last=price, last_qty=qty, trade_number=number)
        elif kind == "order":
            _, local_id, cl_id = ev
            self._refresh_order(local_id, cl_id)
        elif kind == "msg_result":
            _, message_id, broker_id, code, message = ev
            self.store.bus.publish({"type": "message_result", "message_id": message_id, "broker_id": broker_id, "result_code": code, "message": message, "at": agora_iso()})
        elif kind in ("history", "progress"):
            self.store.bus.publish({"type": kind, "data": ev[1:], "at": agora_iso()})

    def _refresh_order(self, local_id: int, cl_id: str | None) -> None:
        """Consulta GetOrderDetails e registra execuções novas (delta de TradedQuantity)."""
        if not self._sdk_ok:
            # TODO(nelogica): sem TConnectorOrderOut (profitTypes.py) não dá para ler os
            # detalhes; só registramos que a ordem mudou.
            self.store.bus.publish({"type": "order_changed", "local_order_id": local_id, "cl_order_id": cl_id, "at": agora_iso()})
            return
        OrderOut = T.SDK_TYPES["TConnectorOrderOut"]
        out = OrderOut()
        out.Version = 0
        out.OrderID.Version = 0
        out.OrderID.LocalOrderID = local_id
        out.OrderID.ClOrderID = cl_id
        ret = self.dll.GetOrderDetails(C.byref(out))
        if ret != T.NL_OK:
            self.store.add_error(f"GetOrderDetails({local_id}/{cl_id}) = {T.descrever_retorno(ret)}")
            return
        # Campos citados na doc: OrderStatus, TradedQuantity, Quantity, LeavesQuantity, AveragePrice.
        # Os demais (AssetID, Side, OrderType, Price, StopPrice) vêm do profitTypes.py do SDK.
        asset = getattr(out, "AssetID", None)
        ticker = (getattr(asset, "Ticker", None) or "").upper() if asset is not None else ""
        exchange = getattr(asset, "Exchange", None) if asset is not None else None
        order = Order(
            local_order_id=int(getattr(out.OrderID, "LocalOrderID", local_id) or local_id),
            cl_order_id=getattr(out.OrderID, "ClOrderID", None) or cl_id,
            ticker=ticker,
            exchange=exchange,
            side=int(getattr(out, "OrderSide", getattr(out, "Side", 0)) or 0),
            order_type=int(getattr(out, "OrderType", 0) or 0),
            quantity=int(getattr(out, "Quantity", 0) or 0),
            traded_quantity=int(getattr(out, "TradedQuantity", 0) or 0),
            price=float(getattr(out, "Price", -1)) if getattr(out, "Price", None) is not None else None,
            stop_price=float(getattr(out, "StopPrice", -1)) if getattr(out, "StopPrice", None) is not None else None,
            average_price=float(getattr(out, "AveragePrice", 0) or 0) or None,
            status=int(getattr(out, "OrderStatus", 200) or 200),
        )
        order, delta = self.store.upsert_order(order)
        if delta > 0 and order.average_price:
            # Execução nova: a DLL entrega o acumulado por ordem (TradedQuantity/AveragePrice);
            # registramos o delta a preço médio. Preço por execução individual não está
            # documentado — TODO(nelogica): trocar por execuções unitárias se o SDK expuser.
            self.store.add_fill(Fill(
                id=f"{order.cl_order_id or order.local_order_id}-{order.traded_quantity}",
                ticker=order.ticker, exchange=order.exchange, side=order.side, quantity=delta,
                price=order.average_price, executed_at=agora_iso(),
                order_cl_id=order.cl_order_id, order_local_id=order.local_order_id,
            ))

    def _after_ready(self) -> None:
        """Quando a conexão completa, descobre a conta de roteamento e reativa assinaturas."""
        if not self.wait_ready(timeout=120):
            log.warning("conexão não ficou pronta em 120 s: %s", self.store.states_snapshot())
            return
        if self.cfg.routing:
            self._load_account()
        self._accept_trades.set()
        for ticker, exchange in list(self.store.subscriptions):
            self._subscribe_dll(ticker, exchange)

    def _load_account(self) -> None:
        if not self._sdk_ok:
            self.store.account = {"error": "profitTypes.py do SDK ausente; GetAccounts desativado"}
            return
        total = self.dll.GetAccountCount()
        if total <= 0:
            self.store.account = {"error": "nenhuma conta de roteamento vinculada"}
            return
        Out = T.SDK_TYPES["TConnectorAccountIdentifierOut"]
        contas = (Out * total)()
        for c in contas:
            c.Version = 0
        ret = self.dll.GetAccounts(0, 0, total, contas)
        if ret < 0:
            self.store.account = {"error": f"GetAccounts = {T.descrever_retorno(ret)}"}
            return
        escolhida = None
        for c in contas:
            broker = int(getattr(c, "BrokerID", 0))
            account = str(getattr(c, "AccountID", "") or "")
            if (self.cfg.broker_id is None or broker == self.cfg.broker_id) and (self.cfg.account_id is None or account == self.cfg.account_id):
                escolhida = (broker, account)
                break
        if escolhida is None:
            self.store.account = {"error": "conta configurada não encontrada", "total": total}
            return
        self._account = T.TConnectorAccountIdentifier(Version=0, BrokerID=escolhida[0], AccountID=escolhida[1], SubAccountID=None, Reserved=0)
        self.store.account = {"broker_id": escolhida[0], "account_id": escolhida[1], "total": total}

    # ── API usada pelo servidor ──────────────────────────────────
    def ready(self) -> bool:
        s = self.store.states_snapshot()
        ok = (s.get(T.CONNECTION_STATE_LOGIN) == T.LOGIN_CONNECTED
              and s.get(T.CONNECTION_STATE_MARKET_DATA) == T.MARKET_CONNECTED
              and s.get(T.CONNECTION_STATE_MARKET_LOGIN) == T.CONNECTION_ACTIVATE_VALID)
        if self.cfg.routing:
            ok = ok and s.get(T.CONNECTION_STATE_ROTEAMENTO) == T.ROTEAMENTO_BROKER_CONNECTED
        return ok

    def wait_ready(self, timeout: float) -> bool:
        fim = time.time() + timeout
        while time.time() < fim and not self._stop.is_set():
            if self.ready():
                return True
            time.sleep(0.5)
        return self.ready()

    def health(self) -> dict:
        s = self.store.states_snapshot()
        return {
            "mode": self.mode,
            "ready": self.ready(),
            "states": {str(k): {"result": v, "label": T.STATE_LABELS.get(k, {}).get(v, str(v))} for k, v in s.items()},
            "routing": self.cfg.routing,
            "sdk_types": self._sdk_ok,
            "sdk_types_error": T.SDK_IMPORT_ERROR,
            "account": self.store.account,
            "dll_dir": str(self.cfg.dll_dir),
        }

    def subscribe(self, ticker: str, exchange: str) -> None:
        self.store.subscriptions.add((ticker.upper(), exchange.upper()))
        if self.ready():
            self._subscribe_dll(ticker.upper(), exchange.upper())

    def _subscribe_dll(self, ticker: str, exchange: str) -> None:
        self._accept_trades.set()
        ret = self.dll.SubscribeTicker(ticker, exchange)  # [RT]
        if ret != T.NL_OK:
            self.store.add_error(f"SubscribeTicker({ticker}/{exchange}) = {T.descrever_retorno(ret)}")

    def unsubscribe(self, ticker: str, exchange: str) -> None:
        self.store.subscriptions.discard((ticker.upper(), exchange.upper()))
        if self.dll and self._initialized:
            self.dll.UnsubscribeTicker(ticker.upper(), exchange.upper())

    def positions(self) -> dict:
        # TODO(nelogica): a função de posição da conta (GetPosition/GetPositionV2) não
        # consta nos artigos consultados; até ter a assinatura oficial, a posição é
        # calculada pelas execuções vistas pelo conector desde que ele subiu.
        return {"positions": self.store.positions_from_fills(), "source": "fills", "note": "posição calculada pelas execuções vistas pelo conector; TODO GetPositionV2"}
