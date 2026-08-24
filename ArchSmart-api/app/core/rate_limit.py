"""
Limitador de requisicoes compartilhado.

Escopo atual: memoria do processo. Serve para a instancia unica do beta;
quando houver mais de uma instancia, trocar o storage por Redis — o ponto
de troca e apenas este arquivo.
"""
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
