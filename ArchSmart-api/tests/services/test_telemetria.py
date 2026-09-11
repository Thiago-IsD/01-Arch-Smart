"""
Telemetria: escopo e isolamento de falha.

O segundo teste e o que importa. Sem o SAVEPOINT dentro de `track`, um INSERT
que estoura invalida a transacao inteira do SQLAlchemy, e a requisicao que a
telemetria so deveria observar morre com PendingRollbackError no proximo
flush. O teste prova que a sessao continua utilizavel depois da falha.
"""
from sqlalchemy.orm import Session

from app.db.repository import ScopedRepository
from app.models.all_models import ProductEvent, Project
from app.services.telemetry_service import track
from tests.conftest import _contexto_de, criar_projeto


def _repo(db: Session, usuario) -> ScopedRepository:
    return ScopedRepository(db, _contexto_de(db, usuario))


def test_track_grava_o_evento_na_conta_da_sessao(db: Session, conta_a):
    conta, usuario = conta_a

    track(_repo(db, usuario), "screen_viewed", {"screen": "/library"})
    db.flush()

    evento = db.query(ProductEvent).one()
    assert evento.name == "screen_viewed"
    assert evento.properties == {"screen": "/library"}
    assert evento.account_id == conta.id
    assert evento.created_by == usuario.id


def test_track_sem_propriedades_grava_objeto_vazio(db: Session, conta_a):
    _, usuario = conta_a

    track(_repo(db, usuario), "app_opened")
    db.flush()

    assert db.query(ProductEvent).one().properties == {}


def test_track_que_estoura_nao_derruba_a_transacao_de_fora(db: Session, conta_a):
    conta, usuario = conta_a

    # `name` e NOT NULL: passar None faz o INSERT do savepoint estourar.
    track(_repo(db, usuario), None, {"qualquer": "coisa"})

    # A prova: a sessao continua utilizavel depois da falha da telemetria.
    projeto = criar_projeto(db, conta, "Projeto depois da falha")
    db.flush()

    assert db.query(Project).filter(Project.id == projeto.id).one() is not None
    assert db.query(ProductEvent).count() == 0
