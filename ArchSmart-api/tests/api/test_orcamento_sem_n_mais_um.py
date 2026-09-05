"""
O orcamento inteiro em duas queries — contadas, nao estimadas.

"~300 para 2" e uma afirmacao de numero, e neste repositorio numero afirmado
sem medicao e numero errado. O contador abaixo E a medicao.
"""
import pytest
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.all_models import (
    Budget,
    BudgetItem,
    Client,
    Environment,
    EnvironmentDNA,
    ItemOption,
    Product,
    Project,
    RuleType,
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


@pytest.fixture
def orcamento_com_trinta_itens(db: Session, conta_a):
    conta = conta_a[0]
    cliente = Client(account_id=conta.id, name="Cliente")
    db.add(cliente)
    db.flush()
    projeto = Project(account_id=conta.id, client_id=cliente.id, name="Projeto")
    db.add(projeto)
    db.flush()
    produto = Product(account_id=conta.id, name="Porcelanato", yield_factor=2.0, price=100.0)
    orcamento = Budget(account_id=conta.id, project_id=projeto.id)
    db.add_all([produto, orcamento])
    db.flush()
    for indice in range(30):
        ambiente = Environment(
            account_id=conta.id, project_id=projeto.id, name=f"Ambiente {indice}"
        )
        db.add(ambiente)
        db.flush()
        db.add(
            EnvironmentDNA(
                account_id=conta.id, environment_id=ambiente.id, floor_area=10.0
            )
        )
        item = BudgetItem(
            account_id=conta.id,
            budget_id=orcamento.id,
            environment_id=ambiente.id,
            rule_type=RuleType.FLOOR,
        )
        db.add(item)
        db.flush()
        db.add(
            ItemOption(
                account_id=conta.id,
                budget_item_id=item.id,
                product_id=produto.id,
                is_selected=True,
            )
        )
    db.flush()
    return orcamento


def test_montar_o_orcamento_nao_cresce_com_o_numero_de_itens(
    db: Session, orcamento_com_trinta_itens
):
    from app.services.budget_calculator import carregar_orcamento

    # O id e capturado ANTES do expire_all(): o orcamento e um objeto ORM, e
    # le-lo depois de expirado dispararia um SELECT proprio so para buscar o
    # id — um quinto query que mediria o fixture, nao carregar_orcamento.
    budget_id = orcamento_com_trinta_itens.id
    db.expire_all()
    with ContadorDeQueries(db.connection()) as contador:
        itens, dnas = carregar_orcamento(db.query(BudgetItem).filter(
            BudgetItem.budget_id == budget_id
        ))
        for item in itens:
            from app.services.budget_calculator import calculate_quantity

            selecionada = next((o for o in item.options if o.is_selected), None)
            calculate_quantity(
                item,
                dnas.get(item.environment_id),
                selecionada.product if selecionada else None,
            )

    assert len(itens) == 30
    assert len(contador) == 2, (
        "esperava 2 queries (itens com a arvore + DNAs), saiu "
        f"{len(contador)}:\n" + "\n".join(contador.sqls)
    )
