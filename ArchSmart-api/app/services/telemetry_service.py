"""
Telemetria de produto.

`track` grava dentro de um SAVEPOINT e engole qualquer erro. A spec pede que
falha de telemetria nao derrube a requisicao — e sem o savepoint isso nao se
cumpre sozinho: um INSERT que estoura invalida a transacao inteira do
SQLAlchemy, e a requisicao que a telemetria so deveria observar morre junto,
no proximo flush.

Savepoint, e nao sessao nova: DATABASE_URL aponta para o host pooler na 5432
justamente porque estado de sessao vaza entre clientes, e abrir conexao por
evento e a ultima coisa que se quer ali.
"""
import logging
from typing import Any, Mapping

from app.db.repository import ScopedRepository
from app.models.all_models import ProductEvent

logger = logging.getLogger(__name__)


def track(
    ctx: ScopedRepository,
    evento: str,
    propriedades: Mapping[str, Any] | None = None,
) -> None:
    """
    Grava um evento de produto na conta da sessao.

    `ctx` e o ScopedRepository: e ele que carrega a identidade resolvida no
    servidor. `account_id` e `created_by` saem dali, nunca de argumento.

    Nunca levanta. Um erro aqui vira log e o evento e descartado.
    """
    try:
        with ctx.db.begin_nested():
            ctx.create(
                ProductEvent, name=evento, properties=dict(propriedades or {})
            )
    except Exception:
        logger.warning(
            "telemetria: evento %r descartado", evento, exc_info=True
        )
