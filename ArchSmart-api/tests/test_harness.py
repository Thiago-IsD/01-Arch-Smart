"""Prova que o harness enxerga o que o MagicMock não enxergava."""
from app.models.all_models import Project

from tests.conftest import criar_projeto


def test_projeto_de_uma_conta_nao_aparece_para_a_outra(db, conta_a, conta_b):
    conta_a_obj, _ = conta_a
    conta_b_obj, _ = conta_b

    criar_projeto(db, conta_a_obj, "Casa do Lago")

    visiveis_para_b = (
        db.query(Project).filter(Project.account_id == conta_b_obj.id).all()
    )
    assert visiveis_para_b == []

    visiveis_para_a = (
        db.query(Project).filter(Project.account_id == conta_a_obj.id).all()
    )
    assert len(visiveis_para_a) == 1


def test_rollback_entre_testes(db):
    assert db.query(Project).count() == 0
