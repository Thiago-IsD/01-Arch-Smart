"""
A migracao roda no start do container, e falha alto.

O Render free tier nao tem Pre-Deploy Command (recurso de instancia paga), que
era o mecanismo previsto em docs/dev/ambientes-online.md para rodar
`alembic upgrade head` antes de subir a API. Sem ele, o unico lugar que roda
automaticamente em todo deploy — e que fica versionado neste repositorio, em
vez de escondido num painel — e o CMD do Dockerfile. Ver ADR 0007.

Este teste guarda tres propriedades desse CMD. Nenhuma e decorativa:

  1. a migracao acontece (senao o banco novo nasce vazio e a API sobe contra
     schema inexistente — foi exatamente o estado medido em 29/08/2026, com
     os dois servicos respondendo /health/db ok contra bancos de 0 tabelas);
  2. ela acontece ANTES do uvicorn (migrar depois de aceitar request e servir
     contra schema velho durante a janela);
  3. os dois estao ligados por `&&`, e nao por `;` — com `;` o uvicorn sobe
     mesmo se a migracao falhar, que e o modo de falha silenciosa que a
     ADR 0003 usa como sinal de que o descarte do banco nao resolveu nada.

Nao toca banco: le o Dockerfile como texto.
"""
import re
from pathlib import Path

import pytest

DOCKERFILE = Path(__file__).resolve().parents[1] / "Dockerfile"


@pytest.fixture(scope="module")
def linha_do_cmd():
    texto = DOCKERFILE.read_text(encoding="utf-8")
    linhas = [l for l in texto.splitlines() if l.strip().startswith("CMD")]
    assert len(linhas) == 1, (
        f"Esperado exatamente um CMD no Dockerfile, achei {len(linhas)}: {linhas}"
    )
    return linhas[0]


def test_o_cmd_roda_a_migracao(linha_do_cmd):
    assert "alembic upgrade head" in linha_do_cmd, (
        "O CMD do Dockerfile nao roda `alembic upgrade head`. Sem isso nenhum "
        "ambiente online aplica migracao automaticamente: o Render free tier "
        "nao tem Pre-Deploy Command. Ver ADR 0007.\n"
        f"CMD atual: {linha_do_cmd}"
    )


def test_a_migracao_vem_antes_do_uvicorn(linha_do_cmd):
    pos_alembic = linha_do_cmd.find("alembic upgrade head")
    pos_uvicorn = linha_do_cmd.find("uvicorn")
    assert pos_alembic != -1 and pos_uvicorn != -1
    assert pos_alembic < pos_uvicorn, (
        "A migracao precisa rodar ANTES do uvicorn; do jeito que esta, a API "
        "aceita request enquanto o schema ainda e o antigo.\n"
        f"CMD atual: {linha_do_cmd}"
    )


def test_a_migracao_falha_alto(linha_do_cmd):
    """`&&` entre os dois: migracao vermelha derruba o deploy."""
    entre = linha_do_cmd[
        linha_do_cmd.find("alembic upgrade head") + len("alembic upgrade head"):
        linha_do_cmd.find("uvicorn")
    ]
    assert "&&" in entre, (
        "Entre `alembic upgrade head` e o uvicorn precisa haver `&&`. Com `;` "
        "(ou `||`) o uvicorn sobe mesmo com a migracao falhando, e a API passa "
        "a servir contra um schema desatualizado sem que nada fique vermelho — "
        "decisao registrada na ADR 0007.\n"
        f"Encontrado entre os dois: {entre!r}"
    )
    assert not re.search(r"(?<![&|]);(?![&|])", entre), (
        f"Ha um `;` separando a migracao do uvicorn: {entre!r}"
    )
