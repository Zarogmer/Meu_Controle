<#
Instala o conector como serviço do Windows usando o NSSM (https://nssm.cc).

Uso (PowerShell como administrador, na pasta connectors\nelogica):
  .\service\install-service.ps1 -NssmPath "C:\nssm\nssm.exe"

Antes: copie .env.example para .env e preencha; rode service\run.bat uma vez
para conferir que /health responde.
#>
param(
  [string]$NssmPath = "nssm.exe",
  [string]$ServiceName = "MeuControleNelogica"
)

$ErrorActionPreference = "Stop"
$base = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$python = Join-Path $base ".venv\Scripts\python.exe"
$runPy = Join-Path $base "run.py"
$logs = Join-Path $base "logs"

if (-not (Test-Path $python)) {
  Write-Host "Criando .venv e instalando dependências..."
  & py -3 -m venv (Join-Path $base ".venv")
  & $python -m pip install -r (Join-Path $base "requirements.txt")
}
New-Item -ItemType Directory -Force -Path $logs | Out-Null

if (-not (Test-Path (Join-Path $base ".env"))) {
  throw "Crie o arquivo .env (copie de .env.example) antes de instalar o serviço."
}

& $NssmPath install $ServiceName $python $runPy
& $NssmPath set $ServiceName AppDirectory $base
& $NssmPath set $ServiceName DisplayName "Meu Controle - Conector Nelogica"
& $NssmPath set $ServiceName Description "Ponte entre a ProfitDLL (Nelogica/Ágora) e o Meu Controle"
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName AppStdout (Join-Path $logs "service-stdout.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $logs "service-stderr.log")
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateBytes 5000000
# A DLL não deve ser reinicializada no mesmo processo: em falha, o NSSM reinicia o processo inteiro.
& $NssmPath set $ServiceName AppExit Default Restart
& $NssmPath set $ServiceName AppRestartDelay 10000

& $NssmPath start $ServiceName
Write-Host "Serviço $ServiceName instalado e iniciado. Logs em $logs"
