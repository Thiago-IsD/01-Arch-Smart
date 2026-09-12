"""
Limitador de requisicoes compartilhado.

Escopo atual: memoria do processo. Serve para a instancia unica do beta;
quando houver mais de uma instancia, trocar o storage por Redis — o ponto
de troca e apenas este arquivo.
"""
import base64
import binascii
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
    Supabase depois que o limitador ja deixou passar. Por isso essa chave
    nao fecha a porta pra um ataque de inundacao anonimo: um cliente sem
    credencial real pode forjar um `sub` diferente a cada requisicao e abrir
    um balde novo por tentativa, sem nunca aparecer aqui com o mesmo valor
    duas vezes. Esse caminho nao fica livre, so passa por outro lugar: sem
    token valido o resolvedor de identidade responde 401 antes de qualquer
    escrita, e o balde por IP (get_remote_address, usado quando nao ha `sub`
    decodificavel) continua de pe atras como segunda guarda contra esse
    cenario. O que esta chave resolve e o caso comum — usuario legitimo
    sendo silenciado pelo trafego de outro usuario legitimo —, nao o caso
    adversarial.
    """
    autorizacao = request.headers.get("authorization", "")
    if autorizacao.lower().startswith("bearer "):
        token = autorizacao[7:]
        partes = token.split(".")
        if len(partes) == 3:
            try:
                corpo = partes[1]
                corpo += "=" * (-len(corpo) % 4)
                sub = json.loads(base64.urlsafe_b64decode(corpo)).get("sub")
            except (ValueError, binascii.Error, UnicodeDecodeError):
                sub = None
            if sub:
                return f"conta:{sub}"
    return get_remote_address(request)
