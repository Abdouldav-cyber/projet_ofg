# Utiliser une image Python legere
FROM python:3.13-slim

# Empecher Python de generer des fichiers .pyc et forcer l'UTF-8
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONUTF8=1

# Repertoire de travail
WORKDIR /app

# Installation des dependances systeme necessaires pour Psycopg2 et autres
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copie et installation des dependances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du reste du code
COPY . .

# Exposer le port de FastAPI
EXPOSE 8000

# Commande de demarrage (Uvicorn)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
