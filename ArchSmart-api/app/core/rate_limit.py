"""
Limitador de requisicoes compartilhado.

Escopo atual: memoria do processo. Serve para a instancia unica do beta;
quando houver mais de uma instancia, trocar o storage por Redis — o ponto
de troca e apenas este arquivo.
"""
import base64
import json

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)


def chave_por_apresentacao(request: Request) -> str:
    """
    Chave de limite por apresentacao, nao por IP do cliente.

    O uvicorn roda sem --forwarded-allow-ips, entao o XFF do load balancer
    nao e confiavel e request.client.host resolve para o IP do proxy em
    toda requisicao — get_remote_address vira uma unica chave global. Nesse
    endpoint (senha do portal), isso faz o limite da plataforma inteira
    ser 10/minuto: um atacante tranca todos os clientes de todos os portais.
    Chavear pelo UUID da apresentacao limita o raio de alcance a uma unica
    apresentacao.
    """
    presentation_uuid = request.path_params.get("presentation_uuid")
    return presentation_uuid or get_remote_address(request)


def chave_por_conta(request: Request) -> str:
    """
    Chave de limite por portador do token, nao por IP do cliente.

    Mesma causa da `chave_por_apresentacao`: sem --forwarded-allow-ips no
    uvicorn, get_remote_address sempre devolve o IP do proxy, e o limite do
    endpoint de telemetria vira um balde unico pra plataforma inteira — um
    usuario navegando rapido silencia o evento dos outros todos, e como o
    429 e engolido pelo cliente (enviarEventos), a perda fica indistinguivel
    de "ninguem navegou".

    O `sub` sai decodificando o corpo do JWT em base64, SEM checar a
    assinatura. Isso so serve pra agrupar requisicoes do mesmo portador num
    mesmo balde; nao e autorizacao, e nunca deve virar uma — quem autoriza
    de fato continua sendo `get_repo`, que resolve a identidade contra o
    Supabase.

    Um chamador anonimo forjando um `sub` novo a cada tentativa nao chega a
    abrir balde nenhum aqui, mas nao por nada que esta funcao faca: quem
    declara `repo: ScopedRepository = Depends(get_repo)` e o endpoint
    `receber_eventos`, que e o que o `@limiter.limit` decora direto. O
    FastAPI resolve toda dependencia `Depends(...)` do endpoint antes de
    chamar a funcao decorada, e a checagem de limite do slowapi roda
    dentro dela (`sync_wrapper`, `slowapi/extension.py`) — ou seja,
    `get_repo` ja rejeitou o token forjado com 401, contra o Supabase de
    verdade, antes de esta funcao ser chamada. Nao e o balde por IP que
    pega esse caso: o caso nem chega aqui. Essa ordem, porem, e detalhe de
    implementacao do FastAPI/slowapi, nao um contrato que este arquivo
    controla — se ela mudar um dia, uma `chave_por_conta` que estourasse
    com corpo malformado passaria a ser alcancavel por um chamador sem
    credencial nenhuma. Por isso ela continua endurecida contra JWT
    ilegivel mesmo sem ninguem hoje conseguir provar esse caminho por fora.
    O que esta chave resolve, no caminho que de fato a alcanca, e o caso
    comum: usuario legitimo sendo silenciado pelo trafego de outro usuario
    legitimo.
    """
    autorizacao = request.headers.get("authorization", "")
    if autorizacao.lower().startswith("bearer "):
        token = autorizacao[7:]
        partes = token.split(".")
        if len(partes) == 3:
            try:
                corpo = partes[1]
                corpo += "=" * (-len(corpo) % 4)
                payload = json.loads(base64.urlsafe_b64decode(corpo))
                # payload e JSON decodificado de entrada nao confiavel: pode
                # ser um JSON valido que nao e objeto (numero, lista, string,
                # null). So um dict tem ".get" — qualquer outra forma cai no
                # IP, igual a um corpo ilegivel.
                sub = payload.get("sub") if isinstance(payload, dict) else None
            except (ValueError, RecursionError):
                # ValueError ja cobre json.JSONDecodeError e, neste Python,
                # binascii.Error e UnicodeDecodeError tambem sao subclasses
                # dela — nao precisam de entrada propria na tupla.
                # RecursionError e a excecao aqui: json.loads recursa por
                # nivel de aninhamento, e um corpo tipo "[[[...]]]" com
                # milhares de colchetes estoura o limite de recursao do
                # Python antes de JSONDecodeError ter chance de ser
                # levantado.
                sub = None
            if sub:
                return f"conta:{sub}"
    return get_remote_address(request)
