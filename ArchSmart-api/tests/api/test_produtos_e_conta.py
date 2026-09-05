"""
Biblioteca de produtos e dados da conta: contrato e isolamento.

O produto e o caso em que o vazamento seria mais caro: a biblioteca de um
escritorio e o ativo dele, com preco de custo e markup.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Product, ProductState, ProductStateStatus


def _estado_normalizado(db: Session) -> ProductState:
    """
    `GET /api/products` faz INNER JOIN com ProductState e filtra pelo estado
    padrao (NORMALIZED) — um Product sem state_id fica invisivel para ele,
    isolamento de conta a parte. Sem isto, o teste de isolamento falharia por
    um motivo que nao tem nada a ver com conta.
    """
    estado = (
        db.query(ProductState)
        .filter(ProductState.status == ProductStateStatus.NORMALIZED)
        .first()
    )
    if estado is None:
        estado = ProductState(name="Normalized", status=ProductStateStatus.NORMALIZED)
        db.add(estado)
        db.flush()
    return estado


def _produto(db: Session, conta, nome: str) -> Product:
    produto = Product(
        account_id=conta.id,
        name=nome,
        price=100.0,
        cost_price=60.0,
        state_id=_estado_normalizado(db).id,
    )
    db.add(produto)
    db.flush()
    return produto


def test_biblioteca_so_traz_produtos_da_conta(db, client_a, conta_a, conta_b):
    _produto(db, conta_a[0], "Meu porcelanato")
    _produto(db, conta_b[0], "Porcelanato alheio")

    corpo = client_a.get("/api/products/").json()
    nomes = [p["name"] for p in (corpo if isinstance(corpo, list) else corpo["items"])]

    assert nomes == ["Meu porcelanato"]


def test_produto_alheio_e_404(db, client_a, conta_b):
    alheio = _produto(db, conta_b[0], "Alheio")

    assert client_a.get(f"/api/products/{alheio.id}").status_code == 404


def test_editar_produto_alheio_e_404(db, client_a, conta_b):
    alheio = _produto(db, conta_b[0], "Alheio")

    r = client_a.put(f"/api/products/{alheio.id}", json={"name": "Sequestrado"})

    assert r.status_code == 404
    db.refresh(alheio)
    assert alheio.name == "Alheio"


def test_criar_produto_grava_conta_e_autor(db, client_a, conta_a):
    r = client_a.post("/api/products/", json={"name": "Novo", "price": 10.0})

    assert r.status_code in (200, 201)
    criado = db.query(Product).filter(Product.name == "Novo").first()
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id


def test_catalogo_global_e_compartilhado_entre_contas(client_a, client_b):
    """
    product_origins e product_states sao catalogo global: nao tem
    account_id. Nao ha endpoint que os liste isoladamente (nao existe
    GET /api/products/origins — verificado em product_router.py); a prova
    de que a excecao esta certa vem de POST /api/products, que resolve o
    ProductOrigin/ProductState padrao (MANUAL/NORMALIZED) por
    `db.query(...).first()` sem filtro de conta. Se essa query fosse
    filtrada por conta (ou se cada conta acabasse com sua propria linha de
    catalogo), as duas contas receberiam origin_id/state_id diferentes na
    primeira criacao.
    """
    a = client_a.post("/api/products/", json={"name": "Produto A", "price": 1.0}).json()
    b = client_b.post("/api/products/", json={"name": "Produto B", "price": 1.0}).json()

    assert a["origin_id"] == b["origin_id"]
    assert a["state_id"] == b["state_id"]
