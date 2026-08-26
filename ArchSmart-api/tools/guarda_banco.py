"""
Guarda unica: impede que um script destrutivo rode contra banco de producao.

Antes deste modulo existiam duas guardas divergentes e dois scripts sem
guarda nenhuma:

  tests/conftest.py  exigia nome terminado em "_test" E hosts fora de
                     ("supabase.co", "supabase.com", "rds.amazonaws.com")
  tools/seed.py      so a lista de hosts, outra:
                     ("supabase.co", "pooler.supabase.com", "render.com", "amazonaws.com")
  tools/reset_db.py  NADA — e faz DROP SCHEMA public CASCADE
  tools/init_db.py   NADA

Nenhuma das duas listas era superconjunto da outra, e a divergencia so foi
notada numa revisao. Uma regra em um lugar so, com teste, e o unico jeito de
isso nao voltar.

## A regra

E uma lista de PERMISSAO, nao de proibicao. Lista de proibicao envelhece com o
mercado: a do seed passava livremente por Neon, Railway, DigitalOcean, Azure,
Cloud SQL, ou pelo IP cru de uma maquina de producao. Aqui, o banco so e aceito
se provar que e descartavel:

  1. o host e local (localhost, 127.0.0.1, ::1 — e so esses tres, ver
     HOSTS_LOCAIS); ou
  2. o nome do banco termina em "_test" ou "_seed".

Qualquer outra coisa e recusada. Bater num staging remoto de proposito continua
possivel — com a flag explicita, que e o ponto: vira uma decisao, nao um
acidente.

Quem precisa de MAIS que isso passa `exigir_host_local=True`, e ai o criterio 2
deixa de valer. E o caso de tests/conftest.py: um banco chamado "arqsmart_test"
num Supabase ou RDS compartilhado satisfaz o criterio 2, e a suite apaga o
schema inteiro a cada execucao. Para os scripts, o criterio 2 e o que permite
semear um staging sem flag; para a suite, ele e um buraco.

A lista de hosts gerenciados sobrevive so para a MENSAGEM: quando a URL bate num
deles, dizer "isto e Supabase" ajuda mais que "host nao-local".

## Por que a URL vem daqui, e nao de os.environ

`resolver_url_e_origem()` le `settings.DATABASE_URL` — o MESMO objeto que
`app/db/session.py` importa para criar o engine. Ler `os.environ["DATABASE_URL"]`
foi o Critical da revisao da Tarefa 9: uma variavel nao exportada nao e ausencia
de URL, e o pydantic cai em silencio para o `.env`, que na maquina de
desenvolvimento aponta para o pooler do Supabase de producao. A guarda aprovava
uma URL e o engine conectava em outra.

Importar `app.core.config` nao abre conexao — `create_engine` so e chamado em
`app.db.session` — entao resolver a URL antes de liberar o script e seguro.
"""
from __future__ import annotations

import os
import sys
from urllib.parse import parse_qs, urlsplit

# Hosts que significam "esta maquina", e nada mais. Sao os unicos aceitos sem
# que o nome do banco precise se declarar descartavel.
#
# Nomes de servico do Docker Compose ("db", "postgres") ficaram DE FORA de
# proposito: uma producao em Compose com o servico chamado "db" passaria pela
# guarda. Nao fazem falta — os dois bancos locais deste projeto sao alcancados
# por localhost tanto aqui quanto no CI (docker-compose.test.yml publica em
# localhost:55432; o TEST_DATABASE_URL do ci.yml tambem diz localhost; a stack
# do Supabase local atende em 127.0.0.1:54322).
HOSTS_LOCAIS = frozenset({"localhost", "127.0.0.1", "::1"})

# Sufixos que declaram um banco como descartavel. "_test" e o que o
# docker-compose.test.yml cria; "_seed" existe para um banco de volume criado a
# mao, que nao e de teste mas tambem nao e de ninguem.
SUFIXOS_DESCARTAVEIS = ("_test", "_seed")

# So para a mensagem de recusa ficar util. NAO e a regra — ver o docstring.
# "supabase.co" cobre tambem "supabase.com" e "pooler.supabase.com", por ser
# substring dos dois; listar os tres fazia a mensagem dizer "contem
# supabase.co, pooler.supabase.com" para um host terminado em .com.
HOSTS_GERENCIADOS = ("supabase.co", "render.com", "amazonaws.com")

def descrever_destino(url: str) -> str:
    """
    'host:porta/banco' — nunca a URL inteira, nunca credencial.

    Esta e a UNICA forma em que uma URL de banco aparece numa mensagem ou num
    log deste projeto. Houve uma `redigir_senha()` que apagava a senha da URL
    completa com expressao regular; ela errava em tres formas legitimas de
    libpq (URL sem usuario, senha contendo '@', e `?password=` na query), e
    cada erro desses e uma credencial de producao num log de build arquivado.
    Montar a string a partir dos campos que interessam nao tem como errar: o
    que nao e host, porta ou nome de banco simplesmente nao entra.
    """
    try:
        partes = urlsplit(url)
        host = partes.hostname or "?"
        porta = f":{partes.port}" if partes.port else ""
        banco = (partes.path or "").lstrip("/") or "?"
        return f"{host}{porta}/{banco}"
    except ValueError:
        return "<URL nao interpretavel>"


def resolver_url_e_origem() -> tuple[str, str]:
    """
    Resolve a URL do banco exatamente como a aplicacao resolve, e diz de onde
    ela veio — para a mensagem deixar claro se foi a variavel exportada ou o
    fallback silencioso do `.env`.
    """
    from app.core.config import settings

    url = settings.DATABASE_URL
    if os.environ.get("DATABASE_URL"):
        origem = "variavel de ambiente DATABASE_URL"
    else:
        origem = "arquivo .env (nenhuma DATABASE_URL exportada no ambiente)"
    return url, origem


def motivo_de_recusa(url: str, exigir_host_local: bool = False) -> str | None:
    """
    Devolve None se o banco for aceitavel, ou o motivo da recusa em uma frase.

    Com `exigir_host_local=True`, so o criterio do host vale — o sufixo
    "_test"/"_seed" deixa de bastar. E o modo de quem apaga o schema inteiro.

    Funcao pura: nao le ambiente, nao encerra o processo, nao conecta. Todo o
    julgamento vive aqui para que ele possa ser testado sem banco.
    """
    if not url:
        return "DATABASE_URL vazia."

    try:
        partes = urlsplit(url)
    except ValueError as erro:
        return f"DATABASE_URL nao e uma URL interpretavel ({erro})."

    # O libpq aceita host e hostaddr como parametro de conexao, e eles VENCEM o
    # host da URL: "postgresql://u:s@localhost/db?host=prod.supabase.co" faz o
    # psycopg2 conectar em prod.supabase.co. Julgar o host da URL nesse caso e
    # julgar uma coisa e conectar em outra — a mesma classe do defeito que esta
    # guarda existe para fechar. Recusar e mais simples que interpretar.
    sobrepoem_host = {"host", "hostaddr"} & set(parse_qs(partes.query))
    if sobrepoem_host:
        return (
            f"a DATABASE_URL traz {', '.join(sorted(sobrepoem_host))} na query "
            "string, que sobrepoe o host da URL — a guarda julgaria um host e a "
            "conexao iria para outro."
        )

    # .hostname do urlsplit ja vem em minuscula, entao db.ABCDEF.SUPABASE.CO
    # nao escapa. A guarda antiga comparava a string crua e escapava.
    host = partes.hostname
    if not host:
        return "DATABASE_URL nao tem host."

    # Comparacao por IGUALDADE, nunca por substring: com "h in host",
    # "localhost.evil.com" passaria.
    if host in HOSTS_LOCAIS:
        return None

    gerenciados = [h for h in HOSTS_GERENCIADOS if h in host]

    if exigir_host_local:
        detalhe = (
            f" (e {', '.join(gerenciados)}, host gerenciado)" if gerenciados else ""
        )
        return (
            f"o host {host!r} nao e local{detalhe}. Neste modo o sufixo "
            f"{'/'.join(SUFIXOS_DESCARTAVEIS)} no nome do banco NAO basta: um "
            "banco de nome descartavel num servidor compartilhado continua sendo "
            "um servidor compartilhado."
        )

    # O nome do banco e UM segmento de caminho. Mais de um e URL malformada, e
    # aceita-la abre uma brecha boba: com endswith no caminho inteiro,
    # ".../prod/_test" passava; pegando so o ultimo segmento, ele continua
    # passando, porque o ultimo segmento e literalmente "_test". A unica leitura
    # que fecha e recusar o caminho composto.
    banco = (partes.path or "").lstrip("/")
    if "/" in banco:
        return (
            f"o caminho {partes.path!r} tem mais de um segmento, entao nao e um "
            "nome de banco valido."
        )
    if banco.endswith(SUFIXOS_DESCARTAVEIS):
        return None

    if gerenciados:
        return (
            f"o host {host!r} contem {', '.join(gerenciados)}, que e host "
            "gerenciado (producao ou staging)."
        )
    return (
        f"o host {host!r} nao e local, e o nome do banco {banco!r} nao termina "
        f"em {' nem '.join(SUFIXOS_DESCARTAVEIS)}. Um banco que nao se declara "
        "descartavel e tratado como se fosse de producao."
    )


def recusar_se_nao_descartavel(
    url: str,
    origem: str,
    forcado: bool,
    acao: str,
    flag: str = "--eu-sei-o-que-estou-fazendo",
    exigir_host_local: bool = False,
) -> None:
    """
    Encerra o processo com saida 1 se `url` nao for um banco descartavel.

    `acao` descreve o estrago em uma frase ("apagar o schema public inteiro"),
    porque a mensagem serve para alguem que rodou o comando errado as duas da
    manha e precisa entender em dois segundos o que quase aconteceu. Cada
    chamador escreve a sua: dizer "nao ha desfazer" para um script que so cria
    tabelas seria a mesma imprecisao que este repositorio cobra dos numeros.

    A mensagem e ASCII de proposito. O shell de referencia do projeto e o
    PowerShell 5.1 (ver docs/dev/ambiente.md), onde um travessao sai como "?"
    no console — e uma mensagem de emergencia nao pode depender de encoding.
    """
    motivo = motivo_de_recusa(url, exigir_host_local=exigir_host_local)
    if motivo is None:
        return
    if forcado:
        # Nao sai calado. Quem usou a escotilha contra um staging precisa
        # aparecer no log, senao "passou" e "foi forcado a passar" viram a
        # mesma linha na hora de entender o que aconteceu.
        print(
            f"GUARDA IGNORADA ({flag}): {motivo}\n"
            f"  Prosseguindo para {descrever_destino(url)} — {acao}.",
            file=sys.stderr,
        )
        return
    sys.exit(
        f"Recusando rodar: {motivo}\n"
        f"  Este script vai {acao}.\n"
        f"  Destino: {descrever_destino(url)}\n"
        f"  Origem: {origem}\n"
        f"Se e realmente o que voce quer, passe {flag}."
    )
