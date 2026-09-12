"""
Catraca dos portoes graduais do CI.

Medidas que hoje estao vermelhas e nao podem piorar enquanto as secoes
que as consertam nao chegam (ver ADR 0006):

  - eslint_erros     o `errorCount` somado do `npx eslint . --format json`
                     (ver tools/catraca.json para o numero medido hoje); as
                     Secoes 5 e 6 derrubam
  - cores_literais   521 hoje em 39 arquivos; a Secao 6 acrescenta os tokens e
                     converte so o que ela mesma toca (3 em components/ui/); quem
                     zera e a Secao 8, convertendo cada tela na migracao dela --
                     73% das ocorrencias estao em telas que a Secao 8 reescreve
  - modulos_sem_doc  os 4 services de hoje; a Secao 8 documenta

A Secao 5 acrescentou duas medidas, para telas que ainda usam o padrao
manual (`fetch` cru, cliente Supabase direto) fora de `src/lib/api/`:

  - fetch_fora_de_lib_api       nasce no numero medido nesta secao; a
                                 Secao 8 zera, quando as ~30 telas migrarem
  - supabase_fora_de_lib_api    nasceu em 0 nesta secao — depois das Tarefas
                                 3 e 9, nenhuma chamada de `createBrowserClient`/
                                 `createServerClient` sobrou fora de
                                 src/lib/api/ e src/proxy.ts. Ja e catraca no
                                 piso: qualquer reintroducao reprova.
  - contraste_reprovado  4 pares hoje: secondary nos dois temas (e a cor da
                         marca), destructive e muted no tema claro. Token novo
                         que nasca reprovado nao esta no baseline e reprova --
                         e assim que "portao fechado para o que a Secao 6 cria"
                         sai de graca, sem lista de excecao para envelhecer

A Tarefa 7 da Secao 6 acrescentou duas medidas de acessibilidade:

  - tabindex_negativo    5 hoje (`tabIndex={-1}` em ArchSmart-web/src/**/*.tsx);
                         a Secao 8 zera, ao migrar as telas onde vivem
  - hover_sem_focus      8 hoje: linhas com `opacity-0` + `group-hover:` (ou a
                         forma nomeada do Tailwind, `group-hover/nome:`) e sem
                         escape de foco (`focus:`, `focus-within:`, ou as
                         formas nomeadas `group-focus/nome:`,
                         `focus-within/nome:` etc.) em
                         ArchSmart-web/src/**/*.tsx -- conteudo so visivel no
                         hover do mouse fica inacessivel por teclado. A Secao
                         8 zera, ao migrar as telas onde vivem

    Rodada 1 de correcao (10/09/2026): a primeira versao desta medida so
    casava `group-hover:` literal, sem a forma nomeada do Tailwind
    (`group-hover/nome:`, usada em 3 linhas de MainBudgetArea.tsx), e saiu
    registrada em 5. Regua cega: as 3 linhas que escapavam sao o MESMO
    defeito das outras 5, so que invisiveis para sempre, e uma violacao nova
    escrita com grupo nomeado nao seria pega. Corrigido ampliando
    RE_GROUP_HOVER para aceitar a forma nomeada -- e, por simetria, RE_FOCUS
    tambem, senao a versao nomeada do CONSERTO (`group-focus/nome:` etc.)
    viraria falso positivo, o mesmo problema que `toast.tsx:80` ja tinha
    ensinado (ver `RE_FOCUS` abaixo). Medido de novo com a regua ampliada:
    8 -- bate o numero do brief original, mas foi medido, nao suposto (nenhuma
    forma nomeada de foco existe hoje no codigo; `grep -rnE
    "(group|peer)-focus(-within)?/[A-Za-z0-9_-]+:" ArchSmart-web/src
    --include=*.tsx` sai vazio). O baseline subiu de 5 para 8 porque a regua
    passou a enxergar mais, nao porque o codigo piorou -- ver task-7-report.md.

A Tarefa 9 da Secao 6 acrescentou uma medida de tamanho de arquivo:

  - arquivos_acima_de_400   os arquivos .ts/.tsx de ArchSmart-web/src acima de
                            400 linhas. Lista, e nao contagem, para a catraca
                            dizer QUAL arquivo cresceu -- e para os que estao
                            fora do escopo da Secao 6 (BuilderClient,
                            PortalBudget e os seis abaixo deles) ficarem
                            registrados por nome em vez de virarem uma
                            enumeracao em prosa, que envelhece. Nasce com 12; a
                            Tarefa 9 quebra os quatro maiores e desce para 8.

Cada medida imprime o criterio que usou. Sai 1 se alguma piorou.

Uso:
    python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
    python tools/catraca.py --atualizar                    # regrava o baseline com o medido
    python tools/catraca.py --atualizar --aceitar-piora     # regrava mesmo com regressao, com aviso

Sem --eslint-json a medida de lint e pulada, e nao falha: quem tem Node
instalado e o job `frontend` do CI, e e la que ela roda. A saida imprime uma
linha `[-] eslint_erros: PULADA` com o motivo -- pular em silencio fazia oito
linhas verdes parecerem um relatorio completo.

Qualquer OUTRA medida do baseline que nao apareca no medido REPROVA
(`SUMIU DA MEDICAO`): uma medida que some do `medir()` esta desligada, e
desligar em silencio e o que uma catraca existe para impedir.

--atualizar so grava o baseline se nenhuma medida piorou. Se alguma piorou
(numero subiu, ou modulo novo ficou sem doc) e --aceitar-piora nao foi
passado, ele recusa gravar, explica o que pioraria e sai 1 -- gravar em
silencio transformaria a regressao no novo normal. Com --aceitar-piora ele
grava mesmo assim, mas imprime um aviso destacado com cada medida que subiu.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import contraste

RAIZ = Path(__file__).resolve().parent.parent
BASELINE = Path(__file__).resolve().parent / "catraca.json"

SRC_WEB = RAIZ / "ArchSmart-web" / "src"
SERVICES_API = RAIZ / "ArchSmart-api" / "app" / "services"
FEATURES_WEB = RAIZ / "ArchSmart-web" / "src" / "features"
DOCS_MODULOS = RAIZ / "docs" / "dev" / "modulos"

LIB_API_WEB = RAIZ / "ArchSmart-web" / "src" / "lib" / "api"
PROXY_WEB = RAIZ / "ArchSmart-web" / "src" / "proxy.ts"

# `\bfetch\s*\(` nao casa "prefetch(": entre "pre" e "fetch" nao ha fronteira
# de palavra. Casa `fetch(` e `client.fetch(`, que e o que queremos contar.
RE_FETCH = re.compile(r"\bfetch\s*\(")
RE_SUPABASE = re.compile(r"\bcreate(Browser|Server)Client\s*\(")

RE_TABINDEX_NEGATIVO = re.compile(r"tabIndex=\{\s*-\s*1\s*\}")
RE_OPACITY_ZERO = re.compile(r"\bopacity-0\b")
# `invisible group-hover:visible` e `hidden group-hover:block` sao o MESMO
# defeito que `opacity-0 group-hover:opacity-100`: o elemento so existe para
# quem tem mouse. A regua via um e nao via os outros dois.
#
# O `(?<!-)` na frente nao e bonus: sem ele, `\bhidden\b` casa "hidden" DENTRO
# de `aria-hidden="true"`, porque "-" nao e caractere de palavra e por isso
# satisfaz \b sozinho. Na pratica isso inflava o numero -- `app/page.tsx:261`
# tem `aria-hidden="true"` na mesma linha de um `group-hover:` de animacao sem
# nada a ver com visibilidade, e a regua contava como defeito. Medido ao
# rodar esta medida pela primeira vez: o numero saiu 10, nao os 9 esperados,
# e a diferenca era exatamente esse falso positivo (ver commit desta medida).
RE_INVISIVEL = re.compile(r"(?<!-)\b(invisible|hidden)\b")
# Casa `group-hover:` E a forma nomeada do Tailwind, `group-hover/<nome>:`
# (letras, digitos, `_` ou `-` no nome) -- usada em tres linhas de
# MainBudgetArea.tsx (`group-hover/opt:`, `group-hover/prod:`,
# `group-hover/edit:`). E o MESMO defeito nos dois formatos: opacity-0 que so
# revela no hover do grupo, sem equivalente de foco. A primeira versao desta
# regua so casava a forma anonima e saia em 5, nao 8 -- regua cega, que
# deixava as tres linhas nomeadas invisiveis para sempre. Corrigido na
# Rodada 1 de revisao da Tarefa 7; ver nota no docstring do modulo.
RE_GROUP_HOVER = re.compile(r"\bgroup-hover(/[A-Za-z0-9_-]+)?:")
# `focus-within:` revela quando o foco cai num filho; `focus:` revela quando o
# proprio elemento recebe foco. Os dois resolvem o defeito -- aceitar so o
# primeiro punia toast.tsx:80, que ja e acessivel por teclado, e um baseline com
# falso positivo dentro e um baseline que ninguem consegue zerar.
#
# Tambem aceita a forma nomeada de qualquer um dos dois -- `group-focus/nome:`,
# `focus-within/nome:`, `peer-focus/nome:` etc. -- pelo mesmo motivo que
# RE_GROUP_HOVER aceita `group-hover/nome:`: por simetria. Sem isso, o
# CONSERTO de uma linha usando grupo nomeado (`group-hover/opt:opacity-100
# group-focus/opt:opacity-100`) continuaria contando como defeito -- um falso
# positivo dentro do baseline, o mesmo problema que a definicao ingenua tinha
# com `toast.tsx:80` antes desta medida existir. Nenhuma forma nomeada de foco
# ocorre no codigo hoje (`grep -rnE "(group|peer)-focus(-within)?/[A-Za-z0-9_-]+:"
# ArchSmart-web/src --include=*.tsx` sai vazio) -- a regua so previne o
# problema antes de existir, nao esta consertando nada agora.
RE_FOCUS = re.compile(r"\bfocus(-within)?(/[A-Za-z0-9_-]+)?:")

# `ring-offset` vem ANTES de `ring` na alternancia: com `ring` primeiro, a
# alternancia casa so `ring` em `ring-offset-slate-900`, exige `-<paleta>` logo
# depois, encontra `-offset` e desiste -- o furo continua aberto com a regra
# "corrigida". Ver test_conta_ring_offset_de_paleta.
_PREFIXOS = (
    "ring-offset|ring|bg|text|border|from|to|via|fill|stroke|outline|"
    "decoration|shadow|accent|caret|divide|placeholder"
)
_PALETAS = ("slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green"
            "|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose")
RE_PALETA = re.compile(rf"\b({_PREFIXOS})-({_PALETAS})-[0-9]{{2,3}}\b")
# `white` e `black` nao tem sufixo numerico e por isso nunca casaram com
# RE_PALETA. Sao cor literal igual: `bg-white` no lugar de `bg-background` e a
# forma mais comum de violar o Art. 7 sem a regua notar.
RE_BRANCO_PRETO = re.compile(rf"\b({_PREFIXOS})-(white|black)\b")
# Qualquer prefixo, nao so bg|text|border: `shadow-[#F88379]` e cor literal.
RE_ARBITRARIA = re.compile(r"\b[a-z]+(-[a-z]+)*-\[#[0-9a-fA-F]{3,8}\]")

LIMITE_DE_LINHAS = 400

CRITERIOS = {
    "eslint_erros": "soma de errorCount no `npx eslint . --format json`",
    "cores_literais": "regex de classe de paleta e de cor arbitraria em ArchSmart-web/src/**/*.{ts,tsx}",
    "modulos_sem_doc": "arquivo em app/services/ ou diretorio em src/features/ sem .md de mesmo nome em docs/dev/modulos/",
    "fetch_fora_de_lib_api": "ocorrencias de `fetch(` em ArchSmart-web/src/**/*.{ts,tsx}, fora de src/lib/api/",
    "supabase_fora_de_lib_api": "ocorrencias de `create{Browser,Server}Client(` fora de src/lib/api/ e src/proxy.ts",
    "contraste_reprovado": "pares (cor, cor-foreground) de globals.css abaixo de 4.5:1, nos dois temas",
    "tabindex_negativo": "ocorrencias de tabIndex={-1} em ArchSmart-web/src/**/*.tsx",
    "hover_sem_focus": "linhas com opacity-0 + group-hover: (ou group-hover/nome:) e sem escape de foco (focus:, focus-within:, ou as formas nomeadas) em ArchSmart-web/src/**/*.tsx",
    "arquivos_acima_de_400": f"arquivos .ts/.tsx de ArchSmart-web/src com mais de {LIMITE_DE_LINHAS} linhas",
}

# Como nomear o que entrou e o que saiu, por medida em lista. O default
# ("entrou no baseline"/"saiu do baseline") serve qualquer medida nova; as duas
# entradas abaixo existem so para a frase dizer o que a medida quer dizer.
ROTULOS_DE_LISTA = {
    "modulos_sem_doc": ("sem doc e fora do baseline", "agora documentados"),
    "arquivos_acima_de_400": ("agora acima do limite", "agora abaixo do limite"),
}
ROTULOS_PADRAO = ("entrou no baseline", "saiu do baseline")

# Medida que pode legitimamente NAO ser coletada numa execucao, com o motivo
# que a saida imprime. Nao e lista de excecao da catraca: e o unico jeito de
# distinguir "esta medida nao rodou aqui" de "alguem apagou a chave", que sao
# a mesma coisa vista de dentro de `comparar()`.
MOTIVOS_DE_PULADA = {
    "eslint_erros": "--eslint-json nao foi passado; quem mede o lint e o job `frontend` do CI",
}

# Chave de documentacao (prefixo "_", logo invisivel para medir()/comparar())
# onde mora a justificativa de cada subida aceita de propósito. Existe porque
# `_auditar_baseline` compara baseline com baseline: ela nao tem como saber se
# um numero subiu porque alguem abriu o arquivo e inflou o valor, ou porque a
# REGUA ficou mais rigorosa e passou a enxergar defeito que sempre esteve la --
# e os dois casos sao indistinguiveis olhando so os dois numeros. A saida nao e
# afrouxar a comparacao: e exigir que a justificativa viva DENTRO do arquivo,
# onde a ferramenta le e o revisor audita. Antes disto ela vivia so no corpo do
# PR, que nenhuma ferramenta le.
CHAVE_PIORAS_ACEITAS = "_pioras_aceitas"


def _commit_corrente() -> str | None:
    """O commit curto de HEAD, ou None fora de um repositorio git.

    Nunca estoura: gravar o registro sem o campo `commit` e pior que nao
    gravar registro nenhum, mas e MUITO melhor que derrubar o --atualizar de
    quem roda a ferramenta de um tarball sem .git.
    """
    try:
        saida = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=RAIZ, capture_output=True, text=True, timeout=15,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if saida.returncode != 0:
        return None
    return saida.stdout.strip() or None


class DiretorioMedidoSumiu(Exception):
    """Um diretorio que a catraca mede deixou de existir — nao meca, falhe."""


def contar_cores(raiz: Path) -> int:
    """Conta ocorrencias de classe utilitaria com cor literal sob `raiz`."""
    if not raiz.exists():
        # Devolver 0 aqui faz a catraca anunciar "baixou de 521 para 0" quando o
        # que aconteceu foi o diretorio mudar de nome. Isso tem data marcada: a
        # Secao 9 renomeia ArchSmart-web/ para web/. No dia do rename, o portao
        # ficaria verde e convidaria a gravar 0 no baseline — apagando a medida
        # em silencio, que e exatamente o que uma catraca existe para impedir.
        raise DiretorioMedidoSumiu(
            f"{raiz} nao existe. A catraca mede esse caminho; se ele foi renomeado, "
            "atualize SRC_WEB em tools/catraca.py no mesmo commit do rename."
        )
    total = 0
    for caminho in raiz.rglob("*"):
        if caminho.suffix not in (".ts", ".tsx") or not caminho.is_file():
            continue
        texto = caminho.read_text(encoding="utf-8", errors="ignore")
        total += (
            len(RE_PALETA.findall(texto))
            + len(RE_BRANCO_PRETO.findall(texto))
            + len(RE_ARBITRARIA.findall(texto))
        )
    return total


def contar_ocorrencias(raiz: Path, padrao: re.Pattern, isentos: tuple[Path, ...] = ()) -> int:
    """Ocorrencias de `padrao` em .ts/.tsx sob `raiz`, fora dos caminhos isentos."""
    if not raiz.exists():
        raise DiretorioMedidoSumiu(
            f"{raiz} nao existe. A catraca mede esse caminho; se ele foi renomeado, "
            "atualize SRC_WEB em tools/catraca.py no mesmo commit do rename."
        )
    total = 0
    for caminho in raiz.rglob("*"):
        if caminho.suffix not in (".ts", ".tsx") or not caminho.is_file():
            continue
        if any(caminho == isento or isento in caminho.parents for isento in isentos):
            continue
        total += len(padrao.findall(caminho.read_text(encoding="utf-8", errors="ignore")))
    return total


def contar_hover_sem_focus_no_texto(texto: str) -> int:
    """Linhas que escondem em opacity-0/invisible/hidden e so revelam no hover
    do grupo.

    Conta por LINHA, nao por arquivo: o par (opacity-0 OU invisible/hidden,
    group-hover:) tem que estar na mesma className para ser o defeito. Uma
    linha que ja revele por foco esta consertada e nao conta -- e assim que a
    medida desce quando alguem conserta, em vez de exigir que o arquivo
    inteiro suma.
    """
    total = 0
    for linha in texto.splitlines():
        if ((RE_OPACITY_ZERO.search(linha) or RE_INVISIVEL.search(linha))
                and RE_GROUP_HOVER.search(linha)
                and not RE_FOCUS.search(linha)):
            total += 1
    return total


def contar_hover_sem_focus(raiz: Path) -> int:
    if not raiz.exists():
        raise DiretorioMedidoSumiu(
            f"{raiz} nao existe. A catraca mede esse caminho; se ele foi renomeado, "
            "atualize SRC_WEB em tools/catraca.py no mesmo commit do rename."
        )
    total = 0
    for caminho in raiz.rglob("*"):
        if caminho.suffix != ".tsx" or not caminho.is_file():
            continue
        total += contar_hover_sem_focus_no_texto(
            caminho.read_text(encoding="utf-8", errors="ignore")
        )
    return total


def arquivos_grandes(raiz: Path) -> list[str]:
    """Arquivos .ts/.tsx acima de LIMITE_DE_LINHAS, em caminho relativo a raiz do repo.

    Lista, e nao contagem, para a catraca dizer QUAL arquivo cresceu -- e para
    os que estao fora do escopo da Secao 6 ficarem registrados por nome em vez
    de virarem uma enumeracao em prosa, que envelhece.
    """
    if not raiz.exists():
        raise DiretorioMedidoSumiu(
            f"{raiz} nao existe. A catraca mede esse caminho; se ele foi renomeado, "
            "atualize SRC_WEB em tools/catraca.py no mesmo commit do rename."
        )
    grandes = []
    for caminho in raiz.rglob("*"):
        if caminho.suffix not in (".ts", ".tsx") or not caminho.is_file():
            continue
        linhas = len(caminho.read_text(encoding="utf-8", errors="ignore").splitlines())
        if linhas > LIMITE_DE_LINHAS:
            grandes.append(caminho.relative_to(RAIZ).as_posix())
    return sorted(grandes)


def modulos_sem_doc(services: Path, features: Path | None, docs: Path) -> list[str]:
    """Modulos sem o .md correspondente em docs/dev/modulos/ (Art. 13)."""
    documentados = {p.stem for p in docs.glob("*.md")} if docs.exists() else set()
    nomes = []
    if services is not None:
        if not services.exists():
            raise DiretorioMedidoSumiu(
                f"{services} nao existe. A catraca mede esse caminho; se ele foi "
                "renomeado, atualize SERVICES_API em tools/catraca.py no mesmo "
                "commit do rename."
            )
        nomes += [p.stem for p in services.glob("*.py") if p.stem != "__init__"]
    if features is not None and features.exists():
        nomes += [p.name for p in features.iterdir() if p.is_dir()]
    return sorted(n for n in nomes if n not in documentados)


def medir(eslint_json: Path | None) -> dict:
    medido = {
        "cores_literais": contar_cores(SRC_WEB),
        "modulos_sem_doc": modulos_sem_doc(SERVICES_API, FEATURES_WEB, DOCS_MODULOS),
        "fetch_fora_de_lib_api": contar_ocorrencias(SRC_WEB, RE_FETCH, (LIB_API_WEB,)),
        "supabase_fora_de_lib_api": contar_ocorrencias(SRC_WEB, RE_SUPABASE, (LIB_API_WEB, PROXY_WEB)),
        "contraste_reprovado": contraste.reprovados(),
        "tabindex_negativo": contar_ocorrencias(SRC_WEB, RE_TABINDEX_NEGATIVO),
        "hover_sem_focus": contar_hover_sem_focus(SRC_WEB),
        "arquivos_acima_de_400": arquivos_grandes(SRC_WEB),
    }
    if eslint_json is not None:
        relatorio = json.loads(eslint_json.read_text(encoding="utf-8"))
        medido["eslint_erros"] = sum(a.get("errorCount", 0) for a in relatorio)
    return medido


def comparar(baseline: dict, medido: dict,
             puladas: tuple[str, ...] = ()) -> tuple[bool, list[str]]:
    """(passou, linhas para imprimir). Falha so quando a medida piora.

    `puladas` nomeia as medidas que esta execucao deliberadamente nao coletou
    (hoje so `eslint_erros`, sem `--eslint-json`). Elas nao reprovam -- mas
    tambem nao somem: a saida diz que foram puladas, e por que.
    """
    ok = True
    linhas = []
    # Uma chave que existe no baseline e some do medido NAO era visitada por
    # este laco, porque ele percorre `medido`. Resultado: nenhuma linha
    # impressa e `ok` continuando True -- o portao saindo verde e MUDO, que e
    # pior que o portao saindo errado. `medidas_pioradas()` ja tratava esta
    # direcao, mas so e alcancada por `--atualizar`; o comando que o CI roda
    # como portao nunca passa por la. Terceira cegueira encontrada nesta mesma
    # funcao, e as tres tem a mesma forma: um caminho que nao imprime nada.
    for chave in sorted(set(baseline) - set(medido)):
        if chave.startswith("_"):
            # `_leia-me` e documentacao do arquivo, nao medida: `medir()` nunca
            # a devolve. Mesmo filtro que --atualizar e _auditar_baseline usam.
            continue
        if chave in puladas:
            motivo = MOTIVOS_DE_PULADA.get(chave, "medida nao coletada nesta execucao")
            linhas.append(f"[-] {chave}: PULADA nesta execucao"
                          f" (baseline: {baseline[chave]!r})")
            linhas.append(f"    motivo: {motivo}")
            continue
        ok = False
        linhas.append(f"[X] {chave}: SUMIU DA MEDICAO (baseline: {baseline[chave]!r})")
        linhas.append("    A medida existe no baseline e nao foi produzida por medir().")
        linhas.append("    Uma medida que some esta desligada — restaure-a em tools/catraca.py.")
    for chave, valor in sorted(medido.items()):
        criterio = CRITERIOS.get(chave, "")
        if chave not in baseline:
            # Fail-closed, para lista e para escalar igualmente. Antes isto era
            # "[v] ... (sem baseline; nada a comparar)" com saida 0: apagar a
            # chave do catraca.json desligava a medida, e um --atualizar
            # seguinte gravava o numero novo sem UM aviso sequer. A recusa do
            # --atualizar guarda a ferramenta, nao o arquivo; esta linha guarda
            # o arquivo.
            #
            # O teste e `chave not in baseline`, nao a falsidade de `valor`
            # nem de `base`: uma medida em lista que meca `[]` hoje e uma
            # chave *ausente* do baseline sao coisas diferentes -- a segunda
            # tem que reprovar mesmo com `valor` vazio, e a primeira (chave
            # presente com lista vazia, como `supabase_fora_de_lib_api`) e
            # legitima e tem que continuar passando. Antes deste conserto, o
            # ramo de lista abaixo comparava `set(valor) - set(base or [])`
            # direto: com os dois lados vazios isso da conjunto vazio, "sem
            # baseline" nunca aparecia, e a chave nova entrava em silencio.
            ok = False
            linhas.append(f"[X] {chave}: SEM BASELINE em tools/catraca.json (medido: {valor})")
            linhas.append("    Uma medida sem baseline esta desligada. Se a chave foi apagada,")
            linhas.append("    restaure-a; se a medida e nova, grave o valor inicial com --atualizar.")
            continue
        base = baseline[chave]
        if isinstance(valor, list):
            novos = sorted(set(valor) - set(base))
            sumidos = sorted(set(base) - set(valor))
            rotulo_subiu, rotulo_baixou = ROTULOS_DE_LISTA.get(chave, ROTULOS_PADRAO)
            if novos:
                ok = False
                linhas.append(f"[X] {chave}: SUBIU — {rotulo_subiu}: {', '.join(novos)}")
                linhas.append(f"    criterio: {criterio}")
            elif sumidos:
                linhas.append(f"[v] {chave}: baixou — {rotulo_baixou}: {', '.join(sumidos)}."
                              " Rode `python tools/catraca.py --atualizar`.")
            else:
                linhas.append(f"[v] {chave}: {len(valor)}, igual ao baseline")
        elif valor > base:
            ok = False
            linhas.append(f"[X] {chave}: SUBIU de {base} para {valor}")
            linhas.append(f"    criterio: {criterio}")
        elif valor < base:
            linhas.append(f"[v] {chave}: baixou de {base} para {valor}."
                          " Rode `python tools/catraca.py --atualizar`.")
        else:
            linhas.append(f"[v] {chave}: {valor}, igual ao baseline")
    return ok, linhas


def medidas_pioradas(baseline: dict, medido: dict, chave_nova_e_piora: bool = True) -> list[str]:
    """Descricoes ('chave: de -> para') de cada medida que piorou de `baseline` para `medido`.

    As duas direcoes de "chave so existe de um lado" nao sao o mesmo caso:

    - chave em `baseline` e ausente de `medido`: a chave sumiu do lado atual.
      Sempre piora, com a mensagem "a chave sumiu do catraca.json" -- pega
      tanto apagar a chave do catraca.json local quanto apagar a chave do
      catraca.json desta branch em relacao ao da branch base.
    - chave em `medido` e ausente de `baseline`: uma medida nova. So conta
      como piora quando `chave_nova_e_piora` e True (o default).
      `decidir_atualizacao` usa o default: contra o proprio tools/catraca.json
      local, uma chave sem baseline fica fail-closed ate `--atualizar` gravar
      de proposito -- por isso a Tarefa 11 precisou de `--aceitar-piora` para
      registrar `fetch_fora_de_lib_api`/`supabase_fora_de_lib_api` pela
      primeira vez. `_auditar_baseline` passa `chave_nova_e_piora=False`:
      ali `baseline` e `medido` sao dois catraca.json (o da branch base e o
      desta branch), e uma chave nova e uma medida apertando do nada para um
      numero real -- nao um afrouxamento. Sem essa distincao, o job
      `Repositorio` reprova todo PR que introduz uma medida nova, com o
      diagnostico invertido de que o baseline afrouxou.
    """
    return [p["descricao"] for p in pioras_detalhadas(baseline, medido, chave_nova_e_piora)]


def pioras_detalhadas(baseline: dict, medido: dict,
                      chave_nova_e_piora: bool = True) -> list[dict]:
    """Cada piora como dict, em vez de so a frase que `medidas_pioradas` imprime.

    Mesma logica e mesma ordem -- `medidas_pioradas` e um mapa sobre esta
    funcao, para nao existirem duas definicoes de "piorou" divergindo com o
    tempo. O que esta forma acrescenta e `chave`/`de`/`para` separados, que e o
    que `_auditar_baseline` precisa para consultar `_pioras_aceitas` e que
    nenhum consumidor conseguiria extrair de volta da frase sem reparsear texto.

    `numerica` e True so quando os dois lados sao numeros e o valor subiu --
    o unico caso que um registro de piora aceita pode cobrir. Medida em lista,
    chave sumida e chave sem baseline ficam `numerica=False` e portanto fora do
    alcance do registro, de proposito: um teto numerico nao diz nada sobre
    "qual arquivo entrou na lista".
    """
    pioras = []
    for chave in sorted(set(baseline) - set(medido)):
        # Chave existia e sumiu do lado atual -- sempre piora, nos dois usos.
        pioras.append({
            "chave": chave, "de": baseline[chave], "para": None, "numerica": False,
            "descricao": f"{chave}: {baseline[chave]!r} -> sumiu (a chave sumiu do catraca.json)",
        })
    for chave, valor in sorted(medido.items()):
        base = baseline.get(chave)
        if isinstance(valor, list):
            novos = sorted(set(valor) - set(base or []))
            if novos:
                rotulo_subiu = ROTULOS_DE_LISTA.get(chave, ROTULOS_PADRAO)[0]
                pioras.append({
                    "chave": chave, "de": base, "para": valor, "numerica": False,
                    "descricao": f"{chave}: {rotulo_subiu}: {', '.join(novos)}",
                })
        elif base is None:
            if not chave_nova_e_piora:
                continue
            # Chave numerica ausente conta como piora. Sem isto, apagar a chave
            # do catraca.json e rodar --atualizar gravava o numero novo em
            # silencio, saida 0 — o cenario que o ADR 0006 nomeia como prova de
            # que a protecao dele falhou.
            pioras.append({
                "chave": chave, "de": None, "para": valor, "numerica": False,
                "descricao": f"{chave}: sem baseline -> {valor} (a chave sumiu do catraca.json)",
            })
        elif valor > base:
            pioras.append({
                "chave": chave, "de": base, "para": valor, "numerica": True,
                "descricao": f"{chave}: {base} -> {valor}",
            })
    return pioras


def registro_cobre_piora(registro: object, de: object, para: object) -> tuple[bool, str]:
    """(aceita, motivo_da_recusa) para um registro de `_pioras_aceitas`.

    Fail-closed nas tres condicoes, e cada uma cobre um caso distinto:

    - **sem registro** -- e exatamente o cenario do docstring de
      `_auditar_baseline`: numero subido na mao, sem justificativa nenhuma.
    - **`de` diferente do valor da base** -- o registro e de OUTRA transicao.
      Quando a branch base receber um baseline novo, o registro para de valer
      sozinho e a guarda volta a morder, que e o comportamento correto: um
      registro nao vira licenca permanente para aquela chave.
    - **valor acima de `ate`** -- a subida aceita tinha teto. Passar dele e
      subida nova, que ninguem justificou ainda.

    O campo e `ate` (teto), nao `para` (valor exato), porque o caminho normal
    depois de uma subida aceita e o numero voltar a DESCER sem deixar de ser
    maior que o da base -- foi o que aconteceu com `cores_literais` na Secao 8:
    aceita ate 588, hoje em 583, e 583 continua acima dos 518 da base porque a
    regua ficou mais rigorosa e enxerga o que sempre esteve la.
    """
    if not isinstance(registro, dict):
        return False, "nao ha registro em _pioras_aceitas para esta medida"
    if "de" not in registro or "ate" not in registro:
        return False, "o registro em _pioras_aceitas nao tem `de` e `ate`"
    if registro["de"] != de:
        return False, (f"o registro em _pioras_aceitas e de outra transicao"
                       f" (registro: de={registro['de']!r}; branch base: {de!r})")
    teto = registro["ate"]
    if not isinstance(teto, (int, float)) or isinstance(teto, bool):
        return False, f"o `ate` do registro em _pioras_aceitas nao e numero: {teto!r}"
    if para > teto:
        return False, f"{para} passa do teto aceito no registro (ate={teto})"
    return True, ""


def decidir_atualizacao(baseline: dict, medido: dict, aceitar_piora: bool) -> tuple[bool, list[str]]:
    """(deve_gravar, avisos).

    Sem regressao: (True, []) -- grava normal, sem aviso.
    Com regressao e sem --aceitar-piora: (False, [...]) -- recusa gravar, explica o motivo.
    Com regressao e com --aceitar-piora: (True, [...]) -- grava, mas avisa cada medida que piorou.
    """
    pioras = medidas_pioradas(baseline, medido)
    if not pioras:
        return True, []
    if not aceitar_piora:
        linhas = ["A catraca recusou --atualizar: isso pioraria o baseline:"]
        linhas += [f"  - {p}" for p in pioras]
        linhas.append("Gravar isso transformaria a regressao no novo normal, em silencio.")
        linhas.append("Se e mesmo intencional, justifique no PR e rode de novo com --aceitar-piora.")
        return False, linhas
    linhas = ["AVISO: --aceitar-piora foi passado, o baseline vai piorar:"]
    linhas += [f"  - {p}" for p in pioras]
    return True, linhas


def registrar_pioras_aceitas(baseline: dict, medido: dict) -> list[str]:
    """Grava em `baseline[_pioras_aceitas]` cada subida numerica de `medido`. Devolve as linhas a imprimir.

    Muta `baseline` no lugar -- quem chama grava o arquivo logo depois.

    `motivo` nasce em branco **de proposito**: a ferramenta sabe o numero e o
    commit, nao sabe por que o numero subiu. A saida diz, em voz alta, que o
    campo precisa ser preenchido antes do commit, e `_auditar_baseline` repete o
    aviso em cada auditoria enquanto ele estiver vazio -- um registro sem motivo
    ainda e melhor que nenhum (a ferramenta consegue auditar a transicao), mas
    nao serve ao revisor, que e quem essa guarda protege.

    Quando ja existe registro cujo intervalo cobre o valor antigo do baseline
    local, o `de` dele e PRESERVADO e so o teto sobe: duas subidas na mesma
    branch sao uma transicao so, vista da branch base. Se a branch base tiver
    adotado um baseline novo no meio disso, o `de` preservado deixa de bater e a
    auditoria reprova dizendo qual `de` ela esperava -- fail-closed, e o conserto
    e apagar o registro velho e gravar de novo.
    """
    registros = baseline.setdefault(CHAVE_PIORAS_ACEITAS, {})
    if not isinstance(registros, dict):
        registros = {}
        baseline[CHAVE_PIORAS_ACEITAS] = registros
    commit = _commit_corrente()
    linhas = []
    numericas = [p for p in pioras_detalhadas(
        {c: v for c, v in baseline.items() if not c.startswith("_")}, medido,
    ) if p["numerica"]]
    if not numericas:
        return linhas
    linhas.append(f"Registrado em {CHAVE_PIORAS_ACEITAS} (tools/catraca.json):")
    for piora in numericas:
        chave = piora["chave"]
        anterior = registros.get(chave)
        de, motivo = piora["de"], ""
        if isinstance(anterior, dict) and isinstance(anterior.get("ate"), (int, float)):
            if anterior.get("de") is not None and anterior["de"] <= piora["de"] <= anterior["ate"]:
                de = anterior["de"]
                motivo = anterior.get("motivo") or ""
        registro = {"de": de, "ate": piora["para"]}
        if commit is not None:
            registro["commit"] = commit
        registro["motivo"] = motivo
        registros[chave] = registro
        linhas.append(f"  - {chave}: de={de}, ate={piora['para']}"
                      + (f", commit={commit}" if commit else ""))
    if commit is None:
        linhas.append("  ATENCAO: nao foi possivel obter o commit corrente"
                      " (`git rev-parse --short HEAD` falhou);")
        linhas.append("  o registro foi gravado SEM o campo `commit`.")
    faltando = [p["chave"] for p in numericas if not (registros[p["chave"]].get("motivo") or "").strip()]
    if faltando:
        linhas.append("  ATENCAO: o campo `motivo` ficou EM BRANCO em: "
                      + ", ".join(faltando) + ".")
        linhas.append("  Preencha antes de commitar: e o que o revisor le, e a unica")
        linhas.append("  parte do registro que a ferramenta nao consegue descobrir sozinha.")
    return linhas


def _auditar_baseline(referencia: Path) -> int:
    """
    Audita o proprio catraca.json contra o da branch base.

    A recusa do --atualizar guarda a FERRAMENTA; nada guardava o ARQUIVO. Um
    desenvolvedor com o PR travado pela catraca abre tools/catraca.json e sobe o
    numero na mao: a catraca passa a dizer "baixou de 9999 para 521" e sai 0.
    Ele nem precisa saber que --aceitar-piora existe.

    Este modo nao mede nada. Compara baseline com baseline, e e por isso que ele
    pega o que a comparacao com o medido nao pega.

    Passa `chave_nova_e_piora=False` para `medidas_pioradas`: uma chave que
    existe nesta branch e nao existe na base e uma medida nova sendo
    registrada, nao um afrouxamento. Sem isso, todo PR que acrescenta uma
    medida (como as duas que a Tarefa 11 da Secao 5 acrescentou) reprovaria
    aqui com o diagnostico invertido de "o baseline afrouxou".

    Uma subida numerica passa **so** quando `_pioras_aceitas` (no catraca.json
    desta branch) tem registro que a cubra, pelas tres condicoes de
    `registro_cobre_piora`. Esse caminho nao afrouxa a comparacao: o cenario do
    paragrafo acima -- numero subido na mao -- continua reprovando, porque
    registro nenhum o cobre. O que ele muda e onde a justificativa vive: dentro
    do arquivo, auditavel, em vez de so no corpo do PR, que nenhuma ferramenta
    le.

    O caso que motivou: a Tarefa 2 da Secao 8 tapou quatro furos da regua de
    `cores_literais`, e o numero subiu de 518 para 588 medindo defeito que
    sempre existiu. 518 (regua antiga, em `staging`) e 583 (regua nova, hoje)
    nao sao numeros comparaveis, e comparando baseline com baseline nao ha como
    descobrir isso -- so o registro conta.
    """
    atual = json.loads(BASELINE.read_text(encoding="utf-8"))
    try:
        base = json.loads(referencia.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"[X] baseline de referencia nao encontrado: {referencia}")
        return 1

    pioras = pioras_detalhadas(
        {c: v for c, v in base.items() if not c.startswith("_")},
        {c: v for c, v in atual.items() if not c.startswith("_")},
        chave_nova_e_piora=False,
    )
    registros = atual.get(CHAVE_PIORAS_ACEITAS) or {}
    if not isinstance(registros, dict):
        registros = {}

    aceitas, recusadas = [], []
    for piora in pioras:
        if not piora["numerica"]:
            # `_pioras_aceitas` tem `de`/`ate` numericos: um teto nao diz nada
            # sobre "qual arquivo entrou na lista" nem sobre uma chave que
            # sumiu. Estas continuam reprovando como antes desta guarda existir.
            if piora["para"] is None:
                razao = ("a chave nao existe nesta branch — restaure-a;"
                         " so subida numerica pode ser coberta por _pioras_aceitas")
            else:
                razao = ("medida em lista — so subida numerica pode ser"
                         " coberta por _pioras_aceitas")
            recusadas.append((piora, razao))
            continue
        registro = registros.get(piora["chave"])
        cobre, motivo_da_recusa = registro_cobre_piora(registro, piora["de"], piora["para"])
        if cobre:
            aceitas.append((piora, registro))
        else:
            recusadas.append((piora, motivo_da_recusa))

    # Imprime as aceitas ANTES de decidir a saida, e imprime mesmo quando o
    # comando vai reprovar por outra medida. O valor desta guarda nao esta em
    # sair 0: esta em o revisor ler por que aquele numero subiu.
    for piora, registro in aceitas:
        print(f"[v] {piora['chave']}: SUBIU de {piora['de']} para {piora['para']},"
              f" e a subida esta registrada em {CHAVE_PIORAS_ACEITAS}")
        print(f"    aceita ate: {registro['ate']}")
        if registro.get("commit"):
            print(f"    commit: {registro['commit']}")
        motivo = (registro.get("motivo") or "").strip()
        print(f"    motivo: {motivo}" if motivo
              else "    motivo: EM BRANCO — quem gravou o registro precisa preencher")

    if not recusadas:
        print(f"[v] tools/catraca.json nao afrouxou em relacao a {referencia}")
        return 0
    print("[X] o BASELINE afrouxou em relacao a branch base:")
    for piora, motivo_da_recusa in recusadas:
        print(f"  - {piora['descricao']}")
        print(f"    {motivo_da_recusa}")
    print()
    print("Subir um numero do baseline e afrouxar a catraca. Se e mesmo")
    print("intencional, justifique no PR e use --atualizar --aceitar-piora, que")
    print("deixa o aviso registrado na saida do comando e grava a justificativa")
    print(f"em {CHAVE_PIORAS_ACEITAS}, dentro do proprio tools/catraca.json.")
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--eslint-json", type=Path, default=None,
                        help="relatorio JSON do eslint; sem ele a medida de lint e pulada")
    parser.add_argument("--atualizar", action="store_true",
                        help="regrava catraca.json com o valor medido; recusa se alguma medida piorou")
    parser.add_argument("--aceitar-piora", action="store_true",
                        help="usado com --atualizar: grava mesmo que alguma medida tenha piorado,"
                             " imprimindo um aviso e registrando a subida em _pioras_aceitas,"
                             " dentro do proprio catraca.json; sozinho nao faz nada")
    parser.add_argument("--comparar-baseline-com", type=Path, default=None,
                        help="caminho de um catraca.json de referencia (o da branch base);"
                             " falha se ALGUM numero deste baseline for maior que o de la,"
                             " exceto a subida que _pioras_aceitas cobrir."
                             " Nao mede nada: audita o proprio arquivo de baseline")
    args = parser.parse_args(argv)

    if args.comparar_baseline_com is not None:
        return _auditar_baseline(args.comparar_baseline_com)

    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    medido = medir(args.eslint_json)

    if args.atualizar:
        # `_leia-me` (e qualquer outra chave de documentacao com "_") nao e
        # medida — `medir()` nunca a devolve, entao compara-la contra o
        # baseline cru sempre acusa "a chave sumiu" e reprova todo
        # `--atualizar`, mesmo sem regressao nenhuma. Mesmo filtro que
        # `_auditar_baseline` ja aplica dos dois lados.
        grava, avisos = decidir_atualizacao(
            {c: v for c, v in baseline.items() if not c.startswith("_")},
            medido,
            args.aceitar_piora,
        )
        if avisos:
            print("\n".join(avisos))
        if not grava:
            return 1
        if args.aceitar_piora:
            # Grava a justificativa DENTRO do arquivo, nao so no aviso acima.
            # Sem isto, a proxima mudanca de regua obrigava alguem a editar o
            # catraca.json a mao para o job `Repositorio` passar -- que e
            # exatamente o habito que `_auditar_baseline` existe para impedir.
            print("\n".join(registrar_pioras_aceitas(baseline, medido)))
        baseline.update(medido)
        BASELINE.write_text(json.dumps(baseline, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
        print(f"catraca.json atualizado: {json.dumps(medido, ensure_ascii=False)}")
        return 0

    # Sem --eslint-json a medida de lint nao e coletada. Isso e legitimo (quem
    # tem Node e o job `frontend` do CI) e nao pode reprovar -- mas ate agora
    # ela sumia da saida sem UMA linha dizendo isso, e oito linhas verdes
    # pareciam um relatorio completo.
    puladas = () if args.eslint_json is not None else ("eslint_erros",)
    ok, linhas = comparar(baseline, medido, puladas)
    print("\n".join(linhas))
    if not ok:
        print("\nA catraca so gira para baixo. Se o numero subiu de proposito,"
              " justifique no PR e atualize o baseline com --atualizar.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
