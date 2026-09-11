"""
Integracao: POST /api/products/normalize grava ai_usage_logs de verdade.

Os testes de tests/services/test_uso_de_ia.py provam custo_usd() e _uso_de()
isoladamente, mas nao exercitam o caminho repo.create(AiUsageLog, ...) ->
repo.db.commit() persistindo de fato (tipos Numeric, colunas NOT NULL, e o
account_id vindo do contexto da sessao, nunca de payload). Este arquivo mocka
o cliente do Gemini e chama o endpoint de verdade, pelo TestClient
autenticado, para fechar essa lacuna.
"""
from decimal import ROUND_HALF_UP, Decimal

import pytest

from app.core.precos_ia import custo_usd
from app.models.all_models import AiUsageLog
from app.services import ai_service


class _MetadataFalsa:
    def __init__(self, prompt, candidates):
        self.prompt_token_count = prompt
        self.candidates_token_count = candidates


class _RespostaFalsa:
    def __init__(self, text, prompt_tokens, candidate_tokens):
        self.text = text
        self.usage_metadata = _MetadataFalsa(prompt_tokens, candidate_tokens)
        self.candidates = []


class _ModelsFalso:
    """Substitui `client.aio.models`: só `generate_content` importa aqui."""

    def __init__(self, resposta):
        self._resposta = resposta

    async def generate_content(self, **kwargs):
        return self._resposta


class _AioFalso:
    def __init__(self, resposta):
        self.models = _ModelsFalso(resposta)


class _ClientFalso:
    """Substitui o `genai.Client` real: só `.aio.models.generate_content` é usado."""

    def __init__(self, resposta):
        self.aio = _AioFalso(resposta)


def _mockar_gemini(monkeypatch, *, texto: str, prompt_tokens: int, candidate_tokens: int):
    resposta = _RespostaFalsa(texto, prompt_tokens, candidate_tokens)
    monkeypatch.setattr(ai_service, "_get_client", lambda: _ClientFalso(resposta))


def test_normalize_grava_linha_com_tokens_separados_e_custo(db, client_a, conta_a, monkeypatch):
    conta, _ = conta_a
    _mockar_gemini(
        monkeypatch,
        texto='{"name": "Porcelanato Foo 60x60", "price": 129.9}',
        prompt_tokens=321,
        candidate_tokens=57,
    )

    resp = client_a.post(
        "/api/products/normalize",
        json={"text": "Porcelanato Foo 60x60, R$ 129,90 a caixa"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Porcelanato Foo 60x60"

    log = db.query(AiUsageLog).one()
    assert log.model_name == "gemini-2.5-flash"
    assert log.input_tokens == 321
    assert log.output_tokens == 57
    # token_count e a soma, nao um dos dois nem um valor gravado a parte.
    assert log.token_count == 321 + 57
    # A coluna e Numeric(10,6): o valor volta do banco arredondado em 6 casas.
    # custo_usd() aqui devolve 0.0002388, sem arredondar — o banco e que faz
    # o corte na escrita, entao a comparacao usa o mesmo arredondamento.
    esperado = custo_usd("gemini-2.5-flash", 321, 57).quantize(
        Decimal("0.000001"), rounding=ROUND_HALF_UP
    )
    assert log.cost_usd == esperado
    assert isinstance(log.cost_usd, Decimal)
    assert log.feature == "product_normalize"
    # Art. 1: account_id vem do contexto da sessao. NormalizeRequest nao tem
    # campo account_id — nao ha o que um payload pudesse pedir —, e o que se
    # prova aqui e que a linha nasceu na conta de quem autenticou a chamada.
    assert log.account_id == conta.id
    assert log.created_by == conta_a[1].id


def test_normalize_de_contas_diferentes_grava_cada_log_na_conta_certa(
    db, client_a, client_b, conta_a, conta_b, monkeypatch
):
    """
    Duas chamadas, de duas contas, no mesmo teste: prova que o account_id
    gravado segue a sessao de quem fez a chamada, nunca uma conta trocada.
    """
    conta_da_a, _ = conta_a
    conta_da_b, _ = conta_b

    _mockar_gemini(monkeypatch, texto='{"name": "Item A"}', prompt_tokens=10, candidate_tokens=5)
    resp_a = client_a.post("/api/products/normalize", json={"text": "Item A"})
    assert resp_a.status_code == 200

    _mockar_gemini(monkeypatch, texto='{"name": "Item B"}', prompt_tokens=20, candidate_tokens=8)
    resp_b = client_b.post("/api/products/normalize", json={"text": "Item B"})
    assert resp_b.status_code == 200

    logs = {log.account_id: log for log in db.query(AiUsageLog).all()}
    assert logs[conta_da_a.id].input_tokens == 10
    assert logs[conta_da_b.id].input_tokens == 20


def test_normalize_com_corpo_vazio_nao_grava_linha_fantasma(client_a, db):
    """
    Corpo vazio (o default de NormalizeRequest) nunca chama o Gemini. Gravar
    uma linha com 0 tokens e latency_ms=0 nesse caso criaria uma chamada
    fantasma indistinguivel de uma chamada real que por acaso zerou.
    """
    resp = client_a.post("/api/products/normalize", json={})
    assert resp.status_code == 200

    assert db.query(AiUsageLog).count() == 0
