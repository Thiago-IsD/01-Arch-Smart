"""
O calculo de quantidade, sem banco.

Todo caso aqui roda em memoria. Se algum precisar de `db`, a funcao deixou de
ser pura e a Tarefa 8 regrediu.
"""
import pytest

from app.models.all_models import BudgetItem, EnvironmentDNA, Product, RuleType
from app.services.budget_calculator import Quantidade, calculate_quantity


def _item(**campos) -> BudgetItem:
    padrao = {"rule_type": RuleType.FLOOR, "manual_quantity": None, "loss_factor": 10.0}
    return BudgetItem(**{**padrao, **campos})


def _dna(piso=0.0, parede=0.0, teto=0.0) -> EnvironmentDNA:
    return EnvironmentDNA(floor_area=piso, wall_area=parede, ceiling_area=teto)


def _produto(rendimento) -> Product:
    return Product(name="Porcelanato", yield_factor=rendimento)


def test_unit_usa_a_quantidade_manual():
    r = calculate_quantity(_item(rule_type=RuleType.UNIT, manual_quantity=7), None, None)
    assert r == Quantidade(base_area=0.0, calculated_quantity=7, has_yield_alert=False)


def test_unit_sem_quantidade_manual_e_um():
    r = calculate_quantity(_item(rule_type=RuleType.UNIT), None, None)
    assert r.calculated_quantity == 1


def test_piso_aplica_perda_e_rendimento():
    # 10 m2 com 10% de perda = 11; rendimento 2 m2/unidade => 5.5 => 6.
    r = calculate_quantity(_item(), _dna(piso=10.0), _produto(2.0))
    assert r.base_area == 10.0
    assert r.calculated_quantity == 6
    assert r.has_yield_alert is False


def test_parede_e_teto_leem_a_area_certa():
    assert calculate_quantity(
        _item(rule_type=RuleType.WALL), _dna(parede=30.0), _produto(1.0)
    ).base_area == 30.0
    assert calculate_quantity(
        _item(rule_type=RuleType.CEILING), _dna(teto=12.0), _produto(1.0)
    ).base_area == 12.0


@pytest.mark.parametrize("rendimento", [None, 0.0, -3.0])
def test_rendimento_invalido_vira_alerta_e_nao_divisao_por_zero(rendimento):
    r = calculate_quantity(_item(), _dna(piso=10.0), _produto(rendimento))
    assert r.has_yield_alert is True
    assert r.calculated_quantity == 11  # cai para rendimento 1.0


def test_sem_dna_a_quantidade_e_zero():
    r = calculate_quantity(_item(), None, _produto(2.0))
    assert r == Quantidade(base_area=0.0, calculated_quantity=0, has_yield_alert=False)


@pytest.mark.parametrize("rendimento", [None, 0.0, -3.0])
def test_sem_dna_e_rendimento_invalido_alerta_mesmo_assim(rendimento):
    """
    Duas ausencias ao mesmo tempo: nem DNA, nem rendimento valido. O alerta
    de rendimento e sobre o PRODUTO (algo errado no cadastro), nao sobre o
    ambiente — faltar DNA zera area e quantidade, mas nao apaga um alerta
    que ja era verdadeiro antes de se descobrir que faltava DNA.

    A versao anterior (`calculate_budget_item_quantity`) preservava esse
    alerta nesse caso; a reescrita da Tarefa 8 zerava ele por engano — este
    teste existe para essa combinacao especifica nao regredir de novo.
    """
    r = calculate_quantity(_item(), None, _produto(rendimento))
    assert r == Quantidade(base_area=0.0, calculated_quantity=0, has_yield_alert=True)


def test_sem_dna_e_sem_produto_alerta_mesmo_assim():
    r = calculate_quantity(_item(), None, None)
    assert r == Quantidade(base_area=0.0, calculated_quantity=0, has_yield_alert=True)


def test_sem_produto_e_alerta_com_rendimento_um():
    r = calculate_quantity(_item(), _dna(piso=5.0), None)
    assert r.has_yield_alert is True
    assert r.calculated_quantity == 6  # 5 * 1.10 = 5.5 -> 6


def test_quantidade_manual_sobrescreve_o_calculo_e_apaga_o_alerta():
    r = calculate_quantity(_item(manual_quantity=3), _dna(piso=100.0), None)
    assert r.calculated_quantity == 3
    assert r.has_yield_alert is False


def test_arredonda_para_cima_mas_nao_por_ruido_de_float():
    """
    2.9999999 vindo de float nao pode virar 3 unidades a mais. O
    `round(x, 4)` antes do ceil existe por isso — a versao antiga ja tinha,
    e o comportamento e preservado.
    """
    r = calculate_quantity(_item(loss_factor=0.0), _dna(piso=9.0), _produto(3.0))
    assert r.calculated_quantity == 3


def test_perda_zero_nao_infla():
    r = calculate_quantity(_item(loss_factor=0.0), _dna(piso=10.0), _produto(1.0))
    assert r.calculated_quantity == 10
