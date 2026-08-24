"""
Verifica links relativos em arquivos Markdown.

Resolve cada link contra o diretorio do arquivo que o contem — nao contra a
raiz do repositorio. Resolver contra a raiz produz falso positivo em todo
link relativo escrito de dentro de uma subpasta.

Uso: python tools/checa_links.py [caminho ...]      (padrao: todos os .md rastreados)
Sai 1 se houver link quebrado.
"""
import re
import subprocess
import sys
from pathlib import Path

PADRAO = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def arquivos_md(args):
    if args:
        return [Path(a) for a in args]
    saida = subprocess.run(
        ["git", "ls-files", "*.md"], capture_output=True, text=True, check=True
    ).stdout
    return [Path(l) for l in saida.splitlines() if l]


def quebrados(caminho):
    achados = []
    for alvo in PADRAO.findall(caminho.read_text(encoding="utf-8")):
        alvo = alvo.split()[0]
        if alvo.startswith(("http://", "https://", "mailto:", "#")):
            continue
        alvo = alvo.split("#")[0]
        if not alvo:
            continue
        if not (caminho.parent / alvo).exists():
            achados.append(alvo)
    return achados


def main():
    total = 0
    for md in arquivos_md(sys.argv[1:]):
        if not md.exists():
            continue
        for alvo in quebrados(md):
            print(f"QUEBRADO: {md} -> {alvo}")
            total += 1
    print(f"--- {total} link(s) quebrado(s) ---")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
