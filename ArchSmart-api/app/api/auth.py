from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import User, Account
from app.schemas.user import ChangePasswordRequest, UserLogin, UserSignup, MagicLinkRequest, RecoverRequest, CompleteRegisterRequest
from app.api.users import get_current_user
from app.services.auth_service import auth_service

router = APIRouter()

@router.post("/register-request")
async def register_request(payload: MagicLinkRequest):
    """
    Initiate Magic Link flow (Signup/Login).
    Sends OTP/Link to email.
    """
    try:
        # Handle frontend alias
        redirect = payload.redirect_to or payload.redirect_url
        return await auth_service.sign_in_with_otp(
            email=payload.email,
            redirect_to=redirect
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/recover-request")
async def recover_request(payload: RecoverRequest):
    """
    Send Password Recovery Email.
    """
    try:
        return await auth_service.reset_password_email(email=payload.email)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/complete-register")
async def complete_register(payload: CompleteRegisterRequest, db: Session = Depends(get_db)):
    """
    Complete registration or reset password.
    Updates user profile and password using the provided access_token.
    Also creates User and Account records in PostgreSQL if they don't exist.
    """
    try:
        # Update User in Supabase
        supabase_response = await auth_service.update_user(
            access_token=payload.access_token,
            attributes={
                "password": payload.password,
                "data": {
                    "full_name": payload.full_name,
                    "cpf": payload.cpf
                }
            }
        )
        
        # Get user data from Supabase to extract email and ID
        user_data = await auth_service.get_user(payload.access_token)
        supabase_id = user_data["id"]
        email = user_data.get("email")
        
        # Check if user already exists in our database
        existing_user = db.query(User).filter(User.supabase_id == supabase_id).first()
        
        if not existing_user and email:
            # Also check by email (for migration cases)
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                # Link supabase_id
                existing_user.supabase_id = supabase_id
                existing_user.full_name = payload.full_name
                db.commit()
        
        if not existing_user:
            # Create new Account first
            new_account = Account(
                name=f"{payload.full_name}'s Account",
                company_name=payload.full_name,
                is_active=True
            )
            db.add(new_account)
            db.flush()  # Get the account ID
            
            # Create new User
            new_user = User(
                supabase_id=supabase_id,
                email=email,
                full_name=payload.full_name,
                account_id=new_account.id
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            print(f"✅ Created new user in database: {new_user.id} ({email})")
        
        
        # Return response with email for auto-login
        return {
            **supabase_response,
            "email": email
        }
    except Exception as e:
        db.rollback()
        print(f"❌ Error in complete-register: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(payload: UserLogin):
    """
    Login with password.
    Returns access_token.
    """
    try:
        return await auth_service.sign_in_with_password(
            email=payload.email,
            password=payload.password
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/signup")
async def signup(payload: UserSignup, db: Session = Depends(get_db)):
    """
    Signup with email/password.
    Creates user in Supabase Auth and PostgreSQL database.
    """
    try:
        # Create user in Supabase
        supabase_response = await auth_service.sign_up(
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            cpf=payload.cpf
        )
        
        # Extract user data from Supabase response
        if "user" in supabase_response and supabase_response["user"]:
            supabase_id = supabase_response["user"]["id"]
            email = supabase_response["user"]["email"]
            
            # Create Account
            new_account = Account(
                name=f"{payload.full_name}'s Account",
                company_name=payload.full_name,
                is_active=True
            )
            db.add(new_account)
            db.flush()
            
            # Create User in PostgreSQL
            new_user = User(
                supabase_id=supabase_id,
                email=email,
                full_name=payload.full_name,
                account_id=new_account.id
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            print(f"✅ Created user in database: {new_user.id} ({email})")
        
        return supabase_response
    except Exception as e:
        db.rollback()
        print(f"❌ Error in signup: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change current user's password.
    Verifies old password by attempting a silent login.
    """
    # 1. Verify old password
    try:
        await auth_service.sign_in_with_password(
            email=current_user.email,
            password=password_data.current_password
        )
    except Exception:
        raise HTTPException(status_code=400, detail="A senha atual está incorreta.")

    # 2. Update password
    try:
        # Strategy: Use Service Role (Admin) to force update
        # We already verified the user knows the old password above.
        
        await auth_service.admin_update_user(
            user_id=str(current_user.supabase_id),
            attributes={"password": password_data.new_password}
        )
        
        return {"message": "Senha alterada com sucesso."}
    except Exception as e:
        print(f"❌ Error changing password: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao alterar senha: {str(e)}")
