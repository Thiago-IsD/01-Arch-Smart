"""
Catraca dos portoes graduais do CI.

Tres medidas que hoje estao vermelhas e nao podem piorar enquanto as secoes
que as consertam nao chegam (ver ADR 0006):

  - eslint_erros     93 hoje; as Secoes 5 e 6 derrubam
  - cores_literais   521 hoje; a Secao 6 zera, quando os tokens existirem
  - modulos_sem_doc  os 4 services de hoje; a Secao 8 documenta

Cada medida imprime o criterio que usou. Sai 1 se alguma piorou.

Uso:
    python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
    python tools/catraca.py --atualizar                    # regrava o baseline com o medido
    python tools/catraca.py --atualizar --aceitar-piora     # regrava mesmo com regressao, com aviso

Sem --eslint-json a medida de lint e pulada, e nao falha: quem tem Node
instalado e o job `frontend` do CI, e e la que ela roda.

--atualizar so grava o baseline se nenhuma medida piorou. Se alguma piorou
(numero subiu, ou modulo novo ficou sem doc) e --aceitar-piora nao foi
passado, ele recusa gravar, explica o que pioraria e sai 1 -- gravar em
silencio transformaria a regressao no novo normal. Com --aceitar-piora ele
grava mesmo assim, mas imprime um aviso destacado com cada medida que subiu.
"""
import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BASELINE = Path(__file__).resolve().parent / "catraca.json"

SRC_WEB = RAIZ / "ArchSmart-web" / "src"
SERVICES_API = RAIZ / "ArchSmart-api" / "app" / "services"
FEATURES_WEB = RAIZ / "ArchSmart-web" / "src" / "features"
DOCS_MODULOS = RAIZ / "docs" / "dev" / "modulos"

_PREFIXOS = ("bg|text|border|ring|from|to|via|fill|stroke|outline|decoration"
             "|shadow|accent|caret|divide|placeholder")
_PALETAS = ("slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green"
            "|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose")
RE_PALETA = re.compile(rf"\b({_PREFIXOS})-({_PALETAS})-[0-9]{{2,3}}\b")
RE_ARBITRARIA = re.compile(r"\b(bg|text|border)-\[#[0-9a-fA-F]{3,8}\]")

CRITERIOS = {
    "eslint_erros": "soma de errorCount no `npx eslint . --format json`",
    "cores_literais": "regex de classe de paleta e de cor arbitraria em ArchSmart-web/src/**/*.{ts,tsx}",
    "modulos_sem_doc": "arquivo em app/services/ ou diretorio em src/features/ sem .md de mesmo nome em docs/dev/modulos/",
}


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
        total += len(RE_PALETA.findall(texto)) + len(RE_ARBITRARIA.findall(texto))
    return total


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
    }
    if eslint_json is not None:
        relatorio = json.loads(eslint_json.read_text(encoding="utf-8"))
        medido["eslint_erros"] = sum(a.get("errorCount", 0) for a in relatorio)
    return medido


def comparar(baseline: dict, medido: dict) -> tuple[bool, list[str]]:
    """(passou, linhas para imprimir). Falha so quando a medida piora."""
    ok = True
    linhas = []
    for chave, valor in sorted(medido.items()):
        base = baseline.get(chave)
        criterio = CRITERIOS.get(chave, "")
        if isinstance(valor, list):
            novos = sorted(set(valor) - set(base or []))
            sumidos = sorted(set(base or []) - set(valor))
            if novos:
                ok = False
                linhas.append(f"[X] {chave}: SUBIU — sem doc e fora do baseline: {', '.join(novos)}")
                linhas.append(f"    criterio: {criterio}")
            elif sumidos:
                linhas.append(f"[v] {chave}: baixou — agora documentados: {', '.join(sumidos)}."
                              " Rode `python tools/catraca.py --atualizar`.")
            else:
                linhas.append(f"[v] {chave}: {len(valor)}, igual ao baseline")
        elif base is None:
            # Fail-closed. Antes isto era "[v] ... (sem baseline; nada a comparar)"
            # com saida 0: apagar a chave do catraca.json desligava a medida, e
            # um --atualizar seguinte gravava o numero novo sem UM aviso sequer.
            # A recusa do --atualizar guarda a ferramenta, nao o arquivo; esta
            # linha guarda o arquivo.
            ok = False
            linhas.append(f"[X] {chave}: SEM BASELINE em tools/catraca.json (medido: {valor})")
            linhas.append("    Uma medida sem baseline esta desligada. Se a chave foi apagada,")
            linhas.append("    restaure-a; se a medida e nova, grave o valor inicial com --atualizar.")
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


def medidas_pioradas(baseline: dict, medido: dict) -> list[str]:
    """Descricoes ('chave: de -> para') de cada medida que piorou de `baseline` para `medido`."""
    pioras = []
    for chave, valor in sorted(medido.items()):
        base = baseline.get(chave)
        if isinstance(valor, list):
            novos = sorted(set(valor) - set(base or []))
            if novos:
                pioras.append(f"{chave}: novo(s) sem doc: {', '.join(novos)}")
        elif base is None:
            # Chave numerica ausente conta como piora. Sem isto, apagar a chave
            # do catraca.json e rodar --atualizar gravava o numero novo em
            # silencio, saida 0 — o cenario que o ADR 0006 nomeia como prova de
            # que a protecao dele falhou.
            pioras.append(f"{chave}: sem baseline -> {valor} (a chave sumiu do catraca.json)")
        elif valor > base:
            pioras.append(f"{chave}: {base} -> {valor}")
    return pioras


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


def _auditar_baseline(referencia: Path) -> int:
    """
    Audita o proprio catraca.json contra o da branch base.

    A recusa do --atualizar guarda a FERRAMENTA; nada guardava o ARQUIVO. Um
    desenvolvedor com o PR travado pela catraca abre tools/catraca.json e sobe o
    numero na mao: a catraca passa a dizer "baixou de 9999 para 521" e sai 0.
    Ele nem precisa saber que --aceitar-piora existe.

    Este modo nao mede nada. Compara baseline com baseline, e e por isso que ele
    pega o que a comparacao com o medido nao pega.
    """
    atual = json.loads(BASELINE.read_text(encoding="utf-8"))
    try:
        base = json.loads(referencia.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"[X] baseline de referencia nao encontrado: {referencia}")
        return 1

    pioras = medidas_pioradas(base, {c: v for c, v in atual.items() if not c.startswith("_")})
    if not pioras:
        print(f"[v] tools/catraca.json nao afrouxou em relacao a {referencia}")
        return 0
    print("[X] o BASELINE afrouxou em relacao a branch base:")
    for piora in pioras:
        print(f"  - {piora}")
    print()
    print("Subir um numero do baseline e afrouxar a catraca. Se e mesmo")
    print("intencional, justifique no PR e use --atualizar --aceitar-piora, que")
    print("deixa o aviso registrado na saida do comando.")
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--eslint-json", type=Path, default=None,
                        help="relatorio JSON do eslint; sem ele a medida de lint e pulada")
    parser.add_argument("--atualizar", action="store_true",
                        help="regrava catraca.json com o valor medido; recusa se alguma medida piorou")
    parser.add_argument("--aceitar-piora", action="store_true",
                        help="usado com --atualizar: grava mesmo que alguma medida tenha piorado,"
                             " imprimindo um aviso; sozinho nao faz nada")
    parser.add_argument("--comparar-baseline-com", type=Path, default=None,
                        help="caminho de um catraca.json de referencia (o da branch base);"
                             " falha se ALGUM numero deste baseline for maior que o de la."
                             " Nao mede nada: audita o proprio arquivo de baseline")
    args = parser.parse_args(argv)

    if args.comparar_baseline_com is not None:
        return _auditar_baseline(args.comparar_baseline_com)

    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    medido = medir(args.eslint_json)

    if args.atualizar:
        grava, avisos = decidir_atualizacao(baseline, medido, args.aceitar_piora)
        if avisos:
            print("\n".join(avisos))
        if not grava:
            return 1
        baseline.update(medido)
        BASELINE.write_text(json.dumps(baseline, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
        print(f"catraca.json atualizado: {json.dumps(medido, ensure_ascii=False)}")
        return 0

    ok, linhas = comparar(baseline, medido)
    print("\n".join(linhas))
    if not ok:
        print("\nA catraca so gira para baixo. Se o numero subiu de proposito,"
              " justifique no PR e atualize o baseline com --atualizar.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
