"""
Serveur WebSocket pour notifications temps réel - Djembe Bank
Gere les connexions WebSocket authentifiees et la publication d'evenements
"""
import asyncio
import json
import os
from datetime import datetime
from typing import Dict, Set
from urllib.parse import urlparse, parse_qs
import websockets
import redis.asyncio as aioredis
from jose import jwt, JWTError


# Configuration
WS_PORT = int(os.getenv("WS_PORT", "8080"))
JWT_SECRET = os.getenv("JWT_SECRET", "djembe-bank-secret-key-2024-change-me-in-production")
ALGORITHM = "HS256"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Gestion des clients connectes
# Structure: {user_id: {websocket1, websocket2, ...}}
clients: Dict[str, Set] = {}

# Client Redis pour Pub/Sub
redis_client: aioredis.Redis = None


async def authenticate_connection(token: str) -> dict:
    """
    Authentifie une connexion WebSocket via token JWT
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])

        user_id = payload.get("user_id")
        email = payload.get("sub")
        role = payload.get("role")
        tenant_id = payload.get("tenant_id")

        if not user_id or not email:
            raise ValueError("Token invalide: informations manquantes")

        return {
            "user_id": user_id,
            "email": email,
            "role": role,
            "tenant_id": tenant_id
        }

    except JWTError as e:
        raise Exception(f"Authentification echouee: {str(e)}")


async def register_client(websocket, user_id: str):
    if user_id not in clients:
        clients[user_id] = set()
    clients[user_id].add(websocket)
    print(f"Client connecte: {user_id} (Total: {len(clients[user_id])} connexions)")


async def unregister_client(websocket, user_id: str):
    if user_id in clients:
        clients[user_id].discard(websocket)
        if not clients[user_id]:
            del clients[user_id]
    print(f"Client deconnecte: {user_id} (Reste: {len(clients.get(user_id, []))} connexions)")


async def send_to_user(user_id: str, message: dict):
    if user_id not in clients:
        return

    disconnected = set()
    for websocket in clients[user_id]:
        try:
            await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            disconnected.add(websocket)

    for ws in disconnected:
        await unregister_client(ws, user_id)


async def broadcast_to_tenant(tenant_id: str, message: dict):
    for user_id in list(clients.keys()):
        await send_to_user(user_id, message)


async def handle_client_message(websocket, user_id: str, message: str):
    try:
        data = json.loads(message)
        message_type = data.get("type")

        if message_type == "ping":
            await websocket.send(json.dumps({"type": "pong", "timestamp": datetime.utcnow().isoformat()}))

        elif message_type == "subscribe":
            channel = data.get("channel")
            print(f"{user_id} s'abonne a {channel}")

        else:
            print(f"Type de message inconnu: {message_type}")

    except json.JSONDecodeError:
        print(f"Message JSON invalide de {user_id}: {message}")


async def redis_listener():
    global redis_client

    redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()

    await pubsub.subscribe(
        "transactions.completed",
        "account.updated",
        "notification.new",
        "chat.message",
        "chat.typing"
    )

    print("Redis listener demarre. En ecoute des evenements...")

    async for message in pubsub.listen():
        if message["type"] == "message":
            channel = message["channel"]
            data = json.loads(message["data"])

            print(f"Evenement recu sur {channel}: {data}")

            if channel == "transactions.completed":
                from_user_id = data.get("from_user_id")
                to_user_id = data.get("to_user_id")

                notification = {
                    "type": "transaction",
                    "event": "completed",
                    "data": data,
                    "timestamp": datetime.utcnow().isoformat()
                }

                if from_user_id:
                    await send_to_user(from_user_id, notification)
                if to_user_id:
                    await send_to_user(to_user_id, notification)

            elif channel == "account.updated":
                user_id = data.get("user_id")

                notification = {
                    "type": "balance_update",
                    "data": {
                        "account_id": data.get("account_id"),
                        "new_balance": data.get("balance"),
                        "currency": data.get("currency")
                    },
                    "timestamp": datetime.utcnow().isoformat()
                }

                if user_id:
                    await send_to_user(user_id, notification)

            elif channel == "notification.new":
                user_id = data.get("user_id")
                if user_id:
                    await send_to_user(user_id, {
                        "type": "notification",
                        "data": data,
                        "timestamp": datetime.utcnow().isoformat()
                    })

            elif channel == "chat.message":
                target_user_id = data.get("target_user_id")
                sender_id = data.get("sender_id")

                chat_notification = {
                    "type": "chat.message",
                    "data": {
                        "ticket_id": data.get("ticket_id"),
                        "message_id": data.get("message_id"),
                        "sender_id": sender_id,
                        "sender_name": data.get("sender_name"),
                        "sender_role": data.get("sender_role"),
                        "message": data.get("message"),
                        "message_type": data.get("message_type", "text"),
                    },
                    "timestamp": data.get("timestamp", datetime.utcnow().isoformat())
                }

                if target_user_id:
                    await send_to_user(target_user_id, chat_notification)
                if sender_id and sender_id != target_user_id:
                    await send_to_user(sender_id, chat_notification)

            elif channel == "chat.typing":
                target_user_id = data.get("target_user_id")
                if target_user_id:
                    await send_to_user(target_user_id, {
                        "type": "chat.typing",
                        "data": {
                            "ticket_id": data.get("ticket_id"),
                            "user_id": data.get("user_id"),
                            "user_name": data.get("user_name"),
                            "is_typing": data.get("is_typing", True),
                        },
                        "timestamp": datetime.utcnow().isoformat()
                    })


async def handle_connection(websocket):
    """
    Gere une connexion WebSocket (websockets v13+ API)
    """
    user_data = None
    user_id = None

    try:
        # Extraire le token depuis les query params de la requete
        # websockets v13+: websocket.request contient la requete HTTP
        path = websocket.request.path
        parsed = urlparse(path)
        params = parse_qs(parsed.query)
        token = params.get("token", [None])[0]

        if not token:
            await websocket.close(1008, "Token manquant")
            return

        # Authentifier
        user_data = await authenticate_connection(token)
        user_id = user_data["user_id"]

        # Enregistrer le client
        await register_client(websocket, user_id)

        # Envoyer message de confirmation
        await websocket.send(json.dumps({
            "type": "connected",
            "user_id": user_id,
            "email": user_data["email"],
            "timestamp": datetime.utcnow().isoformat()
        }))

        # Heartbeat task
        async def heartbeat():
            while True:
                try:
                    await asyncio.sleep(30)
                    pong = await websocket.ping()
                    await asyncio.wait_for(pong, timeout=10)
                except asyncio.TimeoutError:
                    print(f"Heartbeat timeout pour {user_id}")
                    break
                except websockets.exceptions.ConnectionClosed:
                    break

        heartbeat_task = asyncio.create_task(heartbeat())

        # Boucle de reception des messages
        async for message in websocket:
            await handle_client_message(websocket, user_id, message)

        heartbeat_task.cancel()

    except Exception as e:
        print(f"Erreur de connexion: {str(e)}")
        try:
            await websocket.close(1011, str(e))
        except Exception:
            pass

    finally:
        if user_id:
            await unregister_client(websocket, user_id)


async def main():
    print("=" * 60)
    print("Djembe Bank WebSocket Server")
    print("=" * 60)
    print(f"Port: {WS_PORT}")
    print(f"JWT Secret: {JWT_SECRET[:10]}...")
    print(f"Redis URL: {REDIS_URL}")
    print("=" * 60)

    # Demarrer le listener Redis en background
    asyncio.create_task(redis_listener())

    # Demarrer le serveur WebSocket
    async with websockets.serve(handle_connection, "0.0.0.0", WS_PORT):
        print(f"Serveur WebSocket demarre sur ws://0.0.0.0:{WS_PORT}")
        print("Format de connexion: ws://localhost:8080?token=YOUR_JWT_TOKEN")
        print("\nEn attente de connexions...\n")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nArret du serveur WebSocket...")
