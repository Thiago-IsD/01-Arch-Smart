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
    "fetch_fora_de_lib_api": "ocorrencias de `fetch(` em ArchSmart-web/src/**/*.{ts,tsx}, fora de src/lib/api/",
    "supabase_fora_de_lib_api": "ocorrencias de `create{Browser,Server}Client(` fora de src/lib/api/ e src/proxy.ts",
    "contraste_reprovado": "pares (cor, cor-foreground) de globals.css abaixo de 4.5:1, nos dois temas",
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
            if novos:
                ok = False
                linhas.append(f"[X] {chave}: SUBIU — sem doc e fora do baseline: {', '.join(novos)}")
                linhas.append(f"    criterio: {criterio}")
            elif sumidos:
                linhas.append(f"[v] {chave}: baixou — agora documentados: {', '.join(sumidos)}."
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
    pioras = []
    for chave in sorted(set(baseline) - set(medido)):
        # Chave existia e sumiu do lado atual -- sempre piora, nos dois usos.
        pioras.append(f"{chave}: {baseline[chave]!r} -> sumiu (a chave sumiu do catraca.json)")
    for chave, valor in sorted(medido.items()):
        base = baseline.get(chave)
        if isinstance(valor, list):
            novos = sorted(set(valor) - set(base or []))
            if novos:
                pioras.append(f"{chave}: novo(s) sem doc: {', '.join(novos)}")
        elif base is None:
            if not chave_nova_e_piora:
                continue
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

    Passa `chave_nova_e_piora=False` para `medidas_pioradas`: uma chave que
    existe nesta branch e nao existe na base e uma medida nova sendo
    registrada, nao um afrouxamento. Sem isso, todo PR que acrescenta uma
    medida (como as duas que a Tarefa 11 da Secao 5 acrescentou) reprovaria
    aqui com o diagnostico invertido de "o baseline afrouxou".
    """
    atual = json.loads(BASELINE.read_text(encoding="utf-8"))
    try:
        base = json.loads(referencia.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"[X] baseline de referencia nao encontrado: {referencia}")
        return 1

    pioras = medidas_pioradas(
        {c: v for c, v in base.items() if not c.startswith("_")},
        {c: v for c, v in atual.items() if not c.startswith("_")},
        chave_nova_e_piora=False,
    )
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
