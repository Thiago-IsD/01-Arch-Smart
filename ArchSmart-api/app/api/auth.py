from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid

from app.db.session import get_db
from app.models.all_models import User, Account
# Replaced native SDK with lightweight service
from app.services.auth_service import auth_service 

router = APIRouter()

# Schemas
class RegisterRequest(BaseModel):
    email: EmailStr
    redirect_url: str = "http://localhost:3000/auth/verify" # Default fallback

class CompleteRegisterRequest(BaseModel):
    full_name: str
    cpf: Optional[str] = None
    password: str
    access_token: str

class ResetPasswordRequest(BaseModel):
    password: str
    access_token: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RecoverRequest(BaseModel):
    email: EmailStr

# Endpoints (Converted to Async for HTTPX)

@router.post("/auth/register-request")
async def request_registration(req: RegisterRequest, db: Session = Depends(get_db)):
    # 1. Check local DB only to prevent duplicates if desired
    if db.query(User).filter(User.email == req.email).first():
        # Optional: return success silently to avoid enumeration
        raise HTTPException(status_code=400, detail="E-mail já possui cadastro.")
    
    # Create user with email confirmation flow
    email_str = str(req.email)
    
    print(f"\n🚀 DEBUG SIGNUP: Email={email_str}, Redirect={req.redirect_url}")

    try:
        # Use email confirmation flow (not magic link)
        await auth_service.sign_up_with_email_confirmation(
            email=email_str, 
            redirect_to=req.redirect_url
        )
        return {"message": "Link enviado! Verifique seu e-mail."}
        
    except Exception as e:
        print(f"🔥 ERRO AUTH SERVICE: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Erro no Supabase: {str(e)}")

@router.post("/auth/complete-register")
async def complete_registration(req: CompleteRegisterRequest, db: Session = Depends(get_db)):
    print(f"\n📝 DEBUG COMPLETE REGISTER:")
    print(f"Full name: {req.full_name}")
    print(f"CPF: {req.cpf}")
    print(f"Token: {req.access_token[:20]}...")
    
    # 1. Validate CPF Uniqueness locally IF provided
    if req.cpf:
        if db.query(User).filter(User.cpf == req.cpf).first():
            raise HTTPException(status_code=400, detail="CPF já em uso.")

    try:
        # 2. Update Supabase User (Set Password & Metadata)
        attributes = {
            "password": req.password,
            "data": {
                "full_name": req.full_name
            }
        }
        if req.cpf:
            attributes["data"]["cpf"] = req.cpf

        print(f"🔄 Updating Supabase user...")
        # Calls service using User's Token
        await auth_service.update_user(req.access_token, attributes)
        print(f"✅ Supabase user updated successfully")
        
        # 3. Get user details from token to ensure identity
        print(f"🔍 Getting user data...")
        user_data = await auth_service.get_user(req.access_token)
        sb_user_id = user_data.get("id")
        sb_email = user_data.get("email")
        print(f"User ID: {sb_user_id}, Email: {sb_email}")
        
        # 4. Create Sync Record in Local DB
        local_user = db.query(User).filter(User.email == sb_email).first()
        if not local_user:
            print(f"📦 Creating local user record...")
            account = Account(name=f"Conta de {req.full_name}")
            db.add(account)
            db.commit()
            db.refresh(account)
            
            new_user = User(
                id=uuid.UUID(sb_user_id),
                email=sb_email,
                full_name=req.full_name,
                cpf=req.cpf,
                account_id=account.id,
                role="ADMIN"
            )
            db.add(new_user)
            db.commit()
            print(f"✅ Local user created successfully")
        else:
            print(f"ℹ️ User already exists locally")
            
        return {"message": "Cadastro concluído!", "user": {"id": sb_user_id, "email": sb_email}}

    except Exception as e:
        print(f"❌ ERROR in complete_registration: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Erro ao finalizar cadastro: {str(e)}")

@router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    try:
        await auth_service.update_user(req.access_token, {"password": req.password})
        return {"message": "Senha atualizada!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Erro ao atualizar senha.")

@router.post("/auth/login")
async def login(req: LoginRequest):
    print(f"\n🔐 DEBUG LOGIN: Email={req.email}")
    try:
        res = await auth_service.sign_in_with_password(req.email, req.password)
        print(f"✅ LOGIN SUCCESS: {res}")
        return res
    except Exception as e:
        print(f"❌ LOGIN FAILED: {str(e)}")
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")

@router.post("/auth/recover-request")
async def recover_request(req: RecoverRequest):
    try:
        await auth_service.reset_password_email(req.email)
        return {"message": "Se o e-mail existir, um link foi enviado."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
