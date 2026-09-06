import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.errors import ValidacaoDeDominio
from app.db.repository import ScopedRepository, get_repo
from app.db.session import get_db
from app.models.all_models import User, Account
from app.schemas.user import ChangePasswordRequest, UserLogin, UserSignup, MagicLinkRequest, RecoverRequest, CompleteRegisterRequest
from app.services.auth_service import auth_service

router = APIRouter()
logger = logging.getLogger(__name__)

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
        logger.error("Falha ao iniciar cadastro por magic link", exc_info=e)
        raise ValidacaoDeDominio("Não foi possível iniciar o cadastro.")

@router.post("/recover-request")
async def recover_request(payload: RecoverRequest):
    """
    Send Password Recovery Email.
    """
    try:
        return await auth_service.reset_password_email(email=payload.email)
    except Exception as e:
        logger.error("Falha ao iniciar recuperacao de senha", exc_info=e)
        raise ValidacaoDeDominio("Não foi possível iniciar a recuperação de senha.")

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
        
        # Cadastro: acontece ANTES de existir sessao, entao nao ha RequestContext
        # nem repositorio. A protecao aqui e a do Supabase Auth, nao a do escopo
        # por conta.
        existing_user = db.query(User).filter(User.supabase_id == supabase_id).first()  # pre-sessao: sem account_id ainda

        if not existing_user and email:
            # ATENCAO: isto NAO e a mesma excecao de pre-sessao da linha
            # acima. A linha 71 resolve por supabase_id (seguro); esta
            # resolve por E-MAIL e, se achar, sobrescreve o supabase_id e o
            # full_name da linha encontrada com os dados de quem apresentou
            # o token — o mesmo padrao que a Tarefa 2 removeu de
            # security.py. E o unico caminho de resolucao-por-e-mail que
            # sobra na API; a protecao dele mora fora do repositorio, no
            # toggle "Confirm email" do painel do Supabase. Pendencia de
            # seguranca conhecida e registrada, nao um esquecimento desta
            # conversao — o que fazer com o caminho legado de migracao e
            # decisao de Thiago, nao de uma rodada de conversao. Ver
            # docs/dev/arquitetura.md, secao "Resolvido em 05/09/2026: o
            # auto-link por e-mail em app/api/users.py".
            existing_user = db.query(User).filter(User.email == email).first()  # pre-sessao: sem account_id ainda
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
            logger.debug("Novo usuario criado no banco: %s", new_user.id)


        # Return response with email for auto-login
        return {
            **supabase_response,
            "email": email
        }
    except Exception as e:
        db.rollback()
        logger.error("Falha ao concluir cadastro", exc_info=e)
        raise ValidacaoDeDominio("Não foi possível concluir o cadastro.")

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
    except HTTPException:
        raise
    except Exception as e:
        # Traduz erros conhecidos do Supabase para mensagens amigáveis,
        # sem vazar o texto interno (ex.: "Supabase Error (400): ...").
        msg = str(e).lower()
        if "invalid login credentials" in msg or "invalid_grant" in msg:
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
        if "email not confirmed" in msg:
            raise HTTPException(
                status_code=403,
                detail="Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
            )
        if "connection error" in msg:
            raise HTTPException(
                status_code=503,
                detail="Não foi possível conectar ao servidor de autenticação. Tente novamente em instantes.",
            )
        # Fallback genérico para erros inesperados.
        raise HTTPException(status_code=400, detail="Não foi possível fazer login. Tente novamente.")

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
            logger.debug("Usuario criado no banco: %s", new_user.id)

        return supabase_response
    except Exception as e:
        db.rollback()
        logger.error("Falha ao criar conta no cadastro por senha", exc_info=e)
        # Desvio deliberado da mensagem do brief ("Nao foi possivel entrar.
        # Verifique e-mail e senha.") — aquela e uma mensagem de LOGIN, e este
        # bloco e o de signup (cria conta nova). Ver task-5-report.md.
        raise ValidacaoDeDominio("Não foi possível criar a conta. Tente novamente.")

@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Change current user's password.
    Verifies old password by attempting a silent login.
    """
    current_user = repo.obter(User, repo.ctx.user_id)

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
        logger.error("Falha ao alterar senha", exc_info=e)
        raise ValidacaoDeDominio("Não foi possível alterar a senha.")
