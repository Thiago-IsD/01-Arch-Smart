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
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Query, Session

from app.core.errors import NotFound
from app.core.security import RequestContext, get_context
from app.db.session import get_db

M = TypeVar("M")

# Colunas que so o contexto preenche. Usado duas vezes em create(): para
# descartar o literal (`account_id=...`) e para descartar o relacionamento
# que aponta para a mesma coluna (`account=...`) — ver
# `_kwargs_de_relacionamento_protegido` logo abaixo.
_COLUNAS_DO_CONTEXTO = {"account_id", "created_by"}


def _kwargs_de_relacionamento_protegido(model: type) -> set[str]:
    """
    Nomes de kwargs de RELACIONAMENTO (nao de coluna) cuja coluna local e
    account_id ou created_by.

    O SQLAlchemy escreve a FK de um relacionamento many-to-one na sessao no
    FLUSH, depois que `__init__` ja rodou — entao
    `Model(account_id=ctx.account_id, account=conta_alheia)` deixa o
    `account_id` certo por um instante e o flush sobrescreve com o FK de
    `conta_alheia`. `create()` descarta esses kwargs pelo MESMO motivo que
    descarta o literal: a unica origem dessas colunas e o contexto.

    Descoberto pelo mapper (`sqlalchemy.inspect`), nao por um nome fixo como
    "account": um model que chamar a relacao de `conta` ou `owner` fica
    coberto sem ninguem lembrar de atualizar uma lista.
    """
    return {
        rel.key
        for rel in sa_inspect(model).relationships
        if {coluna.name for coluna in rel.local_columns} & _COLUNAS_DO_CONTEXTO
    }


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

    Onde a garantia PARA. A `Query` de `query()`/`get()`/`obter()` continua
    filtrada depois de `.filter()`, `.order_by()` e `.limit()` — eles fazem
    AND sobre o criterio que ja existe. Ela NAO sobrevive a:

    - `.union()` / `.union_all()` / `.except_()` / `.intersect()` — o SELECT
      composto embrulha os dois lados; linhas de uma segunda query sem
      escopo voltam por uma `Query` que parece escopada.
    - `.from_statement(text(...))` — descarta o criterio inteiro.
    - `.join(Outro).with_entities(Outro)` — o filtro de escopo ainda
      restringe o `Project` do join, mas o `Outro` devolvido so esta
      limitado pela condicao do join, nao por account_id nenhum dele.
    - Travessia de relacionamento — `repo.query(Project).first().client`
      carrega o `Client` pela FK, sem filtro de conta. Seguro hoje so porque
      toda escrita mantem as FKs dentro de uma conta so; nada no banco
      obriga isso.
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
                "tools/, alembic/ e tests/."
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
        `created_by` passado em `campos` — literal OU via kwarg de
        relacionamento (`account=...`, `created_by_user=...`) — e DESCARTADO
        em silencio: o unico caminho ate essas colunas e o contexto.

        O kwarg de relacionamento importa porque o SQLAlchemy escreve a FK
        dele no flush, DEPOIS deste `__init__`: sem descartar `account=...`
        aqui, `create(Client, account=conta_alheia)` sobrescreveria o
        `account_id` certo assim que a sessao desse flush.
        """
        self._exigir_coluna_de_conta(model)
        campos.pop("account_id", None)
        campos.pop("created_by", None)
        for chave in _kwargs_de_relacionamento_protegido(model):
            campos.pop(chave, None)
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

        Model sem `account_id` levanta `EscopoImpossivel`, nao `NotFound`:
        sem coluna de conta nao ha "de outra conta" para comparar, entao
        `NotFound` aqui seria um 404 fingindo ser o caso normal.
        """
        self._exigir_coluna_de_conta(type(objeto))
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
