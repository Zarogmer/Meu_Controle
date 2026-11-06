import os
import time

import pytest
from fastapi.testclient import TestClient

os.environ.update({"CONNECTOR_TOKEN": "t" * 32, "PROFIT_SIMULATION": "1", "CONNECTOR_PATH_PREFIX": ""})

from connector import config as config_mod  # noqa: E402
from connector.auth import assinar  # noqa: E402
from connector.server import criar_app  # noqa: E402
from connector.simulation import SimulationBackend  # noqa: E402
from connector.store import Store  # noqa: E402

TOKEN = "t" * 32


@pytest.fixture()
def cliente():
    cfg = config_mod.carregar()
    store = Store()
    backend = SimulationBackend(cfg, store)
    backend.start()
    app = criar_app(cfg, store, backend)
    with TestClient(app) as c:
        yield c, backend
    backend.stop()


def chamar(c, metodo, path, body=None):
    ts = int(time.time())
    corpo = b"" if body is None else __import__("json").dumps(body).encode()
    headers = {"X-Timestamp": str(ts), "X-Signature": assinar(TOKEN, metodo, path, corpo, ts), "Content-Type": "application/json"}
    return c.request(metodo, path, content=corpo if body is not None else None, headers=headers)


def test_recusa_sem_assinatura(cliente):
    c, _ = cliente
    assert c.get("/health").status_code == 401
    r = c.get("/health", headers={"X-Timestamp": str(int(time.time())), "X-Signature": "00"})
    assert r.status_code == 401


def test_health_e_fluxo_de_execucoes(cliente):
    c, backend = cliente
    h = chamar(c, "GET", "/health").json()
    assert h["ok"] and h["mode"] == "simulation" and h["ready"]
    assert h["states"]["0"]["label"] == "LOGIN_CONNECTED"

    r = chamar(c, "POST", "/subscribe", {"tickers": [{"ticker": "winz26", "exchange": "f"}]})
    assert r.json()["subscriptions"] == ["WINZ26/F"]

    q = chamar(c, "GET", "/quote/WINZ26?exchange=F").json()
    assert q["ticker"] == "WINZ26" and q["last"] > 0 and q["bid"] < q["ask"]

    # sem execuções ainda
    assert chamar(c, "GET", "/trades").json() == {"trades": [], "next_since": None}

    f1 = chamar(c, "POST", "/sim/fill", {"ticker": "WINZ26", "exchange": "F", "side": 1, "quantity": 2, "price": 141000}).json()["fill"]
    time.sleep(0.01)
    f2 = chamar(c, "POST", "/sim/fill", {"ticker": "WINZ26", "exchange": "F", "side": 2, "quantity": 2, "price": 141100}).json()["fill"]

    t = chamar(c, "GET", "/trades").json()
    assert [x["id"] for x in t["trades"]] == [f1["id"], f2["id"]]
    assert t["next_since"] == f2["executed_at"]

    # cursor: nada novo depois do último
    t2 = chamar(c, "GET", f"/trades?since={t['next_since']}").json()
    assert t2["trades"] == [] and t2["next_since"] == t["next_since"]

    # posição zerada após compra e venda; ordens registradas
    assert chamar(c, "GET", "/positions").json()["positions"] == []
    ordens = chamar(c, "GET", "/orders").json()["orders"]
    assert len(ordens) == 2 and ordens[0]["status"] == 2

    f3 = chamar(c, "POST", "/sim/fill", {"ticker": "PETR4", "exchange": "B", "side": 1, "quantity": 100, "price": 38.5}).json()["fill"]
    pos = chamar(c, "GET", "/positions").json()["positions"]
    assert pos == [{"ticker": "PETR4", "exchange": "B", "quantity": 100, "average_price": 38.5, "source": "fills"}]
    assert f3["fees"] == 90.0


def test_websocket_assinado(cliente):
    c, backend = cliente
    ts = int(time.time())
    sig = assinar(TOKEN, "GET", "/ws", b"", ts)
    with c.websocket_connect(f"/ws?ts={ts}&sig={sig}") as ws:
        ws.send_json({"subscribe": [{"ticker": "PETR4", "exchange": "B"}]})
        msg = ws.receive_json()
        assert msg["type"] == "quote" and msg["ticker"] == "PETR4"
        backend.simular_execucao("PETR4", "B", side=1, quantity=10, price=38.0)
        tipos = {msg["type"]}
        for _ in range(10):
            m = ws.receive_json()
            tipos.add(m["type"])
            if "fill" in tipos:
                break
        assert "fill" in tipos
    with pytest.raises(Exception):
        with c.websocket_connect("/ws?ts=1&sig=00") as ws:
            ws.receive_json()
