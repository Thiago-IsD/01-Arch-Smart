import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
import traceback

from app.db.session import get_db
from app.utils.supabase_client import get_storage_client
from app.models.all_models import Presentation, PresentationEnvironment, Project, Environment, User, Account, PresentationComment
from app.api.users import get_current_user
from app.schemas.presentation_schema import PresentationResponse, PresentationCreate, PresentationConfigUpdate, PresentationEnvironmentDetailUpdate
from pydantic import BaseModel

class PresentationCommentCreate(BaseModel):
    text: str

router = APIRouter()

@router.get("/presentations", response_model=List[PresentationResponse])
def get_presentations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retorna todas as apresentações de todos os projetos associados à conta do usuário logado.
    """
    presentations = (
        db.query(Presentation)
        .join(Project, Presentation.project_id == Project.id)
        .filter(Project.account_id == current_user.account_id)
        .options(joinedload(Presentation.project))
        .all()
    )
    return presentations

@router.get("/projects/{project_id}/presentations", response_model=List[PresentationResponse])
def get_project_presentations(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retorna as apresentações de um projeto específico associado à conta.
    """
    project = db.query(Project).filter(Project.id == project_id, Project.account_id == current_user.account_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    presentations = db.query(Presentation).filter(Presentation.project_id == project_id).all()
    return presentations

@router.post("/projects/{project_id}/presentations", response_model=PresentationResponse, status_code=status.HTTP_201_CREATED)
def create_project_presentation(
    project_id: uuid.UUID,
    presentation_in: PresentationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cria uma nova apresentação para um projeto e espelha os ambientes do projeto em PresentationEnvironment.
    """
    project = db.query(Project).filter(Project.id == project_id, Project.account_id == current_user.account_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if presentation_in.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project ID mismatch")

    # Capturar branding da conta se o snapshot for nulo
    branding = presentation_in.branding_snapshot
    if not branding:
        account = db.query(Account).filter(Account.id == current_user.account_id).first()
        if account:
            branding = {
                "office_name": account.company_name or account.name,
                "logo_url": account.logo_url,
                "cover_url": None
            }

    # Criar a apresentação
    db_presentation = Presentation(
        project_id=project_id,
        name=presentation_in.name,
        description=presentation_in.description,
        status=presentation_in.status,
        branding_snapshot=branding
    )
    db.add(db_presentation)
    db.flush() # Para obter o ID da apresentação

    # Espelhar os ambientes do projeto
    project_environments = db.query(Environment).filter(Environment.project_id == project_id).all()
    
    for environment in project_environments:
        new_presentation_env = PresentationEnvironment(
            presentation_id=db_presentation.id,
            environment_id=environment.id,
            is_visible=True
        )
        db.add(new_presentation_env)

    db.commit()
    db.refresh(db_presentation)

    return db_presentation

@router.get("/presentations/{presentation_id}", response_model=PresentationResponse)
def get_presentation(
    presentation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retorna os detalhes de uma apresentação, incluindo os ambientes atrelados e o projeto.
    """
    presentation = (
        db.query(Presentation)
        .join(Project, Presentation.project_id == Project.id)
        .filter(Presentation.id == presentation_id, Project.account_id == current_user.account_id)
        .options(
            joinedload(Presentation.project).joinedload(Project.account),
            joinedload(Presentation.environments).joinedload(PresentationEnvironment.environment)
        )
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation not found")
    
    # Fallback para apresentações antigas sem snapshot
    if not presentation.branding_snapshot:
        account = presentation.project.account if presentation.project else None
        if account:
            presentation.branding_snapshot = {
                "office_name": account.company_name or account.name,
                "logo_url": account.logo_url,
                "cover_url": None
            }
    
    return presentation

@router.put("/presentations/{presentation_id}/config", response_model=PresentationResponse)
def update_presentation_config(
    presentation_id: uuid.UUID,
    config_in: PresentationConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualiza metadados básicos (name, description, status) e visibilidade (is_visible) de seus ambientes.
    """
    presentation = (
        db.query(Presentation)
        .join(Project, Presentation.project_id == Project.id)
        .filter(Presentation.id == presentation_id, Project.account_id == current_user.account_id)
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation not found")

    if config_in.name is not None:
        presentation.name = config_in.name
    if config_in.description is not None:
        presentation.description = config_in.description
    if config_in.status is not None:
        presentation.status = config_in.status
    if config_in.branding_snapshot is not None:
        presentation.branding_snapshot = config_in.branding_snapshot

    if config_in.environments is not None:
        for env_update in config_in.environments:
            db_env = db.query(PresentationEnvironment).filter(
                PresentationEnvironment.presentation_id == presentation_id,
                PresentationEnvironment.id == env_update.id
            ).first()
            if db_env:
                db_env.is_visible = env_update.is_visible

    db.commit()
    db.refresh(presentation)
    
    # Reload with relationships simply
    updated_presentation = (
        db.query(Presentation)
        .options(
            joinedload(Presentation.project),
            joinedload(Presentation.environments).joinedload(PresentationEnvironment.environment)
        )
        .filter(Presentation.id == presentation_id)
        .first()
    )
    
    return updated_presentation

@router.post("/presentations/{presentation_id}/assets", response_model=PresentationResponse)
async def upload_presentation_cover(
    presentation_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Faz o upload da imagem de capa para o storage público e salva a URL no `branding_snapshot`.
    """
    presentation = (
        db.query(Presentation)
        .join(Project, Presentation.project_id == Project.id)
        .filter(Presentation.id == presentation_id, Project.account_id == current_user.account_id)
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation not found")

    storage_client = get_storage_client()
    bucket_name = "public-assets"
    
    # Gerando nome único
    file_extension = file.filename.split(".")[-1]
    safe_filename = f"presentations/{presentation_id}/cover_{uuid.uuid4().hex}.{file_extension}"
    
    file_bytes = await file.read()
    
    try:
        # Armazena no Supabase Storage
        upload_response = await storage_client.upload_file(
            bucket=bucket_name,
            path=safe_filename,
            file_bytes=file_bytes,
            content_type=file.content_type
        )
        
        # O supabase_client já deveria retornar o public_url caso fosse público,
        # ou construímos
        public_url = storage_client.get_public_url(bucket_name, safe_filename)
        
        # Salva em branding_snapshot (JSON) de forma robusta
        from sqlalchemy.orm.attributes import flag_modified
        
        if not presentation.branding_snapshot:
            presentation.branding_snapshot = {"cover_url": public_url}
        elif isinstance(presentation.branding_snapshot, dict):
            # Criar cópia profunda ou apenas alterar e avisar o SQLAlchemy
            presentation.branding_snapshot["cover_url"] = public_url
            flag_modified(presentation, "branding_snapshot")
        else:
            # Fallback se não for dict (raro)
            presentation.branding_snapshot = {"cover_url": public_url}
        
        db.commit()
        db.refresh(presentation)
        
    except Exception as e:
        db.rollback()
        print("====== UPLOAD EXCEPTION ======")
        traceback.print_exc()
        print("==============================")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")
        
    # Reload
    updated_presentation = (
        db.query(Presentation)
        .options(
            joinedload(Presentation.project),
            joinedload(Presentation.environments).joinedload(PresentationEnvironment.environment)
        )
        .filter(Presentation.id == presentation_id)
        .first()
    )
    return updated_presentation


@router.put("/presentations/{presentation_id}/environments/{env_id}")
def update_presentation_environment_detail(
    presentation_id: uuid.UUID,
    env_id: uuid.UUID,
    detail_in: PresentationEnvironmentDetailUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualiza os campos de detalhamento (title, subtitle, description, is_visible) de um ambiente
    em uma apresentação específica.
    """
    presentation = (
        db.query(Presentation)
        .join(Project, Presentation.project_id == Project.id)
        .filter(Presentation.id == presentation_id, Project.account_id == current_user.account_id)
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation not found")

    db_env = db.query(PresentationEnvironment).filter(
        PresentationEnvironment.id == env_id,
        PresentationEnvironment.presentation_id == presentation_id
    ).first()
    if not db_env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation environment not found")

    if detail_in.title is not None:
        db_env.title = detail_in.title
    if detail_in.subtitle is not None:
        db_env.subtitle = detail_in.subtitle
    if detail_in.description is not None:
        db_env.description = detail_in.description
    if detail_in.is_visible is not None:
        db_env.is_visible = detail_in.is_visible

    db.commit()
    db.refresh(db_env)
    return {
        "id": str(db_env.id),
        "title": db_env.title,
        "subtitle": db_env.subtitle,
        "description": db_env.description,
        "is_visible": db_env.is_visible,
        "image_urls": db_env.image_urls or []
    }


@router.post("/presentations/{presentation_id}/environments/{env_id}/images")
async def upload_environment_image(
    presentation_id: uuid.UUID,
    env_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Faz upload de uma imagem para um ambiente específico na apresentação.
    Adiciona a URL ao array image_urls. Limite de 4 imagens por ambiente.
    """
    presentation = (
        db.query(Presentation)
        .join(Project, Presentation.project_id == Project.id)
        .filter(Presentation.id == presentation_id, Project.account_id == current_user.account_id)
        .first()
    )
    if not presentation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation not found")

    db_env = db.query(PresentationEnvironment).filter(
        PresentationEnvironment.id == env_id,
        PresentationEnvironment.presentation_id == presentation_id
    ).first()
    if not db_env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation environment not found")

    current_urls = db_env.image_urls or []
    if len(current_urls) >= 4:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 4 images per environment")

    storage_client = get_storage_client()
    bucket_name = "public-assets"
    file_extension = file.filename.split(".")[-1]
    safe_filename = f"presentations/environments/{env_id}/{uuid.uuid4().hex}.{file_extension}"

    file_bytes = await file.read()

    try:
        await storage_client.upload_file(
            bucket=bucket_name,
            path=safe_filename,
            file_bytes=file_bytes,
            content_type=file.content_type
        )
        public_url = storage_client.get_public_url(bucket_name, safe_filename)

        new_urls = list(current_urls) + [public_url]
        db_env.image_urls = new_urls
        db.commit()
        db.refresh(db_env)

        return {"url": public_url, "image_urls": db_env.image_urls}
    except Exception as e:
        db.rollback()
        print("====== UPLOAD ENV IMAGE EXCEPTION ======")
        traceback.print_exc()
        print("========================================")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")

@router.delete("/presentations/{presentation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_presentation(
    presentation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deleta uma apresentação específica, validando se pertence à conta do usuário.
    """
    presentation = (
        db.query(Presentation)
        .join(Project, Presentation.project_id == Project.id)
        .filter(Presentation.id == presentation_id, Project.account_id == current_user.account_id)
        .first()
    )

    if not presentation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation not found")

    try:
        db.delete(presentation)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Delete failed: {str(e)}")
    
    return None

@router.get("/presentations/{presentation_id}/comments")
def get_presentation_comments(
    presentation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lista a thread de conversas (Comentários) de uma Apresentação.
    Acesso restrito para o Arquiteto dono do Projeto.
    """
    presentation = db.query(Presentation).join(Project).filter(
        Presentation.id == presentation_id,
        Project.account_id == current_user.account_id
    ).first()
    
    if not presentation:
        raise HTTPException(status_code=404, detail="Apresentação não encontrada")
        
    comments = db.query(PresentationComment).filter(
        PresentationComment.presentation_id == presentation_id
    ).order_by(PresentationComment.created_at.asc()).all()
    
    return [
        {
            "id": c.id,
            "author_type": c.author_type,
            "text": c.text,
            "created_at": c.created_at
        }
        for c in comments
    ]

@router.post("/presentations/{presentation_id}/comments")
def add_presentation_comment(
    presentation_id: uuid.UUID,
    payload: PresentationCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Arquiteto posta um comentário na thread e a apresentação volta para PUBLISHED.
    """
    presentation = db.query(Presentation).join(Project).filter(
        Presentation.id == presentation_id,
        Project.account_id == current_user.account_id
    ).first()
    
    if not presentation:
        raise HTTPException(status_code=404, detail="Apresentação não encontrada")
        
    # Gravar o comentário
    new_comment = PresentationComment(
        presentation_id=presentation.id,
        author_type="ARCHITECT",
        text=payload.text
    )
    db.add(new_comment)
    
    # Destravar a avaliação do cliente (voltando para PUBLISHED ou STATUS apropriado)
    presentation.status = "PUBLISHED"
    
    db.commit()
    db.refresh(new_comment)
    
    return {
        "status": "success",
        "comment": {
            "id": new_comment.id,
            "author_type": new_comment.author_type,
            "text": new_comment.text,
            "created_at": new_comment.created_at
        }
    }
