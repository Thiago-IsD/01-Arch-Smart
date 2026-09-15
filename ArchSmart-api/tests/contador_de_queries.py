"""
Conta idas ao banco, e faz a requisicao passar pelo `get_context` de verdade.

Existem porque cada consulta e uma ida a rede, e na API implantada cada ida
custa 0,17 s (docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md).
Tres arquivos de teste ja tinham a sua copia do contador; os testes novos usam
esta.

`contexto_de_verdade` importa porque as fixtures `client_a`/`client_b`
SOBREPOEM `get_context`: com a sobreposicao, o caminho compartilhado nao roda,
o `User` nao entra na identity map, e a contagem mediria uma requisicao que a
producao nunca faz.
"""
from contextlib import contextmanager

from sqlalchemy import event

from app.services.auth_service import auth_service


class ContadorDeQueries:
    def __init__(self, conexao):
        self.conexao = conexao
        self.sqls: list[str] = []

    def __enter__(self):
        event.listen(self.conexao, "before_cursor_execute", self._registrar)
        return self

    def __exit__(self, *_):
        event.remove(self.conexao, "before_cursor_execute", self._registrar)

    def _registrar(self, conn, cursor, sql, params, context, executemany):
        self.sqls.append(sql)

    def __len__(self):
        return len(self.sqls)

    def resumo(self) -> str:
        return "\n  ".join(" ".join(sql.split())[:90] for sql in self.sqls)


@contextmanager
def contexto_de_verdade(client, usuario, monkeypatch):
    """
    A validacao local do JWT falha (segredo None, token que nao e JWT) e a
    remota e stubada para SUCEDER com o `sub` do usuario: e o caminho que
    resolve identidade no banco, igual a producao.
    """
    monkeypatch.setattr("app.core.security.settings.SUPABASE_JWT_SECRET", None)

    async def _resolve(_token):
        return {"id": usuario.supabase_id, "email": usuario.email}

    monkeypatch.setattr(auth_service, "get_user", _resolve)
    with client.sem_sobreposicao_de_contexto():
        yield {"Authorization": "Bearer nao-e-jwt"}
