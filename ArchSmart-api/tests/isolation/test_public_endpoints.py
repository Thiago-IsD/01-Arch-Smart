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
    resposta = client_anon.post(
        "/api/products/normalize",
        json={"text": "Sofá 3 lugares", "source_url": "https://exemplo.com/sofa"},
    )
    assert resposta.status_code in (401, 422)


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
