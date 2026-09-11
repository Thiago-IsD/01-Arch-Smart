"""
Endpoint de telemetria: escopo, lote e identidade.

O teste do account_id forjado e o que fecha a tarefa. Ele nao prova que o
endpoint "ignora um campo": prova que a conta gravada e a da SESSAO, mesmo
quando o corpo pede outra (Art. 1).
"""
from sqlalchemy.orm import Session

from app.models.all_models import ProductEvent


def test_evento_e_gravado_na_conta_da_sessao(db: Session, client_a, conta_a):
    conta, usuario = conta_a

    r = client_a.post(
        "/api/telemetry/events",
        json={"eventos": [{"name": "screen_viewed", "properties": {"screen": "/library"}}]},
    )

    assert r.status_code == 204
    evento = db.query(ProductEvent).one()
    assert evento.name == "screen_viewed"
    assert evento.account_id == conta.id
    assert evento.created_by == usuario.id


def test_account_id_forjado_no_corpo_e_ignorado(db: Session, client_a, conta_a, conta_b):
    minha_conta, _ = conta_a
    conta_alheia, _ = conta_b

    r = client_a.post(
        "/api/telemetry/events",
        json={
            "eventos": [
                {
                    "name": "screen_viewed",
                    "properties": {"screen": "/library"},
                    "account_id": str(conta_alheia.id),
                }
            ]
        },
    )

    assert r.status_code == 204
    evento = db.query(ProductEvent).one()
    assert evento.account_id == minha_conta.id
    assert evento.account_id != conta_alheia.id


def test_lote_grava_todos_os_eventos(db: Session, client_a):
    r = client_a.post(
        "/api/telemetry/events",
        json={
            "eventos": [
                {"name": "screen_viewed", "properties": {"screen": "/library"}},
                {"name": "screen_viewed", "properties": {"screen": "/dashboard"}},
            ]
        },
    )

    assert r.status_code == 204
    assert db.query(ProductEvent).count() == 2


def test_lote_vazio_nao_grava_nada(db: Session, client_a):
    r = client_a.post("/api/telemetry/events", json={"eventos": []})

    assert r.status_code == 204
    assert db.query(ProductEvent).count() == 0


def test_anonimo_nao_grava(db: Session, client_anon):
    """
    O status certo aqui e 422, nao 401/403: o FastAPI rejeita a requisicao
    por falta do header `authorization` antes mesmo do Depends(get_repo)
    (que resolve `get_context`) rodar — o mesmo motivo documentado em
    tests/isolation/test_public_endpoints.py::test_normalize_exige_autenticacao.
    Afirmar so o status deixaria passar despercebida uma mudanca que
    trocasse o motivo do 422 (por exemplo, um schema de corpo alterado) sem
    que a autenticacao continuasse exigida — por isso o teste tambem checa
    que o corpo do erro aponta para o header ausente.
    """
    r = client_anon.post(
        "/api/telemetry/events",
        json={"eventos": [{"name": "screen_viewed", "properties": {}}]},
    )

    assert r.status_code == 422
    assert "authorization" in str(r.json()["detail"]).lower()
    assert db.query(ProductEvent).count() == 0
