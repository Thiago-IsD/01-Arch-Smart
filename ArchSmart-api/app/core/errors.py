"""
Erros de dominio e a traducao deles para HTTP.

Regra: a resposta carrega uma frase em pt-BR que o usuario pode ler; o rastro
tecnico vai inteiro para o log. Ate a Secao 4 o codigo fazia o contrario — a
excecao crua ia direto para o `detail` da resposta em 12 lugares, mandando
mensagem de driver, nome de coluna e host do banco para quem chamou, sem
registrar nada.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

MENSAGEM_GENERICA = "Erro interno. Tente novamente."


class DomainError(Exception):
    """
    Base de tudo que a aplicacao sabe explicar ao usuario.

    `status` e `mensagem` sao atributos de classe para que
    `raise NotFound()` — sem argumento — ja produza uma resposta completa.
    """

    status: int = 400
    mensagem: str = "Requisição inválida."

    def __init__(self, mensagem: str | None = None) -> None:
        if mensagem is not None:
            self.mensagem = mensagem
        super().__init__(self.mensagem)


class NotFound(DomainError):
    status = 404
    # Deliberadamente vaga: distinguir "nao existe" de "existe e nao e sua"
    # confirmaria a existencia do recurso alheio. Ver tests/isolation/.
    mensagem = "Recurso não encontrado."


class Forbidden(DomainError):
    status = 403
    mensagem = "Você não tem permissão para esta ação."


class QuotaExceeded(DomainError):
    status = 402
    mensagem = "Seu plano não permite esta ação."


class ValidacaoDeDominio(DomainError):
    status = 422
    mensagem = "Dados inválidos."


def registrar_handlers(app: FastAPI) -> None:
    """Liga os dois handlers na aplicacao. Chamado uma vez, no main.py."""

    @app.exception_handler(DomainError)
    async def _dominio(_: Request, erro: DomainError) -> JSONResponse:
        # info, nao error: erro de dominio e fluxo previsto, nao defeito.
        logger.info("%s: %s", type(erro).__name__, erro.mensagem)
        return JSONResponse(
            status_code=erro.status, content={"detail": erro.mensagem}
        )

    @app.exception_handler(Exception)
    async def _inesperado(request: Request, erro: Exception) -> JSONResponse:
        logger.error(
            "Erro nao tratado em %s %s",
            request.method,
            request.url.path,
            exc_info=erro,
        )
        return JSONResponse(
            status_code=500, content={"detail": MENSAGEM_GENERICA}
        )
