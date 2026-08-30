"""Regressao do achado P0-3: endpoints sem autenticacao alguma."""

from app.main import app
from app.models.all_models import Product


def test_seed_captured_nao_existe_mais(client_anon, db):
    """
    A vulnerabilidade era escrita no banco sem autenticacao — nao um codigo HTTP.
    Por isso o teste afirma a propriedade de seguranca, e nao o status.

    Detalhe de roteamento: depois de apagada, a URL passa a casar com
    GET /{product_id}, cuja conversao para UUID falha e devolve 422, nao 404.
    """
    caminhos = {getattr(rota, "path", "") for rota in app.routes}
    assert not any("seed-captured" in caminho for caminho in caminhos), (
        "a rota seed-captured ainda esta registrada na aplicacao"
    )

    produtos_antes = db.query(Product).count()
    resposta = client_anon.get("/api/products/seed-captured")

    assert resposta.status_code not in (200, 201)
    assert db.query(Product).count() == produtos_antes, (
        "chamada anonima criou produto no banco"
    )


def test_normalize_exige_autenticacao(client_anon):
    """
    O status certo aqui e 422, nao 401: o FastAPI rejeita a requisicao por
    falta do header `authorization` antes mesmo do Depends(get_current_user)
    rodar. Afirmar so o status deixaria passar despercebida uma mudanca que
    trocasse o motivo do 422 (por exemplo, um schema de corpo alterado) sem
    que a autenticacao continuasse exigida — por isso o teste tambem checa
    que o corpo do erro aponta para o header ausente.
    """
    resposta = client_anon.post(
        "/api/products/normalize",
        json={"text": "Sofá 3 lugares", "source_url": "https://exemplo.com/sofa"},
    )
    assert resposta.status_code == 422
    assert "authorization" in str(resposta.json()["detail"]).lower()


def test_verify_password_tem_rate_limit(client_anon, db, conta_a):
    from app.core.portal_security import hash_password
    from app.models.all_models import Presentation

    from tests.conftest import criar_projeto

    conta, _ = conta_a
    projeto = criar_projeto(db, conta, "Projeto RL")
    apresentacao = Presentation(
        project_id=projeto.id,
        name="Proposta RL",
        access_password_hash=hash_password("certa"),
    )
    db.add(apresentacao)
    db.flush()

    codigos = []
    for _ in range(12):
        r = client_anon.post(
            f"/public/presentations/{apresentacao.id}/verify-password",
            json={"password": "errada"},
        )
        codigos.append(r.status_code)

    assert 429 in codigos, "sem rate limit, a senha do portal e forca-brutavel"


def test_rate_limit_do_verify_password_e_por_apresentacao_nao_por_ip(
    client_anon, db, conta_a
):
    """
    Regressao do IMPORTANT 5 da revisao final: em producao o uvicorn roda sem
    --forwarded-allow-ips, entao get_remote_address resolve sempre para o IP
    do proxy — o limite vira orcamento GLOBAL da plataforma, e um atacante
    tranca todos os portais esgotando o de um so.

    O TestClient sempre usa o mesmo "IP" simulado, entao este teste so passa
    se a chave do limite for o UUID da apresentacao: esgotar o limite da
    apresentacao A nao pode afetar a apresentacao B.
    """
    from app.core.portal_security import hash_password
    from app.models.all_models import Presentation

    from tests.conftest import criar_projeto

    conta, _ = conta_a
    projeto = criar_projeto(db, conta, "Projeto RL 2")

    apresentacao_a = Presentation(
        project_id=projeto.id,
        name="Proposta RL A",
        access_password_hash=hash_password("certa"),
    )
    apresentacao_b = Presentation(
        project_id=projeto.id,
        name="Proposta RL B",
        access_password_hash=hash_password("certa"),
    )
    db.add_all([apresentacao_a, apresentacao_b])
    db.flush()

    for _ in range(12):
        client_anon.post(
            f"/public/presentations/{apresentacao_a.id}/verify-password",
            json={"password": "errada"},
        )

    resposta_b = client_anon.post(
        f"/public/presentations/{apresentacao_b.id}/verify-password",
        json={"password": "errada"},
    )
    assert resposta_b.status_code != 429, (
        "esgotar o limite de uma apresentacao trancou outra apresentacao — "
        "a chave do limite ainda esta presa ao IP do proxy"
    )
