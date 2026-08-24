"""
Limitador de requisicoes compartilhado.

Escopo atual: memoria do processo. Serve para a instancia unica do beta;
quando houver mais de uma instancia, trocar o storage por Redis — o ponto
de troca e apenas este arquivo.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
