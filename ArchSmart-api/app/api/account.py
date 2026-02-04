from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import uuid
from pathlib import Path

from app.db.session import get_db
from app.models.all_models import User, Account
from app.schemas.account import AccountBrandingUpdate, AccountBrandingResponse
from app.services.auth_service import auth_service
from app.utils.supabase_client import get_storage_client


from app.api.users import get_current_user


router = APIRouter()


@router.put("/branding", response_model=AccountBrandingResponse)
async def update_account_branding(
    company_name: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update account branding (company name and/or logo).
    Uploads logo to Supabase Storage bucket 'secure.files'.
    """
    # Get account
    account = db.query(Account).filter(Account.id == current_user.account_id).first()
    
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
            print(f"📂 Uploading file: {unique_filename} to path: {storage_path}")
            file_bytes = await file.read()
            
            # Upload to Supabase Storage
            storage_client = get_storage_client()
            await storage_client.upload_file(
                bucket="secure-files",
                path=storage_path,
                file_bytes=file_bytes,
                content_type=file.content_type or "image/png"
            )
            print(f"✅ Upload successful. Path: {storage_path}")
            
            # Store PATH in database (not URL)
            account.logo_url = storage_path
            
        except Exception as e:
            print(f"❌ Upload failed: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload file: {str(e)}"
            )
    
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Soft delete account.
    Marks account as inactive.
    """
    account = db.query(Account).filter(Account.id == current_user.account_id).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    account.is_active = False
    db.commit()
    return None
