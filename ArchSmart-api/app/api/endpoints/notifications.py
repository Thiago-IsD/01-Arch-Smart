from fastapi import APIRouter, Depends, HTTPException
from typing import List
from pydantic import BaseModel
from datetime import datetime
import uuid as uuid_module

from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Notification

router = APIRouter()

class NotificationResponse(BaseModel):
    id: str
    account_id: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Get all notifications for the current user's account, ordered by newest first.
    """
    notifications = (
        repo.query(Notification)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    # Format IDs to string
    response = []
    for n in notifications:
        response.append(NotificationResponse(
            id=str(n.id),
            account_id=str(n.account_id),
            title=n.title,
            message=n.message,
            is_read=n.is_read,
            created_at=n.created_at
        ))

    return response

@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Mark a specific notification as read.
    """
    try:
        nid = uuid_module.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de identificador de notificação inválido")

    notification = repo.obter(Notification, nid)

    notification.is_read = True
    repo.db.commit()

    return {"success": True, "is_read": True}
