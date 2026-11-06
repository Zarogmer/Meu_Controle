# Conector Nelogica (ProfitDLL) — Meu Controle

Serviço Windows que fica entre a **ProfitDLL** (Nelogica, usada pela Ágora)
e o **Meu Controle**. Ele carrega a DLL com a licença e o login do próprio
usuário e expõe uma API local assinada por HMAC, que o Meu Controle consulta
para puxar execuções, posições, ordens e cotações.

```
[Navegador] ⇄ [Next.js / Railway] ⇄ HTTPS + WebSocket (HMAC) ⇄ [este conector, no Windows do usuário] ⇄ ProfitDLL ⇄ Nelogica ⇄ Ágora
```

## Por que Python + ctypes (e não C#)

- A documentação oficial da Nelogica traz os exemplos em **Python/ctypes**
  (inclusive o tutorial de Linux/Wine), então as assinaturas aqui são
  cópias fiéis do que está publicado, não traduções.
- Um único `python.exe` + `.venv` roda como serviço (NSSM) e não precisa de
  Visual Studio nem build.
- FastAPI/uvicorn entregam HTTP e WebSocket no mesmo processo.
- Contra: a DLL exige **Python 64 bits** e disciplina com `WinDLL`,
  `WINFUNCTYPE` e referências vivas de callback — tudo isso está em
  `connector/profit_dll.py`, com comentários apontando o artigo de origem.

## Linux?

A Nelogica confirma que a DLL **não tem versão nativa para Linux** e não dá
suporte a outros sistemas. O único caminho documentado é rodar o
`python.exe` **do Windows** dentro do **Wine** (artigo "ProfitDLL no Linux").
Isso funciona para o conector (é o mesmo código), mas **não** dentro do
Next.js no Railway. Portanto o desenho continua: o conector roda no
computador do usuário (Windows, ou Linux + Wine por conta e risco dele).

## Requisitos

- Windows 10/11 64 bits (ou Linux + Wine seguindo o artigo da Nelogica).
- Python **3.11+ 64 bits**.
- Pacote oficial da ProfitDLL: copie **todo** o conteúdo de `DLLs/Win64`
  (DLL principal, dependências, `.dat` e o `profitTypes.py`) para uma pasta,
  ex. `C:\ProfitDLL\Win64`. Não copie só a `ProfitDLL.dll`.
- Licença ativa da ProfitDLL, chave de ativação e login Nelogica
  (a senha de **login**, não a de roteamento).
- A mesma licença não pode estar conectada por outra instância da DLL.

## Instalação

```powershell
cd connectors\nelogica
copy .env.example .env
py -3 -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python run.py --gerar-token     # cole em CONNECTOR_TOKEN e no Meu Controle
notepad .env                                  # preencha chave, usuário, senha, PROFITDLL_DIR
service\run.bat                               # teste em primeiro plano
```

Com `/health` respondendo, instale como serviço (PowerShell como administrador,
NSSM em https://nssm.cc):

```powershell
.\service\install-service.ps1 -NssmPath "C:\nssm\nssm.exe"
```

Logs: `logs\conector.log` (aplicação) e `logs\service-*.log` (serviço).
Os logs da própria DLL ficam na pasta `Logs` ao lado do `python.exe`
(comportamento documentado pela Nelogica para Python).

## Expondo para o Meu Controle (TLS obrigatório)

O conector escuta em `127.0.0.1:8787`, sem TLS. **Nunca abra essa porta na
internet.** Use um túnel que termine TLS:

- **Cloudflare Tunnel** (recomendado, gratuito): `cloudflared tunnel --url http://127.0.0.1:8787`
  dá uma URL `https://...trycloudflare.com`; para algo fixo, crie um túnel
  nomeado com seu domínio.
- ngrok, Tailscale Funnel etc. também servem.
- Alternativa sem túnel: `CONNECTOR_SSL_CERT`/`CONNECTOR_SSL_KEY` com um
  certificado válido e porta liberada no roteador.

No Meu Controle (Investimentos → Conexões) informe a URL pública e o mesmo
`CONNECTOR_TOKEN`. O app só aceita `https://` em produção.

Se o túnel publicar em um sub-caminho (ex.: `https://meusite/conector`),
defina `CONNECTOR_PATH_PREFIX=/conector` para a assinatura bater.

## Segurança

- Toda chamada traz `X-Timestamp` e `X-Signature = HMAC-SHA256(token,
  "<ts>.<MÉTODO>.<path+query>.<sha256(body)>")`. O token nunca trafega.
  Janela de replay de 300 s. O WebSocket usa `?ts=&sig=` assinando `GET /ws`.
- O Meu Controle guarda o token cifrado (AES-256-GCM). A senha da Nelogica
  e a chave de ativação ficam **só** no `.env` desta máquina.
- A senha de roteamento (ordens) não é usada nesta fase. Fase 4 só entra
  atrás de feature flag.

## Modo simulação

`PROFIT_SIMULATION=1` sobe o serviço sem a DLL, gerando cotações falsas para
os ativos assinados. `POST /sim/fill` injeta execuções. Use para validar o
túnel, o token e a sincronização antes de ligar a licença — funciona em
qualquer sistema (é assim que os testes automatizados rodam).

## API

| Rota | Descrição |
|---|---|
| `GET /health` | estado das 4 conexões (login, roteamento, market data, ativação), conta, assinaturas, erros recentes |
| `GET /positions` | posição por ativo calculada pelas execuções vistas (`source: fills`) |
| `GET /orders?since=&ticker=` | ordens conhecidas (GetOrderDetails) |
| `GET /trades?since=<ISO>` | execuções da conta desde o cursor; devolve `next_since` |
| `GET /quote/{ticker}?exchange=F` | última cotação (assina o ativo se preciso) |
| `POST /subscribe` / `POST /unsubscribe` | `{"tickers":[{"ticker":"WINZ26","exchange":"F"}]}` |
| `WS /ws?ts=&sig=` | eventos `quote`, `fill`, `order`, `state` |

## O que vem da documentação e o que ficou como TODO

Tudo em `connector/profit_types.py` e `connector/profit_dll.py` cita o artigo
de origem (`[PP]`, `[RT]`, `[HT]`, `[RO]`, `[LX]`). Assinaturas **não**
publicadas nos artigos não foram inventadas:

- `TConnectorOrderOut`, `TConnectorAccountIdentifierOut` e
  `TConnectorTradingMessageResult`: importados do `profitTypes.py` do SDK.
  Sem esse arquivo, `GetOrderDetails`/`GetAccounts` ficam desativados e o
  `/health` avisa (`sdk_types: false`).
- Callbacks passados na inicialização (`THistoryCallback`,
  `TOrderChangeCallback`, `TAccountCallback`, `TNewTradeCallback`,
  `TNewDailyCallback`, `TPriceBookCallback`, `TOfferBookCallback`): vão como
  `None`; usamos os `Set*Callback` documentados depois do init.
- `GetPosition`/`GetPositionV2`: não consta nos artigos consultados. A posição
  é calculada pelas execuções vistas pelo conector; o Meu Controle, por sua
  vez, calcula a carteira pelo histórico completo de operações.
- Execuções: a DLL entrega o acumulado por ordem (`TradedQuantity`,
  `AveragePrice`). O conector registra o **delta** a preço médio. Execuções
  que aconteceram antes de o serviço subir não são recuperadas (sem
  assinatura documentada para histórico de ordens).

## Testes

```powershell
.venv\Scripts\pip install pytest httpx
.venv\Scripts\python -m pytest
```
