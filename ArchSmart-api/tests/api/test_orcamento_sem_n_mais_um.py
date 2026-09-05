"""
O orcamento inteiro sem N+1 — medido, nao estimado.

Duas asserções, dois papeis:

- A CONSTANCIA (o numero de queries e o mesmo em 5 e em 30 itens) e a
  garantia de verdade: e o que "sem N+1" significa. Um algoritmo O(n) jamais
  passaria nisso, em nenhum tamanho, porque o numero cresceria com o numero
  de itens. Esta e a asserção que nunca deve virar um numero fixo: se um dia
  a estrategia trocar de `joinedload` para `selectinload` por um motivo
  legitimo — evitar multiplicar linha quando um item acumula muitas opcoes —
  o numero de queries sobe (de 2 para 4, ver `budget_calculator.py`), mas a
  ausencia de N+1 continua valendo desde que o novo numero tambem seja
  constante entre 5 e 30 itens. Um teste que so checasse "== 2" reprovaria
  nessa troca legitima, e a correcao obvia (trocar o 2 por um 4) apagaria a
  garantia sem ninguem perceber.
- O TETO (`<= 3`) fixa o custo de hoje: `joinedload` nos dois niveis
  (`options` -> `options.product`) e 1 SELECT para a arvore inteira do
  orcamento, mais 1 para os `EnvironmentDNA` — 2. O teto da folga de 1 para
  pegar um round-trip acidental a mais sem travar o numero exato; quem
  troca a estrategia deliberadamente ajusta o teto no mesmo commit.

"~300 para 2" e uma afirmacao de numero, e neste repositorio numero afirmado
sem medicao e numero errado. O contador abaixo E a medicao.
"""
from uuid import UUID

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.all_models import (
    Account,
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


def _montar_orcamento(db: Session, conta: Account, numero_de_itens: int) -> UUID:
    """
    Orcamento com `numero_de_itens` itens, cada um com 3 opcoes de produto
    (uma selecionada). Tres opcoes por item — nao uma — e o caso que
    realmente expoe multiplicacao de linha: se o `joinedload` duplo nao
    fosse agrupado de volta pela identity map da `Query` legada,
    `len(itens)` sairia maior que `numero_de_itens`.

    Devolve o `id` do orcamento, ja como UUID puro — nao o objeto ORM — para
    quem chama poder filtrar por ele sem tocar um atributo que `expire_all()`
    expirou.
    """
    cliente = Client(account_id=conta.id, name="Cliente")
    db.add(cliente)
    db.flush()
    projeto = Project(account_id=conta.id, client_id=cliente.id, name="Projeto")
    db.add(projeto)
    db.flush()
    produtos = [
        Product(account_id=conta.id, name=f"Produto {i}", yield_factor=2.0, price=100.0)
        for i in range(3)
    ]
    orcamento = Budget(account_id=conta.id, project_id=projeto.id)
    db.add_all([*produtos, orcamento])
    db.flush()
    for indice in range(numero_de_itens):
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
        for posicao, produto in enumerate(produtos):
            db.add(
                ItemOption(
                    account_id=conta.id,
                    budget_item_id=item.id,
                    product_id=produto.id,
                    is_selected=(posicao == 0),
                )
            )
    db.flush()
    return orcamento.id


def _carregar_e_contar(db: Session, budget_id: UUID) -> tuple[int, int, list[str]]:
    """
    Roda `carregar_orcamento` + `calculate_quantity` por item, como um
    endpoint faria, e devolve (numero de itens, numero de queries, os SQLs).

    `db.expire_all()` garante que nada do que `_montar_orcamento` deixou em
    cache no identity map disfarce uma query que aconteceria de verdade numa
    request nova, com uma `Session` sem nada carregado ainda.
    """
    from app.services.budget_calculator import calculate_quantity, carregar_orcamento

    db.expire_all()
    with ContadorDeQueries(db.connection()) as contador:
        itens, dnas = carregar_orcamento(
            db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id)
        )
        for item in itens:
            selecionada = next((o for o in item.options if o.is_selected), None)
            calculate_quantity(
                item,
                dnas.get(item.environment_id),
                selecionada.product if selecionada else None,
            )
    return len(itens), len(contador), contador.sqls


def test_montar_o_orcamento_nao_cresce_com_o_numero_de_itens(db: Session, conta_a):
    conta = conta_a[0]

    budget_id_pequeno = _montar_orcamento(db, conta, 5)
    n_itens_pequeno, n_queries_pequeno, sqls_pequeno = _carregar_e_contar(
        db, budget_id_pequeno
    )

    budget_id_grande = _montar_orcamento(db, conta, 30)
    n_itens_grande, n_queries_grande, sqls_grande = _carregar_e_contar(
        db, budget_id_grande
    )

    # A de-duplicacao do joinedload: 3 opcoes por item nao inflam a lista.
    assert n_itens_pequeno == 5
    assert n_itens_grande == 30

    # A GARANTIA: constante entre 5 e 30 itens, nao um numero fixo — ver
    # docstring do modulo para o porque disto e a asserção que importa.
    assert n_queries_pequeno == n_queries_grande, (
        "o numero de queries cresceu com o numero de itens — isso E o N+1:\n"
        f"  5 itens:  {n_queries_pequeno} queries\n"
        + "\n".join(f"    {sql}" for sql in sqls_pequeno)
        + f"\n  30 itens: {n_queries_grande} queries\n"
        + "\n".join(f"    {sql}" for sql in sqls_grande)
    )

    # O TETO: pina o custo de hoje (joinedload duplo = arvore + DNAs = 2),
    # com 1 de folga para um round-trip acidental. Quem troca a estrategia
    # deliberadamente ajusta este numero no mesmo commit — a asserção acima
    # e a que continua valendo depois da troca.
    assert n_queries_grande <= 3, (
        f"esperava no maximo 3 queries (arvore + DNAs, com 1 de folga), saiu "
        f"{n_queries_grande}:\n" + "\n".join(sqls_grande)
    )
