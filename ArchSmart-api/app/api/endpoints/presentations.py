import logging
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import joinedload

from app.core.errors import NotFound, ValidacaoDeDominio
from app.db.repository import ScopedRepository, get_repo
from app.utils.supabase_client import get_storage_client
from app.models.all_models import Presentation, PresentationEnvironment, Project, Environment, PresentationComment
from app.schemas.presentation_schema import PresentationResponse, PresentationCreate, PresentationConfigUpdate, PresentationEnvironmentDetailUpdate
from app.core.portal_security import hash_password
from pydantic import BaseModel

class PresentationCommentCreate(BaseModel):
    text: str

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/presentations", response_model=List[PresentationResponse])
def get_presentations(
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Retorna todas as apresentações de todos os projetos associados à conta do usuário logado.
    """
    presentations = (
        repo.query(Presentation)
        .options(joinedload(Presentation.project))
        .all()
    )
    return presentations

@router.get("/projects/{project_id}/presentations", response_model=List[PresentationResponse])
def get_project_presentations(
    project_id: uuid.UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Retorna as apresentações de um projeto específico associado à conta.
    """
    repo.obter(Project, project_id)

    presentations = repo.query(Presentation).filter(Presentation.project_id == project_id).all()
    return presentations

@router.post("/projects/{project_id}/presentations", response_model=PresentationResponse, status_code=status.HTTP_201_CREATED)
def create_project_presentation(
    project_id: uuid.UUID,
    presentation_in: PresentationCreate,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Cria uma nova apresentação para um projeto e espelha os ambientes do projeto em PresentationEnvironment.
    """
    project = repo.obter(Project, project_id)

    if presentation_in.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O ID do projeto informado não confere com o da rota.")

    # Capturar branding da conta se o snapshot for nulo. `project.account` e
    # travessia de relacionamento sobre um Project ja escopado por
    # `repo.obter` — nao vira `repo.query(Account)` porque `accounts` e a
    # unica tabela sem account_id (o repositorio recusaria com
    # EscopoImpossivel).
    branding = presentation_in.branding_snapshot
    if not branding:
        account = project.account
        if account:
            branding = {
                "office_name": account.company_name or account.name,
                "logo_url": account.logo_url,
                "cover_url": None
            }

    # Criar a apresentação
    db_presentation = repo.create(
        Presentation,
        project_id=project_id,
        name=presentation_in.name,
        description=presentation_in.description,
        status=presentation_in.status,
        branding_snapshot=branding
    )
    repo.db.flush() # Para obter o ID da apresentação

    # Espelhar os ambientes do projeto
    project_environments = repo.query(Environment).filter(Environment.project_id == project_id).all()

    for environment in project_environments:
        repo.create(
            PresentationEnvironment,
            presentation_id=db_presentation.id,
            environment_id=environment.id,
            is_visible=True
        )

    repo.db.commit()
    repo.db.refresh(db_presentation)

    return db_presentation

@router.get("/presentations/{presentation_id}", response_model=PresentationResponse)
def get_presentation(
    presentation_id: uuid.UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Retorna os detalhes de uma apresentação, incluindo os ambientes atrelados e o projeto.
    """
    # joinedload(Presentation.project).joinedload(Project.account) continua
    # necessario: o portal usa o branding da conta. Nao vira
    # repo.query(Account) pelo mesmo motivo do comentario acima — chegar na
    # conta pela relacao do projeto ja filtrado e o caminho certo.
    presentation = (
        repo.query(Presentation)
        .options(
            joinedload(Presentation.project).joinedload(Project.account),
            joinedload(Presentation.environments).joinedload(PresentationEnvironment.environment)
        )
        .filter(Presentation.id == presentation_id)
        .first()
    )
    if presentation is None:
        raise NotFound("Apresentação não encontrada.")

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
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Atualiza metadados básicos (name, description, status) e visibilidade (is_visible) de seus ambientes.
    """
    presentation = repo.obter(Presentation, presentation_id)

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
            db_env = repo.query(PresentationEnvironment).filter(
                PresentationEnvironment.presentation_id == presentation_id,
                PresentationEnvironment.id == env_update.id
            ).first()
            if db_env:
                db_env.is_visible = env_update.is_visible

    repo.db.commit()
    repo.db.refresh(presentation)

    # Reload with relationships simply
    updated_presentation = (
        repo.query(Presentation)
        .options(
            joinedload(Presentation.project),
            joinedload(Presentation.environments).joinedload(PresentationEnvironment.environment)
        )
        .filter(Presentation.id == presentation_id)
        .first()
    )

    return updated_presentation

class AccessPasswordUpdate(BaseModel):
    # Envie uma senha para proteger; string vazia/None remove a proteção.
    password: str | None = None

@router.put("/presentations/{presentation_id}/access-password")
def set_presentation_access_password(
    presentation_id: uuid.UUID,
    payload: AccessPasswordUpdate,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Define (ou remove) a senha que o cliente usa para acessar o portal público.
    Apenas o dono (mesma conta) pode alterar.
    """
    presentation = repo.obter(Presentation, presentation_id)

    pw = (payload.password or "").strip()
    if pw:
        presentation.access_password_hash = hash_password(pw)
    else:
        presentation.access_password_hash = None

    repo.db.commit()
    return {"has_access_password": presentation.access_password_hash is not None}

@router.post("/presentations/{presentation_id}/assets", response_model=PresentationResponse)
async def upload_presentation_cover(
    presentation_id: uuid.UUID,
    file: UploadFile = File(...),
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Faz o upload da imagem de capa para o storage público e salva a URL no `branding_snapshot`.
    """
    presentation = repo.obter(Presentation, presentation_id)

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

        repo.db.commit()
        repo.db.refresh(presentation)

    except Exception as e:
        repo.db.rollback()
        logger.error("Falha ao enviar imagem de capa da apresentacao", exc_info=e)
        raise ValidacaoDeDominio("Não foi possível enviar a imagem.")

    # Reload
    updated_presentation = (
        repo.query(Presentation)
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
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Atualiza os campos de detalhamento (title, subtitle, description, is_visible) de um ambiente
    em uma apresentação específica.
    """
    repo.obter(Presentation, presentation_id)

    db_env = repo.query(PresentationEnvironment).filter(
        PresentationEnvironment.id == env_id,
        PresentationEnvironment.presentation_id == presentation_id
    ).first()
    if not db_env:
        raise NotFound("Ambiente da apresentação não encontrado.")

    if detail_in.title is not None:
        db_env.title = detail_in.title
    if detail_in.subtitle is not None:
        db_env.subtitle = detail_in.subtitle
    if detail_in.description is not None:
        db_env.description = detail_in.description
    if detail_in.is_visible is not None:
        db_env.is_visible = detail_in.is_visible

    repo.db.commit()
    repo.db.refresh(db_env)
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
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Faz upload de uma imagem para um ambiente específico na apresentação.
    Adiciona a URL ao array image_urls. Limite de 4 imagens por ambiente.
    """
    repo.obter(Presentation, presentation_id)

    db_env = repo.query(PresentationEnvironment).filter(
        PresentationEnvironment.id == env_id,
        PresentationEnvironment.presentation_id == presentation_id
    ).first()
    if not db_env:
        raise NotFound("Ambiente da apresentação não encontrado.")

    current_urls = db_env.image_urls or []
    if len(current_urls) >= 4:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Limite de 4 imagens por ambiente atingido.")

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
        repo.db.commit()
        repo.db.refresh(db_env)

        return {"url": public_url, "image_urls": db_env.image_urls}
    except Exception as e:
        repo.db.rollback()
        logger.error("Falha ao enviar imagem do ambiente", exc_info=e)
        raise ValidacaoDeDominio("Não foi possível enviar a imagem.")

@router.delete("/presentations/{presentation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_presentation(
    presentation_id: uuid.UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Deleta uma apresentação específica, validando se pertence à conta do usuário.
    """
    presentation = repo.obter(Presentation, presentation_id)

    try:
        repo.remover(presentation)
        repo.db.commit()
    except Exception as e:
        repo.db.rollback()
        logger.error("Falha ao remover apresentacao", exc_info=e)
        # Desvio deliberado da mensagem do brief ("Nao foi possivel remover a
        # imagem.") — este bloco remove a apresentacao inteira, nao uma
        # imagem. Ver task-5-report.md.
        raise ValidacaoDeDominio("Não foi possível remover a apresentação.")

    return None

@router.get("/presentations/{presentation_id}/comments")
def get_presentation_comments(
    presentation_id: uuid.UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Lista a thread de conversas (Comentários) de uma Apresentação.
    Acesso restrito para o Arquiteto dono do Projeto.
    """
    repo.obter(Presentation, presentation_id)

    comments = repo.query(PresentationComment).filter(
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
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Arquiteto posta um comentário na thread e a apresentação volta para PUBLISHED.
    """
    presentation = repo.obter(Presentation, presentation_id)

    # Gravar o comentário
    new_comment = repo.create(
        PresentationComment,
        presentation_id=presentation.id,
        author_type="ARCHITECT",
        text=payload.text
    )

    # Destravar a avaliação do cliente (voltando para PUBLISHED ou STATUS apropriado)
    presentation.status = "PUBLISHED"

    repo.db.commit()
    repo.db.refresh(new_comment)

    return {
        "status": "success",
        "comment": {
            "id": new_comment.id,
            "author_type": new_comment.author_type,
            "text": new_comment.text,
            "created_at": new_comment.created_at
        }
    }
