import os
import time
import json

import pytest
from fastapi.testclient import TestClient

os.environ.update({"CONNECTOR_TOKEN": "t" * 32, "PROFIT_SIMULATION": "1", "CONNECTOR_PATH_PREFIX": ""})

from connector import config as config_mod  # noqa: E402
from connector.auth import assinar  # noqa: E402
from connector.server import criar_app  # noqa: E402
from connector.simulation import SimulationBackend  # noqa: E402
from connector.store import Store  # noqa: E402

TOKEN = "t" * 32


def montar(trading: bool):
    os.environ["PROFIT_TRADING_ENABLED"] = "1" if trading else "0"
    cfg = config_mod.carregar()
    store = Store()
    backend = SimulationBackend(cfg, store)
    backend.start()
    return TestClient(criar_app(cfg, store, backend)), backend


def chamar(c, metodo, path, body=None):
    ts = int(time.time())
    corpo = b"" if body is None else json.dumps(body).encode()
    headers = {"X-Timestamp": str(ts), "X-Signature": assinar(TOKEN, metodo, path, corpo, ts), "Content-Type": "application/json"}
    return c.request(metodo, path, content=corpo if body is not None else None, headers=headers)


def test_roteamento_desligado_por_padrao():
    c, backend = montar(trading=False)
    with c:
        assert chamar(c, "GET", "/health").json()["trading_enabled"] is False
        r = chamar(c, "POST", "/orders", {"ticker": "WINZ26", "exchange": "F", "side": 1, "order_type": 1, "quantity": 1})
        assert r.status_code == 403 and r.json()["accepted"] is False
        assert chamar(c, "POST", "/orders/cancel-all", {}).status_code == 403
        assert chamar(c, "POST", "/positions/WINZ26/zero", {"exchange": "F"}).status_code == 403
    backend.stop()


def test_fluxo_de_ordens_simuladas():
    c, backend = montar(trading=True)
    with c:
        # mercado executa na hora e vira execução
        r = chamar(c, "POST", "/orders", {"ticker": "WINZ26", "exchange": "F", "side": 1, "order_type": 1, "quantity": 2, "client_ref": "ref-1"}).json()
        assert r["accepted"] and r["cl_order_id"].startswith("SIM") and "executada" in r["message"]
        trades = chamar(c, "GET", "/trades").json()["trades"]
        assert len(trades) == 1 and trades[0]["quantity"] == 2 and trades[0]["side"] == 1
        pos = chamar(c, "GET", "/positions").json()["positions"]
        assert pos[0]["ticker"] == "WINZ26" and pos[0]["quantity"] == 2

        # limitada fora do preço fica aberta; cancelar funciona uma vez
        ultimo = chamar(c, "GET", "/quote/WINZ26?exchange=F").json()["last"]
        r2 = chamar(c, "POST", "/orders", {"ticker": "WINZ26", "exchange": "F", "side": 1, "order_type": 2, "quantity": 1, "price": ultimo - 5000}).json()
        assert r2["accepted"] and "aberta" in r2["message"]
        abertas = [o for o in chamar(c, "GET", "/orders").json()["orders"] if o["status"] == 0]
        assert len(abertas) == 1
        rc = chamar(c, "POST", f"/orders/{r2['cl_order_id']}/cancel", {}).json()
        assert rc["accepted"]
        rc2 = chamar(c, "POST", f"/orders/{r2['cl_order_id']}/cancel", {}).json()
        assert rc2["accepted"] is False
        assert chamar(c, "POST", "/orders/999999/cancel", {}).json()["accepted"] is False

        # validações
        assert chamar(c, "POST", "/orders", {"ticker": "WINZ26", "side": 1, "order_type": 2, "quantity": 1}).status_code == 400
        assert chamar(c, "POST", "/orders", {"ticker": "WINZ26", "side": 1, "order_type": 4, "quantity": 1, "price": 1}).status_code == 400
        assert chamar(c, "POST", "/orders", {"ticker": "WINZ26", "side": 3, "order_type": 1, "quantity": 1}).status_code == 422

        # zerar posição: vende os 2 contratos a mercado; segunda vez não há posição
        rz = chamar(c, "POST", "/positions/WINZ26/zero", {"exchange": "F", "position_type": 1}).json()
        assert rz["accepted"]
        assert chamar(c, "GET", "/positions").json()["positions"] == []
        rz2 = chamar(c, "POST", "/positions/WINZ26/zero", {"exchange": "F"}).json()
        assert rz2["accepted"] is False and "NL_NO_POSITION" in rz2["message"]

        # kill switch
        chamar(c, "POST", "/orders", {"ticker": "PETR4", "exchange": "B", "side": 2, "order_type": 2, "quantity": 100, "price": 999})
        rk = chamar(c, "POST", "/orders/cancel-all", {}).json()
        assert rk["accepted"] and rk["message"].startswith("1 ordem")
    backend.stop()
