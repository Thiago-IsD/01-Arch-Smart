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

Recebe `db` e faz `db.expunge_all()` antes de montar o stub: sem isso, o
`User` que a fixture (`conta_a`/`conta_b`) devolveu continua na sessao por
conta ALHEIA a producao — nenhuma requisicao real chega com o usuario ja
carregado por quem chamou. Com o expunge, o unico `User` que entra na
identity map durante a requisicao e o que `get_context` carregar, exatamente
como acontece fora do teste — e foi assim que a medicao contra o banco real
(`TestClient(app)` sem override) pegou o que este arquivo escondia: 4
consultas, nao 3, porque a identity map guarda so referencia FRACA e nada
alem da fixture segurava o objeto.

O expunge sozinho nao bastava para reproduzir o 4 aqui, e a causa NAO e
timing de GC (varias tentativas com `gc.collect()` repetido e
`gc.set_threshold(1, 1, 1)` nao mudaram nada — o objeto continuava achavel).
Rastreado por `gc.get_referrers()`: o ramo de excecao de `resolve_identity`
(`app/core/security.py`) loga `logger.info("...", erro)` passando o objeto
da excecao, nao a string dele. O handler de captura de log do proprio pytest
retem esse `LogRecord` (com `erro` no `args`) pela duracao do teste — e
`erro.__traceback__` encadeia ate o frame de `resolve_identity`, cujo
`f_back` e o frame de `get_context`, cujos locals incluem o `usuario` recem
carregado. A cadeia — captura de log do pytest -> LogRecord.args -> excecao
-> traceback -> frame de resolve_identity -> f_back -> frame de get_context
-> `usuario` — mantem o objeto vivo so durante o teste; a API implantada nao
tem esse handler, entao la o refcounting derruba o objeto na hora (e foi por
isso que a medicao contra o banco real deu 4). Silenciar esse `logger.info`
durante o `with` tira a unica coisa deste teste que a producao nao tem.
"""
from contextlib import contextmanager

from sqlalchemy import event

import app.core.security as _security
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
def contexto_de_verdade(client, db, usuario, monkeypatch):
    """
    A validacao local do JWT falha (segredo None, token que nao e JWT) e a
    remota e stubada para SUCEDER com o `sub` do usuario: e o caminho que
    resolve identidade no banco, igual a producao.

    `supabase_id`/`email` sao capturados ANTES do `db.expunge_all()` — o
    stub roda depois, e um `usuario` desanexado da sessao levantaria
    `DetachedInstanceError` no primeiro `.supabase_id` lido dali. O expunge
    tira TODOS os objetos da sessao, `usuario` incluido, para a identity map
    comecar vazia quando `get_context` rodar de verdade.

    `logger.info` (o do ramo de excecao de `resolve_identity`) e silenciado
    pelo motivo do docstring do modulo: sem isso, a captura de log do pytest
    mantem viva a excecao que a validacao local levanta de proposito aqui —
    e, atraves do traceback dela, o `User` que `get_context` acabou de
    carregar — mascarando exatamente o bug que este teste existe para pegar.
    """
    supabase_id = usuario.supabase_id
    email = usuario.email
    db.expunge_all()
    monkeypatch.setattr("app.core.security.settings.SUPABASE_JWT_SECRET", None)
    monkeypatch.setattr(_security.logger, "info", lambda *args, **kwargs: None)

    async def _resolve(_token):
        return {"id": supabase_id, "email": email}

    monkeypatch.setattr(auth_service, "get_user", _resolve)
    with client.sem_sobreposicao_de_contexto():
        yield {"Authorization": "Bearer nao-e-jwt"}
