"""
POST /api/telemetry/events.

O prefixo `telemetry` existe porque `/api/events` ja significa Agenda. E nao ha
`/v1`: o ADR 0008 descartou esse prefixo para a reestruturacao inteira.
"""
from fastapi import APIRouter, Depends, Request, Response, status

from app.core.rate_limit import limiter
from app.db.repository import ScopedRepository, get_repo
from app.schemas.telemetry_schema import LoteDeEventos
from app.services.telemetry_service import track

router = APIRouter()


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")
def receber_eventos(
    request: Request,
    lote: LoteDeEventos,
    repo: ScopedRepository = Depends(get_repo),
) -> Response:
    for evento in lote.eventos:
        track(repo, evento.name, evento.properties)
    repo.db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
