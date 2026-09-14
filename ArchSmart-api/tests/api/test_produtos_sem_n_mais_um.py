"""
A lista da Biblioteca nao faz uma consulta por estado e origem da pagina.

`ProductResponse` traz `state` e `origin` aninhados, e os dois sao
`relationship` com carga preguicosa: sem `joinedload`, o Pydantic toca cada um
na serializacao e a sessao emite uma consulta por **valor distinto** de
`state_id`/`origin_id` na pagina. Nao e proporcional ao numero de linhas — a
identity map agrupa —, mas cresce com a variedade da pagina, e foi medido em
producao: `/api/products/?size=15` gastava **8 consultas**, das quais 4 eram
essas (1 de `product_states` e 3 de `product_origins`).

Isso importa porque cada consulta e uma ida a rede: medido em 13/09/2026
contra a API implantada, **0,17 s cada** — ver
`docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md`.

Como o teste do orcamento (`test_orcamento_sem_n_mais_um.py`), quem carrega a
garantia e a **constancia**: o numero de consultas e o mesmo para 5 produtos
com 5 estados distintos e para 20 produtos com 20 estados distintos. Um teto
fixo sozinho passaria a falsa sensacao de garantia — e um `==` exato
reprovaria uma troca legitima de estrategia de carga.
"""
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.all_models import (
    Account,
    Product,
    ProductOrigin,
    ProductOriginType,
    ProductState,
    ProductStateStatus,
    User,
)


class ContadorDeQueries:
    def __init__(self, conexao):
        self.conexao = conexao
        self.sqls: list[str] = []

    def __enter__(self):
        event.listen(self.conexao, "before_cursor_execute", self._registrar)
        return self

    def __exit__(self, *_):
        event.remove(self.conexao, "before_cursor_execute", self._registrar)

    def _registrar(self, conn, cursor, sql, params, context, executemany):
        self.sqls.append(sql)

    def __len__(self):
        return len(self.sqls)


def _produtos_com_estados_distintos(
    db: Session, conta: Account, usuario: User, quantos: int
) -> None:
    """
    `quantos` produtos, cada um com o SEU estado e a SUA origem. Compartilhar
    as linhas de catalogo — que e o que o seed faz — esconderia o defeito:
    a identity map agruparia tudo em 2 consultas mesmo sem `joinedload`.
    """
    for indice in range(quantos):
        estado = ProductState(
            name=f"Estado {indice}", status=ProductStateStatus.NORMALIZED
        )
        origem = ProductOrigin(name=f"Origem {indice}", type=ProductOriginType.MANUAL)
        db.add_all([estado, origem])
        db.flush()
        db.add(
            Product(
                account_id=conta.id,
                created_by=usuario.id,
                name=f"Produto {indice}",
                price=100.0,
                state_id=estado.id,
                origin_id=origem.id,
            )
        )
    db.flush()


def _consultas_da_lista(db: Session, client, quantos: int) -> int:
    with ContadorDeQueries(db.connection()) as contador:
        resposta = client.get(f"/api/products/?page=1&size={quantos}")
    assert resposta.status_code == 200, resposta.text
    assert len(resposta.json()["items"]) == quantos
    # Todo item volta com estado e origem preenchidos: se o `joinedload` um dia
    # virar um `load_only` que some com os aninhados, a contagem despencaria e
    # o teste passaria por engano.
    assert all(item["state"] and item["origin"] for item in resposta.json()["items"])
    return len(contador)


def test_a_lista_nao_consulta_uma_vez_por_estado_e_origem_da_pagina(
    db: Session, conta_a, client_a
):
    conta, usuario = conta_a
    _produtos_com_estados_distintos(db, conta, usuario, 5)
    com_cinco = _consultas_da_lista(db, client_a, 5)

    _produtos_com_estados_distintos(db, conta, usuario, 15)
    com_vinte = _consultas_da_lista(db, client_a, 20)

    assert com_cinco == com_vinte, (
        "o numero de consultas cresceu com a variedade da pagina: "
        f"{com_cinco} para 5 produtos, {com_vinte} para 20. "
        "Carregue `state` e `origin` junto da pagina."
    )
    # Teto do custo de hoje: 1 contagem + 1 pagina com os dois joins. A folga
    # de 1 pega um round trip acidental sem travar o numero exato; quem trocar
    # a estrategia de carga de proposito ajusta o teto no mesmo commit.
    assert com_vinte <= 3, f"{com_vinte} consultas para uma pagina da lista"
