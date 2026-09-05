"""
Lints de arquitetura, escritos como teste porque o CI ja roda pytest.

Cada regra aqui existe porque a violacao dela ja custou alguma coisa neste
repositorio. Elas falham com o arquivo e a linha, nao com "algo esta errado".
"""
import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]

# Pastas que nao sao codigo nosso — nunca "codigo que hoje nao filtramos".
# venv/ sozinho tem milhares de arquivos .py; __pycache__ nao tem .py de
# verdade mas custa caro descer nele; node_modules e de outro stack. A
# varredura desce em TODO o resto — inclusive tools/, alembic/ e tests/,
# porque os dois lints abaixo precisam ENCONTRAR ocorrencias ali para depois
# decidir se sao permitidas; um diretorio novo que ninguem lembrou de listar
# nao pode virar ponto cego.
#
# Isto e deliberadamente diferente do allowlist de diretorios que a primeira
# versao deste arquivo usava. O lint irmao (test_colunas_de_escopo.py) levou
# esse mesmo susto na Tarefa 4: comecou olhando so para app/ e perdeu quatro
# sites quebrados em tools/seed.py, um script que escreve em bancos de
# verdade — so virou uma varredura do repositorio inteiro, com exclusao
# explicita, depois disso. A mesma licao vale aqui.
_PASTAS_PODADAS = {"venv", "node_modules", "__pycache__"}


def _arquivos_python() -> list[Path]:
    arquivos = []
    for diretorio_atual, subpastas, nomes in os.walk(RAIZ):
        subpastas[:] = [s for s in subpastas if s not in _PASTAS_PODADAS]
        for nome in nomes:
            if nome.endswith(".py"):
                arquivos.append(Path(diretorio_atual) / nome)
    return arquivos


def _ocorrencias(agulha: str) -> list[str]:
    achados = []
    for arquivo in _arquivos_python():
        for numero, linha in enumerate(
            arquivo.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if agulha in linha:
                achados.append(f"{arquivo.relative_to(RAIZ)}:{numero}: {linha.strip()}")
    return achados


def _fora_dos_locais_permitidos(
    agulha: str, permitidos: tuple[Path, ...]
) -> list[str]:
    """
    `permitidos` mistura arquivos (o ponto de definicao) e diretorios (onde o
    uso e legitimo) — `Path.is_relative_to` cobre os dois: um arquivo so e
    "relativo a si mesmo" quando o achado E ele mesmo.

    Comparado contra o CAMINHO isolado (`achado.split(":")[0]`), nao contra a
    linha inteira: uma versao anterior deste lint comparava a linha inteira
    contra a string "app/db/repository.py" para reconhecer a definicao da
    escotilha, e uma chamada ilegitima como
    `ScopedRepository.unscoped_query(db, Project)  # ver app/db/repository.py`
    escapava, porque o texto do comentario continha a mesma substring usada
    para reconhecer a definicao. Comparar so o caminho fecha esse buraco.
    """
    fora = []
    for achado in _ocorrencias(agulha):
        caminho = RAIZ / achado.split(":")[0].replace("\\", "/")
        if not any(caminho.is_relative_to(p) for p in permitidos):
            fora.append(achado)
    return fora


# A escotilha e legitima em script que fala com o banco, em migracao, em
# teste, e na propria definicao. Note que a spec dizia `app/tools/`, que NAO
# existe: o diretorio real e ArchSmart-api/tools/ (ver
# ArchSmart-api/tools/README.md).
ONDE_A_ESCOTILHA_E_PERMITIDA = (
    RAIZ / "tools",
    RAIZ / "alembic",
    RAIZ / "tests",
    RAIZ / "app" / "db" / "repository.py",
)


def test_escotilha_so_em_tools_alembic_e_testes():
    fora = _fora_dos_locais_permitidos("unscoped_query", ONDE_A_ESCOTILHA_E_PERMITIDA)
    assert not fora, (
        "unscoped_query() atravessa o filtro por conta e so pode aparecer em "
        "tools/, alembic/, tests/ e na propria definicao "
        "(app/db/repository.py). Fora de la:\n" + "\n".join(fora)
    )


# O espelho da escotilha. `ScopedRepository` promete que a unica origem de um
# `RequestContext` e o servidor (Art. 1) — mas nada impede, em Python, que um
# endpoint construa um `RequestContext(...)` com o account_id que quiser.
# app/core/security.py e onde a identidade e resolvida a partir do token (a
# UNICA construcao de producao legitima); tests/ constroi contextos forjados
# de proposito, para testar isolamento sem precisar de um token de verdade.
ONDE_REQUESTCONTEXT_E_PERMITIDO = (
    RAIZ / "app" / "core" / "security.py",
    RAIZ / "tests",
)


def test_requestcontext_so_em_security_e_testes():
    fora = _fora_dos_locais_permitidos(
        "RequestContext(", ONDE_REQUESTCONTEXT_E_PERMITIDO
    )
    assert not fora, (
        "RequestContext(...) so pode ser construido em app/core/security.py "
        "(onde a identidade e resolvida a partir do token) e em tests/ "
        "(contexto forjado para teste). Um endpoint que monta o proprio "
        "contexto pode preencher account_id vindo de onde quiser — o oposto "
        "do que ScopedRepository existe para garantir. Fora de la:\n"
        + "\n".join(fora)
    )
