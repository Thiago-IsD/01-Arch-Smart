"""
Erro do dominio vira resposta HTTP em pt-BR, e o rastro tecnico fica no log.

O teste do vazamento e o mais importante: ele reproduz o padrao
`detail=str(e)`, que mandava mensagem de driver e nome de coluna para o
cliente.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import (
    DomainError,
    Forbidden,
    NotFound,
    QuotaExceeded,
    ValidacaoDeDominio,
    registrar_handlers,
)


@pytest.fixture
def app_de_erro() -> TestClient:
    app = FastAPI()
    registrar_handlers(app)

    @app.get("/nao-encontrado")
    def _nao_encontrado():
        raise NotFound()

    @app.get("/proibido")
    def _proibido():
        raise Forbidden()

    @app.get("/cota")
    def _cota():
        raise QuotaExceeded("Seu plano permite 2 projetos.")

    @app.get("/invalido")
    def _invalido():
        raise ValidacaoDeDominio("A area do ambiente precisa ser positiva.")

    @app.get("/explode")
    def _explode():
        raise RuntimeError(
            "connection to server at 'db.exemplo.supabase.co' failed: senha=hunter2"
        )

    return TestClient(app, raise_server_exceptions=False)


def test_not_found_vira_404_em_portugues(app_de_erro):
    r = app_de_erro.get("/nao-encontrado")
    assert r.status_code == 404
    assert r.json()["detail"] == "Recurso não encontrado."


def test_forbidden_vira_403(app_de_erro):
    assert app_de_erro.get("/proibido").status_code == 403


def test_quota_vira_402_com_a_mensagem_dada(app_de_erro):
    r = app_de_erro.get("/cota")
    assert r.status_code == 402
    assert r.json()["detail"] == "Seu plano permite 2 projetos."


def test_validacao_vira_422(app_de_erro):
    r = app_de_erro.get("/invalido")
    assert r.status_code == 422
    assert r.json()["detail"] == "A area do ambiente precisa ser positiva."


def test_excecao_inesperada_nao_vaza_detalhe(app_de_erro):
    """
    Era o `detail=str(e)`: host, senha e mensagem de driver na resposta.
    """
    r = app_de_erro.get("/explode")
    assert r.status_code == 500
    corpo = r.text
    assert "supabase.co" not in corpo
    assert "hunter2" not in corpo
    assert "connection to server" not in corpo
    assert r.json()["detail"] == "Erro interno. Tente novamente."


def test_excecao_inesperada_vai_para_o_log(app_de_erro, caplog):
    """
    O rastro nao some — ele muda de lugar. Sem isto, o handler viraria uma
    forma elegante de esconder defeito.
    """
    with caplog.at_level("ERROR"):
        app_de_erro.get("/explode")
    assert any("hunter2" in r.getMessage() or r.exc_info for r in caplog.records)


def test_domain_error_e_a_base_de_todas():
    for classe in (NotFound, Forbidden, QuotaExceeded, ValidacaoDeDominio):
        assert issubclass(classe, DomainError)
