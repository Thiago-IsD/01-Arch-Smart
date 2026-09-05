"""
As colunas de escopo existem em toda tabela de dado — e so nelas.

Este teste e a rede que impede uma tabela nova de nascer sem `account_id` ou
`created_by`. Ele le o metadata do SQLAlchemy, entao uma tabela adicionada em
all_models.py aparece aqui sem ninguem lembrar de atualizar lista nenhuma: ou
ela entra em CATALOGO_GLOBAL com justificativa, ou tem as colunas.
"""
import ast
from pathlib import Path

import pytest

from app.db.base_class import Base
import app.models.all_models  # noqa: F401  (popula o metadata)

RAIZ = Path(__file__).resolve().parents[1]

# Tabelas que NAO tem dono. Cada entrada precisa de motivo — a lista so cresce
# com decisao registrada, nunca por conveniencia de fazer um teste passar.
CATALOGO_GLOBAL = {
    "accounts": "e a propria conta; account_id seria auto-referencia",
    "plans": "catalogo global de planos",
    "product_origins": "catalogo global",
    "product_states": "catalogo global",
    "documents": "embeddings sem FK e sem consumidor em app/; escopo adiado",
    "alembic_version": "controle do Alembic, nao e dado da aplicacao",
}


def tabelas_de_dado() -> list[str]:
    return sorted(t for t in Base.metadata.tables if t not in CATALOGO_GLOBAL)


def test_sao_vinte_e_uma_tabelas_de_dado():
    """
    Trava a contagem. Se este teste falhar, uma tabela foi adicionada ou
    removida — atualize o numero DEPOIS de decidir o escopo dela, nunca antes.
    """
    assert len(tabelas_de_dado()) == 21


@pytest.mark.parametrize("tabela", tabelas_de_dado())
def test_toda_tabela_de_dado_tem_created_by(tabela: str):
    colunas = Base.metadata.tables[tabela].columns
    assert "created_by" in colunas, (
        f"{tabela} nao tem created_by. Se ela nao tem dono, declare em "
        "CATALOGO_GLOBAL com o motivo."
    )
    assert colunas["created_by"].nullable, (
        f"{tabela}.created_by precisa ser nullable: o portal publico e o "
        "formulario de leads gravam sem sessao de usuario."
    )


# As 10 que ganharam account_id na Secao 4, Tarefa 4. A lista existe para o
# teste de NOT NULL: nas outras 11 a coluna e mais antiga e ha linha legada.
GANHARAM_ACCOUNT_ID = [
    "budget_items",
    "budgets",
    "environment_dnas",
    "environments",
    "item_options",
    "presentation_acceptances",
    "presentation_comments",
    "presentation_environments",
    "presentations",
    "project_slots",
]


@pytest.mark.parametrize("tabela", tabelas_de_dado())
def test_toda_tabela_de_dado_tem_account_id(tabela: str):
    colunas = Base.metadata.tables[tabela].columns
    assert "account_id" in colunas, (
        f"{tabela} nao tem account_id. Sem ela o ScopedRepository levanta "
        "TypeError e nenhum endpoint consegue ler a tabela."
    )


@pytest.mark.parametrize("tabela", GANHARAM_ACCOUNT_ID)
def test_account_id_e_obrigatorio_nas_dez(tabela: str):
    coluna = Base.metadata.tables[tabela].columns["account_id"]
    assert not coluna.nullable, (
        f"{tabela}.account_id precisa ser NOT NULL: uma linha sem conta e "
        "invisivel para o ScopedRepository e vira dado orfao."
    )
    assert coluna.foreign_keys, f"{tabela}.account_id precisa de FK para accounts"


# Nomes de classe (nao de tabela) das dez que ganharam account_id NOT NULL na
# Secao 4, Tarefa 4 — o lint abaixo casa por nome de construtor no codigo-fonte.
DEZ_QUE_GANHARAM_ACCOUNT_ID = {
    "Environment",
    "EnvironmentDNA",
    "Budget",
    "BudgetItem",
    "ItemOption",
    "Presentation",
    "PresentationEnvironment",
    "PresentationAcceptance",
    "PresentationComment",
    "ProjectSlot",
}


def _construcoes_sem_account_id() -> list[str]:
    """
    Varre app/ (exceto app/tests/, a suite antiga que sai na Secao 4) por
    construcoes diretas `Modelo(...)` de uma das dez tabelas que ganharam
    account_id NOT NULL nesta tarefa, usando `ast` — nao regex, porque as
    chamadas se espalham por varias linhas e um regex mentiria.

    So casa `ast.Call` cujo `func` e um `ast.Name` (construcao direta,
    `Modelo(...)`). Depois das Tarefas 11-15 estas viram
    `repo.create(Modelo, ...)` — um `ast.Attribute`, que o walk ignora de
    proposito: `ScopedRepository.create()` preenche account_id sozinho,
    entao este lint se aposenta sozinho conforme a conversao avanca, sem
    brigar com ela.
    """
    ofensores: list[str] = []
    for caminho in sorted((RAIZ / "app").rglob("*.py")):
        relativo = caminho.relative_to(RAIZ)
        if relativo.parts[1:2] == ("tests",):
            continue
        arvore = ast.parse(
            caminho.read_text(encoding="utf-8"), filename=str(caminho)
        )
        for node in ast.walk(arvore):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
                continue
            if node.func.id not in DEZ_QUE_GANHARAM_ACCOUNT_ID:
                continue
            nomes_kw = {kw.arg for kw in node.keywords if kw.arg is not None}
            if "account_id" not in nomes_kw:
                ofensores.append(f"{relativo.as_posix()}:{node.lineno}")
    return ofensores


def test_toda_construcao_das_dez_tabelas_preenche_account_id():
    """
    As dez colunas de GANHARAM_ACCOUNT_ID sao NOT NULL desde a migracao desta
    tarefa: uma `Modelo(...)` que nao passa `account_id` vira
    `IntegrityError` em tempo de execucao — um 500 no primeiro create que
    passar por ali. Antes deste teste existir, onze pontos de criacao (em
    budgets_router.py, environments_router.py e presentations.py) ficaram
    exatamente assim atras de uma suite verde, porque nenhum teste ate entao
    exercitava esses caminhos o bastante para estourar o NOT NULL.
    """
    ofensores = _construcoes_sem_account_id()
    assert ofensores == [], (
        "construcao sem account_id (vira IntegrityError em runtime, um 500 "
        "no endpoint de criacao):\n" + "\n".join(f"  - {o}" for o in ofensores)
    )
