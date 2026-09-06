"""
Lints de arquitetura, escritos como teste porque o CI ja roda pytest.

Cada regra aqui existe porque a violacao dela ja custou alguma coisa neste
repositorio. Elas falham com o arquivo e a linha, nao com "algo esta errado".
"""
import ast
import os
from pathlib import Path

import app.models.all_models  # noqa: F401  (usado via vars() abaixo)

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
    """
    Ordem ESTAVEL, nao a do sistema de arquivos.

    `os.walk` devolve na ordem que o sistema de arquivos entrega, e ela muda
    entre plataformas: medido em 06/09/2026, NTFS aqui entrega `auth.py` antes
    de `leads.py` e o ext4 do runner do CI entrega ao contrario. Um lint que
    so afirma "nao ha achados" nao se importa — mas um teste que compara a
    lista encontrada passa numa plataforma e reprova na outra, com os mesmos
    itens. Foi o que aconteceu com
    `test_marca_de_pre_sessao_nao_cresce_sem_querer`: verde no Windows,
    vermelho no CI. Ordenar na origem tira a pegadinha de quem escrever o
    proximo consumidor.
    """
    arquivos = []
    for diretorio_atual, subpastas, nomes in os.walk(RAIZ):
        subpastas[:] = [s for s in subpastas if s not in _PASTAS_PODADAS]
        for nome in nomes:
            if nome.endswith(".py"):
                arquivos.append(Path(diretorio_atual) / nome)
    return sorted(arquivos)


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


def test_nenhum_print_em_app():
    """
    43 print() em app/ (fora de app/tests/) em 05/09/2026. Eles saem sem
    timestamp e sem nome de modulo, o que tornou o log do Render inutil para
    diagnostico — e alguns imprimiam trecho de token.
    """
    achados = [
        a
        for a in _ocorrencias("print(")
        if a.replace("\\", "/").startswith("app/")
    ]
    assert not achados, (
        "use logging.getLogger(__name__) em vez de print():\n"
        + "\n".join(achados)
    )


# O lint mira o MODO DE FALHA (query direta sobre model com account_id), nao
# o nome do arquivo. Substitui a antiga JA_CONVERTIDOS: aquela lista so podia
# receber um arquivo TOTALMENTE convertido, e quatro arquivos legitimos —
# product_router.py, users.py, auth.py e leads.py — mantem excecao
# documentada de catalogo global ou de pre-sessao, entao nunca entravam e
# ficavam sem catraca nenhuma. Entre eles esta o de maior valor da secao: a
# biblioteca de produtos carrega preco de custo e markup, e um
# `db.query(Product).all()` novo ali passava por todos os portoes.
#
# Calculado do metadata, nao digitado a mao: uma tabela nova ganha ou nao
# account_id no proprio all_models.py (Tarefa 4), e este conjunto acompanha
# sozinho — sem ninguem lembrar de atualizar uma lista aqui.
MODELS_COM_ACCOUNT_ID = {
    nome
    for nome, cls in vars(app.models.all_models).items()
    if isinstance(cls, type)
    and hasattr(cls, "__tablename__")
    and "account_id" in cls.__table__.columns
}

# O portal publico. Quem chama nao tem conta, entao nao ha repositorio — a
# docstring do proprio arquivo explica, e isso e permanente.
FORA_DO_LINT = ("app/api/endpoints/public.py",)


def _sob_o_lint(relativo: str) -> bool:
    """
    Onde a pergunta "e query direta sobre model com account_id?" faz sentido:
    a camada de endpoint (app/api/) — e financial_service.py, que a antiga
    JA_CONVERTIDOS tambem cobria, por orquestrar leitura de FinancialEntry
    por conta a mando de dashboard.py e financial.py. Fora daqui ha escapes
    de natureza diferente (app/services/budget_calculator.py recebe uma
    Query JA filtrada por quem chamou; app/core/security.py resolve
    identidade a partir do token, antes de existir conta para filtrar;
    app/db/repository.py e a propria definicao do ScopedRepository) — nenhum
    deles e "endpoint decidindo escopo sozinho", que e o defeito que este
    lint mira, e alarga-lo para la sem revisar cada caso e o tipo de mudanca
    de escopo que esta secao evita fazer de passagem.
    """
    if relativo in FORA_DO_LINT:
        return False
    return relativo.startswith("app/api/") or relativo == "app/services/financial_service.py"


# Uma linha de db.query()/db.get() sobre model com account_id pode ser
# excecao DELIBERADA de pre-sessao: o codigo roda ANTES de existir
# RequestContext (cadastro via Supabase em auth.py, formulario publico de
# leads em leads.py), entao nao ha account_id nenhum para filtrar — filtrar
# seria logicamente impossivel, nao so indesejado. Cada uma dessas 3 linhas
# ja tem paragrafo de comentario explicando o motivo; a marca abaixo e so o
# que o lint consegue ler sem entender portugues.
MARCA_DE_PRE_SESSAO = "pre-sessao: sem account_id"

# So esta raiz e confiavelmente segura: `repo` (ScopedRepository) ja filtra
# por conta sozinho quando quem chama `.query()`/`.get()` NELE DIRETO —
# `repo.query(X)`, `repo.get(X, id)`. Alista SO ela, em vez de desconfiar so
# de "db" por nome: uma revisao mediu que a versao anterior (checava se a
# raiz batia literalmente com "db" ou tinha `.attr == "db"`) deixaria passar
# `session.query(EnvironmentDNA)` — a forma que
# app/services/budget_calculator.py:159 usa hoje, fora do escopo deste
# lint, mas prova que a forma existe no repositorio, nao so na teoria — ou
# uma futura renomeacao de `db` para outro nome de variavel. Com a raiz como
# ALLOWLIST (so "repo" passa), qualquer outra coisa que chame `.query()`/
# `.get()` sobre um model com account_id cai aqui, seja `db`, `session`,
# `self.db` ou o que vier.
RAIZ_SEGURA = "repo"


def _nome_base(no: ast.AST) -> str | None:
    """
    Resolve uma expressao Name/Attribute ate o identificador mais a
    esquerda — 'Modelo' tanto em `Modelo` quanto em `Modelo.coluna`. Usada
    duas vezes: para reconhecer o MODEL alvo de `db.query(Modelo.coluna)`
    (um `ast.Attribute`, que `alvo.id` sozinho — a versao anterior — nao
    resolvia; app/services/entitlements.py:57 tem essa forma hoje, fora do
    escopo do lint, mas de novo prova que ela ocorre aqui) e para
    reconstruir o CAMINHO da raiz da chamada (`repo` vs `repo.db` vs `db`)
    em `_caminho_da_chamada` abaixo.
    """
    if isinstance(no, ast.Name):
        return no.id
    if isinstance(no, ast.Attribute):
        return _nome_base(no.value)
    return None


def _caminho_da_chamada(no: ast.AST) -> str:
    """
    Reconstroi o caminho pontilhado ate a raiz de quem chamou `.query()`/
    `.get()` — "repo" para `repo.query(X)`, "repo.db" para
    `repo.db.query(X)` (a escotilha usada por conta propria), "db" para
    `db.query(X)`. Precisa ser o caminho INTEIRO, nao so o nome mais a
    esquerda: `_nome_base` sozinho devolveria "repo" tanto para
    `repo.query(X)` quanto para `repo.db.query(X)`, apagando exatamente a
    distincao que importa — `repo.query` e o ScopedRepository de verdade,
    `repo.db.query` e a Session crua por baixo dele.
    """
    if isinstance(no, ast.Name):
        return no.id
    if isinstance(no, ast.Attribute):
        return f"{_caminho_da_chamada(no.value)}.{no.attr}"
    return "?"


def test_query_direta_so_em_model_sem_account_id():
    achados = []
    for arquivo in _arquivos_python():
        relativo = arquivo.relative_to(RAIZ).as_posix()
        if not _sob_o_lint(relativo):
            continue
        linhas = arquivo.read_text(encoding="utf-8").splitlines()
        arvore = ast.parse("\n".join(linhas), filename=relativo)
        for no in ast.walk(arvore):
            if not isinstance(no, ast.Call):
                continue
            f = no.func
            if not isinstance(f, ast.Attribute) or f.attr not in ("query", "get"):
                continue
            if _caminho_da_chamada(f.value) == RAIZ_SEGURA:
                continue
            if not no.args:
                continue
            nome = _nome_base(no.args[0])
            if nome not in MODELS_COM_ACCOUNT_ID:
                continue
            linha_fonte = linhas[no.lineno - 1]
            if MARCA_DE_PRE_SESSAO in linha_fonte:
                continue
            achados.append(f"{relativo}:{no.lineno}: {nome}")
    assert not achados, (
        "query direta sobre model com account_id — use repo.query()/"
        "repo.obter() (ou, se for excecao de pre-sessao de verdade, "
        f'documente o motivo e marque a linha com "{MARCA_DE_PRE_SESSAO}"):\n'
        + "\n".join(achados)
    )


def test_marca_de_pre_sessao_nao_cresce_sem_querer():
    """
    MARCA_DE_PRE_SESSAO e uma string comum — qualquer comentario que a
    contenha silencia o lint acima. Isso e aceitavel (e greppable e visivel
    em diff, como o proprio Passo 2a documenta), mas nao deveria ser FACIL:
    travar a contagem de hoje faz uma quarta ocorrencia exigir que quem a
    escreveu tambem mexa nesta linha — deliberado, nao so digitado.
    """
    # sorted() nos DOIS lados: `_arquivos_python()` usa os.walk, cuja ordem de
    # diretorios vem do sistema de arquivos. Medido em 06/09/2026: no Windows
    # (NTFS) sai auth.py antes de leads.py; no runner do CI (Linux, ext4) sai
    # leads.py primeiro. A primeira versao deste teste comparava a lista na
    # ordem em que veio e passava aqui e reprovava la, com os MESMOS tres
    # itens — o que se afirma e QUAIS marcas existem, nunca em que ordem o
    # os.walk as encontrou.
    ocorrencias = sorted(
        f"{arquivo.relative_to(RAIZ).as_posix()}:{numero}"
        for arquivo in _arquivos_python()
        if _sob_o_lint(arquivo.relative_to(RAIZ).as_posix())
        for numero, linha in enumerate(
            arquivo.read_text(encoding="utf-8").splitlines(), start=1
        )
        if MARCA_DE_PRE_SESSAO in linha
    )
    assert ocorrencias == sorted(
        [
            "app/api/auth.py:71",
            "app/api/auth.py:87",
            "app/api/leads.py:14",
        ]
    ), (
        f'esperava exatamente as 3 marcas conhecidas de "{MARCA_DE_PRE_SESSAO}"; '
        f"achei {ocorrencias}. Se uma nova excecao de pre-sessao e legitima, "
        "atualize esta lista tambem — a marca nao pode crescer sozinha."
    )


def test_a_marca_e_arq_smart():
    """
    Art. 8: a marca e "Arq Smart" — duas palavras, com Q. A outra grafia e a
    do nome do diretorio, e ja chegou a sair em assunto de e-mail.
    """
    achados = []
    for grafia in ("Arch Smart", "ArchSmart", "Ark Smart", "Ecowe"):
        achados += [
            a
            for a in _ocorrencias(grafia)
            if a.replace("\\", "/").startswith("app/")
        ]
    assert not achados, "grafia errada da marca:\n" + "\n".join(achados)
