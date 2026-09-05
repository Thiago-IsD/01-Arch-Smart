"""
Toda tabela de dado tem indice em account_id.

Depois da Secao 4, TODA query de endpoint tem `WHERE account_id = ?`. Sem o
indice, cada uma delas e um sequential scan que cresce com o banco inteiro, e
nao com a conta.

Os compostos abaixo sao so os que uma query real do repositorio usa hoje
(checado em app/api/) — nao a lista original de oito da spec, que tinha tres
sem query nenhuma por tras e faltava duas. Ver task-7-report.md para o
levantamento completo, com o endpoint e a linha que justifica (ou nao) cada
um dos que entraram e dos que ficaram de fora.
"""
import pytest

from app.db.base_class import Base
import app.models.all_models  # noqa: F401
from tests.test_colunas_de_escopo import tabelas_de_dado

COMPOSTOS_ESPERADOS = {
    ("projects", ("account_id", "created_at")),
    ("products", ("account_id", "created_at")),
    ("budget_items", ("budget_id",)),
    ("budget_items", ("environment_id",)),
    ("environments", ("project_id",)),
    ("events", ("account_id", "start_time")),
    ("financial_entries", ("account_id", "due_date")),
    ("notifications", ("account_id", "created_at")),
    ("presentation_comments", ("presentation_id", "created_at")),
}


def _colunas_dos_indices(tabela: str) -> set[tuple[str, ...]]:
    return {
        tuple(c.name for c in indice.columns)
        for indice in Base.metadata.tables[tabela].indexes
    }


@pytest.mark.parametrize("tabela", tabelas_de_dado())
def test_toda_tabela_de_dado_tem_indice_em_account_id(tabela: str):
    conjuntos = _colunas_dos_indices(tabela)
    tem = any(colunas and colunas[0] == "account_id" for colunas in conjuntos)
    assert tem, (
        f"{tabela} nao tem indice comecando em account_id. Indices desta "
        f"tabela: {sorted(conjuntos)}"
    )


@pytest.mark.parametrize("tabela,colunas", sorted(COMPOSTOS_ESPERADOS))
def test_indices_compostos_existem(tabela: str, colunas: tuple[str, ...]):
    assert colunas in _colunas_dos_indices(tabela), (
        f"falta indice {colunas} em {tabela}"
    )
