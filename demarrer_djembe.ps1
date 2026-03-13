# Script de demarrage securise pour Djembe Bank
# Force l'encodage UTF-8 pour eviter les erreurs Python/PostgreSQL sous Windows

$Host.UI.RawUI.WindowTitle = "Djembe Bank API - Backend"

# 1. Variables d'environnement pour l'encodage
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:PGCLIENTENCODING = "utf-8"
$env:LC_ALL = "C.UTF-8"
$env:LANG = "C.UTF-8"

# 2. Variables de connexion (au cas ou elles seraient polluees ailleurs)
$env:DATABASE_URL = "postgresql://admin:davou64598258@localhost:5432/djembe_bank"

Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host "   DEMARRAGE DE DJEMBE BANK CORE API (PYTHON 3.13)  " -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor Cyan
Write-Host "[*] Encodage UTF-8 force" -ForegroundColor Green
Write-Host "[*] Chemin : $PSScriptRoot"

# 3. Lancement de l'API
cd "$PSScriptRoot/backend/core-service"
& "$env:CONDA_PREFIX\python.exe" main.py
