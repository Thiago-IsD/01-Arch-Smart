import uuid
from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_

from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Event, Project
from app.schemas.events_schema import EventCreate, EventUpdate, EventResponse

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: build EventResponse with project_name from a tuple or single obj
# ---------------------------------------------------------------------------

def _build_response(event: Event, project_name: Optional[str] = None) -> EventResponse:
    return EventResponse(
        id=event.id,
        account_id=event.account_id,
        project_id=event.project_id,
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time,
        meet_link=event.meet_link,
        google_event_id=event.google_event_id,
        created_at=event.created_at,
        project_name=project_name,
    )


# ---------------------------------------------------------------------------
# GET /events
# ---------------------------------------------------------------------------

@router.get("", response_model=List[EventResponse])
def get_events(
    start_date: date = Query(..., description="Data inicial do filtro (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Data final do filtro (YYYY-MM-DD)"),
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Lista eventos do período, com JOIN em projects para retornar o nome do projeto.
    """
    # Converte datas para datetime (início do dia e fim do dia)
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # `Project.account_id == repo.ctx.account_id` no ON: `repo.query(Event)`
    # escopa EVENT, e o `with_entities` abaixo traz `Project.name`, coluna de
    # outra tabela, para a resposta. A condicao fica no ON e nao no WHERE
    # porque este e um `outerjoin` - no WHERE ela viraria INNER JOIN e sumiria
    # com todo evento sem projeto.
    rows = (
        repo.query(Event)
        .outerjoin(
            Project,
            and_(
                Event.project_id == Project.id,
                Project.account_id == repo.ctx.account_id,
            ),
        )
        .filter(
            Event.start_time >= start_dt,
            Event.start_time <= end_dt,
        )
        .order_by(Event.start_time.asc())
        .with_entities(Event, Project.name.label("project_name"))
        .all()
    )

    return [_build_response(event, pj_name) for event, pj_name in rows]


# ---------------------------------------------------------------------------
# POST /events
# ---------------------------------------------------------------------------

@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Cria um novo evento. Valida que end_time > start_time.
    """
    # Validação extra (já ocorre no schema, mas dupla segurança)
    if payload.end_time <= payload.start_time:
        raise HTTPException(
            status_code=400,
            detail="end_time deve ser maior que start_time",
        )

    # Isola pelo account do usuário autenticado
    if payload.project_id:
        repo.obter(Project, payload.project_id)

    event = repo.create(
        Event,
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        meet_link=payload.meet_link,
    )
    repo.db.commit()
    repo.db.refresh(event)

    project_name = None
    if event.project_id:
        pj = repo.get(Project, event.project_id)
        if pj:
            project_name = pj.name

    return _build_response(event, project_name)


# ---------------------------------------------------------------------------
# PUT /events/{event_id}
# ---------------------------------------------------------------------------

@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: uuid.UUID,
    payload: EventUpdate,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Atualiza um evento existente (isolamento por account).
    """
    event = repo.obter(Event, event_id)

    # Determina os valores finais de start/end para validação cruzada
    new_start = payload.start_time if payload.start_time is not None else event.start_time
    new_end = payload.end_time if payload.end_time is not None else event.end_time

    if new_end <= new_start:
        raise HTTPException(
            status_code=400,
            detail="end_time deve ser maior que start_time",
        )

    if payload.title is not None:
        event.title = payload.title
    if payload.description is not None:
        event.description = payload.description
    if payload.start_time is not None:
        event.start_time = payload.start_time
    if payload.end_time is not None:
        event.end_time = payload.end_time
    if payload.meet_link is not None:
        event.meet_link = payload.meet_link
    if "project_id" in payload.model_fields_set:
        # Permitir setar project_id = null (desvincula do projeto)
        if payload.project_id is not None:
            repo.obter(Project, payload.project_id)
        event.project_id = payload.project_id

    repo.db.commit()
    repo.db.refresh(event)

    project_name = None
    if event.project_id:
        pj = repo.get(Project, event.project_id)
        if pj:
            project_name = pj.name

    return _build_response(event, project_name)


# ---------------------------------------------------------------------------
# DELETE /events/{event_id}
# ---------------------------------------------------------------------------

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: uuid.UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Remove um evento (isolamento por account).
    """
    event = repo.obter(Event, event_id)

    repo.remover(event)
    repo.db.commit()
    return None
