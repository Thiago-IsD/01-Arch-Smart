from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.core.security import get_context
from app.db.session import get_db
from app.models.all_models import User, Account, Subscription, Plan
from app.schemas.user import UserProfileResponse, AccountInfo, UserProfileUpdate


router = APIRouter()



async def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db)
) -> User:
    """
    Compatibilidade: os endpoints ainda nao convertidos para `RequestContext`
    dependem desta funcao. Ela NAO tem logica propria — delega para
    `app.core.security`, de modo que auto-link e auto-create estejam mortos
    para os dois caminhos. Some quando a ultima rota migrar (Tarefa 15).
    """
    ctx = await get_context(authorization=authorization, db=db)
    usuario = db.get(User, ctx.user_id)
    if usuario is None:  # pragma: no cover - get_context ja garantiu
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")
    return usuario


from app.utils.supabase_client import get_storage_client


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user's profile.
    Returns user data with account and subscription information.
    """
    # Get account with subscription
    account = db.query(Account).filter(Account.id == current_user.account_id).first()
    
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
    
    # Generate Signed URL for logo if it's a private path
    logo_response_url = account.logo_url
    if account.logo_url and not account.logo_url.startswith("http"):
        try:
            storage_client = get_storage_client()
            logo_response_url = await storage_client.create_signed_url(
                bucket="secure-files", 
                path=account.logo_url
            )
        except Exception as e:
            print(f"⚠️ Failed to sign logo URL: {e}")

    # Build response
    account_info = AccountInfo(
        id=account.id,
        name=account.name,
        subscription_status=subscription_status,
        plan_name=plan_name,
        company_name=account.company_name,
        logo_url=logo_response_url
    )
    
    return UserProfileResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        avatar_url=None,  # TODO: Implement avatar storage
        role="admin" if account.is_active else "user",  # Simplified role logic
        account=account_info
    )


@router.put("/profile", response_model=UserProfileResponse)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile (full_name).
    """
    # Update full_name
    current_user.full_name = profile_data.full_name
    db.commit()
    db.refresh(current_user)
    
    # Get account info for response
    account = db.query(Account).filter(Account.id == current_user.account_id).first()
    subscription = db.query(Subscription).filter(Subscription.account_id == account.id).first()
    plan_name = None
    subscription_status = "BETA"
    
    if subscription:
        subscription_status = subscription.status
        if subscription.plan_id:
            plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
            if plan:
                plan_name = plan.name
    
    # Generate Signed URL for logo if it's a private path
    logo_response_url = account.logo_url
    if account.logo_url and not account.logo_url.startswith("http"):
        try:
            storage_client = get_storage_client()
            logo_response_url = await storage_client.create_signed_url(
                bucket="secure-files", 
                path=account.logo_url
            )
        except Exception as e:
            print(f"⚠️ Failed to sign logo URL: {e}")

    account_info = AccountInfo(
        id=account.id,
        name=account.name,
        subscription_status=subscription_status,
        plan_name=plan_name,
        company_name=account.company_name,
        logo_url=logo_response_url
    )
    
    return UserProfileResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        avatar_url=None,
        role="admin" if account.is_active else "user",
        account=account_info
    )

