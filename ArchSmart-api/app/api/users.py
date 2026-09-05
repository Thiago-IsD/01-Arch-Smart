import logging

from fastapi import APIRouter, Depends, HTTPException

from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Account, Subscription, Plan, User
from app.schemas.user import UserProfileResponse, AccountInfo, UserProfileUpdate
from app.services.entitlements import entitlements_da_conta


router = APIRouter()
logger = logging.getLogger(__name__)


from app.utils.supabase_client import get_storage_client


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Get current authenticated user's profile.
    Returns user data with account and subscription information.
    """
    usuario = repo.obter(User, repo.ctx.user_id)
    db = repo.db

    # `accounts` e a unica tabela sem account_id — ela E a conta. Chegar nela
    # pelo ctx.account_id do contexto e o caminho certo; repo.query(Account)
    # levantaria EscopoImpossivel.
    account = db.query(Account).filter(Account.id == repo.ctx.account_id).first()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Subscription tem account_id: converte de verdade.
    subscription = repo.query(Subscription).first()
    plan_name = None
    subscription_status = "BETA"  # Default

    if subscription:
        subscription_status = subscription.status
        if subscription.plan_id:
            # `plans` e catalogo global, sem account_id: repo.query(Plan)
            # levantaria EscopoImpossivel.
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
            logger.warning("Falha ao assinar URL do logo: %s", e)

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
        id=usuario.id,
        full_name=usuario.full_name,
        email=usuario.email,
        avatar_url=None,  # TODO: Implement avatar storage
        role="admin" if account.is_active else "user",  # Simplified role logic
        account=account_info,
        entitlements=entitlements_da_conta(db, repo.ctx.account_id)
    )


@router.put("/profile", response_model=UserProfileResponse)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Update current user's profile (full_name).
    """
    usuario = repo.obter(User, repo.ctx.user_id)
    db = repo.db

    # Update full_name
    usuario.full_name = profile_data.full_name
    db.commit()
    db.refresh(usuario)

    # `accounts` e a unica tabela sem account_id — ela E a conta. Chegar nela
    # pelo ctx.account_id do contexto e o caminho certo; repo.query(Account)
    # levantaria EscopoImpossivel.
    account = db.query(Account).filter(Account.id == repo.ctx.account_id).first()
    # Subscription tem account_id: converte de verdade.
    subscription = repo.query(Subscription).first()
    plan_name = None
    subscription_status = "BETA"

    if subscription:
        subscription_status = subscription.status
        if subscription.plan_id:
            # `plans` e catalogo global, sem account_id: repo.query(Plan)
            # levantaria EscopoImpossivel.
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
            logger.warning("Falha ao assinar URL do logo: %s", e)

    account_info = AccountInfo(
        id=account.id,
        name=account.name,
        subscription_status=subscription_status,
        plan_name=plan_name,
        company_name=account.company_name,
        logo_url=logo_response_url
    )

    return UserProfileResponse(
        id=usuario.id,
        full_name=usuario.full_name,
        email=usuario.email,
        avatar_url=None,
        role="admin" if account.is_active else "user",
        account=account_info,
        entitlements=entitlements_da_conta(db, repo.ctx.account_id)
    )
