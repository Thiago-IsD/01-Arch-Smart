"""
Toda rota registrada isola por conta — inclusive a que ainda nao existe.

tests/isolation/ ja cobre 27 casos escritos a mao, na Secao 1. Esta lista nao
cresce sozinha: uma rota nova nao entra nela. Este arquivo percorre
`app.routes`, entao a rota nova aparece no dia em que e registrada — e se
ninguem tiver dito que recurso o id dela endereca, o teste FALHA em vez de
ignorar.

Como quebrar de proposito, para ver que funciona: apague o filtro por conta de
um endpoint qualquer e rode. Se ele continuar verde, este arquivo esta mentindo.
"""
import re

import pytest

from app.main import app
from tests.conftest import (
    criar_ambiente,
    criar_apresentacao,
    criar_evento,
    criar_item_de_orcamento,
    criar_lancamento,
    criar_notificacao,
    criar_opcao,
    criar_orcamento,
    criar_produto,
    criar_projeto,
)

# Parametro de caminho -> como fabricar um recurso daquele tipo numa conta.
# TODA rota com id na URL precisa de entrada aqui. E de proposito que a falta
# de uma entrada seja falha, e nao pulo: rota nova sem isolamento tem que
# quebrar o build no dia em que e escrita.
#
# `env_id` merece uma nota: das 4 ocorrencias, 2 (PUT e POST em
# /presentations/{presentation_id}/environments/{env_id}[...]) endereçam
# PresentationEnvironment, nao Environment — sao modelos diferentes com o
# mesmo nome de parametro. A fabrica abaixo cria um Environment, e nesses
# dois casos o id cai numa tabela errada; a isolacao dessas duas rotas ainda
# fica provada porque `repo.obter(Presentation, presentation_id)` roda ANTES
# de qualquer uso de env_id — para conta B, ja e 404 ali. O que este arquivo
# NAO prova, por causa disso, e isolacao de PresentationEnvironment por id
# proprio; nao ha rota hoje que vaze isso (a busca e sempre composta com
# presentation_id), entao nao criei uma segunda fabrica so para um teste que
# nao mudaria de resultado.
RECURSOS = {
    "project_id": lambda db, conta, usuario: criar_projeto(
        db, conta, "Alheio", usuario
    ),
    "env_id": criar_ambiente,
    "budget_id": criar_orcamento,
    "item_id": criar_item_de_orcamento,
    "option_id": criar_opcao,
    "product_id": criar_produto,
    "presentation_id": criar_apresentacao,
    "entry_id": criar_lancamento,
    "event_id": criar_evento,
    "notification_id": criar_notificacao,
}

# O portal publico. Quem chama nao tem conta: e o cliente final do arquiteto,
# autorizado por token de portal (app/core/portal_security.py). "Conta A
# tentando alcancar recurso da conta B" nao descreve esse caminho, e testa-lo
# aqui daria falso verde. Coberto por tests/isolation/test_portal_access.py.
PARAMETROS_FORA_DO_ESCOPO = {"presentation_uuid"}

# Prefixos que nao sao rota de aplicacao.
CAMINHOS_DE_INFRAESTRUTURA = ("/docs", "/redoc", "/openapi.json")


def _rotas_com_recurso():
    for rota in app.routes:
        if not hasattr(rota, "methods"):
            continue
        if rota.path.startswith(CAMINHOS_DE_INFRAESTRUTURA):
            continue
        parametros = re.findall(r"{(\w+)}", rota.path)
        if not parametros:
            continue
        if any(p in PARAMETROS_FORA_DO_ESCOPO for p in parametros):
            continue
        for metodo in sorted(rota.methods - {"HEAD", "OPTIONS"}):
            yield metodo, rota.path, tuple(parametros)


CASOS = sorted(set(_rotas_com_recurso()))


def test_ha_rotas_para_percorrer():
    """
    Rede contra o pior modo de falha deste arquivo: um `_rotas_com_recurso`
    que devolve lista vazia deixa a suite verde sem testar nada.
    """
    assert len(CASOS) >= 30, f"so {len(CASOS)} rotas coletadas; algo filtrou demais"


@pytest.mark.parametrize("metodo,caminho,parametros", CASOS, ids=lambda v: str(v))
def test_toda_rota_com_id_isola_por_conta(
    db, client_a, conta_b, metodo, caminho, parametros
):
    conta, usuario = conta_b
    url = caminho
    for parametro in parametros:
        fabrica = RECURSOS.get(parametro)
        assert fabrica is not None, (
            f"a rota {metodo} {caminho} tem o parametro {{{parametro}}} e "
            "ninguem disse que recurso ele endereca. Acrescente uma entrada em "
            "RECURSOS (ou, se for rota de portal publico, em "
            "PARAMETROS_FORA_DO_ESCOPO, com o motivo)."
        )
        recurso = fabrica(db, conta, usuario)
        url = url.replace("{" + parametro + "}", str(recurso.id))

    resposta = client_a.request(metodo, url, json={})

    assert resposta.status_code not in (200, 201, 202, 204), (
        f"{metodo} {caminho} devolveu {resposta.status_code} para recurso da "
        "conta B — vazamento entre contas."
    )
    assert resposta.status_code != 403, (
        f"{metodo} {caminho} devolveu 403, que CONFIRMA a existencia do "
        "recurso alheio. Use 404."
    )
    if metodo in ("GET", "DELETE"):
        # Sem corpo, nao ha validacao do Pydantic no caminho: 404 e exigivel.
        assert resposta.status_code == 404, (
            f"{metodo} {caminho} devolveu {resposta.status_code}; esperado 404."
        )


# Rotas GET sem parametro de caminho. O teste de isolamento acima nao as
# alcanca — ele existe para tentar chegar no recurso de OUTRA conta, e sem id
# na URL nao ha o que tentar. Mas uma rota que estoura 500 em toda requisicao
# tambem passa despercebida por ele, e foi o que aconteceu com
# /api/dashboard/lean entre as Tarefas 11 e 14: a assinatura de um helper
# mudou num arquivo, quem importava nao foi atualizado, e nenhum teste batia
# na rota. Esta rede e barata e teria pego.
GETS_SEM_PARAMETRO = sorted(
    {
        rota.path
        for rota in app.routes
        if hasattr(rota, "methods")
        and "GET" in rota.methods
        and "{" not in rota.path
        and rota.path.startswith("/api")
    }
)


def test_ha_gets_sem_parametro_para_percorrer():
    assert len(GETS_SEM_PARAMETRO) >= 8, (
        f"so {len(GETS_SEM_PARAMETRO)} rotas coletadas; algo filtrou demais"
    )


@pytest.mark.parametrize("caminho", GETS_SEM_PARAMETRO)
def test_get_sem_parametro_nao_estoura(db, client_a, caminho):
    """
    Fumaca, nao contrato: so exige que a rota RESPONDA. Nao afirma status 200,
    porque varias dependem de dado que a conta de teste nao tem — o que se
    afirma e que ela nao morre.
    """
    resposta = client_a.get(caminho)

    assert resposta.status_code < 500, (
        f"GET {caminho} devolveu {resposta.status_code}. "
        f"Corpo: {resposta.text[:400]}"
    )
