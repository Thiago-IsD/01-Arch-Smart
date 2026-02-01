from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic_settings import BaseSettings
from app.core.config import settings
from pathlib import Path

# Mail Configuration
conf = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USER,
    MAIL_PASSWORD=settings.SMTP_PASSWORD,
    MAIL_FROM=settings.EMAILS_FROM_EMAIL or "noreply@archsmart.com",
    MAIL_PORT=settings.SMTP_PORT,
    MAIL_SERVER=settings.SMTP_HOST,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_verification_email(email: str, token: str, frontend_url: str, type: str = "REGISTRATION"):
    verification_link = f"{frontend_url}/auth/verify?token={token}"
    
    subject = "Arch Smart - Confirmação de E-mail"
    title = "Verifique seu e-mail"
    action = "Confirmar E-mail"
    
    if type == "RECOVERY":
        subject = "Arch Smart - Recuperação de Senha"
        title = "Redefinir Senha"
        action = "Redefinir Minha Senha"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #008080;">{title}</h2>
        <p>Olá,</p>
        <p>Recebemos uma solicitação para sua conta.</p>
        <p>Clique no botão abaixo para continuar:</p>
        <a href="{verification_link}" style="background-color: #008080; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">{action}</a>
        <p>Ou cole este link no navegador:</p>
        <p>{verification_link}</p>
        <p>Se você não solicitou, ignore este e-mail.</p>
        <p>Atenciosamente,<br>Equipe Arch Smart</p>
    </div>
    """

    message = MessageSchema(
        subject=subject,
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)
