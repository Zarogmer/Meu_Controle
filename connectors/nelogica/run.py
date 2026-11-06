"""Ponto de entrada do conector.

    python run.py                 # sobe o serviço com o .env
    python run.py --gerar-token   # imprime um token novo para o .env e para o Meu Controle
"""
from __future__ import annotations

import logging
import secrets
import signal
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE))

from connector import config as config_mod  # noqa: E402
from connector.store import Store  # noqa: E402


def configurar_logs(cfg) -> None:
    cfg.log_dir.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    root = logging.getLogger()
    root.setLevel(cfg.log_level)
    arquivo = RotatingFileHandler(cfg.log_dir / "conector.log", maxBytes=5_000_000, backupCount=5, encoding="utf-8")
    arquivo.setFormatter(fmt)
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    root.handlers = [arquivo, console]


def main() -> None:
    if "--gerar-token" in sys.argv:
        print(secrets.token_hex(32))
        return

    cfg = config_mod.carregar(BASE)
    configurar_logs(cfg)
    log = logging.getLogger("conector")

    store = Store()
    if cfg.simulation:
        from connector.simulation import SimulationBackend
        backend = SimulationBackend(cfg, store)
    else:
        from connector.profit_dll import ProfitDLLBackend
        backend = ProfitDLLBackend(cfg, store)

    backend.start()

    import uvicorn
    from connector.server import criar_app

    app = criar_app(cfg, store, backend)

    def encerrar(*_):
        log.info("encerrando…")
        backend.stop()

    signal.signal(signal.SIGTERM, encerrar)
    try:
        uvicorn.run(
            app, host=cfg.host, port=cfg.port, log_level=cfg.log_level.lower(),
            ssl_certfile=cfg.ssl_cert, ssl_keyfile=cfg.ssl_key, ws_ping_interval=20, ws_ping_timeout=20,
        )
    finally:
        backend.stop()


if __name__ == "__main__":
    main()
