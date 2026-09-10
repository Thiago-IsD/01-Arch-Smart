"""
Mede o contraste WCAG 2.1 de cada par (cor, cor-foreground) do tema.

Le os tokens HSL de ArchSmart-web/src/app/globals.css nos dois temas e devolve
os pares abaixo de 4.5:1. O tema escuro herda de :root o que `.dark` nao
sobrescreve -- ler `.dark` isolado mediria um tema que nao existe.

Quatro pares reprovavam quando esta ferramenta nasceu, em 09/09/2026: secondary
nos dois temas (3,93:1 -- e o coral da marca), destructive (3,59:1) e muted
(4,34:1) no claro. Por isso a medida entra como catraca, e nao como portao
fechado: portao que nasce vermelho e desligado na primeira semana (ADR 0006).
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
