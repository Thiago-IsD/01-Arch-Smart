from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.models.all_models import User, Account, Subscription, Plan
from app.schemas.user import UserProfileResponse, AccountInfo
from app.services.auth_service import auth_service


router = APIRouter()


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """
    Dependency to extract and validate user ID from JWT token.
    Expects header: Authorization: Bearer <token>
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Verify token with Supabase and get user data
        user_data = await auth_service.get_user(token)
        return user_data["id"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user's profile.
    Returns user data with account and subscription information.
    """
    # Fetch user with related account and subscription
    user = db.query(User).filter(User.supabase_id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get account with subscription
    account = db.query(Account).filter(Account.id == user.account_id).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Get subscription and plan info
    subscription = db.query(Subscription).filter(Subscription.account_id == account.id).first()
    plan_name = None
    subscription_status = "BETA"  # Default
    
    if subscription:
        subscription_status = subscription.status
        if subscription.plan_id:
            plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
            if plan:
                plan_name = plan.name
    
    # Build response
    account_info = AccountInfo(
        id=account.id,
        name=account.name,
        subscription_status=subscription_status,
        plan_name=plan_name
    )
    
    return UserProfileResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        avatar_url=None,  # TODO: Implement avatar storage
        role="admin" if account.is_active else "user",  # Simplified role logic
        account=account_info
    )
