"""
Ambientes: contrato e isolamento.

`environments` ganhou account_id proprio na Tarefa 4. Antes dela, o isolamento
dependia de descer por project_id ate projects — e era o tipo de caminho que
um endpoint novo esquecia.

Nao existe rota `GET /api/environments/{id}` (detalhe unico) hoje — so
`/api/projects/{project_id}/environments` (lista), `PUT
/api/environments/{env_id}/dna` e `DELETE /api/environments/{env_id}`. Os
testes de isolamento abaixo usam as rotas que de fato existem, verificadas com
o snippet do brief antes de escrever isto.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Environment
from tests.conftest import criar_projeto


def _ambiente(db: Session, conta, nome: str) -> Environment:
    projeto = criar_projeto(db, conta, f"Projeto de {nome}")
    ambiente = Environment(account_id=conta.id, project_id=projeto.id, name=nome)
    db.add(ambiente)
    db.flush()
    return ambiente


def test_atualizar_dna_de_ambiente_alheio_e_404(db: Session, client_a, conta_b):
    alheio = _ambiente(db, conta_b[0], "Sala alheia")

    r = client_a.put(
        f"/api/environments/{alheio.id}/dna",
        json={"floor_area": 1.0, "wall_area": 1.0, "ceiling_area": 1.0},
    )

    assert r.status_code == 404


def test_apagar_ambiente_alheio_e_404(db: Session, client_a, conta_b):
    alheio = _ambiente(db, conta_b[0], "Sala alheia")

    assert client_a.delete(f"/api/environments/{alheio.id}").status_code == 404
    assert db.query(Environment).filter(Environment.id == alheio.id).first() is not None


def test_lista_de_ambientes_de_projeto_alheio_e_404(db: Session, client_a, conta_b):
    projeto = criar_projeto(db, conta_b[0], "Alheio")

    r = client_a.get(f"/api/projects/{projeto.id}/environments")

    assert r.status_code == 404


def test_criar_ambiente_grava_conta_e_autor(db: Session, client_a, conta_a):
    projeto = criar_projeto(db, conta_a[0], "Meu")

    r = client_a.post(
        f"/api/projects/{projeto.id}/environments", json={"name": "Cozinha"}
    )

    assert r.status_code in (200, 201)
    criado = db.query(Environment).filter(Environment.name == "Cozinha").first()
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id


def test_criar_ambiente_em_projeto_alheio_e_404(db: Session, client_a, conta_b):
    projeto = criar_projeto(db, conta_b[0], "Alheio")

    r = client_a.post(
        f"/api/projects/{projeto.id}/environments", json={"name": "Invasao"}
    )

    assert r.status_code == 404
    assert db.query(Environment).filter(Environment.name == "Invasao").first() is None
