param(
  [string]$NssmPath = "nssm.exe",
  [string]$ServiceName = "MeuControleNelogica"
)
$ErrorActionPreference = "Stop"
& $NssmPath stop $ServiceName
& $NssmPath remove $ServiceName confirm
Write-Host "Serviço $ServiceName removido."
