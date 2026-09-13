"""
As chaves publicas do projeto Supabase, em cache.

Existe para tirar uma ida a rede do caminho quente. O projeto assina o JWT em
**ES256**, um algoritmo de chave assimetrica: quem valida precisa da chave
**publica**, que o Supabase publica em `/auth/v1/.well-known/jwks.json`. Sem
isso, a API caia no `auth_service.get_user` — uma chamada HTTP ao Supabase em
**toda** requisicao autenticada, medida em 0,240 s contra a API implantada
(`docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md`).

Buscar o JWKS a cada requisicao nao resolveria nada: so mudaria o endereco da
ida remota. Por isso o cache, e por isso as duas regras que o cercam:

- **`kid` desconhecido busca o JWKS de novo**, porque chave rotacionada
  precisa ser aprendida sem reiniciar o processo;
- **mas no maximo uma vez por `intervalo_minimo`**, porque senao qualquer
  pessoa com um token de `kid` inventado nos faria martelar o Supabase — um
  amplificador de trafego acionavel de fora.

Este modulo **nao decide nada sobre identidade**: ele entrega uma chave
publica. Quem verifica assinatura e `exp` e o `jwt.decode` em
`app/core/security.py`, e quem decide de quem e a conta continua sendo o
`supabase_id` resolvido contra o banco.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, Awaitable, Callable, Optional

import httpx

from app.core.config import settings

# Uma chave rotacionada aparece em no maximo este tempo; um token de `kid`
# inventado custa, no maximo, uma busca por esta janela.
INTERVALO_MINIMO_ENTRE_BUSCAS = 300.0

TIMEOUT = 5.0


class ChaveDesconhecida(LookupError):
    """O `kid` do token nao esta no JWKS do projeto."""


async def _buscar_do_supabase() -> dict[str, Any]:
    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=TIMEOUT) as cliente:
        resposta = await cliente.get(url)
        resposta.raise_for_status()
        return resposta.json()


class CacheDeJwks:
    def __init__(
        self,
        buscar: Callable[[], Awaitable[dict[str, Any]]] = _buscar_do_supabase,
        intervalo_minimo: float = INTERVALO_MINIMO_ENTRE_BUSCAS,
        relogio: Callable[[], float] = time.monotonic,
    ):
        self._buscar = buscar
        self._intervalo_minimo = intervalo_minimo
        self._relogio = relogio
        self._por_kid: dict[str, dict[str, Any]] = {}
        self._ultima_busca: Optional[float] = None
        self._trava = asyncio.Lock()

    async def chave(self, kid: Optional[str]) -> dict[str, Any]:
        """
        A chave publica daquele `kid`. Levanta `ChaveDesconhecida` se ela nao
        estiver no JWKS — inclusive quando o intervalo minimo impede uma busca
        nova, que e o caso em que dizer "nao conheco" e a resposta certa.
        """
        achada = self._por_kid.get(kid) if kid else None
        if achada is not None:
            return achada

        async with self._trava:
            # Outra corrotina pode ter buscado enquanto esperavamos a trava.
            achada = self._por_kid.get(kid) if kid else None
            if achada is not None:
                return achada
            if self._pode_buscar():
                await self._atualizar()
                achada = self._por_kid.get(kid) if kid else None
                if achada is not None:
                    return achada

        raise ChaveDesconhecida(f"kid={kid} nao esta no JWKS do projeto")

    def _pode_buscar(self) -> bool:
        if self._ultima_busca is None:
            return True
        return self._relogio() - self._ultima_busca >= self._intervalo_minimo

    async def _atualizar(self) -> None:
        self._ultima_busca = self._relogio()
        documento = await self._buscar()
        self._por_kid = {
            chave["kid"]: chave
            for chave in documento.get("keys", [])
            if chave.get("kid")
        }
