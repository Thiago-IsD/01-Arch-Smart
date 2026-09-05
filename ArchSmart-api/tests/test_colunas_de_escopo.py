"""
As colunas de escopo existem em toda tabela de dado — e so nelas.

Este teste e a rede que impede uma tabela nova de nascer sem `account_id` ou
`created_by`. Ele le o metadata do SQLAlchemy, entao uma tabela adicionada em
all_models.py aparece aqui sem ninguem lembrar de atualizar lista nenhuma: ou
ela entra em CATALOGO_GLOBAL com justificativa, ou tem as colunas.
"""
import pytest

from app.db.base_class import Base
import app.models.all_models  # noqa: F401  (popula o metadata)

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
