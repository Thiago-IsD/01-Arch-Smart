from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime
import uuid as uuid_module

from app.db.session import get_db
from app.models.all_models import Notification, User
from app.api.users import get_current_user

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all notifications for the current user's account, ordered by newest first.
    """
    notifications = db.query(Notification).filter(
        Notification.account_id == current_user.account_id
    ).order_by(Notification.created_at.desc()).limit(50).all()
    
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark a specific notification as read.
    """
    try:
        nid = uuid_module.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID format")

    notification = db.query(Notification).filter(
        Notification.id == nid,
        Notification.account_id == current_user.account_id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    
    return {"success": True, "is_read": True}
