"""
Verifica links relativos em arquivos Markdown.

Resolve cada link contra o diretorio do arquivo que o contem — nao contra a
raiz do repositorio. Resolver contra a raiz produz falso positivo em todo
link relativo escrito de dentro de uma subpasta.

Ignora links dentro de blocos de codigo cercados (``` ou ~~~, com ou sem
linguagem declarada). Sem isso, um documento que reproduz markdown de
exemplo (mostrando o que outro arquivo deve conter) vira um falso positivo
permanente — e verificador que grita errado e verificador que alguem acaba
desligando.

Uso: python tools/checa_links.py [caminho ...]      (padrao: todos os .md rastreados)
Sai 1 se houver link quebrado.
"""
import re
import subprocess
import sys
from pathlib import Path

PADRAO = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
CERCA_RE = re.compile(r"^\s*(`{3,}|~{3,})")


def arquivos_md(args):
    if args:
        return [Path(a) for a in args]
    saida = subprocess.run(
        ["git", "ls-files", "*.md"], capture_output=True, text=True, check=True
    ).stdout
    return [Path(l) for l in saida.splitlines() if l]


def remove_blocos_cercados(texto):
    """Apaga o conteudo (inclusive as proprias linhas de cerca) de blocos de
    codigo cercados, preservando as demais linhas intactas.

    Segue a regra do CommonMark para fechar uma cerca: precisa do mesmo
    caractere (` ou ~) da abertura, em quantidade igual ou maior — por isso
    uma cerca de 3 backticks dentro de um bloco aberto com 4 nao fecha nada,
    e cercas aninhadas de tamanhos diferentes sao tratadas corretamente.
    O que este parser simples NAO cobre: cerca indentada como parte de uma
    lista com o marcador de item cercando o bloco em vez de o texto puro
    (caso raro, nao observado neste repositorio); nesse caso o bloco pode nao
    ser reconhecido e um link dentro dele voltaria a ser avaliado.
    """
    linhas = texto.split("\n")
    resultado = []
    cerca_atual = None  # (caractere, tamanho) da cerca que abriu o bloco
    for linha in linhas:
        m = CERCA_RE.match(linha)
        if cerca_atual is None:
            if m:
                token = m.group(1)
                cerca_atual = (token[0], len(token))
                resultado.append("")
            else:
                resultado.append(linha)
            continue
        if m:
            token = m.group(1)
            fecha = token[0] == cerca_atual[0] and len(token) >= cerca_atual[1]
            if fecha:
                cerca_atual = None
        resultado.append("")
    return "\n".join(resultado)


def quebrados_no_texto(texto, diretorio):
    achados = []
    for alvo in PADRAO.findall(texto):
        alvo = alvo.split()[0]
        if alvo.startswith(("http://", "https://", "mailto:", "#")):
            continue
        alvo = alvo.split("#")[0]
        if not alvo:
            continue
        if not (diretorio / alvo).exists():
            achados.append(alvo)
    return achados


def quebrados(caminho):
    texto = remove_blocos_cercados(caminho.read_text(encoding="utf-8"))
    return quebrados_no_texto(texto, caminho.parent)


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
