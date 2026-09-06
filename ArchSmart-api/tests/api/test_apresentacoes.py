"""
Apresentacoes: contrato e isolamento no lado do arquiteto.

O lado do cliente final — o portal publico — ja tem 10 testes em
tests/isolation/test_portal_access.py, da Secao 1. Eles nao sao repetidos
aqui; o que esta tarefa nao pode fazer e quebra-los.

Rotas verificadas em app/api/endpoints/presentations.py antes de escrever
estes testes (o brief original apontava POST /api/presentations, que nao
existe: criar apresentacao e sempre por baixo do projeto).
"""
from sqlalchemy.orm import Session

from app.models.all_models import Presentation
from tests.conftest import criar_projeto


def _apresentacao(db: Session, conta, nome: str) -> Presentation:
    projeto = criar_projeto(db, conta, f"Projeto de {nome}")
    apresentacao = Presentation(
        account_id=conta.id, project_id=projeto.id, name=nome
    )
    db.add(apresentacao)
    db.flush()
    return apresentacao


def test_lista_so_as_apresentacoes_da_conta(db: Session, client_a, conta_a, conta_b):
    _apresentacao(db, conta_a[0], "Minha")
    _apresentacao(db, conta_b[0], "Alheia")

    corpo = client_a.get("/api/presentations").json()

    assert [p["name"] for p in corpo] == ["Minha"]


def test_apresentacao_alheia_e_404(db: Session, client_a, conta_b):
    alheia = _apresentacao(db, conta_b[0], "Alheia")

    assert client_a.get(f"/api/presentations/{alheia.id}").status_code == 404


def test_apagar_apresentacao_alheia_e_404(db: Session, client_a, conta_b):
    alheia = _apresentacao(db, conta_b[0], "Alheia")

    assert client_a.delete(f"/api/presentations/{alheia.id}").status_code == 404
    assert (
        db.query(Presentation).filter(Presentation.id == alheia.id).first()
        is not None
    )


def test_criar_apresentacao_grava_conta_e_autor(db: Session, client_a, conta_a):
    projeto = criar_projeto(db, conta_a[0], "Meu")

    r = client_a.post(
        f"/api/projects/{projeto.id}/presentations",
        json={"project_id": str(projeto.id), "name": "Proposta"},
    )

    assert r.status_code in (200, 201)
    criada = (
        db.query(Presentation).filter(Presentation.name == "Proposta").first()
    )
    assert criada.account_id == conta_a[0].id
    assert criada.created_by == conta_a[1].id


def test_criar_apresentacao_em_projeto_alheio_e_404(db: Session, client_a, conta_b):
    projeto = criar_projeto(db, conta_b[0], "Alheio")

    r = client_a.post(
        f"/api/projects/{projeto.id}/presentations",
        json={"project_id": str(projeto.id), "name": "Invasao"},
    )

    assert r.status_code == 404
    assert (
        db.query(Presentation).filter(Presentation.name == "Invasao").first()
        is None
    )
