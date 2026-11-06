"""Tipos ctypes da ProfitDLL.

Só o que está documentado na central de ajuda da Nelogica foi declarado
aqui, com a fonte indicada em cada bloco:

  [PP]  "Ecossistema ProfitDLL e primeiros passos"
  [RT]  "Funções Real Time - DLL"
  [HT]  "Como requisitar trades históricos com a ProfitDLL"
  [RO]  "Como rotear ordens com a ProfitDLL"
  [LX]  "ProfitDLL no Linux: Saiba como acessar e utilizar" (layout de
        TConnectorAssetIdentifier por valor e TConnectorTrade, conferido
        contra a ProfitDLL 4.0.0.41)

As estruturas cujo layout completo NÃO aparece nos artigos
(TConnectorOrderOut, TConnectorAccountIdentifierOut,
TConnectorTradingMessageResult) são importadas do `profitTypes.py` que
acompanha o pacote oficial da DLL (os exemplos da Nelogica fazem
`from profitTypes import ...`). Se o arquivo não estiver na PROFITDLL_DIR,
as funções que dependem delas ficam desativadas e o conector avisa no
/health — ver TODOs em profit_dll.py.
"""
from __future__ import annotations

import ctypes as C
import importlib
import sys
from pathlib import Path

# WINFUNCTYPE só existe no Python para Windows (ou Windows-Python no Wine).
WINFUNCTYPE = getattr(C, "WINFUNCTYPE", C.CFUNCTYPE)

# ── Constantes de estado [PP] ────────────────────────────────────
NL_OK = 0

CONNECTION_STATE_LOGIN = 0
CONNECTION_STATE_ROTEAMENTO = 1
CONNECTION_STATE_MARKET_DATA = 2
CONNECTION_STATE_MARKET_LOGIN = 3

LOGIN_CONNECTED = 0
LOGIN_INVALID = 1
LOGIN_INVALID_PASS = 2
LOGIN_BLOCKED_PASS = 3
LOGIN_EXPIRED_PASS = 4
LOGIN_UNKNOWN_ERR = 200

ROTEAMENTO_DISCONNECTED = 0
ROTEAMENTO_CONNECTING = 1
ROTEAMENTO_CONNECTED = 2
ROTEAMENTO_BROKER_DISCONNECTED = 3
ROTEAMENTO_BROKER_CONNECTING = 4
ROTEAMENTO_BROKER_CONNECTED = 5

MARKET_DISCONNECTED = 0
MARKET_CONNECTING = 1
MARKET_WAITING = 2
MARKET_NOT_LOGGED = 3
MARKET_CONNECTED = 4

CONNECTION_ACTIVATE_VALID = 0
CONNECTION_ACTIVATE_INVALID = 1

STATE_LABELS = {
    CONNECTION_STATE_LOGIN: {0: "LOGIN_CONNECTED", 1: "LOGIN_INVALID", 2: "LOGIN_INVALID_PASS", 3: "LOGIN_BLOCKED_PASS", 4: "LOGIN_EXPIRED_PASS", 200: "LOGIN_UNKNOWN_ERR"},
    CONNECTION_STATE_ROTEAMENTO: {0: "ROTEAMENTO_DISCONNECTED", 1: "ROTEAMENTO_CONNECTING", 2: "ROTEAMENTO_CONNECTED", 3: "ROTEAMENTO_BROKER_DISCONNECTED", 4: "ROTEAMENTO_BROKER_CONNECTING", 5: "ROTEAMENTO_BROKER_CONNECTED"},
    CONNECTION_STATE_MARKET_DATA: {0: "MARKET_DISCONNECTED", 1: "MARKET_CONNECTING", 2: "MARKET_WAITING", 3: "MARKET_NOT_LOGGED", 4: "MARKET_CONNECTED"},
    CONNECTION_STATE_MARKET_LOGIN: {0: "CONNECTION_ACTIVATE_VALID", 1: "CONNECTION_ACTIVATE_INVALID"},
}

# ── Enums de roteamento [RO] ─────────────────────────────────────
ORDER_TYPE_MARKET = 1
ORDER_TYPE_LIMIT = 2
ORDER_TYPE_STOP_LIMIT = 4
ORDER_SIDE_BUY = 1
ORDER_SIDE_SELL = 2

ORDER_STATUS = {
    0: "cosNew", 1: "cosPartiallyFilled", 2: "cosFilled", 4: "cosCanceled", 5: "cosReplaced",
    6: "cosPendingCancel", 7: "cosStopped", 8: "cosRejected", 9: "cosSuspended", 10: "cosPendingNew",
    12: "cosExpired", 14: "cosPendingReplace", 15: "cosPartiallyFilledCanceled", 16: "cosReceived",
    18: "cosPartiallyFilledRejected", 200: "cosUnknown", 205: "cosCanceledByAdmin",
}

# Códigos de erro mais comuns [RO]
NL_ERRORS = {
    -2147483646: "NL_NOT_INITIALIZED", -2147483645: "NL_INVALID_ARGS", -2147483644: "NL_WAITING_SERVER",
    -2147483643: "NL_NO_LOGIN", -2147483638: "NL_MARKET_ONLY", -2147483637: "NL_NO_POSITION",
    -2147483636: "NL_NOT_FOUND", -2147483635: "NL_VERSION_NOT_SUPPORTED", -2147483630: "NL_LICENSE_NOT_ALLOWED",
    -2147483617: "NL_INVALID_TICKER",
}


def descrever_retorno(valor: int) -> str:
    nome = NL_ERRORS.get(valor)
    return f"{valor} ({nome})" if nome else f"{valor} (0x{C.c_uint32(valor).value:08X})"


# ── Estruturas [HT] ──────────────────────────────────────────────
class TAssetID(C.Structure):
    """Ativo nos callbacks antigos (histórico, tiny book, progresso). Passado POR VALOR."""
    _fields_ = [("ticker", C.c_wchar_p), ("bolsa", C.c_wchar_p), ("feed", C.c_int)]


# ── Estruturas [LX] (callbacks V2) ───────────────────────────────
class SystemTime(C.Structure):
    _fields_ = [
        ("wYear", C.c_ushort), ("wMonth", C.c_ushort), ("wDayOfWeek", C.c_ushort), ("wDay", C.c_ushort),
        ("wHour", C.c_ushort), ("wMinute", C.c_ushort), ("wSecond", C.c_ushort), ("wMilliseconds", C.c_ushort),
    ]


class AssetIdentifierByValue(C.Structure):
    """TConnectorAssetIdentifier como chega no TConnectorTradeCallback (por valor).
    Ticker/Exchange são ponteiros válidos só durante o callback."""
    _fields_ = [("Version", C.c_ubyte), ("Ticker", C.c_void_p), ("Exchange", C.c_void_p), ("FeedType", C.c_ubyte)]


class ConnectorTrade(C.Structure):
    """TConnectorTrade preenchida por TranslateTrade."""
    _fields_ = [
        ("Version", C.c_ubyte), ("TradeDate", SystemTime), ("TradeNumber", C.c_uint), ("Price", C.c_double),
        ("Quantity", C.c_longlong), ("Volume", C.c_double), ("BuyAgent", C.c_int), ("SellAgent", C.c_int),
        ("TradeType", C.c_ubyte),
    ]


# ── Estruturas de roteamento [RO] ────────────────────────────────
class TConnectorAccountIdentifier(C.Structure):
    _fields_ = [("Version", C.c_ubyte), ("BrokerID", C.c_int), ("AccountID", C.c_wchar_p), ("SubAccountID", C.c_wchar_p), ("Reserved", C.c_int64)]


class TConnectorAssetIdentifier(C.Structure):
    _fields_ = [("Version", C.c_ubyte), ("Ticker", C.c_wchar_p), ("Exchange", C.c_wchar_p), ("FeedType", C.c_ubyte)]


class TConnectorOrderIdentifier(C.Structure):
    _fields_ = [("Version", C.c_ubyte), ("LocalOrderID", C.c_int64), ("ClOrderID", C.c_wchar_p)]


class TConnectorSendOrder(C.Structure):
    _fields_ = [
        ("Version", C.c_ubyte), ("AccountID", TConnectorAccountIdentifier), ("AssetID", TConnectorAssetIdentifier),
        ("Password", C.c_wchar_p), ("OrderType", C.c_ubyte), ("OrderSide", C.c_ubyte), ("Price", C.c_double),
        ("StopPrice", C.c_double), ("Quantity", C.c_int64), ("MessageID", C.c_int64),
    ]


class TConnectorChangeOrder(C.Structure):
    _fields_ = [
        ("Version", C.c_ubyte), ("AccountID", TConnectorAccountIdentifier), ("OrderID", TConnectorOrderIdentifier),
        ("Password", C.c_wchar_p), ("Price", C.c_double), ("StopPrice", C.c_double), ("Quantity", C.c_int64), ("MessageID", C.c_int64),
    ]


class TConnectorCancelOrder(C.Structure):
    _fields_ = [("Version", C.c_ubyte), ("AccountID", TConnectorAccountIdentifier), ("OrderID", TConnectorOrderIdentifier), ("Password", C.c_wchar_p), ("MessageID", C.c_int64)]


class TConnectorCancelOrders(C.Structure):
    _fields_ = [("Version", C.c_ubyte), ("AccountID", TConnectorAccountIdentifier), ("AssetID", TConnectorAssetIdentifier), ("Password", C.c_wchar_p)]


class TConnectorCancelAllOrders(C.Structure):
    _fields_ = [("Version", C.c_ubyte), ("AccountID", TConnectorAccountIdentifier), ("Password", C.c_wchar_p)]


class TConnectorZeroPosition(C.Structure):
    _fields_ = [
        ("Version", C.c_ubyte), ("AccountID", TConnectorAccountIdentifier), ("AssetID", TConnectorAssetIdentifier),
        ("Password", C.c_wchar_p), ("Price", C.c_double), ("PositionType", C.c_ubyte), ("MessageID", C.c_int64),
    ]


# ── Tipos de callback ────────────────────────────────────────────
TStateCallback = WINFUNCTYPE(None, C.c_int, C.c_int)                                   # [PP]
TTinyBookCallback = WINFUNCTYPE(None, TAssetID, C.c_double, C.c_int, C.c_int)          # [RT] (asset, price, qty, side 0=bid 1=ask)
TConnectorTradeCallback = WINFUNCTYPE(None, AssetIdentifierByValue, C.c_size_t, C.c_uint)  # [LX] (asset, ptr opaco, flags)
THistoryTradeCallback = WINFUNCTYPE(                                                   # [HT]
    None, TAssetID, C.c_wchar_p, C.c_uint, C.c_double, C.c_double, C.c_int, C.c_int, C.c_int, C.c_int,
)
TProgressCallback = WINFUNCTYPE(None, TAssetID, C.c_int)                               # [HT]
TConnectorOrderCallback = WINFUNCTYPE(None, TConnectorOrderIdentifier)                 # [RO] (por valor)


# ── Tipos vindos do SDK (profitTypes.py) ─────────────────────────
# TODO(nelogica): o layout completo de TConnectorOrderOut,
# TConnectorAccountIdentifierOut e TConnectorTradingMessageResult não
# consta nos artigos consultados (só alguns campos são citados). Eles são
# carregados do profitTypes.py do pacote oficial. Não invente os campos.
SDK_TYPES: dict[str, type | None] = {
    "TConnectorOrderOut": None,
    "TConnectorAccountIdentifierOut": None,
    "TConnectorTradingMessageResult": None,
}
SDK_IMPORT_ERROR: str | None = None


def carregar_tipos_sdk(dll_dir: Path) -> bool:
    """Tenta importar profitTypes.py da pasta da DLL. Devolve True se achou tudo."""
    global SDK_IMPORT_ERROR
    try:
        if str(dll_dir) not in sys.path:
            sys.path.insert(0, str(dll_dir))
        mod = importlib.import_module("profitTypes")
    except Exception as exc:  # noqa: BLE001
        SDK_IMPORT_ERROR = f"profitTypes.py não encontrado em {dll_dir}: {exc}"
        return False
    faltando = []
    for nome in SDK_TYPES:
        tipo = getattr(mod, nome, None)
        if tipo is None:
            faltando.append(nome)
        SDK_TYPES[nome] = tipo
    if faltando:
        SDK_IMPORT_ERROR = f"profitTypes.py sem: {', '.join(faltando)}"
        return False
    SDK_IMPORT_ERROR = None
    return True
