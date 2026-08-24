"""
Fixtures locais de `tests/isolation/`.

O `limiter` de `app.core.rate_limit` e um objeto de modulo, com estado
(contadores por IP) que sobrevive entre testes. O teste de forca bruta de
`test_public_endpoints.py` dispara 12 requisicoes do mesmo IP de teste e
deixa o contador estourado; sem limpeza, qualquer teste posterior que bata
no mesmo endpoint receberia 429 sem motivo, e a suite ficaria dependente
da ordem de execucao.

`Limiter.reset()` (slowapi 0.1.9) limpa o storage em memoria — que e o
storage padrao usado aqui. Autouse porque o vazamento afeta qualquer teste
da pasta, nao so os que testam rate limit explicitamente.
"""
import pytest

from app.core.rate_limit import limiter


@pytest.fixture(autouse=True)
def _limpar_rate_limiter():
    yield
    limiter.reset()
