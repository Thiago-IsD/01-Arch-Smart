"""
Preco por milhao de tokens, por modelo.

Fonte: https://ai.google.dev/gemini-api/docs/pricing, consultada em
10/09/2026 (a pagina informa "last update 2026-09-08 UTC").

Tier pago, gemini-2.5-flash, por 1 milhao de tokens: entrada US$ 0.30, saida
US$ 2.50.

A entrada de audio custa US$ 1.00 por 1M e NAO se aplica a nos hoje, porque
`extract_product_data(raw_text, source_url)` manda texto. Quem um dia mandar
audio precisa mexer aqui.

O custo e calculado e CONGELADO no momento da gravacao (ver AiUsageLog), nunca
recalculado depois: quando o preco mudar, o custo historico continua sendo o
que de fato se pagou.

Modelo que nao estiver aqui devolve None, e a linha e gravada com os tokens e
sem custo. Nao invente preco: perder a contagem de tokens e pior que nao saber
o custo de uma linha, e as duas coisas sao melhores que um numero errado.
"""
from decimal import Decimal
from typing import NamedTuple


class PrecoPorMilhao(NamedTuple):
    entrada: Decimal
    saida: Decimal


PRECOS: dict[str, PrecoPorMilhao] = {
    "gemini-2.5-flash": PrecoPorMilhao(
        entrada=Decimal("0.30"),
        saida=Decimal("2.50"),
    ),
}

UM_MILHAO = Decimal(1_000_000)


def custo_usd(
    modelo: str, input_tokens: int, output_tokens: int
) -> Decimal | None:
    """Custo em USD, ou None se o modelo nao estiver na tabela."""
    preco = PRECOS.get(modelo)
    if preco is None:
        return None
    return (
        Decimal(input_tokens) * preco.entrada
        + Decimal(output_tokens) * preco.saida
    ) / UM_MILHAO
