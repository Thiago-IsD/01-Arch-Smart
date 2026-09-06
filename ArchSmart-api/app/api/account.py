import logging

from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form
from typing import Optional
import uuid
from pathlib import Path

from app.core.errors import ValidacaoDeDominio
from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Account
from app.schemas.account import AccountBrandingUpdate, AccountBrandingResponse
from app.services.auth_service import auth_service
from app.utils.supabase_client import get_storage_client


router = APIRouter()
logger = logging.getLogger(__name__)


@router.put("/branding", response_model=AccountBrandingResponse)
async def update_account_branding(
    company_name: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Update account branding (company name and/or logo).
    Uploads logo to Supabase Storage bucket 'secure.files'.
    """
    db = repo.db
    # `accounts` e a unica tabela sem account_id — ela E a conta. Chegar nela
    # pelo ctx.account_id do contexto e o caminho certo; repo.query(Account)
    # levantaria EscopoImpossivel. Busca por chave primaria (Session.get),
    # nao por filtro manual — dispensa a excecao de query direta.
    account = db.get(Account, repo.ctx.account_id)

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Update company_name if provided
    if company_name is not None:
        account.company_name = company_name
    
    # Handle file upload if provided
    if file:
        # Validate file type
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        file_ext = Path(file.filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Generate unique filename and path
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        storage_path = f"logos/{account.id}/{unique_filename}"
        
        # Read file content
        try:
            logger.debug("Enviando arquivo %s para %s", unique_filename, storage_path)
            file_bytes = await file.read()

            # Upload to Supabase Storage
            storage_client = get_storage_client()
            await storage_client.upload_file(
                bucket="secure-files",
                path=storage_path,
                file_bytes=file_bytes,
                content_type=file.content_type or "image/png"
            )
            logger.debug("Upload concluido: %s", storage_path)

            # Store PATH in database (not URL)
            account.logo_url = storage_path

        except Exception as e:
            logger.error("Falha ao subir o logo da conta", exc_info=e)
            raise ValidacaoDeDominio("Não foi possível enviar o arquivo.")
    
    # Commit changes
    db.commit()
    db.refresh(account)
    
    # Generate Signed URL for response
    logo_response_url = None
    if account.logo_url:
        # Check if it's a path or legacy URL
        if account.logo_url.startswith("http"):
            logo_response_url = account.logo_url
        else:
            storage_client = get_storage_client()
            logo_response_url = await storage_client.create_signed_url(
                bucket="secure-files", 
                path=account.logo_url
            )
    
    return AccountBrandingResponse(
        id=account.id,
        name=account.name,
        company_name=account.company_name,
        logo_url=logo_response_url
    )


@router.delete("", status_code=204)
async def delete_account(
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Soft delete account.
    Marks account as inactive.
    """
    db = repo.db
    # `accounts` e a unica tabela sem account_id — ela E a conta. Chegar nela
    # pelo ctx.account_id do contexto e o caminho certo; repo.query(Account)
    # levantaria EscopoImpossivel. Busca por chave primaria (Session.get),
    # nao por filtro manual — dispensa a excecao de query direta.
    account = db.get(Account, repo.ctx.account_id)

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    account.is_active = False
    db.commit()
    return None
