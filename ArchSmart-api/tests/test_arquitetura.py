"""
Lints de arquitetura, escritos como teste porque o CI ja roda pytest.

Cada regra aqui existe porque a violacao dela ja custou alguma coisa neste
repositorio. Elas falham com o arquivo e a linha, nao com "algo esta errado".
"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
APP = RAIZ / "app"

# A escotilha e legitima em script que fala com o banco e em migracao. Note
# que a spec dizia `app/tools/`, que NAO existe: o diretorio real e
# ArchSmart-api/tools/ (ver ArchSmart-api/tools/README.md).
ONDE_A_ESCOTILHA_E_PERMITIDA = (RAIZ / "tools", RAIZ / "alembic", RAIZ / "tests")

# Caminho (relativo a RAIZ, estilo posix) de onde `unscoped_query` e
# DEFINIDA — nao onde ela pode ser CHAMADA. Comparado contra o segmento de
# caminho isolado, nao contra a linha inteira: uma versao anterior deste
# lint comparava a linha inteira ("achado"), e uma chamada ilegitima como
# `ScopedRepository.unscoped_query(db, Project)  # ver app/db/repository.py`
# escapava, porque o texto do comentario continha a mesma substring usada
# para reconhecer a definicao. Comparar so o caminho fecha esse buraco.
DEFINICAO_DA_ESCOTILHA = "app/db/repository.py"


# Diretorios de codigo, explicitos. NAO use RAIZ.rglob("*.py"): ele enumera os
# 4024 arquivos .py do venv/ antes de filtrar, e cada lint deste arquivo pagaria
# isso de novo.
DIRETORIOS_DE_CODIGO = ("app", "tools", "alembic", "tests")


def _arquivos_python(raiz: Path) -> list[Path]:
    if raiz.is_dir() and raiz != RAIZ:
        origens = [raiz]
    else:
        origens = [RAIZ / d for d in DIRETORIOS_DE_CODIGO if (RAIZ / d).is_dir()]
    return [
        p
        for origem in origens
        for p in origem.rglob("*.py")
        if "venv" not in p.parts and "node_modules" not in p.parts
    ]


def _ocorrencias(raiz: Path, agulha: str) -> list[str]:
    achados = []
    for arquivo in _arquivos_python(raiz):
        for numero, linha in enumerate(
            arquivo.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if agulha in linha:
                achados.append(f"{arquivo.relative_to(RAIZ)}:{numero}: {linha.strip()}")
    return achados


def test_escotilha_so_em_tools_alembic_e_testes():
    fora = [
        achado
        for achado in _ocorrencias(RAIZ, "unscoped_query")
        if achado.split(":")[0].replace("\\", "/") != DEFINICAO_DA_ESCOTILHA
        and not any(
            (RAIZ / achado.split(":")[0]).is_relative_to(permitido)
            for permitido in ONDE_A_ESCOTILHA_E_PERMITIDA
        )
    ]
    assert not fora, (
        "unscoped_query() atravessa o filtro por conta e so pode aparecer em "
        "tools/, alembic/ e tests/. Fora de la:\n" + "\n".join(fora)
    )
