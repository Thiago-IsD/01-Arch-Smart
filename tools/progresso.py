#!/usr/bin/env python3
"""
Calculador de progresso da reestruturação Arq Smart.

O numero do PROGRESS.md e calculado a partir das caixas marcadas, nunca
digitado a mao. Sem dependencia externa: so biblioteca padrao.

Uso:
    python tools/progresso.py --check   # sai 1 se PROGRESS.md divergir das caixas
    python tools/progresso.py --write   # recalcula e grava PROGRESS.md
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path

CHECKBOX_RE = re.compile(r"^\s*-\s\[([ xX])\]")
HEADER_RE = re.compile(r"^## (.+)$")

OVERALL_RE = re.compile(
    r"(\*\*Progresso geral: )(\d+)/(\d+) \((\d+)%\)(\*\*\n`)[█░]*(`)"
)
SECTION_RE = re.compile(
    r"(^## (.+)$\n\*\*)(\d+)/(\d+) \((\d+)%\)(\*\* `)[█░]*(`)",
    re.MULTILINE,
)
DATA_RE = re.compile(r"(_Última atualização: )([0-9]{4}-[0-9]{2}-[0-9]{2})(_)")

CAMINHO_PADRAO = Path(__file__).resolve().parent.parent / "PROGRESS.md"


def contar(texto: str) -> dict[str, tuple[int, int]]:
    """Para cada cabeçalho '## ', conta caixas [x] e o total de caixas abaixo dele."""
    resultado: dict[str, tuple[int, int]] = {}
    secao_atual: str | None = None
    for linha in texto.splitlines():
        header_match = HEADER_RE.match(linha)
        if header_match:
            secao_atual = header_match.group(1).strip()
            resultado.setdefault(secao_atual, (0, 0))
            continue
        if secao_atual is None:
            continue
        checkbox_match = CHECKBOX_RE.match(linha)
        if checkbox_match:
            feitos, total = resultado[secao_atual]
            total += 1
            if checkbox_match.group(1) in ("x", "X"):
                feitos += 1
            resultado[secao_atual] = (feitos, total)
    return resultado


def renderizar_barra(feitos: int, total: int, largura: int = 20) -> str:
    """Barra de blocos cheios/vazios. Seção sem tarefas devolve barra vazia."""
    if total == 0:
        return "░" * largura
    preenchido = round(largura * feitos / total)
    preenchido = max(0, min(largura, preenchido))
    return "█" * preenchido + "░" * (largura - preenchido)


def _percentual(feitos: int, total: int) -> int:
    if total == 0:
        return 0
    return round(100 * feitos / total)


def _totais_gerais(contagens: dict[str, tuple[int, int]]) -> tuple[int, int]:
    feitos = sum(f for f, _ in contagens.values())
    total = sum(t for _, t in contagens.values())
    return feitos, total


def escrever(caminho: Path) -> bool:
    """Recalcula os números a partir das caixas e grava de volta no arquivo."""
    texto = caminho.read_text(encoding="utf-8")
    contagens = contar(texto)

    def _sub_secao(m: re.Match) -> str:
        titulo = m.group(2).strip()
        feitos, total = contagens.get(titulo, (0, 0))
        pct = _percentual(feitos, total)
        barra = renderizar_barra(feitos, total)
        return f"{m.group(1)}{feitos}/{total} ({pct}%){m.group(6)}{barra}{m.group(7)}"

    texto = SECTION_RE.sub(_sub_secao, texto)

    feitos_geral, total_geral = _totais_gerais(contagens)
    pct_geral = _percentual(feitos_geral, total_geral)
    barra_geral = renderizar_barra(feitos_geral, total_geral)

    def _sub_geral(m: re.Match) -> str:
        return f"{m.group(1)}{feitos_geral}/{total_geral} ({pct_geral}%){m.group(5)}{barra_geral}{m.group(6)}"

    texto, n = OVERALL_RE.subn(_sub_geral, texto)
    if n == 0:
        print("Aviso: linha 'Progresso geral' não encontrada no formato esperado.", file=sys.stderr)

    texto = DATA_RE.sub(rf"\g<1>{date.today().isoformat()}\g<3>", texto)

    caminho.write_text(texto, encoding="utf-8")
    return True


def conferir(caminho: Path) -> int:
    """Compara os números escritos no arquivo com os calculados a partir das caixas."""
    texto = caminho.read_text(encoding="utf-8")
    contagens = contar(texto)

    divergencias: list[str] = []

    overall_match = OVERALL_RE.search(texto)
    feitos_geral, total_geral = _totais_gerais(contagens)
    pct_geral = _percentual(feitos_geral, total_geral)
    if overall_match:
        escrito_f, escrito_t, escrito_p = (
            int(overall_match.group(2)),
            int(overall_match.group(3)),
            int(overall_match.group(4)),
        )
        if (escrito_f, escrito_t, escrito_p) != (feitos_geral, total_geral, pct_geral):
            divergencias.append(
                f"Geral: escrito {escrito_f}/{escrito_t} ({escrito_p}%), "
                f"calculado {feitos_geral}/{total_geral} ({pct_geral}%)"
            )
    else:
        divergencias.append("Geral: linha 'Progresso geral' não encontrada no formato esperado")

    for m in SECTION_RE.finditer(texto):
        titulo = m.group(2).strip()
        escrito_f, escrito_t, escrito_p = int(m.group(3)), int(m.group(4)), int(m.group(5))
        feitos, total = contagens.get(titulo, (0, 0))
        pct = _percentual(feitos, total)
        if (escrito_f, escrito_t, escrito_p) != (feitos, total, pct):
            divergencias.append(
                f"{titulo}: escrito {escrito_f}/{escrito_t} ({escrito_p}%), "
                f"calculado {feitos}/{total} ({pct}%)"
            )

    if divergencias:
        print("PROGRESS.md diverge das caixas marcadas:")
        for d in divergencias:
            print(f"  - {d}")
        print("Rode: python tools/progresso.py --write")
        return 1

    print("PROGRESS.md está consistente com as caixas marcadas.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true",
        help="Compara os números escritos com os calculados; sai 1 se divergir",
    )
    parser.add_argument(
        "--write", action="store_true",
        help="Recalcula e grava os números em PROGRESS.md",
    )
    parser.add_argument(
        "--arquivo", default=None,
        help="Caminho do PROGRESS.md (default: PROGRESS.md na raiz do repositório)",
    )
    args = parser.parse_args(argv)

    caminho = Path(args.arquivo) if args.arquivo else CAMINHO_PADRAO

    if args.write:
        escrever(caminho)
        print(f"{caminho} recalculado e gravado.")
        return 0
    if args.check:
        return conferir(caminho)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
