"""
Mede o contraste WCAG 2.1 de cada par (cor, cor-foreground) do tema.

Le os tokens HSL de ArchSmart-web/src/app/globals.css nos dois temas e devolve
os pares abaixo de 4.5:1. O tema escuro herda de :root o que `.dark` nao
sobrescreve -- ler `.dark` isolado mediria um tema que nao existe.

Quatro pares reprovavam quando esta ferramenta nasceu, em 09/09/2026: secondary
nos dois temas (3,93:1 -- e o coral da marca), destructive (3,59:1) e muted
(4,34:1) no claro. Por isso a medida entra como catraca, e nao como portao
fechado: portao que nasce vermelho e desligado na primeira semana (ADR 0006).
Tres desde 15/09/2026, quando destructive mudou (spec de Projetos).
"""
import colorsys
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GLOBALS_CSS = RAIZ / "ArchSmart-web" / "src" / "app" / "globals.css"
PISO = 4.5

RE_TOKEN = re.compile(r"--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%")


class TemaIlegivel(Exception):
    """globals.css nao tem o bloco esperado — falhar alto e melhor que medir zero pares."""


def _corpo(css: str, seletor: str) -> str:
    """Corpo do bloco `seletor`, casando chaves de verdade."""
    i = css.find(seletor)
    if i == -1:
        raise TemaIlegivel(f"{seletor} nao encontrado em {GLOBALS_CSS}")
    inicio = css.index("{", i)
    profundidade = 0
    for j in range(inicio, len(css)):
        if css[j] == "{":
            profundidade += 1
        elif css[j] == "}":
            profundidade -= 1
            if profundidade == 0:
                return css[inicio + 1:j]
    raise TemaIlegivel(f"bloco {seletor} nao fecha em {GLOBALS_CSS}")


def _tokens(corpo: str) -> dict:
    return {n: (float(h), float(s), float(l)) for n, h, s, l in RE_TOKEN.findall(corpo)}


def tokens_dos_temas(css: str | None = None) -> tuple[dict, dict]:
    """(tokens do tema claro, tokens do tema escuro). O escuro herda do claro."""
    if css is None:
        css = GLOBALS_CSS.read_text(encoding="utf-8")
    claro = _tokens(_corpo(css, ":root"))
    escuro = dict(claro)
    escuro.update(_tokens(_corpo(css, ".dark")))
    return claro, escuro


def _canal(c: float) -> float:
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminancia(hsl: tuple) -> float:
    h, s, l = hsl
    # colorsys usa a ordem (h, l, s), nao (h, s, l).
    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
    return 0.2126 * _canal(r) + 0.7152 * _canal(g) + 0.0722 * _canal(b)


def contraste(a: tuple, b: tuple) -> float:
    la, lb = luminancia(a), luminancia(b)
    claro, escuro = max(la, lb), min(la, lb)
    return (claro + 0.05) / (escuro + 0.05)


def pares(tokens: dict) -> list:
    """(nome, cor, cor do texto) para cada par que existe no tema."""
    achados = [
        (nome, tokens[nome], tokens[f"{nome}-foreground"])
        for nome in tokens
        if f"{nome}-foreground" in tokens
    ]
    # background/foreground e o par geral da pagina, e nao segue o sufixo.
    if "background" in tokens and "foreground" in tokens:
        achados.append(("background", tokens["background"], tokens["foreground"]))
    return sorted(achados)


def reprovados(css: str | None = None) -> list:
    """Pares abaixo de PISO, no formato `tema:nome`, ordenados."""
    claro, escuro = tokens_dos_temas(css)
    fora = []
    for rotulo, tema in (("claro", claro), ("escuro", escuro)):
        for nome, cor, texto in pares(tema):
            if contraste(cor, texto) < PISO:
                fora.append(f"{rotulo}:{nome}")
    return sorted(fora)


SRC_WEB = RAIZ / "ArchSmart-web" / "src"
RE_CLASSE_DE_TEXTO = re.compile(r"\btext-([a-z]+(?:-[a-z]+)*)")
#  `/\*` só abre comentário de bloco quando o caractere imediatamente antes
#  dele é espaço em branco (inclui `\n`, o que cobre o `/*` que abre uma linha
#  nova) ou `{` — o padrão de comentário do JSX, `{/* ... */}` — ou quando não
#  há caractere nenhum antes (início do arquivo, coberto por `^` com
#  MULTILINE). Sem essa guarda, `accept="image/*"` (real em quatro arquivos:
#  image-upload.tsx, profile/page.tsx, EnvironmentAccordion.tsx,
#  BuilderClient.tsx) pareava o `/*` de "image/*" com o `*/` do próximo
#  comentário de verdade e apagava o código do meio em silêncio — falso
#  NEGATIVO (a régua escondendo uso real), pior que o falso positivo que este
#  módulo corrigiu antes. `(?<=[\s{])` é lookbehind de largura fixa (1
#  caractere); `^` cobre a posição sem caractere antes. Os dois são
#  alternativas dentro do mesmo grupo, não um lookbehind de largura variável.
RE_BLOCO_COMENTARIO = re.compile(r"(?:^|(?<=[\s{]))/\*.*?\*/", re.DOTALL | re.MULTILINE)


def _sem_comentarios(texto: str) -> str:
    """Descarta comentário de bloco inteiro e linha que É um comentário de linha.

    Não resolve JS de verdade -- só o suficiente para uma MENÇÃO em prosa
    (`// text-warning da 1,99:1`) não contar como uso real. Duas regras,
    deliberadamente conservadoras:

    - `/* ... */` some inteiro, mesmo cruzando linhas (comentário de bloco do
      JS/TS não aninha, então o não-guloso `.*?` para no primeiro `*/`) —
      MAS só quando o `/*` é precedido por espaço em branco, por `{`, ou por
      nada (início do arquivo/linha). Ver o comentário de `RE_BLOCO_COMENTARIO`
      acima para o porquê (`accept="image/*"`).
    - uma linha some só quando tudo ANTES do primeiro `//` nela é vazio --
      ou seja, é comentário de linha inteira. Uma URL com `//` no meio de uma
      string (`"https://..."`) nunca satisfaz isso, porque o que vem antes do
      `//` naquela linha não é vazio (é a abertura da string) -- então a linha
      sobrevive inteira, `//` incluso, exatamente o cuidado clássico de "tirar
      comentário com regex" que apagaria o resto da linha por engano.

      **Limitação conhecida, deixada de propósito**: um comentário de linha no
      FIM de uma linha de código (`className="..." /* ok */ // nao use
      text-warning aqui`) continua contando como uso, porque distinguir isso
      exigiria saber se o `//` está dentro de uma string — o mesmo risco que a
      regra acima evita para `//` de URL. Não há ocorrência viva disso no
      repositório hoje (medido); se aparecer, é uma tela nova falando sobre um
      token em vez de usá-lo, caso raro de sobra.
    """
    texto = RE_BLOCO_COMENTARIO.sub("", texto)
    linhas = []
    for linha in texto.splitlines():
        i = linha.find("//")
        if i != -1 and linha[:i].strip() == "":
            continue
        linhas.append(linha)
    return "\n".join(linhas)


def tokens_usados_como_texto(src: Path = SRC_WEB, tokens: dict | None = None) -> set:
    """Nomes de token que aparecem como `text-<token>` em .ts/.tsx de `src`.

    Comentários (bloco e linha inteira) são descartados antes de casar a
    classe -- sem isso, uma nota em prosa citando `text-warning` (para dizer
    que ele REPROVA como texto) contava como se a tela usasse `text-warning`
    de verdade. Ver `_sem_comentarios`.
    """
    if tokens is None:
        tokens, _ = tokens_dos_temas()
    achados = set()
    for arquivo in src.rglob("*"):
        if arquivo.suffix in (".ts", ".tsx"):
            texto = _sem_comentarios(arquivo.read_text(encoding="utf-8"))
            achados.update(RE_CLASSE_DE_TEXTO.findall(texto))
    return achados & set(tokens)


def texto_sobre_fundo_reprovados(css: str | None = None, usados: set | None = None) -> list:
    """
    Tokens usados como texto que ficam abaixo de PISO sobre `--background`.

    Existe porque `reprovados()` so mede pares (cor, cor-foreground): o
    `destructive` usado como TEXTO media 2,00:1 no tema escuro e passava verde
    (item 2 do bloco do Dashboard no CLAUDE.md).

    Fora da medida, de proposito e escrito: `X-foreground` quando `X` e token
    (e par; `pares()` o mede sobre `X` — o que deixa `muted-foreground` sobre
    `background` sem medida), o proprio `background`, texto sobre `card`/
    `popover`/`muted`, e opacidade (`text-destructive/80`).

    O caso real que esta medida pegou (`text-destructive` dentro de um `Card`)
    so fica coberto porque `--card` tem hoje o MESMO valor de `--background`
    nos dois temas — coincidencia de dado, nao desenho da medida. Se algum dia
    `--card` divergir de `--background`, texto sobre card volta a nao ser
    medido por nada aqui.
    """
    claro, escuro = tokens_dos_temas(css)
    if usados is None:
        usados = tokens_usados_como_texto(tokens=claro)
    fora = []
    for rotulo, tema in (("claro", claro), ("escuro", escuro)):
        if "background" not in tema:
            continue
        for nome in sorted(usados):
            if nome == "background" or nome not in tema:
                continue
            if nome.endswith("-foreground") and nome[: -len("-foreground")] in tema:
                continue
            if contraste(tema[nome], tema["background"]) < PISO:
                fora.append(f"{rotulo}:{nome}")
    return sorted(fora)


def main() -> int:
    claro, escuro = tokens_dos_temas()
    for rotulo, tema in (("claro", claro), ("escuro", escuro)):
        print(f"--- tema {rotulo} ---")
        for nome, cor, texto in pares(tema):
            r = contraste(cor, texto)
            print(f"  {'[v]' if r >= PISO else '[X]'} {nome}: {r:.2f}:1")
    fora = reprovados()
    print(f"\n{len(fora)} par(es) abaixo de {PISO}:1: {', '.join(fora) or 'nenhum'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
