"""
A unica porta para o banco em codigo de endpoint.

Antes da Secao 4 havia 117 `db.query()` diretos, e cada endpoint decidia
sozinho se filtrava por conta. Treze esqueceram — foi a Secao 1 inteira.
Enquanto for possivel esquecer, alguem esquece; entao o filtro deixa de ser
decisao de quem escreve o endpoint.
"""
from __future__ import annotations

from typing import Any, TypeVar
from uuid import UUID

from fastapi import Depends
from sqlalchemy.orm import Query, Session

from app.core.errors import NotFound
from app.core.security import RequestContext, get_context
from app.db.session import get_db

M = TypeVar("M")


class EscopoImpossivel(TypeError):
    """
    Model sem `account_id`. Subclasse de TypeError de proposito: e erro de
    programacao, nao condicao de runtime — nao existe entrada de usuario que
    o provoque, e nenhum `except` de endpoint deve captura-lo.
    """


class ScopedRepository:
    """
    Toda query nasce filtrada por `ctx.account_id`.

    Nao ha construtor que aceite `account_id` avulso: a unica origem e o
    `RequestContext`, que so o servidor monta (Art. 1).
    """

    def __init__(self, db: Session, ctx: RequestContext) -> None:
        self.db = db
        self.ctx = ctx

    # -- leitura ---------------------------------------------------------

    def _exigir_coluna_de_conta(self, model: type[M]) -> Any:
        coluna = getattr(model, "account_id", None)
        if coluna is None:
            raise EscopoImpossivel(
                f"{model.__name__} nao tem account_id, entao nao da para "
                "filtrar por conta (Art. 1: toda leitura e escrita e filtrada "
                "pela identidade da sessao). Se for catalogo global, use "
                "ScopedRepository.unscoped_query(db, model) — permitida so em "
                "tools/ e alembic/."
            )
        return coluna

    def query(self, model: type[M]) -> Query:
        coluna = self._exigir_coluna_de_conta(model)
        return self.db.query(model).filter(coluna == self.ctx.account_id)

    def get(self, model: type[M], id_: UUID | str) -> M | None:
        return self.query(model).filter(model.id == id_).first()

    def obter(self, model: type[M], id_: UUID | str) -> M:
        """
        Como `get`, mas levanta `NotFound` — que o handler da Tarefa 5 traduz
        para 404. Nunca 403: um 403 confirmaria que o recurso existe na conta
        de outra pessoa.
        """
        achado = self.get(model, id_)
        if achado is None:
            raise NotFound()
        return achado

    # -- escrita ---------------------------------------------------------

    def create(self, model: type[M], **campos: Any) -> M:
        """
        Injeta `account_id` e `created_by`. Qualquer `account_id` ou
        `created_by` passado em `campos` e DESCARTADO em silencio: o unico
        caminho ate essas colunas e o contexto.
        """
        campos.pop("account_id", None)
        campos.pop("created_by", None)
        objeto = model(
            account_id=self.ctx.account_id,
            created_by=self.ctx.user_id,
            **campos,
        )
        self.db.add(objeto)
        return objeto

    def remover(self, objeto: Any) -> None:
        """
        Recusa objeto de outra conta. Sem isto, um endpoint poderia carregar
        pela escotilha e apagar o que nao e dele.
        """
        if getattr(objeto, "account_id", None) != self.ctx.account_id:
            raise NotFound()
        self.db.delete(objeto)

    # -- escotilha -------------------------------------------------------

    @staticmethod
    def unscoped_query(db: Session, model: type[M]) -> Query:
        """
        Atravessa o filtro por conta. Legitima para catalogo global e para
        script de manutencao; ilegitima em endpoint. O lint que garante isso
        e `tests/test_arquitetura.py::test_escotilha_so_em_tools_alembic_e_testes`.
        """
        return db.query(model)


def get_repo(
    db: Session = Depends(get_db),
    ctx: RequestContext = Depends(get_context),
) -> ScopedRepository:
    """Dependencia que os endpoints declaram: `repo: ScopedRepository = Depends(get_repo)`."""
    return ScopedRepository(db, ctx)
