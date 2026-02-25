from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from starlette.concurrency import run_in_threadpool

from app.db.session import get_db
from app.models.all_models import User, Account, Subscription, Plan
from app.schemas.user import UserProfileResponse, AccountInfo, UserProfileUpdate
from app.services.auth_service import auth_service


router = APIRouter()



async def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to extract and validate user from JWT token.
    Handles legacy users by matching email if supabase_id is missing.
    Returns the User model instance.
    """
    print(f"\n🔐 DEBUG get_current_user called")
    print(f"Authorization header: {authorization[:50]}...")
    
    if not authorization.startswith("Bearer "):
        print("❌ Invalid authorization header format")
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    print(f"Token extracted: {token[:20]}...")
    
    try:
        # Verify token with Supabase and get user data
        print("🔍 Calling auth_service.get_user...")
        user_data = await auth_service.get_user(token)
        print(f"✅ User data received: {user_data.get('id')}, {user_data.get('email')}")
        
        supabase_id = user_data["id"]
        email = user_data.get("email")
        
        # 1. DB Operations need to run in threadpool to avoid blocking main event loop
        def _db_operations():
            # Try to find by supabase_id
            user = db.query(User).filter(User.supabase_id == supabase_id).first()
            if user:
                print(f"✅ User found by supabase_id: {user.id}")
                return user
                
            # If not found and we have email, try to find by email (Legacy/Migration)
            if email:
                user = db.query(User).filter(User.email == email).first()
                if user:
                    # Auto-link: Update supabase_id for this user
                    print(f"⚠️ User found by email, linking supabase_id")
                    user.supabase_id = supabase_id
                    db.commit()
                    db.refresh(user)
                    return user
            
            # If still not found, Auto-Create User AND Account to ensure sync resiliency
            if email and supabase_id:
                print(f"⚠️ User not found in local DB. Auto-creating for email: {email}")
                
                # Create a default account
                new_account = Account(
                    name=email.split("@")[0], 
                    company_name=None
                )
                db.add(new_account)
                db.commit()
                db.refresh(new_account)
                
                # Create the user
                new_user = User(
                    account_id=new_account.id,
                    email=email,
                    supabase_id=supabase_id,
                    full_name=email.split("@")[0],
                    role="ARCHITECT"
                )
                db.add(new_user)
                db.commit()
                db.refresh(new_user)
                
                print(f"✅ User auto-created successfully: {new_user.id}")
                return new_user
                
            return None
            
        user = await run_in_threadpool(_db_operations)
        if user:
            return user
            
        raise HTTPException(status_code=404, detail="User not found and could not be auto-created")
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")


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

