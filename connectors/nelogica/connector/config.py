"""Configuração via variáveis de ambiente / arquivo .env."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _carregar_dotenv(caminho: Path) -> None:
    """Loader mínimo de .env (sem dependência externa)."""
    if not caminho.is_file():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        chave = chave.strip()
        valor = valor.strip().strip('"').strip("'")
        os.environ.setdefault(chave, valor)


@dataclass(frozen=True)
class Config:
    token: str
    activation_key: str
    user: str
    password: str
    dll_dir: Path
    mode: str  # "routing" | "market"
    broker_id: int | None
    account_id: str | None
    host: str
    port: int
    ssl_cert: str | None
    ssl_key: str | None
    path_prefix: str
    simulation: bool
    sim_auto_fills: bool
    log_level: str
    log_dir: Path

    @property
    def routing(self) -> bool:
        return self.mode == "routing"


def carregar(base_dir: Path | None = None) -> Config:
    base = base_dir or Path(__file__).resolve().parent.parent
    _carregar_dotenv(base / ".env")

    def env(nome: str, padrao: str = "") -> str:
        return os.environ.get(nome, padrao).strip()

    simulation = env("PROFIT_SIMULATION", "0") in ("1", "true", "True")
    token = env("CONNECTOR_TOKEN")
    if len(token) < 16:
        raise SystemExit("CONNECTOR_TOKEN precisa ter ao menos 16 caracteres (gere com: python run.py --gerar-token)")

    if not simulation:
        faltando = [n for n in ("PROFIT_ACTIVATION_KEY", "PROFIT_USER", "PROFIT_PASSWORD") if not env(n)]
        if faltando:
            raise SystemExit(f"Faltam variáveis: {', '.join(faltando)} (ou use PROFIT_SIMULATION=1)")

    prefix = env("CONNECTOR_PATH_PREFIX", "")
    if prefix and not prefix.startswith("/"):
        prefix = "/" + prefix
    prefix = prefix.rstrip("/")

    broker = env("PROFIT_BROKER_ID")
    return Config(
        token=token,
        activation_key=env("PROFIT_ACTIVATION_KEY"),
        user=env("PROFIT_USER"),
        password=env("PROFIT_PASSWORD"),
        dll_dir=Path(env("PROFITDLL_DIR", r"C:\ProfitDLL\Win64")),
        mode="market" if env("PROFIT_MODE", "routing").lower() == "market" else "routing",
        broker_id=int(broker) if broker.isdigit() else None,
        account_id=env("PROFIT_ACCOUNT_ID") or None,
        host=env("CONNECTOR_HOST", "127.0.0.1"),
        port=int(env("CONNECTOR_PORT", "8787")),
        ssl_cert=env("CONNECTOR_SSL_CERT") or None,
        ssl_key=env("CONNECTOR_SSL_KEY") or None,
        path_prefix=prefix,
        simulation=simulation,
        sim_auto_fills=env("SIM_AUTO_FILLS", "0") in ("1", "true", "True"),
        log_level=env("LOG_LEVEL", "INFO").upper(),
        log_dir=base / env("LOG_DIR", "logs"),
    )
