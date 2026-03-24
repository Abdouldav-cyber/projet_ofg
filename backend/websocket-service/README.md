# Djembé Bank - WebSocket Service

Service de notifications temps réel pour Djembé Bank.

## Démarrage

### Installation des dépendances
```bash
cd backend/websocket-service
pip install -r requirements.txt
```

### Lancer le serveur
```bash
python main.py
```

Le serveur démarre sur `ws://localhost:8080`.

## Configuration

Variables d'environnement:
- `WS_PORT`: Port du serveur (défaut: 8080)
- `JWT_SECRET`: Clé secrète JWT (doit correspondre à l'API)
- `REDIS_URL`: URL Redis (défaut: redis://localhost:6379/0)

## Connexion Client

### Format d'URL
```
ws://localhost:8080?token=YOUR_JWT_TOKEN
```

### Exemple JavaScript
```javascript
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const ws = new WebSocket(`ws://localhost:8080?token=${token}`);

ws.onopen = () => {
    console.log('✅ Connecté au serveur WebSocket');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('📨 Message reçu:', data);

    switch(data.type) {
        case 'connected':
            console.log(`Bienvenue ${data.email}`);
            break;
        case 'transaction':
            console.log('Transaction complétée:', data.data);
            break;
        case 'balance_update':
            console.log('Solde mis à jour:', data.data);
            break;
    }
};

// Heartbeat
setInterval(() => {
    ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);
```

## Types d'Événements

### Événements Reçus

#### 1. Connected
```json
{
    "type": "connected",
    "user_id": "uuid",
    "email": "user@example.com",
    "timestamp": "2025-01-15T10:30:00Z"
}
```

#### 2. Transaction Completed
```json
{
    "type": "transaction",
    "event": "completed",
    "data": {
        "transaction_id": "uuid",
        "from_account": "uuid",
        "to_account": "uuid",
        "amount": "10000",
        "currency": "XOF"
    },
    "timestamp": "2025-01-15T10:30:00Z"
}
```

#### 3. Balance Update
```json
{
    "type": "balance_update",
    "data": {
        "account_id": "uuid",
        "new_balance": "50000",
        "currency": "XOF"
    },
    "timestamp": "2025-01-15T10:30:00Z"
}
```

#### 4. Generic Notification
```json
{
    "type": "notification",
    "data": {
        "title": "Nouveau message",
        "message": "Votre KYC a été validé"
    },
    "timestamp": "2025-01-15T10:30:00Z"
}
```

### Événements Envoyés

#### Ping
```json
{
    "type": "ping"
}
```

#### Subscribe to Channel
```json
{
    "type": "subscribe",
    "channel": "transactions"
}
```

## Publication d'Événements (Backend)

Depuis l'API backend, publier des événements via Redis Pub/Sub:

```python
import redis
import json

redis_client = redis.Redis.from_url("redis://localhost:6379/0")

# Publier événement de transaction
event = {
    "transaction_id": str(transaction.id),
    "from_user_id": str(from_user.id),
    "to_user_id": str(to_user.id),
    "amount": str(amount),
    "currency": currency
}
redis_client.publish("transactions.completed", json.dumps(event))

# Publier mise à jour de solde
event = {
    "user_id": str(user.id),
    "account_id": str(account.id),
    "balance": str(new_balance),
    "currency": currency
}
redis_client.publish("account.updated", json.dumps(event))
```

## Monitoring

Le serveur affiche des logs en temps réel:
- ✅ Connexions
- ❌ Déconnexions
- 📢 Événements Redis reçus
- 💔 Timeouts heartbeat

## Production

Pour la production:
1. Utiliser un process manager (systemd, supervisord)
2. Configurer un reverse proxy (nginx, caddy)
3. Activer TLS/SSL (wss://)
4. Scaler horizontalement avec Redis comme message broker
