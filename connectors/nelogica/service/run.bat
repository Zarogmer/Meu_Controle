@echo off
REM Sobe o conector em primeiro plano (para testar antes de instalar como serviço).
cd /d "%~dp0\.."
if not exist .venv (
  py -3 -m venv .venv || python -m venv .venv
  .venv\Scripts\pip install -r requirements.txt
)
.venv\Scripts\python run.py
