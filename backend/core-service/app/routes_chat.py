"""
Routes Chat Live Support pour Djembe Bank
Gere la messagerie temps reel entre clients et agents support
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, desc
from typing import List, Optional
from pydantic import UUID4
from datetime import datetime
import json

from app.database import get_db_with_tenant
from app.models import ChatMessage, SupportTicket, User
from app.schemas import ChatMessageCreate, ChatMessageResponse
from app.rbac import get_current_user, CurrentUser

router = APIRouter(prefix="/chat", tags=["Chat Live Support"])


def try_publish_redis(channel: str, data: dict):
    """Publie un evenement Redis pour notification temps reel (non bloquant)."""
    try:
        import redis
        r = redis.Redis(host="localhost", port=6379, db=0)
        r.publish(channel, json.dumps(data))
        r.close()
    except Exception:
        pass  # Redis optionnel - ne pas bloquer si indisponible


@router.get("/tickets/{ticket_id}/messages", response_model=List[ChatMessageResponse])
async def get_chat_messages(
    ticket_id: UUID4,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_with_tenant)
):
    """
    Recupere les messages d'un ticket de support.
    Les clients ne voient que leurs tickets. Les agents voient tous les tickets.
    """
    # Verifier que le ticket existe
    ticket = db.query(SupportTicket).filter(SupportTicket.id == str(ticket_id)).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket introuvable")

    # Verifier l'acces : client ne voit que ses tickets
    if current_user.role == "customer" and str(ticket.user_id) != current_user.user_id:
        raise HTTPException(status_code=403, detail="Acces refuse a ce ticket")

    # Recuperer les messages
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.ticket_id == str(ticket_id))
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Enrichir avec le nom de l'expediteur
    result = []
    for msg in messages:
        sender = db.query(User).filter(User.id == str(msg.sender_id)).first()
        sender_name = f"{sender.first_name} {sender.last_name}" if sender else "Systeme"

        result.append(ChatMessageResponse(
            id=msg.id,
            ticket_id=msg.ticket_id,
            sender_id=msg.sender_id,
            sender_role=msg.sender_role,
            sender_name=sender_name,
            message=msg.message,
            message_type=msg.message_type or "text",
            file_url=msg.file_url,
            is_read=msg.is_read if isinstance(msg.is_read, bool) else str(msg.is_read).lower() == "true",
            created_at=msg.created_at
        ))

    return result


@router.post("/tickets/{ticket_id}/messages", response_model=ChatMessageResponse, status_code=201)
async def send_chat_message(
    ticket_id: UUID4,
    message_data: ChatMessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_with_tenant)
):
    """
    Envoie un message dans le chat d'un ticket.
    Met a jour le statut du ticket si necessaire.
    """
    # Verifier que le ticket existe
    ticket = db.query(SupportTicket).filter(SupportTicket.id == str(ticket_id)).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket introuvable")

    # Verifier l'acces
    if current_user.role == "customer" and str(ticket.user_id) != current_user.user_id:
        raise HTTPException(status_code=403, detail="Acces refuse a ce ticket")

    # Verifier que le ticket n'est pas ferme
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="Ce ticket est ferme. Impossible d'envoyer un message.")

    # Determiner le role de l'expediteur
    sender_role = current_user.role
    if sender_role not in ("customer", "support_l1", "support_l2", "country_admin", "super_admin"):
        sender_role = "customer"

    # Creer le message
    chat_msg = ChatMessage(
        ticket_id=str(ticket_id),
        sender_id=current_user.user_id,
        sender_role=sender_role,
        message=message_data.message,
        message_type=message_data.message_type or "text",
        file_url=message_data.file_url
    )
    db.add(chat_msg)

    # Si un agent repond et le ticket est "open", passer en "in_progress"
    if sender_role in ("support_l1", "support_l2", "country_admin", "super_admin"):
        if ticket.status == "open":
            ticket.status = "in_progress"
            ticket.assigned_to = current_user.user_id
            ticket.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(chat_msg)

    # Enrichir avec le nom
    sender = db.query(User).filter(User.id == current_user.user_id).first()
    sender_name = f"{sender.first_name} {sender.last_name}" if sender else "Systeme"

    # Publier sur Redis pour notification WebSocket
    ws_payload = {
        "ticket_id": str(ticket_id),
        "message_id": str(chat_msg.id),
        "sender_id": current_user.user_id,
        "sender_name": sender_name,
        "sender_role": sender_role,
        "message": message_data.message,
        "message_type": message_data.message_type or "text",
        "timestamp": chat_msg.created_at.isoformat() if chat_msg.created_at else datetime.utcnow().isoformat()
    }

    # Notifier le destinataire via Redis
    if sender_role == "customer":
        # Client envoie → notifier l'agent assigne
        if ticket.assigned_to:
            ws_payload["target_user_id"] = str(ticket.assigned_to)
    else:
        # Agent envoie → notifier le client
        ws_payload["target_user_id"] = str(ticket.user_id)

    try_publish_redis("chat.message", ws_payload)

    return ChatMessageResponse(
        id=chat_msg.id,
        ticket_id=chat_msg.ticket_id,
        sender_id=chat_msg.sender_id,
        sender_role=chat_msg.sender_role,
        sender_name=sender_name,
        message=chat_msg.message,
        message_type=chat_msg.message_type or "text",
        file_url=chat_msg.file_url,
        is_read=False,
        created_at=chat_msg.created_at
    )


@router.patch("/tickets/{ticket_id}/messages/read")
async def mark_messages_read(
    ticket_id: UUID4,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_with_tenant)
):
    """Marque tous les messages d'un ticket comme lus pour l'utilisateur courant."""
    # Verifier que le ticket existe
    ticket = db.query(SupportTicket).filter(SupportTicket.id == str(ticket_id)).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket introuvable")

    # Marquer les messages non envoyes par l'utilisateur courant comme lus
    db.query(ChatMessage).filter(
        ChatMessage.ticket_id == str(ticket_id),
        ChatMessage.sender_id != current_user.user_id
    ).update({"is_read": True})

    db.commit()

    return {"message": "Messages marques comme lus"}


@router.get("/tickets/{ticket_id}/unread-count")
async def get_unread_count(
    ticket_id: UUID4,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_with_tenant)
):
    """Retourne le nombre de messages non lus pour un ticket."""
    count = db.query(ChatMessage).filter(
        ChatMessage.ticket_id == str(ticket_id),
        ChatMessage.sender_id != current_user.user_id,
        ChatMessage.is_read == text("'false'")
    ).count()

    return {"ticket_id": str(ticket_id), "unread_count": count}


@router.get("/unread-total")
async def get_total_unread(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_with_tenant)
):
    """
    Retourne le total de messages non lus pour l'utilisateur courant.
    Pour les agents : messages non lus de tous les tickets assignes.
    Pour les clients : messages non lus de leurs tickets.
    """
    query = db.query(ChatMessage).filter(
        ChatMessage.sender_id != current_user.user_id,
        ChatMessage.is_read == text("'false'")
    )

    if current_user.role == "customer":
        # Ne compter que les tickets du client
        ticket_ids = db.query(SupportTicket.id).filter(
            SupportTicket.user_id == current_user.user_id
        ).all()
        ticket_id_list = [str(t.id) for t in ticket_ids]
        query = query.filter(ChatMessage.ticket_id.in_(ticket_id_list))
    else:
        # Agent : tickets assignes ou non assignes (open)
        ticket_ids = db.query(SupportTicket.id).filter(
            (SupportTicket.assigned_to == current_user.user_id) |
            (SupportTicket.status == "open")
        ).all()
        ticket_id_list = [str(t.id) for t in ticket_ids]
        query = query.filter(ChatMessage.ticket_id.in_(ticket_id_list))

    count = query.count()
    return {"unread_total": count}


@router.post("/tickets/{ticket_id}/typing")
async def send_typing_indicator(
    ticket_id: UUID4,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_with_tenant)
):
    """Envoie un indicateur de frappe via WebSocket."""
    ticket = db.query(SupportTicket).filter(SupportTicket.id == str(ticket_id)).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket introuvable")

    sender = db.query(User).filter(User.id == current_user.user_id).first()
    sender_name = f"{sender.first_name} {sender.last_name}" if sender else "Utilisateur"

    typing_data = {
        "ticket_id": str(ticket_id),
        "user_id": current_user.user_id,
        "user_name": sender_name,
        "is_typing": True
    }

    # Determiner le destinataire
    if current_user.role == "customer" and ticket.assigned_to:
        typing_data["target_user_id"] = str(ticket.assigned_to)
    elif current_user.role != "customer":
        typing_data["target_user_id"] = str(ticket.user_id)

    try_publish_redis("chat.typing", typing_data)

    return {"message": "Indicateur de frappe envoye"}
