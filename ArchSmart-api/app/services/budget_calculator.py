"""
Calculo de quantidade do item de orcamento.

Ate a Secao 4 esta funcao recebia uma `Session` e fazia ate 3 queries por
item — ~300 para um orcamento de 100 itens. Agora ela e pura: recebe o item,
o DNA do ambiente e o produto selecionado, e devolve o resultado. Quem carrega
o dado e `carregar_orcamento`, em 2 queries, uma vez.

Pureza aqui nao e estetica: e o que permite testar a regra de negocio em
memoria, sem Postgres. Ver tests/services/test_calculo_de_quantidade.py.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Query, joinedload

from app.models.all_models import (
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
        # Ambiente sem DNA ainda: area 0, e nao ha alerta de rendimento a dar
        # sobre um calculo que nao aconteceu.
        return Quantidade(
            base_area=0.0, calculated_quantity=0, has_yield_alert=False
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

    1. os itens com `options` e `options.product` ja carregados num unico
       JOIN (`joinedload` nos dois niveis). A `Query` legada do SQLAlchemy
       agrupa as linhas duplicadas do JOIN de volta em objetos `BudgetItem`
       unicos pela identity map — testado por
       `test_montar_o_orcamento_nao_cresce_com_o_numero_de_itens`, que conta
       `len(itens) == 30` sem duplicata. Um `selectinload` encadeado em dois
       niveis (`options` -> `options.product`) parecia mais direto, mas mede
       **3** SELECTs (itens, depois options, depois products) em vez de 1 —
       cada nivel de `selectinload` e um round-trip proprio;
    2. os `EnvironmentDNA` dos ambientes envolvidos, em dicionario.

    `itens` e uma Query JA FILTRADA por conta por quem chamou — tipicamente
    `repo.query(BudgetItem).filter(BudgetItem.budget_id == ...)`.
    """
    carregados: list[BudgetItem] = (
        itens.options(
            joinedload(BudgetItem.options).joinedload(ItemOption.product)
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
