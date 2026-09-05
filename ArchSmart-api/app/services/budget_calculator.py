"""
Calculo de quantidade do item de orcamento.

Ate a Secao 4 esta funcao recebia uma `Session` e fazia ate 3 queries por
item — ~300 para um orcamento de 100 itens. Agora ela e pura: recebe o item,
o DNA do ambiente e o produto selecionado, e devolve o resultado. Quem carrega
o dado e `carregar_orcamento`, em 2 queries, uma vez.

Pureza aqui nao e estetica: e o que permite testar a regra de negocio em
memoria, sem Postgres. Ver tests/services/test_calculo_de_quantidade.py.

As 2 queries de `carregar_orcamento` sao o custo do CALCULO, nao do
endpoint inteiro: `GET /projects/{id}/budget` tambem paga Project + Budget,
e a serializacao de `BudgetResponse.items` tem seu proprio N+1 se ninguem
cuidar (medido: 18 e 68 queries para 5 e 30 itens, antes do fix).
`popular_relacionamento_de_itens` fecha essa segunda metade — ver
docs/dev/modulos/budget_calculator.md, secao "O N+1 que sobrava depois de
carregar_orcamento", e tests/api/test_orcamento_sem_n_mais_um.py.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Query, joinedload
from sqlalchemy.orm.attributes import set_committed_value

from app.models.all_models import (
    Budget,
    BudgetItem,
    EnvironmentDNA,
    ItemOption,
    Product,
    RuleType,
)

PERDA_PADRAO = 10.0


@dataclass(frozen=True)
class Quantidade:
    base_area: float
    calculated_quantity: int
    has_yield_alert: bool


def _area_da_regra(regra: RuleType, dna: EnvironmentDNA) -> float:
    if regra == RuleType.FLOOR:
        return dna.floor_area or 0.0
    if regra == RuleType.WALL:
        return dna.wall_area or 0.0
    if regra == RuleType.CEILING:
        return dna.ceiling_area or 0.0
    return 0.0


def calculate_quantity(
    item: BudgetItem,
    dna: Optional[EnvironmentDNA],
    produto: Optional[Product],
) -> Quantidade:
    """
    Pura: nao toca banco, nao usa `Session`, nao le atributo lazy.

    `produto` e a opcao SELECIONADA do item, ja resolvida por quem chamou —
    a funcao nao vai atras dela.
    """
    if item.rule_type == RuleType.UNIT:
        return Quantidade(
            base_area=0.0,
            calculated_quantity=item.manual_quantity or 1,
            has_yield_alert=False,
        )

    rendimento = produto.yield_factor if produto else None
    alerta_de_rendimento = rendimento is None or rendimento <= 0
    if alerta_de_rendimento:
        rendimento = 1.0

    if dna is None:
        # Ambiente sem DNA ainda: area e quantidade zeram, mas o alerta de
        # rendimento e sobre o PRODUTO (cadastro sem yield_factor valido),
        # nao sobre o ambiente — falta de DNA nao apaga um alerta que ja era
        # verdadeiro. Comportamento da funcao anterior
        # (`calculate_budget_item_quantity`), preservado aqui — ver
        # test_sem_dna_e_rendimento_invalido_alerta_mesmo_assim.
        return Quantidade(
            base_area=0.0,
            calculated_quantity=0,
            has_yield_alert=alerta_de_rendimento,
        )

    base_area = _area_da_regra(item.rule_type, dna)
    perda = item.loss_factor if item.loss_factor is not None else PERDA_PADRAO
    bruto = base_area * (1 + perda / 100.0)
    # round antes do ceil: sem ele, 8.999999999 de ruido de float vira 9 em
    # vez de 9 — e 9.000000001 viraria 10.
    final = math.ceil(round(bruto / rendimento, 4))

    if item.manual_quantity is not None:
        # Quantidade manual sobrescreve o motor; o alerta de rendimento perde
        # o sentido porque o rendimento deixou de ser usado.
        return Quantidade(
            base_area=base_area,
            calculated_quantity=item.manual_quantity,
            has_yield_alert=False,
        )

    return Quantidade(
        base_area=base_area,
        calculated_quantity=final,
        has_yield_alert=alerta_de_rendimento,
    )


def carregar_orcamento(
    itens: Query,
) -> tuple[list[BudgetItem], dict[UUID, EnvironmentDNA]]:
    """
    Duas queries, sempre — independente do numero de itens.

    1. os itens com `options`, `options.product` e `environment` ja
       carregados num unico JOIN (`joinedload` nos tres). A `Query` legada
       do SQLAlchemy agrupa as linhas duplicadas do JOIN de volta em objetos
       `BudgetItem` unicos pela identity map — testado por
       `test_montar_o_orcamento_nao_cresce_com_o_numero_de_itens`, que conta
       `len(itens) == 30` sem duplicata. Um `selectinload` encadeado em dois
       niveis (`options` -> `options.product`) parecia mais direto, mas mede
       **3** SELECTs (itens, depois options, depois products) em vez de 1 —
       cada nivel de `selectinload` e um round-trip proprio. `environment` e
       many-to-one (um por item, nao uma colecao) — junta-lo na mesma query
       nao multiplica linha nenhuma alem do que `options` ja multiplica;
    2. os `EnvironmentDNA` dos ambientes envolvidos, em dicionario.

    `environment` entrou aqui por uma dor medida, nao por simetria: sem ele,
    `BudgetItemResponse.environment` (campo que toda resposta de item de
    orcamento serializa) lazy-carrega um `Environment` POR ITEM na
    serializacao — um N+1 que `calculate_quantity`/`carregar_orcamento`
    nunca tocavam porque vivem fora do caminho de serializacao. Ver
    `popular_relacionamento_de_itens` abaixo para a outra metade do mesmo
    problema (`Budget.items`).

    `itens` e uma Query JA FILTRADA por conta por quem chamou — tipicamente
    `repo.query(BudgetItem).filter(BudgetItem.budget_id == ...)`.
    """
    carregados: list[BudgetItem] = (
        itens.options(
            joinedload(BudgetItem.environment),
            joinedload(BudgetItem.options).joinedload(ItemOption.product),
        ).all()
    )
    ids_de_ambiente = {i.environment_id for i in carregados if i.environment_id}
    if not ids_de_ambiente:
        return carregados, {}

    dnas = (
        itens.session.query(EnvironmentDNA)
        .filter(EnvironmentDNA.environment_id.in_(ids_de_ambiente))
        .all()
    )
    return carregados, {d.environment_id: d for d in dnas}


def produto_selecionado(item: BudgetItem) -> Optional[Product]:
    """
    A opcao marcada `is_selected` do item, ou None.

    Le `item.options`, que `carregar_orcamento` ja trouxe — chamar isto fora
    de um item carregado por la dispara lazy load e devolve o N+1 pela porta
    dos fundos.
    """
    escolhida = next((o for o in item.options if o.is_selected), None)
    return escolhida.product if escolhida else None


def popular_relacionamento_de_itens(orcamento: Budget, itens: list[BudgetItem]) -> None:
    """
    Preenche `Budget.items` com os itens que `carregar_orcamento` ja
    carregou — sem query extra, e sem marcar a colecao como suja.

    `Budget.items` (`app/models/all_models.py:317`) e um relationship lazy
    comum. `GET /projects/{id}/budget` devolve `BudgetResponse`, cujo campo
    `items: List[BudgetItemResponse]` faz o Pydantic ler `budget.items` na
    serializacao — se ninguem povoar essa colecao antes, ela dispara sua
    PRÓPRIA query (redundante com a de `carregar_orcamento`, que ja tem os
    mesmos itens, com `environment`/`options`/`options.product` inclusos).
    Medido: sem isto, o endpoint sai de O(1) para O(n) (item de verdade nao
    era so a query da colecao — cada item ainda lazy-carregaria seu proprio
    `environment` na ausencia do `joinedload` que `carregar_orcamento` agora
    faz).

    Usa `sqlalchemy.orm.attributes.set_committed_value` — a forma
    documentada de popular um relationship por fora do atributo
    instrumentado. **Nao** faca `orcamento.items = itens`: isso passa pelo
    setter instrumentado, marca a colecao como "dirty" e arrisca reordenar
    escritas no proximo `commit()` — o efeito colateral que este helper
    existe para evitar.
    """
    set_committed_value(orcamento, "items", itens)
