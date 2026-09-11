"""
Custo de IA: calculo, modelo desconhecido e metadata ausente.

O caso do modelo desconhecido e o que importa: ele prova que a linha e gravada
com os tokens mesmo sem preco. Perder a contagem de tokens e pior que nao saber
o custo daquela linha.
"""
from decimal import Decimal

import pytest

from app.core.precos_ia import PRECOS, custo_usd
from app.services.ai_service import UsoIA, _uso_de


def test_custo_soma_entrada_e_saida_com_precos_diferentes():
    preco = PRECOS["gemini-2.5-flash"]

    # 1 milhao de cada: o custo e exatamente a soma dos dois precos.
    assert custo_usd("gemini-2.5-flash", 1_000_000, 1_000_000) == (
        preco.entrada + preco.saida
    )


def test_custo_e_proporcional_ao_numero_de_tokens():
    inteiro = custo_usd("gemini-2.5-flash", 1_000_000, 0)
    metade = custo_usd("gemini-2.5-flash", 500_000, 0)

    assert metade == inteiro / 2


def test_entrada_e_saida_nao_tem_o_mesmo_preco():
    """
    Se este teste falhar, ou o provedor unificou os precos, ou alguem copiou o
    mesmo numero nas duas colunas. Nos dois casos, va olhar a tabela oficial
    antes de mexer aqui.
    """
    preco = PRECOS["gemini-2.5-flash"]
    assert preco.entrada != preco.saida


def test_modelo_desconhecido_devolve_none_em_vez_de_estourar():
    assert custo_usd("modelo-que-nao-existe", 1000, 1000) is None


def test_custo_e_decimal_nao_float():
    """Dinheiro nao anda em ponto flutuante."""
    assert isinstance(custo_usd("gemini-2.5-flash", 1000, 1000), Decimal)


class _MetadataFalsa:
    def __init__(self, prompt, candidates):
        self.prompt_token_count = prompt
        self.candidates_token_count = candidates


class _RespostaFalsa:
    def __init__(self, metadata):
        self.usage_metadata = metadata


def test_uso_le_os_tokens_da_resposta():
    resposta = _RespostaFalsa(_MetadataFalsa(prompt=120, candidates=45))

    uso = _uso_de(resposta, latency_ms=800)

    assert uso == UsoIA(
        model_name="gemini-2.5-flash",
        input_tokens=120,
        output_tokens=45,
        latency_ms=800,
    )


def test_uso_sem_metadata_conta_zero_em_vez_de_estourar():
    """
    O caminho com url_context usa tool e nao JSON mode, e ja voltou sem
    usage_metadata. A linha e gravada com o que houver; o que nao se faz e
    descartar o registro nem inventar o numero.
    """
    uso = _uso_de(_RespostaFalsa(None), latency_ms=800)

    assert uso.input_tokens == 0
    assert uso.output_tokens == 0
    assert uso.latency_ms == 800
