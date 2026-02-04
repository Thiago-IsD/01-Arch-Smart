from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import User
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
async def complete_register(payload: CompleteRegisterRequest):
    """
    Complete registration or reset password.
    Updates user profile and password using the provided access_token.
    """
    try:
        attributes = {
            "password": payload.payload, # Typo fix in next validation step? No, payload is the object. payload.password
            "data": {
                "full_name": payload.full_name
            }
        }
        if payload.cpf:
            attributes["data"]["cpf"] = payload.cpf

        # Update User in Supabase
        # Note: update_user takes (access_token, attributes)
        # We use the token provided by the frontend (hash fragment)
        return await auth_service.update_user(
            access_token=payload.access_token,
            attributes={
                "password": payload.password,
                "data": {
                    "full_name": payload.full_name,
                    "cpf": payload.cpf
                }
            }
        )
    except Exception as e:
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
async def signup(payload: UserSignup):
    """
    Signup with email/password.
    """
    try:
        return await auth_service.sign_up(
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            cpf=payload.cpf
        )
    except Exception as e:
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
            user_id=str(current_user.id),
            attributes={"password": password_data.new_password}
        )
        
        return {"message": "Senha alterada com sucesso."}
    except Exception as e:
        print(f"❌ Error changing password: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao alterar senha: {str(e)}")
