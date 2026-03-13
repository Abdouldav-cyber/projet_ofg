@echo off
echo ==========================================
echo   Djembé Bank - Démarrage du Backend
echo ==========================================

echo [1/3] Lancement de l'infrastructure Docker (DB, Redis, Kafka)...
docker-compose up -d

echo [2/3] Installation des dépendances Python...
cd backend/core-service
pip install -r requirements.txt

echo [3/3] Lancement du service API...
python main.py

pause
