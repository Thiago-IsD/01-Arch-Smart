"""
Contrato do endpoint de telemetria.

O corpo e SEMPRE um lote, desde o primeiro dia, mesmo que o cliente de hoje
mande um evento por vez: trocar de objeto para array depois significa mexer em
servidor, cliente e testes no mesmo commit.

Nao ha campo de conta nem de usuario. Nao e esquecimento: a identidade vem do
contexto do servidor (Art. 1), e um campo aqui daria a impressao de que o
cliente pode escolher.
"""
from typing import Any, Dict, List

from pydantic import BaseModel, Field


class EventoRecebido(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    properties: Dict[str, Any] = Field(default_factory=dict)


class LoteDeEventos(BaseModel):
    eventos: List[EventoRecebido] = Field(default_factory=list, max_length=50)
