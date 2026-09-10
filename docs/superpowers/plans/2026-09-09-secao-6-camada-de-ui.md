# Seção 6 — Camada de UI · Plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixas (`- [ ]`) para acompanhamento.

**Objetivo:** dar à plataforma uma camada de UI com tokens completos,
componentes que carregam a decisão de produto, e ferramentas que impedem a
volta do que foi consertado — sem tocar nas telas que a Seção 8 vai migrar.

**Arquitetura:** três blocos independentes. (a) Um portão pendente da Seção 5
que fecha com um usuário de teste dedicado. (b) Tokens e ferramentas de medição
no repositório (`tools/`, Python, só biblioteca padrão), que passam a medir cor
e acessibilidade como catraca. (c) Componentes e galeria em `ArchSmart-web/src`,
mais duas mudanças estruturais (code splitting e quebra de arquivo) que existem
para tornar a Seção 8 mais barata.

**Stack:** Next.js (App Router) · React · TypeScript · Tailwind · Radix/shadcn ·
React Query · Vitest + Testing Library · Playwright (só instrumento de medição) ·
Python 3.12 stdlib em `tools/`.

**Spec:** [`docs/superpowers/specs/2026-09-09-secao-6-camada-de-ui-design.md`](../specs/2026-09-09-secao-6-camada-de-ui-design.md)
— aprovada por Thiago em 09/09/2026. Leia junto: este plano argumenta a partir
dela, e as decisões de fronteira (o que NÃO entra) estão lá.

## Ordem, e por que ela difere da tabela do desenho

O desenho lista tokens antes do validador de contraste. **O plano inverte:** o
validador entra primeiro. Se os tokens chegarem antes, eles nascem sem guarda e
o baseline é escrito depois do fato — que é exatamente o que uma catraca existe
para impedir. Com o validador de pé, os tokens novos já nascem obrigados.

Também: galeria (Tarefa 6) antes de acessibilidade (Tarefa 7), porque o axe roda
sobre a galeria.

## Restrições globais

Valem para toda tarefa. Texto integral em
[`spec-kit-2/memory/constitution.md`](../../../spec-kit-2/memory/constitution.md)
e nas regras do [`CLAUDE.md`](../../../CLAUDE.md) da raiz.

- **Nenhum `account_id` ou id de usuário/tenant literal no código** (Art. 1).
- **Nenhuma URL, chave ou host fixo no código** (Art. 4). Frontend usa
  `process.env.NEXT_PUBLIC_API_URL`; backend usa `app/core/config.py`; segredo
  vive em `.env`, nunca versionado.
- **Nenhuma cor literal em classe utilitária** (`bg-emerald-600`, `bg-[#F88379]`)
  em código novo (Art. 7). As 521 existentes são da Seção 8 — não converta de
  passagem.
- **A marca é "Arq Smart"** — duas palavras, com Q (Art. 8).
- **Nenhuma regra de negócio ou limite de plano decidido no front** (Art. 3).
- **`tools/` da raiz usa só a biblioteca padrão do Python** e nunca fala com o
  banco da aplicação.
- **Número afirmado sem medição é número errado.** Ao afirmar um número, cole o
  comando que o produziu.
- **Nunca edite `tools/catraca.json` à mão.** O job `Repositorio` compara o
  arquivo do PR com o da base e reprova. Use `python tools/catraca.py
  --atualizar` (ou `--atualizar --aceitar-piora` para registrar medida nova).
- **`--atualizar` exige `--eslint-json`.** Sem ele a medida `eslint_erros` não é
  medida, a catraca lê a chave como *sumida* — que é uma regressão — e **recusa
  gravar**. Verificado em 09/09/2026: `python tools/catraca.py --atualizar`
  sozinho sai 1 com `eslint_erros: 85 -> sumiu`. Todo `--atualizar` deste plano
  é, na prática:

  ```bash
  cd ArchSmart-web && npx eslint . --format json -o eslint.json || true
  cd .. && python tools/catraca.py --eslint-json ArchSmart-web/eslint.json --atualizar
  ```

  (O `|| true` é de propósito: o eslint sai != 0 quando há erro, e quem decide
  se isso reprova é a catraca, não o eslint. É o que o CI faz.)
- **Não migre área não migrada de passagem.** Se uma tarefa te levar a um
  arquivo de tela, faça só o que a tarefa pede.
- Rode os portões do repositório **da raiz**: `python tools/catraca.py`,
  `python tools/progresso.py --check`, `python tools/checa_links.py`.
- Ao terminar uma tarefa, marque a caixa correspondente no `PROGRESS.md` e rode
  `python tools/progresso.py --write` no mesmo commit.

---

## Tarefa 1: Usuário de teste E2E e fechamento do portão da Seção 5

Esta é a única tarefa da seção que age contra ambiente real.

**PARE E PEÇA OK EXPLÍCITO A THIAGO ANTES DO PASSO 3.** Os passos 3 a 6 criam
usuário no Supabase de staging e reescrevem os dados de volume da conta
`"Seed — volume realista"` no banco de staging. Nenhuma outra conta é tocada,
mas isso é destrutivo dentro daquela conta e é ação fora do repositório.

**Arquivos:**
- Criar: `docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md`
- Criar: `ArchSmart-web/e2e/hidratacao-biblioteca.spec.ts`
- Modificar: `docs/dev/medicoes/2026-09-06-biblioteca-baseline.md`
- Modificar: `docs/dev/medicoes/2026-09-06-biblioteca-depois.md`
- Modificar: `ArchSmart-web/.env.example`

**Interfaces:**
- Consome: `ArchSmart-api/tools/seed.py` (existente); a coluna
  `users.supabase_id` (`ArchSmart-api/app/models/all_models.py:72`); o spec
  `ArchSmart-web/e2e/medicao-biblioteca.spec.ts` (existente).
- Produz: um par `E2E_EMAIL`/`E2E_PASSWORD` válido, e dois arquivos de medição
  com número real. **A Seção 8 depende disto** — sem esta tarefa ela não pode se
  apoiar na Seção 5.

**Topologia (medida em 09/09/2026, confira antes de agir):** o Playwright roda
contra `http://localhost:3000` (`ArchSmart-web/playwright.config.ts`), que fala
com a API em `http://localhost:8000` (`NEXT_PUBLIC_API_URL` em
`ArchSmart-web/.env.local`), que fala com o banco de **staging** (bloco ativo de
`ArchSmart-api/.env`), e autentica no Supabase de **staging**
(`NEXT_PUBLIC_SUPABASE_URL`). O usuário precisa existir no Supabase de staging
**e** estar vinculado a uma conta com volume no banco de staging.

- [ ] **Passo 1: Confirmar para qual banco o `.env` da API aponta**

```bash
grep -n "^DATABASE_URL" ArchSmart-api/.env | grep -o "postgres\.[a-z]*"
```

Esperado: `postgres.ipbhtqzybgdltewwnvnl` (staging). Se sair
`postgres.wokgnojyrpzndtxzvfcz`, **PARE**: é produção, e o bloco ativo está
errado. Nunca rode `seed.py` contra produção.

- [ ] **Passo 2: Confirmar que o front aponta para o mesmo Supabase**

```bash
grep -n "NEXT_PUBLIC_SUPABASE_URL" ArchSmart-web/.env.local
```

Esperado: o mesmo ref `ipbhtqzybgdltewwnvnl`. Se os dois não baterem, o login do
Playwright autentica num projeto e a API lê de outro — e a medição não roda.

- [ ] **Passo 3: Pedir o OK de Thiago, e só então semear o volume**

```bash
cd ArchSmart-api
.\venv\Scripts\Activate.ps1
python tools/seed.py --projetos 5 --ambientes 25 --biblioteca 300 --itens 500
```

O script é determinístico (`random.seed(42)`) e idempotente: recria os dados de
volume da conta `"Seed — volume realista"`. Ele cria também três usuários de
aplicação, com `supabase_id` nulo — o primeiro é
`ana.arquiteta@seed.arqsmart.local` (`ArchSmart-api/tools/seed.py`,
`USUARIOS_SEED`).

- [ ] **Passo 4: Criar o usuário de auth no Supabase de staging**

Use a API admin, com `email_confirm: true` para não depender de e-mail entregue
(o domínio `.local` não recebe mensagem). Leia as variáveis do `.env`, **não
cole chave no comando**:

```bash
cd ArchSmart-api
set -a; . ./.env; set +a
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"ana.arquiteta@seed.arqsmart.local","password":"<gere-uma-senha-forte>","email_confirm":true}' \
  | python -c "import json,sys; print(json.load(sys.stdin)['id'])"
```

Guarde o `id` devolvido: é o `supabase_id`.

- [ ] **Passo 5: Vincular o `supabase_id` ao usuário de aplicação**

Vincular explicitamente é importante: o auto-link por e-mail que sobrevive em
`POST /api/auth/complete-register` é uma pendência de segurança conhecida
(pendência 2 da Seção 4), e depender dele aqui seria exercitar o caminho errado.

```bash
cd ArchSmart-api
python - <<'PY'
import os
from sqlalchemy import create_engine, text
url = os.environ["DATABASE_URL"]
assert "ipbhtqzybgdltewwnvnl" in url, f"NAO e staging: {url[:40]}"
sup = os.environ["SUPABASE_ID_E2E"]
with create_engine(url).begin() as c:
    n = c.execute(text(
        "UPDATE users SET supabase_id = :sup "
        "WHERE email = 'ana.arquiteta@seed.arqsmart.local'"
    ), {"sup": sup}).rowcount
print("linhas atualizadas:", n)
PY
```

Esperado: `linhas atualizadas: 1`. Se sair `0`, o `seed.py` não rodou.

- [ ] **Passo 6: Rodar a medição**

```bash
cd ArchSmart-web
E2E_EMAIL=ana.arquiteta@seed.arqsmart.local E2E_PASSWORD=<a senha do passo 4> \
  npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line
```

Esperado: as linhas `AMOSTRAS=...` e `MEDIANA_MS=...` no console. Se falhar no
login, confira que o usuário está confirmado (`email_confirm: true`).

- [ ] **Passo 7: Gravar o número nos dois arquivos de medição**

Em `docs/dev/medicoes/2026-09-06-biblioteca-depois.md`, substitua a seção que
hoje diz que a medição não rodou pelo número real, colando `AMOSTRAS` e
`MEDIANA_MS` e a data. Em `...-baseline.md`, registre que o baseline
**permanece não medido** — o código de antes da Seção 5 não existe mais na
branch — e que portanto a comparação é contra o número de referência da spec
(3,6 s), rotulada como tal. **Não invente um baseline.**

- [ ] **Passo 8: Escrever a verificação viva da hidratação (teste que falha primeiro)**

Crie `ArchSmart-web/e2e/hidratacao-biblioteca.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

/**
 * Prova que o prefetch no servidor da Seção 5 está de fato hidratando: ao abrir
 * /library direto (navegação de servidor, não client-side), o navegador não
 * pode emitir requisição a /api/products no primeiro carregamento.
 *
 * Sem isto, "o prefetch funciona" é inferência estrutural. O modo de falha é
 * silencioso: o prefetch vira custo puro sem emitir erro nenhum.
 */
test("nao busca /api/products no navegador no primeiro carregamento", async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
        throw new Error("E2E_EMAIL e/ou E2E_PASSWORD nao definidos. Ver Tarefa 1 do plano da Secao 6.")
    }

    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    // Aquece a API: cold start do Render nao pode virar falha de hidratacao.
    await page.goto("/library")
    await page.waitForSelector("[data-testid='product-grid'], [data-testid='library-empty']")

    const pedidos: string[] = []
    page.on("request", (r) => {
        if (r.url().includes("/api/products")) pedidos.push(r.url())
    })

    await page.goto("/library")
    await page.waitForSelector("[data-testid='product-grid'], [data-testid='library-empty']")

    expect(pedidos, `o navegador pediu /api/products: ${pedidos.join(", ")}`).toHaveLength(0)
})
```

- [ ] **Passo 9: Rodar e registrar o resultado honestamente**

```bash
cd ArchSmart-web
E2E_EMAIL=... E2E_PASSWORD=... npx playwright test e2e/hidratacao-biblioteca.spec.ts --reporter=line
```

Se **passar**: o prefetch está hidratando; registre no arquivo `-depois.md`.
Se **falhar**: o prefetch da Seção 5 está sendo pago e jogado fora. **Não
conserte aqui** — registre o achado no `PROGRESS.md` como defeito da Seção 5 e
leve a Thiago. Consertar prefetch é camada de dados, não camada de UI.

- [ ] **Passo 10: Documentar onde a credencial vive**

Crie `docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md` explicando: qual
usuário, em qual projeto Supabase, vinculado a qual conta, como recriá-lo do
zero (passos 3 a 5), e que a senha **não é versionada**. Acrescente as duas
variáveis a `ArchSmart-web/.env.example`, com valor vazio e um comentário:

```
# Credenciais do usuario de teste E2E (staging). A senha nao e versionada —
# ver docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md
E2E_EMAIL=
E2E_PASSWORD=
```

- [ ] **Passo 11: Marcar a caixa e commitar**

```bash
python tools/progresso.py --write
python tools/checa_links.py
git add docs/dev/medicoes ArchSmart-web/e2e/hidratacao-biblioteca.spec.ts ArchSmart-web/.env.example PROGRESS.md
git commit -m "test(secao-6): usuario de teste E2E fecha o portao de validacao da Secao 5"
```

---

## Tarefa 2: Validador de contraste

**Arquivos:**
- Criar: `tools/contraste.py`
- Criar: `tools/test_contraste.py`
- Modificar: `tools/catraca.py`
- Modificar: `tools/catraca.json` (via ferramenta, nunca à mão)

**Interfaces:**
- Produz: `contraste.reprovados() -> list[str]`, itens no formato
  `"claro:secondary"` / `"escuro:secondary"`. A Tarefa 3 depende deste formato.
- Produz: `contraste.contraste(a, b) -> float` e
  `contraste.tokens_dos_temas() -> tuple[dict, dict]`.

**Nota sobre o formato da medida.** O desenho falava em uma medida numérica com
baseline 4. O plano usa **lista**, não número: `tools/catraca.py` já sabe
comparar lista (é como `modulos_sem_doc` funciona), e a lista diz *qual* par
regrediu em vez de só dizer que subiu. O portão é o mesmo — par novo reprovado
não está no baseline e reprova.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `tools/test_contraste.py`:

```python
"""Testes do validador de contraste. Só biblioteca padrão, como todo tools/."""
import unittest

import contraste


class TestMatematica(unittest.TestCase):
    def test_preto_no_branco_e_21(self):
        preto = (0.0, 0.0, 0.0)
        branco = (0.0, 0.0, 100.0)
        self.assertAlmostEqual(contraste.contraste(preto, branco), 21.0, places=1)

    def test_cor_contra_ela_mesma_e_1(self):
        cor = (180.0, 100.0, 25.1)
        self.assertAlmostEqual(contraste.contraste(cor, cor), 1.0, places=6)

    def test_e_simetrico(self):
        a, b = (0.0, 0.0, 0.0), (0.0, 0.0, 100.0)
        self.assertAlmostEqual(contraste.contraste(a, b), contraste.contraste(b, a))


class TestLeituraDoTema(unittest.TestCase):
    def test_o_tema_escuro_herda_o_que_nao_sobrescreve(self):
        claro, escuro = contraste.tokens_dos_temas()
        # `.dark` nao redefine --radius; o tema escuro tem que herda-lo de :root.
        self.assertIn("secondary", escuro)
        self.assertEqual(claro["secondary"], escuro["secondary"])

    def test_o_par_fundo_texto_geral_entra(self):
        claro, _ = contraste.tokens_dos_temas()
        nomes = [nome for nome, _, _ in contraste.pares(claro)]
        self.assertIn("background", nomes)


class TestReprovados(unittest.TestCase):
    def test_lista_os_quatro_pares_reprovados_de_hoje(self):
        self.assertEqual(
            contraste.reprovados(),
            ["claro:destructive", "claro:muted", "claro:secondary", "escuro:secondary"],
        )

    def test_par_novo_reprovado_aparece(self):
        css = """
        :root { --zzz: 0 0% 90%; --zzz-foreground: 0 0% 95%; }
        .dark { }
        """
        self.assertIn("claro:zzz", contraste.reprovados(css))

    def test_par_novo_aprovado_nao_aparece(self):
        css = """
        :root { --zzz: 0 0% 10%; --zzz-foreground: 0 0% 100%; }
        .dark { }
        """
        self.assertNotIn("claro:zzz", contraste.reprovados(css))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
cd tools && python -m unittest test_contraste -v
```

Esperado: `ModuleNotFoundError: No module named 'contraste'`.

- [ ] **Passo 3: Escrever `tools/contraste.py`**

```python
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
```

- [ ] **Passo 4: Rodar os testes e ver passar**

```bash
cd tools && python -m unittest test_contraste -v
```

Esperado: `OK`, 8 testes. Se `test_lista_os_quatro_pares_reprovados_de_hoje`
falhar, **não ajuste o teste para casar** — meça e descubra por que o tema mudou.

- [ ] **Passo 5: Ver a tabela com os próprios olhos**

```bash
python tools/contraste.py
```

Esperado, entre outras linhas: `[X] secondary: 3.93:1` nos dois temas.

- [ ] **Passo 6: Ligar a medida na catraca**

Em `tools/catraca.py`: `import contraste` no topo; acrescente a
`CRITERIOS`:

```python
    "contraste_reprovado": "pares (cor, cor-foreground) de globals.css abaixo de 4.5:1, nos dois temas",
```

e a `medir()`:

```python
        "contraste_reprovado": contraste.reprovados(),
```

Acrescente ao docstring do módulo, junto das outras medidas:

```
  - contraste_reprovado  4 pares hoje: secondary nos dois temas (e a cor da
                         marca), destructive e muted no tema claro. Token novo
                         que nasca reprovado nao esta no baseline e reprova --
                         e assim que "portao fechado para o que a Secao 6 cria"
                         sai de graca, sem lista de excecao para envelhecer
```

- [ ] **Passo 7: Ver a catraca reprovar por falta de baseline**

```bash
python tools/catraca.py
```

Esperado: sai **1**, com `[X] contraste_reprovado: SEM BASELINE`. Isso é o
fail-closed funcionando — chave sem baseline é medida desligada.

- [ ] **Passo 8: Registrar o baseline**

```bash
cd ArchSmart-web && npx eslint . --format json -o eslint.json || true
cd .. && python tools/catraca.py --eslint-json ArchSmart-web/eslint.json --atualizar --aceitar-piora
python tools/catraca.py
```

O `--aceitar-piora` é obrigatório porque chave nova é tratada como regressão.
Depois do registro, o segundo comando sai **0**. Confira que
`tools/catraca.json` ganhou os quatro itens.

- [ ] **Passo 9: Rodar a suíte de `tools/` e commitar**

```bash
cd tools && python -m unittest discover -p "test_*.py"
cd .. && python tools/progresso.py --check
git add tools/contraste.py tools/test_contraste.py tools/catraca.py tools/catraca.json
git commit -m "feat(secao-6): validador de contraste entra como catraca em 4 pares"
```

---

## Tarefa 3: Tokens completos

**Arquivos:**
- Modificar: `ArchSmart-web/src/app/globals.css`
- Modificar: `ArchSmart-web/tailwind.config.ts`
- Modificar: `tools/test_contraste.py`

**Interfaces:**
- Consome: `contraste.reprovados()` da Tarefa 2.
- Produz: as classes `bg-success`, `text-success-foreground`, `bg-warning`,
  `text-warning-foreground`, `bg-info`, `text-info-foreground`, e os tokens
  `--radius-sm/-lg/-xl`, `--text-*`, `--space-*`. As Tarefas 5, 6 e 7 usam.

Os valores abaixo **foram calculados e verificados** em 09/09/2026: os seis
pares passam 4.5:1 com folga. Não substitua por outros sem rodar
`python tools/contraste.py`.

- [ ] **Passo 1: Escrever o teste que falha**

Acrescente a `tools/test_contraste.py`:

```python
class TestTokensDeEstado(unittest.TestCase):
    ESTADOS = ("success", "warning", "info")

    def test_existem_nos_dois_temas_com_foreground(self):
        claro, escuro = contraste.tokens_dos_temas()
        for tema, nome in ((claro, "claro"), (escuro, "escuro")):
            for estado in self.ESTADOS:
                self.assertIn(estado, tema, f"--{estado} ausente no tema {nome}")
                self.assertIn(f"{estado}-foreground", tema,
                              f"--{estado}-foreground ausente no tema {nome}")

    def test_nascem_aprovados(self):
        fora = contraste.reprovados()
        for estado in self.ESTADOS:
            self.assertNotIn(f"claro:{estado}", fora)
            self.assertNotIn(f"escuro:{estado}", fora)

    def test_nao_pioram_o_que_ja_existia(self):
        self.assertEqual(
            contraste.reprovados(),
            ["claro:destructive", "claro:muted", "claro:secondary", "escuro:secondary"],
        )
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
cd tools && python -m unittest test_contraste.TestTokensDeEstado -v
```

Esperado: `AssertionError: --success ausente no tema claro`.

- [ ] **Passo 3: Acrescentar os tokens ao `:root` de `globals.css`**

Dentro do bloco `:root`, depois de `--destructive-foreground`:

```css
    /* Estado. Medidos com tools/contraste.py em 09/09/2026: 5,07:1, 4,91:1 e
       6,63:1 — os tres passam 4.5:1 com folga. */
    --success: 142 72% 29%;
    --success-foreground: 0 0% 100%;

    --warning: 38 92% 55%;
    --warning-foreground: 200 18% 26%;

    --info: 217 91% 42%;
    --info-foreground: 0 0% 100%;

    /* Raio derivado do --radius que ja existia. */
    --radius-sm: 0.25rem;
    --radius-lg: 0.5rem;
    --radius-xl: 0.75rem;

    /* Escala tipografica. */
    --text-xs: 0.75rem;
    --text-sm: 0.875rem;
    --text-base: 1rem;
    --text-lg: 1.125rem;
    --text-xl: 1.25rem;
    --text-2xl: 1.5rem;
    --text-3xl: 1.875rem;

    /* Espacamento. */
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-6: 1.5rem;
    --space-8: 2rem;
```

- [ ] **Passo 4: Acrescentar as variantes escuras ao bloco `.dark`**

Só cor muda no tema escuro; raio, tipografia e espaçamento são herdados de
`:root` de propósito. Dentro de `.dark`, depois de `--destructive-foreground`:

```css
    /* Medidos em 09/09/2026: 10,17:1, 10,83:1 e 6,67:1. */
    --success: 142 60% 55%;
    --success-foreground: 222.2 84% 4.9%;

    --warning: 38 92% 60%;
    --warning-foreground: 222.2 84% 4.9%;

    --info: 217 80% 65%;
    --info-foreground: 222.2 84% 4.9%;
```

- [ ] **Passo 5: Rodar os testes de contraste e ver passar**

```bash
cd tools && python -m unittest test_contraste -v
cd .. && python tools/contraste.py
```

Esperado: `OK`; e a tabela mostrando `[v] success`, `[v] warning`, `[v] info`
nos dois temas, com o total de reprovados ainda em 4.

- [ ] **Passo 6: Expor os tokens ao Tailwind**

Em `ArchSmart-web/tailwind.config.ts`, dentro de `theme.extend.colors`, junto de
`destructive`:

```ts
    			success: {
    				DEFAULT: 'hsl(var(--success))',
    				foreground: 'hsl(var(--success-foreground))'
    			},
    			warning: {
    				DEFAULT: 'hsl(var(--warning))',
    				foreground: 'hsl(var(--warning-foreground))'
    			},
    			info: {
    				DEFAULT: 'hsl(var(--info))',
    				foreground: 'hsl(var(--info-foreground))'
    			},
```

e, ainda dentro de `theme.extend`:

```ts
    		borderRadius: {
    			sm: 'var(--radius-sm)',
    			DEFAULT: 'var(--radius)',
    			lg: 'var(--radius-lg)',
    			xl: 'var(--radius-xl)'
    		},
    		fontSize: {
    			xs: 'var(--text-xs)',
    			sm: 'var(--text-sm)',
    			base: 'var(--text-base)',
    			lg: 'var(--text-lg)',
    			xl: 'var(--text-xl)',
    			'2xl': 'var(--text-2xl)',
    			'3xl': 'var(--text-3xl)'
    		},
    		spacing: {
    			1: 'var(--space-1)',
    			2: 'var(--space-2)',
    			3: 'var(--space-3)',
    			4: 'var(--space-4)',
    			6: 'var(--space-6)',
    			8: 'var(--space-8)'
    		},
```

**Atenção:** `borderRadius` pode já existir no `extend` (o shadcn costuma
declarar `lg/md/sm` em cima de `--radius`). Se existir, **mescle** em vez de
duplicar a chave — duas chaves iguais no mesmo objeto e a segunda vence em
silêncio.

- [ ] **Passo 7: Provar que o build não quebrou**

```bash
cd ArchSmart-web
npm run typecheck
npm test
```

Esperado: `tsc` sem saída; `Test Files 11 passed (11)`, `Tests 63 passed (63)` —
ou mais, se a Tarefa 1 tiver acrescentado teste. Um `failed` é regressão real.

- [ ] **Passo 8: Confirmar que a catraca de cor não subiu**

```bash
python tools/catraca.py
```

Esperado: `cores_literais: 521, igual ao baseline` e `contraste_reprovado: 4,
igual ao baseline`. Se `cores_literais` subiu, você escreveu cor literal — os
passos até aqui só escrevem token. (Ele vira 518 no Passo 10, de propósito.)

- [ ] **Passo 9: Converter o único literal de cor que mora em `components/ui/`**

O desenho manda a Seção 6 converter o que ela mesma toca. Medido em 09/09/2026,
isso é **uma linha**: `src/components/ui/toast.tsx:80`, no botão de fechar da
variante destrutiva do toast. Confirme antes de editar:

```bash
python -c "import sys,pathlib; sys.path.insert(0,'tools'); import catraca; p=pathlib.Path('ArchSmart-web/src/components/ui/toast.tsx'); [print(i, l.strip()[:120]) for i,l in enumerate(p.read_text(encoding='utf-8').splitlines(),1) if catraca.RE_PALETA.findall(l) or catraca.RE_ARBITRARIA.findall(l)]"
```

Troque as quatro classes literais por tokens do tema:

| Antes | Depois |
|---|---|
| `group-[.destructive]:text-red-300` | `group-[.destructive]:text-destructive-foreground/70` |
| `group-[.destructive]:hover:text-red-50` | `group-[.destructive]:hover:text-destructive-foreground` |
| `group-[.destructive]:focus:ring-red-400` | `group-[.destructive]:focus:ring-destructive-foreground` |
| `group-[.destructive]:focus:ring-offset-red-600` | `group-[.destructive]:focus:ring-offset-destructive` |

**São quatro classes, mas a catraca conta três.** `ring-offset-red-600` não casa
o regex de `tools/catraca.py`: entre `ring-` e `red` existe `offset`, e
`ring-offset` não está na lista de prefixos. Converta as quatro assim mesmo —
deixar uma cor literal só porque a régua não a enxerga é enganar a régua. E
**não conserte o regex nesta tarefa**: mexer na régua no mesmo commit em que se
mexe no medido torna impossível saber qual dos dois moveu o número. Registre o
furo na nota da seção.

- [ ] **Passo 10: Ver a catraca de cor descer, e gravar**

```bash
python tools/catraca.py
```

Esperado: `cores_literais: baixou de 521 para 518`. Então grave, lembrando do
`--eslint-json` (ver Restrições globais):

```bash
cd ArchSmart-web && npx eslint . --format json -o eslint.json || true
cd .. && python tools/catraca.py --eslint-json ArchSmart-web/eslint.json --atualizar
python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
```

Sem `--aceitar-piora`: o número **desceu**, que é o caminho normal. De agora em
diante, **518** é o número a esperar nas tarefas seguintes.

- [ ] **Passo 11: Commit**

```bash
cd ArchSmart-web && npm run typecheck && npx vitest run && cd ..
git add ArchSmart-web/src/app/globals.css ArchSmart-web/tailwind.config.ts ArchSmart-web/src/components/ui/toast.tsx tools/test_contraste.py tools/catraca.json
git commit -m "feat(secao-6): tokens de estado, raio, tipografia e espacamento"
```

---

## Tarefa 4: `QueryBoundary`

Obriga três dos 5 estados: carregando, erro e vazio. "Padrão" é o próprio
`children`; "hover/foco" é estado visual, cobrado pela Tarefa 7.

**Arquivos:**
- Criar: `ArchSmart-web/src/components/ui/query-boundary.tsx`
- Criar: `ArchSmart-web/src/__tests__/query-boundary.test.tsx`

**Interfaces:**
- Consome: `UseQueryResult` de `@tanstack/react-query`.
- Produz:

```ts
export function QueryBoundary<T>(props: {
  query: UseQueryResult<T>
  skeleton: ReactNode
  empty: ReactNode
  error: (erro: Error, refazer: () => void) => ReactNode
  isEmpty?: (dados: T) => boolean
  children: (dados: T) => ReactNode
}): ReactElement
```

  As Tarefas 5 e 6 usam. A Seção 8 usa em toda tela migrada.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `ArchSmart-web/src/__tests__/query-boundary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import type { UseQueryResult } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import { QueryBoundary } from "@/components/ui/query-boundary"

function query<T>(parcial: Partial<UseQueryResult<T>>): UseQueryResult<T> {
    return {
        isPending: false,
        isError: false,
        data: undefined,
        error: null,
        refetch: vi.fn(),
        ...parcial,
    } as unknown as UseQueryResult<T>
}

describe("QueryBoundary", () => {
    it("mostra o skeleton enquanto carrega", () => {
        render(
            <QueryBoundary
                query={query<string[]>({ isPending: true })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {(dados) => <p>{dados.join()}</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("carregando")).toBeInTheDocument()
    })

    it("mostra o erro e entrega o refetch para tentar de novo", () => {
        const refetch = vi.fn()
        render(
            <QueryBoundary
                query={query<string[]>({ isError: true, error: new Error("caiu"), refetch })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={(erro, refazer) => <button onClick={refazer}>{erro.message}</button>}
            >
                {(dados) => <p>{dados.join()}</p>}
            </QueryBoundary>,
        )
        screen.getByRole("button", { name: "caiu" }).click()
        expect(refetch).toHaveBeenCalledOnce()
    })

    it("mostra o vazio quando a lista volta vazia", () => {
        render(
            <QueryBoundary
                query={query<string[]>({ data: [] })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {(dados) => <p>{dados.join()}</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("vazio")).toBeInTheDocument()
    })

    it("aceita um criterio de vazio proprio, para quem nao devolve lista", () => {
        render(
            <QueryBoundary
                query={query<{ total: number }>({ data: { total: 0 } })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
                isEmpty={(d) => d.total === 0}
            >
                {(d) => <p>{d.total}</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("vazio")).toBeInTheDocument()
    })

    it("mostra os dados quando ha dados", () => {
        render(
            <QueryBoundary
                query={query<string[]>({ data: ["a", "b"] })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {(dados) => <p>{dados.join()}</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("a,b")).toBeInTheDocument()
    })

    it("nao compila sem os estados obrigatorios", () => {
        // @ts-expect-error `empty` e `error` sao obrigatorios: o caminho feliz
        // sozinho tem que deixar de compilar. Se este ts-expect-error virar
        // "unused", alguem afrouxou o tipo — e o portao caiu.
        const so_o_feliz = <QueryBoundary query={query<string[]>({ data: [] })} skeleton={<p />}>
            {(dados) => <p>{dados.join()}</p>}
        </QueryBoundary>
        expect(so_o_feliz).toBeTruthy()
    })
})
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
cd ArchSmart-web && npx vitest run src/__tests__/query-boundary.test.tsx
```

Esperado: falha ao resolver `@/components/ui/query-boundary`.

- [ ] **Passo 3: Implementar**

Crie `ArchSmart-web/src/components/ui/query-boundary.tsx`:

```tsx
"use client"

import type { ReactElement, ReactNode } from "react"
import type { UseQueryResult } from "@tanstack/react-query"

/**
 * Fronteira de query com os estados obrigatorios por tipo.
 *
 * `skeleton`, `empty` e `error` nao tem default de proposito: o caminho feliz
 * sozinho deixa de compilar. Esses tres sao os estados de dado dos 5 da
 * constituicao; "padrao" e o proprio `children`, e "hover/foco" e estado
 * visual, cobrado pelo lint de acessibilidade e pela galeria.
 */
type Props<T> = {
    query: UseQueryResult<T>
    skeleton: ReactNode
    empty: ReactNode
    error: (erro: Error, refazer: () => void) => ReactNode
    /** Quando o dado nao e lista. Sem isto, vazio = array de tamanho 0. */
    isEmpty?: (dados: T) => boolean
    children: (dados: T) => ReactNode
}

export function QueryBoundary<T>({
    query,
    skeleton,
    empty,
    error,
    isEmpty,
    children,
}: Props<T>): ReactElement {
    if (query.isPending) return <>{skeleton}</>
    if (query.isError) return <>{error(query.error as Error, () => void query.refetch())}</>

    const dados = query.data as T
    const vazio = isEmpty ? isEmpty(dados) : Array.isArray(dados) && dados.length === 0
    if (vazio) return <>{empty}</>

    return <>{children(dados)}</>
}
```

- [ ] **Passo 4: Rodar os testes e o typecheck**

```bash
cd ArchSmart-web && npx vitest run src/__tests__/query-boundary.test.tsx && npm run typecheck
```

Esperado: 6 testes passando, e `tsc` **sem saída**. Se `tsc` reclamar
`Unused '@ts-expect-error' directive`, o tipo está frouxo demais — os três
estados não estão obrigatórios de verdade.

- [ ] **Passo 5: Commit**

```bash
git add ArchSmart-web/src/components/ui/query-boundary.tsx ArchSmart-web/src/__tests__/query-boundary.test.tsx
git commit -m "feat(secao-6): QueryBoundary obriga carregando, erro e vazio por tipo"
```

---

## Tarefa 5: Componentes que carregam decisão de produto

Cinco novos e três endurecidos. **Um commit por componente** — um revisor pode
rejeitar o `DataTable` e aprovar o `EmptyState`.

**Arquivos:**
- Criar: `ArchSmart-web/src/components/ui/empty-state.tsx`
- Criar: `ArchSmart-web/src/components/ui/currency-input.tsx`
- Criar: `ArchSmart-web/src/components/ui/error-boundary.tsx`
- Criar: `ArchSmart-web/src/components/ui/data-table.tsx`
- Criar: `ArchSmart-web/src/components/ui/form-field.tsx`
- Criar: `ArchSmart-web/src/__tests__/componentes-ui.test.tsx`
- Modificar: `ArchSmart-web/src/components/ui/dropdown-menu.tsx`
- Modificar: `ArchSmart-web/src/components/ui/skeleton.tsx`

**Interfaces:**
- Produz: `EmptyState`, `CurrencyInput`, `ErrorBoundary`,
  `registrarReportadorDeErro`, `DataTable`, `FormField`. A Tarefa 6 monta a
  galeria com todos.
- `CurrencyInput` trabalha em **centavos inteiros**, nunca float — dinheiro em
  float é erro de arredondamento esperando acontecer.
- `ErrorBoundary` expõe `registrarReportadorDeErro(fn)`. **É o ponto de extensão
  da Seção 7.** Esta tarefa deixa o plugue vazio; não implemente telemetria.

- [ ] **Passo 0: Instalar `@testing-library/user-event`**

Medido em 09/09/2026: o projeto tem `@testing-library/react` e
`@testing-library/jest-dom` (este último já carregado em `vitest-setup.ts`), mas
**não tem `user-event`** — e os testes desta tarefa dependem dele para simular
digitação e clique como um usuário faz.

```bash
cd ArchSmart-web && npm install --save-dev @testing-library/user-event
```

- [ ] **Passo 1: `EmptyState` — teste primeiro**

Crie `ArchSmart-web/src/__tests__/componentes-ui.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EmptyState } from "@/components/ui/empty-state"

describe("EmptyState", () => {
    it("mostra titulo, descricao e a acao de saida", async () => {
        const acao = vi.fn()
        render(
            <EmptyState
                titulo="Nenhum produto"
                descricao="Use o Web Clipper para trazer o primeiro."
                acao={{ rotulo: "Abrir o Clipper", aoClicar: acao }}
            />,
        )
        expect(screen.getByRole("heading", { name: "Nenhum produto" })).toBeInTheDocument()
        expect(screen.getByText(/Web Clipper/)).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Abrir o Clipper" }))
        expect(acao).toHaveBeenCalledOnce()
    })

    it("funciona sem acao — nem todo vazio tem saida", () => {
        render(<EmptyState titulo="Sem resultados" descricao="Tente outro filtro." />)
        expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
})
```

- [ ] **Passo 2: `EmptyState` — rodar, ver falhar, implementar**

```bash
cd ArchSmart-web && npx vitest run src/__tests__/componentes-ui.test.tsx
```

Depois crie `ArchSmart-web/src/components/ui/empty-state.tsx`:

```tsx
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

/**
 * O estado vazio e decisao de produto, nao de tela: toda tela vazia diz o que
 * aconteceu e, quando existe, oferece a saida. Por isso `titulo` e `descricao`
 * sao obrigatorios — vazio mudo e o defeito que este componente evita.
 */
export function EmptyState({
    titulo,
    descricao,
    icone,
    acao,
}: {
    titulo: string
    descricao: string
    icone?: ReactNode
    acao?: { rotulo: string; aoClicar: () => void }
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
            {icone}
            <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
            <p className="max-w-sm text-sm">{descricao}</p>
            {acao ? <Button onClick={acao.aoClicar}>{acao.rotulo}</Button> : null}
        </div>
    )
}
```

- [ ] **Passo 3: `EmptyState` — testes verdes e commit**

```bash
npx vitest run src/__tests__/componentes-ui.test.tsx && npm run typecheck
git add ArchSmart-web/package.json ArchSmart-web/package-lock.json \
        ArchSmart-web/src/components/ui/empty-state.tsx ArchSmart-web/src/__tests__/componentes-ui.test.tsx
git commit -m "feat(secao-6): EmptyState obriga titulo e descricao"
```

- [ ] **Passo 4: `CurrencyInput` — teste primeiro**

Acrescente a `componentes-ui.test.tsx`:

```tsx
import { CurrencyInput } from "@/components/ui/currency-input"

describe("CurrencyInput", () => {
    it("trabalha em centavos: digitar 12345 vira R$ 123,45 e emite 12345", async () => {
        const aoMudar = vi.fn()
        render(<CurrencyInput value={0} onChange={aoMudar} aria-label="Valor" />)
        const campo = screen.getByLabelText("Valor")
        await userEvent.type(campo, "12345")
        expect(aoMudar).toHaveBeenLastCalledWith(12345)
        expect(campo).toHaveValue("R$ 123,45")
    })

    it("ignora o que nao e digito", async () => {
        const aoMudar = vi.fn()
        render(<CurrencyInput value={0} onChange={aoMudar} aria-label="Valor" />)
        await userEvent.type(screen.getByLabelText("Valor"), "1a2b3")
        expect(aoMudar).toHaveBeenLastCalledWith(123)
    })

    it("formata o valor que recebe de fora", () => {
        render(<CurrencyInput value={987654} onChange={vi.fn()} aria-label="Valor" />)
        expect(screen.getByLabelText("Valor")).toHaveValue("R$ 9.876,54")
    })
})
```

- [ ] **Passo 5: `CurrencyInput` — rodar, ver falhar, implementar**

Crie `ArchSmart-web/src/components/ui/currency-input.tsx`:

```tsx
"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

const FORMATADOR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/**
 * Entrada de dinheiro em centavos inteiros.
 *
 * `value` e `onChange` falam centavos, nunca reais em float: 0,1 + 0,2 nao da
 * 0,3 em ponto flutuante, e orcamento e a Acao de Valor do produto. A tela
 * nunca precisa saber formatar moeda — a decisao mora aqui.
 */
type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
    value: number
    onChange: (centavos: number) => void
}

export function CurrencyInput({ value, onChange, ...resto }: Props) {
    const [texto, setTexto] = React.useState(() => FORMATADOR.format(value / 100))

    React.useEffect(() => {
        setTexto(FORMATADOR.format(value / 100))
    }, [value])

    return (
        <Input
            {...resto}
            inputMode="numeric"
            value={texto}
            onChange={(evento) => {
                const digitos = evento.target.value.replace(/\D/g, "")
                const centavos = digitos === "" ? 0 : Number.parseInt(digitos, 10)
                setTexto(FORMATADOR.format(centavos / 100))
                onChange(centavos)
            }}
        />
    )
}
```

- [ ] **Passo 6: `CurrencyInput` — testes verdes e commit**

```bash
npx vitest run src/__tests__/componentes-ui.test.tsx && npm run typecheck
git add ArchSmart-web/src/components/ui/currency-input.tsx ArchSmart-web/src/__tests__/componentes-ui.test.tsx
git commit -m "feat(secao-6): CurrencyInput trabalha em centavos, nunca float"
```

- [ ] **Passo 7: `FormField` — teste primeiro**

```tsx
import { FormField } from "@/components/ui/form-field"

describe("FormField", () => {
    it("liga rotulo e campo por htmlFor, sem depender de aninhamento", () => {
        render(<FormField id="nome" rotulo="Nome do projeto"><input id="nome" /></FormField>)
        expect(screen.getByLabelText("Nome do projeto")).toBeInTheDocument()
    })

    it("anuncia o erro pelo aria-describedby e marca aria-invalid", () => {
        render(
            <FormField id="email" rotulo="E-mail" erro="E-mail invalido">
                <input id="email" />
            </FormField>,
        )
        const campo = screen.getByLabelText("E-mail")
        expect(campo).toHaveAttribute("aria-invalid", "true")
        expect(campo).toHaveAccessibleDescription("E-mail invalido")
    })

    it("marca data-private quando o dado e sensivel", () => {
        const { container } = render(
            <FormField id="cpf" rotulo="CPF" sensivel><input id="cpf" /></FormField>,
        )
        expect(container.querySelector("[data-private='true']")).not.toBeNull()
    })
})
```

- [ ] **Passo 8: `FormField` — implementar**

Crie `ArchSmart-web/src/components/ui/form-field.tsx`:

```tsx
import { cloneElement, isValidElement, type ReactElement } from "react"

import { Label } from "@/components/ui/label"

/**
 * Campo de formulario com as decisoes de produto embutidas: rotulo ligado por
 * `htmlFor`, erro inline anunciado por `aria-describedby`, e `data-private`
 * quando o dado e sensivel (para telemetria e session replay nunca capturarem).
 *
 * `sensivel` existe aqui, e nao na tela, porque "este campo e sensivel" e
 * decisao de produto — deixa-la na tela e como ela some.
 */
export function FormField({
    id,
    rotulo,
    erro,
    sensivel = false,
    children,
}: {
    id: string
    rotulo: string
    erro?: string
    sensivel?: boolean
    children: ReactElement
}) {
    const idDoErro = `${id}-erro`
    const campo = isValidElement<Record<string, unknown>>(children)
        ? cloneElement(children, {
              "aria-invalid": erro ? true : undefined,
              "aria-describedby": erro ? idDoErro : undefined,
          })
        : children

    return (
        <div className="flex flex-col gap-2" data-private={sensivel ? "true" : undefined}>
            <Label htmlFor={id}>{rotulo}</Label>
            {campo}
            {erro ? (
                <p id={idDoErro} className="text-sm text-destructive">
                    {erro}
                </p>
            ) : null}
        </div>
    )
}
```

- [ ] **Passo 9: `FormField` — testes verdes e commit**

```bash
npx vitest run src/__tests__/componentes-ui.test.tsx && npm run typecheck
git add ArchSmart-web/src/components/ui/form-field.tsx ArchSmart-web/src/__tests__/componentes-ui.test.tsx
git commit -m "feat(secao-6): FormField liga rotulo, erro e data-private"
```

- [ ] **Passo 10: `ErrorBoundary` — teste primeiro**

```tsx
import { ErrorBoundary, registrarReportadorDeErro } from "@/components/ui/error-boundary"

function Explode(): never {
    throw new Error("estourou")
}

describe("ErrorBoundary", () => {
    it("mostra o fallback em vez de derrubar a arvore", () => {
        const silencio = vi.spyOn(console, "error").mockImplementation(() => {})
        render(
            <ErrorBoundary fallback={(erro) => <p>peguei: {erro.message}</p>}>
                <Explode />
            </ErrorBoundary>,
        )
        expect(screen.getByText("peguei: estourou")).toBeInTheDocument()
        silencio.mockRestore()
    })

    it("chama o reportador registrado — o plugue que a Secao 7 liga", () => {
        const silencio = vi.spyOn(console, "error").mockImplementation(() => {})
        const reportador = vi.fn()
        registrarReportadorDeErro(reportador)
        render(
            <ErrorBoundary fallback={() => <p>fallback</p>}>
                <Explode />
            </ErrorBoundary>,
        )
        expect(reportador).toHaveBeenCalledOnce()
        registrarReportadorDeErro(() => {})
        silencio.mockRestore()
    })
})
```

- [ ] **Passo 11: `ErrorBoundary` — implementar**

Crie `ArchSmart-web/src/components/ui/error-boundary.tsx`:

```tsx
"use client"

import * as React from "react"

/**
 * Fronteira de erro de render, com ponto de extensao para telemetria.
 *
 * O plugue nasce vazio DE PROPOSITO: telemetria e a Secao 7. Quando ela
 * chegar, chama `registrarReportadorDeErro` uma vez no shell e todo
 * ErrorBoundary da aplicacao passa a reportar — sem tocar em nenhuma tela.
 */
export type ReportadorDeErro = (erro: Error, info: React.ErrorInfo) => void

let reportar: ReportadorDeErro = () => {}

export function registrarReportadorDeErro(fn: ReportadorDeErro) {
    reportar = fn
}

type Props = {
    fallback: (erro: Error, tentarDeNovo: () => void) => React.ReactNode
    children: React.ReactNode
}

export class ErrorBoundary extends React.Component<Props, { erro: Error | null }> {
    state: { erro: Error | null } = { erro: null }

    static getDerivedStateFromError(erro: Error) {
        return { erro }
    }

    componentDidCatch(erro: Error, info: React.ErrorInfo) {
        reportar(erro, info)
    }

    render() {
        if (this.state.erro) {
            return this.props.fallback(this.state.erro, () => this.setState({ erro: null }))
        }
        return this.props.children
    }
}
```

- [ ] **Passo 12: `ErrorBoundary` — testes verdes e commit**

```bash
npx vitest run src/__tests__/componentes-ui.test.tsx && npm run typecheck
git add ArchSmart-web/src/components/ui/error-boundary.tsx ArchSmart-web/src/__tests__/componentes-ui.test.tsx
git commit -m "feat(secao-6): ErrorBoundary com o ponto de extensao que a Secao 7 liga"
```

- [ ] **Passo 13: `DataTable` — teste primeiro**

```tsx
import { DataTable } from "@/components/ui/data-table"

type Linha = { nome: string; valor: number }

const COLUNAS = [
    { chave: "nome" as const, rotulo: "Nome" },
    { chave: "valor" as const, rotulo: "Valor" },
]

const LINHAS: Linha[] = [
    { nome: "Cadeira", valor: 300 },
    { nome: "Abajur", valor: 100 },
    { nome: "Mesa", valor: 200 },
]

describe("DataTable", () => {
    it("ordena ao clicar no cabecalho, e inverte no segundo clique", async () => {
        render(<DataTable colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.nome} />)
        await userEvent.click(screen.getByRole("button", { name: /Nome/ }))
        let celulas = screen.getAllByRole("cell").map((c) => c.textContent)
        expect(celulas.slice(0, 2)).toEqual(["Abajur", "100"])

        await userEvent.click(screen.getByRole("button", { name: /Nome/ }))
        celulas = screen.getAllByRole("cell").map((c) => c.textContent)
        expect(celulas.slice(0, 2)).toEqual(["Mesa", "200"])
    })

    it("pagina, e nao mostra a pagina seguinte antes do clique", async () => {
        render(
            <DataTable colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.nome} porPagina={2} />,
        )
        expect(screen.queryByText("Mesa")).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: /proxima/i }))
        expect(screen.getByText("Mesa")).toBeInTheDocument()
    })

    it("anuncia a ordenacao por aria-sort, nao so por seta", async () => {
        render(<DataTable colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.nome} />)
        await userEvent.click(screen.getByRole("button", { name: /Nome/ }))
        expect(screen.getByRole("columnheader", { name: /Nome/ })).toHaveAttribute("aria-sort", "ascending")
    })
})
```

- [ ] **Passo 14: `DataTable` — implementar**

Crie `ArchSmart-web/src/components/ui/data-table.tsx`:

```tsx
"use client"

import * as React from "react"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"

/**
 * Tabela com ordenacao e paginacao embutidas.
 *
 * Existe para que nenhuma tela reimplemente "clicar no cabecalho ordena" de um
 * jeito diferente — e para que a ordenacao seja anunciada por `aria-sort`, e
 * nao so por uma seta que leitor de tela nao le.
 */
type Coluna<T> = { chave: keyof T & string; rotulo: string }

export function DataTable<T>({
    colunas,
    linhas,
    chaveDaLinha,
    porPagina = 20,
}: {
    colunas: ReadonlyArray<Coluna<T>>
    linhas: ReadonlyArray<T>
    chaveDaLinha: (linha: T) => string
    porPagina?: number
}) {
    const [ordem, setOrdem] = React.useState<{ chave: keyof T & string; asc: boolean } | null>(null)
    const [pagina, setPagina] = React.useState(0)

    const ordenadas = React.useMemo(() => {
        if (!ordem) return [...linhas]
        return [...linhas].sort((a, b) => {
            const x = a[ordem.chave]
            const y = b[ordem.chave]
            if (x === y) return 0
            return (x > y ? 1 : -1) * (ordem.asc ? 1 : -1)
        })
    }, [linhas, ordem])

    const totalDePaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina))
    const visiveis = ordenadas.slice(pagina * porPagina, (pagina + 1) * porPagina)

    return (
        <div className="flex flex-col gap-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        {colunas.map((coluna) => (
                            <TableHead
                                key={coluna.chave}
                                aria-sort={
                                    ordem?.chave === coluna.chave
                                        ? ordem.asc
                                            ? "ascending"
                                            : "descending"
                                        : "none"
                                }
                            >
                                <button
                                    type="button"
                                    className="font-medium underline-offset-4 hover:underline focus-visible:underline"
                                    onClick={() =>
                                        setOrdem((atual) =>
                                            atual?.chave === coluna.chave
                                                ? { chave: coluna.chave, asc: !atual.asc }
                                                : { chave: coluna.chave, asc: true },
                                        )
                                    }
                                >
                                    {coluna.rotulo}
                                </button>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visiveis.map((linha) => (
                        <TableRow key={chaveDaLinha(linha)}>
                            {colunas.map((coluna) => (
                                <TableCell key={coluna.chave}>{String(linha[coluna.chave])}</TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                <span>
                    Pagina {pagina + 1} de {totalDePaginas}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina === 0}
                    onClick={() => setPagina((p) => p - 1)}
                >
                    Anterior
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina + 1 >= totalDePaginas}
                    onClick={() => setPagina((p) => p + 1)}
                >
                    Proxima
                </Button>
            </div>
        </div>
    )
}
```

- [ ] **Passo 15: `DataTable` — testes verdes e commit**

```bash
npx vitest run src/__tests__/componentes-ui.test.tsx && npm run typecheck
git add ArchSmart-web/src/components/ui/data-table.tsx ArchSmart-web/src/__tests__/componentes-ui.test.tsx
git commit -m "feat(secao-6): DataTable com ordenacao anunciada e paginacao"
```

- [ ] **Passo 16: Endurecer os três que já existem — teste primeiro**

`AlertDialog`, `DropdownMenu` e `Skeleton` **já existem** em
`src/components/ui/`. A tarefa é provar e corrigir, não recriar.

```tsx
import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"

describe("componentes endurecidos", () => {
    it("AlertDialog prende o foco dentro do dialogo", async () => {
        render(
            <AlertDialog>
                <AlertDialogTrigger>abrir</AlertDialogTrigger>
                <AlertDialogContent>
                    <button>dentro</button>
                </AlertDialogContent>
            </AlertDialog>,
        )
        await userEvent.click(screen.getByText("abrir"))
        expect(screen.getByRole("alertdialog")).toContainElement(document.activeElement)
    })

    it("DropdownMenuItem tem alvo de toque de no minimo 44px", async () => {
        render(
            <DropdownMenu>
                <DropdownMenuTrigger>menu</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>opcao</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>,
        )
        await userEvent.click(screen.getByText("menu"))
        expect(screen.getByRole("menuitem")).toHaveClass("min-h-11")
    })

    it("Skeleton nao e lido por leitor de tela", () => {
        const { container } = render(<Skeleton className="h-4 w-20" />)
        expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
    })
})
```

- [ ] **Passo 17: Endurecer — implementar só o que o teste reprovar**

Rode primeiro. O Radix já prende foco no `AlertDialog`, então esse teste pode
passar de cara — **isso é resultado válido**, e o teste vira a prova de que
continua valendo. Para os que falharem:

Em `dropdown-menu.tsx`, acrescente `min-h-11` à lista de classes do
`DropdownMenuItem` (44px = `min-h-11` no espaçamento padrão do Tailwind).
Em `skeleton.tsx`, acrescente `aria-hidden="true"` ao elemento raiz — o
esqueleto é ruído para quem usa leitor de tela, e o estado de carregamento é
anunciado pelo `QueryBoundary`, não por ele.

- [ ] **Passo 18: Testes verdes, catraca e commit**

```bash
cd ArchSmart-web && npx vitest run && npm run typecheck
cd .. && python tools/catraca.py
git add ArchSmart-web/src/components/ui ArchSmart-web/src/__tests__/componentes-ui.test.tsx
git commit -m "fix(secao-6): endurece AlertDialog, DropdownMenu e Skeleton"
```

`cores_literais` tem que continuar em **518** (a Tarefa 3 desceu de 521). Se
subiu, algum componente novo usou cor literal em vez de token.

---

## Tarefa 6: Galeria `/dev/componentes`

**Arquivos:**
- Criar: `ArchSmart-web/src/app/dev/componentes/page.tsx`
- Criar: `ArchSmart-web/src/app/dev/componentes/galeria.tsx`
- Criar: `ArchSmart-web/src/__tests__/galeria.test.tsx`

**Interfaces:**
- Consome: todos os componentes da Tarefa 5 e o `QueryBoundary` da Tarefa 4.
- Produz: `Galeria` (componente client, sem `page.tsx` em volta), que a Tarefa 7
  renderiza para rodar o axe. **Separar `galeria.tsx` de `page.tsx` existe para
  isso** — o teste do axe não deve depender de rota, metadata ou `notFound()`.

- [ ] **Passo 1: Escrever o teste que falha**

Crie `ArchSmart-web/src/__tests__/galeria.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Galeria } from "@/app/dev/componentes/galeria"

describe("galeria de componentes", () => {
    it("mostra cada componente da Secao 6, com secao nomeada", () => {
        render(<Galeria />)
        for (const nome of [
            "EmptyState",
            "CurrencyInput",
            "FormField",
            "DataTable",
            "ErrorBoundary",
            "QueryBoundary",
            "AlertDialog",
            "DropdownMenu",
            "Skeleton",
        ]) {
            expect(screen.getByRole("heading", { name: nome })).toBeInTheDocument()
        }
    })

    it("mostra os estados de dado do QueryBoundary, nao so o caminho feliz", () => {
        render(<Galeria />)
        expect(screen.getByTestId("qb-carregando")).toBeInTheDocument()
        expect(screen.getByTestId("qb-vazio")).toBeInTheDocument()
        expect(screen.getByTestId("qb-erro")).toBeInTheDocument()
        expect(screen.getByTestId("qb-dados")).toBeInTheDocument()
    })
})
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
cd ArchSmart-web && npx vitest run src/__tests__/galeria.test.tsx
```

- [ ] **Passo 3: Escrever `galeria.tsx`**

Crie `ArchSmart-web/src/app/dev/componentes/galeria.tsx`. Use **apenas tokens** —
`bg-success`, `text-warning-foreground`, `bg-info` — nunca cor literal: a
galeria é a referência que outros vão copiar, e cor literal aqui se multiplica.

```tsx
"use client"

import * as React from "react"
import type { UseQueryResult } from "@tanstack/react-query"

import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { CurrencyInput } from "@/components/ui/currency-input"
import { DataTable } from "@/components/ui/data-table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { FormField } from "@/components/ui/form-field"
import { QueryBoundary } from "@/components/ui/query-boundary"
import { Skeleton } from "@/components/ui/skeleton"

/** Query falsa, só para a galeria mostrar cada estado sem rede. */
function fake<T>(parcial: Partial<UseQueryResult<T>>): UseQueryResult<T> {
    return {
        isPending: false,
        isError: false,
        data: undefined,
        error: null,
        refetch: () => {},
        ...parcial,
    } as unknown as UseQueryResult<T>
}

function Secao({ nome, children }: { nome: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-4 border-b border-border py-8">
            <h2 className="text-xl font-semibold">{nome}</h2>
            {children}
        </section>
    )
}

const LINHAS = [
    { nome: "Cadeira Eames", valor: 300 },
    { nome: "Abajur Linho", valor: 100 },
]

export function Galeria() {
    const [centavos, setCentavos] = React.useState(12345)

    return (
        <main className="mx-auto flex max-w-4xl flex-col px-4">
            <h1 className="py-8 text-3xl font-bold">Componentes — Arq Smart</h1>

            <Secao nome="EmptyState">
                <EmptyState
                    titulo="Nenhum produto"
                    descricao="Use o Web Clipper para trazer o primeiro."
                    acao={{ rotulo: "Abrir o Clipper", aoClicar: () => {} }}
                />
            </Secao>

            <Secao nome="CurrencyInput">
                <FormField id="galeria-valor" rotulo="Valor do item">
                    <CurrencyInput id="galeria-valor" value={centavos} onChange={setCentavos} />
                </FormField>
                <p className="text-sm text-muted-foreground">Em centavos: {centavos}</p>
            </Secao>

            <Secao nome="FormField">
                <FormField id="galeria-email" rotulo="E-mail" erro="E-mail invalido">
                    <input id="galeria-email" className="rounded border border-input p-2" />
                </FormField>
                <FormField id="galeria-cpf" rotulo="CPF" sensivel>
                    <input id="galeria-cpf" className="rounded border border-input p-2" />
                </FormField>
            </Secao>

            <Secao nome="DataTable">
                <DataTable
                    colunas={[
                        { chave: "nome", rotulo: "Nome" },
                        { chave: "valor", rotulo: "Valor" },
                    ]}
                    linhas={LINHAS}
                    chaveDaLinha={(l) => l.nome}
                />
            </Secao>

            <Secao nome="QueryBoundary">
                <div data-testid="qb-carregando">
                    <QueryBoundary
                        query={fake<string[]>({ isPending: true })}
                        skeleton={<Skeleton className="h-8 w-40" />}
                        empty={<EmptyState titulo="Vazio" descricao="Nada aqui." />}
                        error={(erro) => <p className="text-destructive">{erro.message}</p>}
                    >
                        {(dados) => <p>{dados.join()}</p>}
                    </QueryBoundary>
                </div>
                <div data-testid="qb-vazio">
                    <QueryBoundary
                        query={fake<string[]>({ data: [] })}
                        skeleton={<Skeleton className="h-8 w-40" />}
                        empty={<EmptyState titulo="Vazio" descricao="Nada aqui." />}
                        error={(erro) => <p className="text-destructive">{erro.message}</p>}
                    >
                        {(dados) => <p>{dados.join()}</p>}
                    </QueryBoundary>
                </div>
                <div data-testid="qb-erro">
                    <QueryBoundary
                        query={fake<string[]>({ isError: true, error: new Error("A API nao respondeu") })}
                        skeleton={<Skeleton className="h-8 w-40" />}
                        empty={<EmptyState titulo="Vazio" descricao="Nada aqui." />}
                        error={(erro) => <p className="text-destructive">{erro.message}</p>}
                    >
                        {(dados) => <p>{dados.join()}</p>}
                    </QueryBoundary>
                </div>
                <div data-testid="qb-dados">
                    <QueryBoundary
                        query={fake<string[]>({ data: ["Cadeira", "Abajur"] })}
                        skeleton={<Skeleton className="h-8 w-40" />}
                        empty={<EmptyState titulo="Vazio" descricao="Nada aqui." />}
                        error={(erro) => <p className="text-destructive">{erro.message}</p>}
                    >
                        {(dados) => <p>{dados.join(", ")}</p>}
                    </QueryBoundary>
                </div>
            </Secao>

            <Secao nome="ErrorBoundary">
                <ErrorBoundary fallback={(erro) => <p className="text-destructive">{erro.message}</p>}>
                    <p>Conteudo normal — o fallback so aparece quando um filho estoura.</p>
                </ErrorBoundary>
            </Secao>

            <Secao nome="AlertDialog">
                <AlertDialog>
                    <AlertDialogTrigger className="rounded bg-destructive px-3 py-2 text-destructive-foreground">
                        Excluir projeto
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <p>Esta acao nao pode ser desfeita.</p>
                    </AlertDialogContent>
                </AlertDialog>
            </Secao>

            <Secao nome="DropdownMenu">
                <DropdownMenu>
                    <DropdownMenuTrigger className="rounded border border-input px-3 py-2">
                        Acoes
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem>Duplicar</DropdownMenuItem>
                        <DropdownMenuItem>Arquivar</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </Secao>

            <Secao nome="Skeleton">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-40" />
            </Secao>

            <Secao nome="Tokens de estado">
                <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-success px-3 py-1 text-success-foreground">success</span>
                    <span className="rounded bg-warning px-3 py-1 text-warning-foreground">warning</span>
                    <span className="rounded bg-info px-3 py-1 text-info-foreground">info</span>
                    <span className="rounded bg-destructive px-3 py-1 text-destructive-foreground">
                        destructive
                    </span>
                </div>
            </Secao>
        </main>
    )
}
```

**Sobre a seção "Tokens de estado":** ela existe para o olho conferir o que o
`tools/contraste.py` mede por número. As duas checagens são independentes de
propósito — a ferramenta pega o que o olho deixa passar, e o olho pega o que a
fórmula não sabe (um cinza que passa 4.5:1 e ainda assim some no fundo).

- [ ] **Passo 4: Escrever `page.tsx`, protegida e não indexável**

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Galeria } from "./galeria"

export const metadata: Metadata = {
    title: "Componentes | Arq Smart",
    robots: { index: false, follow: false },
}

/**
 * Galeria de componentes. Nao existe em producao — e ferramenta de
 * desenvolvimento, e uma rota publica listando a interface inteira e superficie
 * que nao precisamos oferecer.
 */
export default function Page() {
    if (process.env.NODE_ENV === "production") notFound()
    return <Galeria />
}
```

- [ ] **Passo 5: Testes verdes**

```bash
npx vitest run src/__tests__/galeria.test.tsx && npm run typecheck
```

- [ ] **Passo 6: Confirmar que a galeria não usou cor literal**

```bash
cd .. && python tools/catraca.py
```

`cores_literais` tem que continuar em **518**.

- [ ] **Passo 7: Commit**

```bash
git add ArchSmart-web/src/app/dev ArchSmart-web/src/__tests__/galeria.test.tsx
git commit -m "feat(secao-6): galeria /dev/componentes, protegida e nao indexavel"
```

---

## Tarefa 7: Acessibilidade por ferramenta

**Arquivos:**
- Modificar: `tools/catraca.py`
- Modificar: `tools/catraca.json` (via ferramenta)
- Modificar: `tools/test_catraca.py`
- Modificar: `ArchSmart-web/src/__tests__/galeria.test.tsx`
- Modificar: `ArchSmart-web/package.json` (devDependency `axe-core`)

**Interfaces:**
- Consome: `Galeria` da Tarefa 6.
- Produz: medidas `tabindex_negativo` (baseline **5**) e `hover_sem_focus`
  (baseline **8**) na catraca; e um teste de axe que **nasce portão fechado**,
  porque a galeria é código novo e não tem dívida para herdar.

### Por que o baseline é 8 e não 9

A spec de 23/08 e o desenho dizem **9**. Ao escrever a régua, medimos as duas
definições possíveis e elas discordam:

```bash
cd ArchSmart-web
# def A — só aceita focus-within:
grep -rn "opacity-0" src --include=*.tsx | grep "group-hover" | grep -vc "focus-within"     # 9
# def B — aceita focus-within: OU focus:
grep -rn "opacity-0" src --include=*.tsx | grep "group-hover" | grep -v "focus-within:" | grep -vc "focus:"   # 8
```

A diferença é uma linha só: `src/components/ui/toast.tsx:80`, que revela o botão
com `focus:opacity-100`. **Isso já é acessível por teclado** — `focus-within:` é
para revelar quando o foco cai *dentro* de um filho; `focus:` resolve quando o
próprio elemento recebe foco. Contar essa linha seria medir um defeito que não
existe, e um baseline com falso positivo dentro é um baseline que ninguém
consegue zerar.

**Use a definição B.** O `9` da spec é de agosto e não separava os dois casos.

- [ ] **Passo 1: Medir o que existe hoje, antes de escrever a ferramenta**

```bash
cd ArchSmart-web
grep -rn "tabIndex={-1}" src --include=*.tsx | wc -l
grep -rn "opacity-0" src --include=*.tsx | grep "group-hover" | grep -v "focus-within:" | grep -vc "focus:"
```

Esperado em 09/09/2026: **5** e **8**. Se der outro número, use o número medido
como baseline e **diga no PR que mudou** — não force o 5 e o 8.

- [ ] **Passo 2: Escrever os testes das medidas**

Acrescente a `tools/test_catraca.py`:

```python
class TestMedidasDeAcessibilidade(unittest.TestCase):
    def test_conta_tabindex_negativo(self):
        self.assertEqual(catraca.medir(None)["tabindex_negativo"], 5)

    def test_conta_hover_sem_focus(self):
        self.assertEqual(catraca.medir(None)["hover_sem_focus"], 8)

    def test_linha_com_focus_within_nao_conta(self):
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="opacity-0 group-hover:opacity-100 focus-within:opacity-100"'
            ),
            0,
        )

    def test_linha_com_focus_proprio_tambem_nao_conta(self):
        # O elemento aparece quando ELE recebe foco. E acessivel por teclado —
        # contar isso seria medir um defeito que nao existe (ver toast.tsx:80).
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="opacity-0 group-hover:opacity-100 focus:opacity-100"'
            ),
            0,
        )

    def test_linha_sem_nenhum_foco_conta(self):
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="opacity-0 group-hover:opacity-100"'
            ),
            1,
        )
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
cd tools && python -m unittest test_catraca -v
```

- [ ] **Passo 4: Implementar as duas medidas em `tools/catraca.py`**

```python
RE_TABINDEX_NEGATIVO = re.compile(r"tabIndex=\{\s*-\s*1\s*\}")
RE_OPACITY_ZERO = re.compile(r"\bopacity-0\b")
RE_GROUP_HOVER = re.compile(r"\bgroup-hover:")
# `focus-within:` revela quando o foco cai num filho; `focus:` revela quando o
# proprio elemento recebe foco. Os dois resolvem o defeito -- aceitar so o
# primeiro punia toast.tsx:80, que ja e acessivel por teclado, e um baseline com
# falso positivo dentro e um baseline que ninguem consegue zerar.
RE_FOCUS = re.compile(r"\bfocus(-within)?:")


def contar_hover_sem_focus_no_texto(texto: str) -> int:
    """Linhas que escondem em opacity-0 e so revelam no hover do grupo.

    Conta por LINHA, nao por arquivo: o par (opacity-0, group-hover:) tem que
    estar na mesma className para ser o defeito. Uma linha que ja revele por
    foco esta consertada e nao conta -- e assim que a medida desce quando
    alguem conserta, em vez de exigir que o arquivo inteiro suma.
    """
    total = 0
    for linha in texto.splitlines():
        if (RE_OPACITY_ZERO.search(linha) and RE_GROUP_HOVER.search(linha)
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
```

Em `medir()`:

```python
        "tabindex_negativo": contar_ocorrencias(SRC_WEB, RE_TABINDEX_NEGATIVO),
        "hover_sem_focus": contar_hover_sem_focus(SRC_WEB),
```

Em `CRITERIOS`:

```python
    "tabindex_negativo": "ocorrencias de tabIndex={-1} em ArchSmart-web/src/**/*.tsx",
    "hover_sem_focus": "linhas com opacity-0 + group-hover: e sem focus: nem focus-within: em ArchSmart-web/src/**/*.tsx",
```

E acrescente as duas ao docstring do módulo, dizendo que a **Seção 8 zera**, ao
migrar as telas onde elas vivem.

- [ ] **Passo 5: Testes verdes e baseline registrado**

```bash
cd tools && python -m unittest discover -p "test_*.py"
cd .. && python tools/catraca.py                        # sai 1: duas chaves sem baseline
cd ArchSmart-web && npx eslint . --format json -o eslint.json || true
cd .. && python tools/catraca.py --eslint-json ArchSmart-web/eslint.json --atualizar --aceitar-piora
python tools/catraca.py                                 # sai 0
```

- [ ] **Passo 6: Instalar o axe e escrever o teste que falha**

```bash
cd ArchSmart-web && npm install --save-dev axe-core
```

Acrescente a `src/__tests__/galeria.test.tsx`:

```tsx
import axe from "axe-core"

it("a galeria nao tem violacao de acessibilidade", async () => {
    const { container } = render(<Galeria />)
    const resultado = await axe.run(container, {
        rules: {
            // A galeria e um fragmento, nao um documento: as regras de
            // estrutura de pagina (landmark, region, ordem de heading) nao se
            // aplicam a ela e produziriam violacao falsa.
            region: { enabled: false },
        },
    })
    const resumo = resultado.violations
        .map((v) => `${v.id}: ${v.nodes.length} no(s) — ${v.help}`)
        .join("\n")
    expect(resultado.violations, `violacoes:\n${resumo}`).toHaveLength(0)
}, 20_000)
```

- [ ] **Passo 7: Rodar, e consertar a galeria até zerar**

```bash
npx vitest run src/__tests__/galeria.test.tsx
```

**Conserte a galeria e os componentes, nunca a regra.** Se uma regra do axe for
mesmo inaplicável a um fragmento, desligue-a com comentário dizendo por quê,
como no `region` acima. Desligar regra sem justificativa é transformar o portão
em enfeite.

- [ ] **Passo 8: Suíte inteira, catraca e commit**

```bash
npx vitest run && npm run typecheck
cd .. && python tools/catraca.py && cd tools && python -m unittest discover -p "test_*.py"
cd ..
git add tools/catraca.py tools/catraca.json tools/test_catraca.py ArchSmart-web/package.json ArchSmart-web/package-lock.json ArchSmart-web/src/__tests__/galeria.test.tsx
git commit -m "feat(secao-6): catracas de a11y em 5 e 9, axe zero na galeria"
```

---

## Tarefa 8: Code splitting e limpeza de dependências

**Arquivos:**
- Modificar: `ArchSmart-web/package.json`
- Modificar: as telas pesadas (só a linha de import — não reescreva a tela)
- Criar: `ArchSmart-web/src/__tests__/dependencias.test.ts`

**Interfaces:**
- Não produz interface para outras tarefas. É limpeza.

- [ ] **Passo 1: Confirmar que as quatro dependências continuam sem uso**

```bash
cd ArchSmart-web
for dep in react-icons embla-carousel-react react-easy-crop vaul; do
  echo "$dep: $(grep -rn "$dep" src --include=*.tsx --include=*.ts | wc -l) import(s)"
done
```

Esperado: `0` para as quatro. **Se alguma tiver import, não remova** — mede-se
antes de apagar. `vaul` costuma vir junto de um `drawer.tsx` do shadcn e
`embla-carousel-react` de um `carousel.tsx`; confira que esses arquivos não
existem antes de concluir.

- [ ] **Passo 2: Escrever o teste que trava a volta delas**

Crie `ArchSmart-web/src/__tests__/dependencias.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"))

describe("dependencias", () => {
    it.each(["react-icons", "embla-carousel-react", "react-easy-crop", "vaul"])(
        "%s foi removida na Secao 6 e nao volta sem uso",
        (dep) => {
            expect(pkg.dependencies?.[dep]).toBeUndefined()
            expect(pkg.devDependencies?.[dep]).toBeUndefined()
        },
    )

    it("@types/* nao mora em dependencies — tipo nao vai para o bundle", () => {
        const tipos = Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith("@types/"))
        expect(tipos, `mova para devDependencies: ${tipos.join(", ")}`).toHaveLength(0)
    })
})
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx vitest run src/__tests__/dependencias.test.ts
```

Esperado: 5 falhas — as 4 deps e o `@types/react-big-calendar`.

- [ ] **Passo 4: Remover e mover**

```bash
cd ArchSmart-web
npm uninstall react-icons embla-carousel-react react-easy-crop vaul
npm uninstall @types/react-big-calendar && npm install --save-dev @types/react-big-calendar
```

- [ ] **Passo 5: Rodar o teste e o build**

```bash
npx vitest run src/__tests__/dependencias.test.ts
npm run typecheck
npm run build
```

`npm run build` aqui é obrigatório: remover dependência é o tipo de mudança que
passa no `tsc` e quebra no build.

- [ ] **Passo 6: Commitar a limpeza separada do splitting**

```bash
git add ArchSmart-web/package.json ArchSmart-web/package-lock.json ArchSmart-web/src/__tests__/dependencias.test.ts
git commit -m "chore(secao-6): remove 4 dependencias sem uso e move @types para devDependencies"
```

- [ ] **Passo 7: Ligar `next/dynamic` nas telas pesadas**

Alvos: Agenda (calendário), construtor de apresentação, impressão, e os modais
pesados da Biblioteca. Localize os pontos de import:

```bash
grep -rn "react-big-calendar" src --include=*.tsx | head
grep -rn "BuilderClient\|NormalizationSheet\|BatchNormalizeModal" src --include=*.tsx | grep import
```

Para cada um, troque o import estático por dinâmico, **sem tocar no resto da
tela**:

```tsx
import dynamic from "next/dynamic"

import { Skeleton } from "@/components/ui/skeleton"

const BatchNormalizeModal = dynamic(
    () => import("@/components/library/BatchNormalizeModal").then((m) => m.BatchNormalizeModal),
    { loading: () => <Skeleton className="h-64 w-full" /> },
)
```

**Atenção ao default export:** se o componente for `export default`, o
`.then((m) => m.X)` sobra e quebra. Confira cada arquivo antes.

E **atenção ao `ssr: false`**: só use em componente que de fato quebra no
servidor (o calendário costuma quebrar). Desligar SSR sem precisar troca uma
lentidão por outra.

- [ ] **Passo 8: Provar que o splitting existe**

```bash
grep -rn "next/dynamic" src --include=*.tsx | wc -l
npm run build
```

Esperado: `next/dynamic` maior que 0 (era 0), e o build passando. Olhe a saída
do build: os alvos devem aparecer como chunk separado.

- [ ] **Passo 9: Suíte e commit**

```bash
npx vitest run && npm run typecheck
git add ArchSmart-web/src
git commit -m "perf(secao-6): next/dynamic na agenda, builder, impressao e modais pesados"
```

---

## Tarefa 9: Quebra dos arquivos grandes

A tarefa de maior risco de regressão silenciosa: quatro arquivos grandes, em
telas sem cobertura. A defesa é caracterizar antes de mexer.

**Arquivos:**
- Modificar: `ArchSmart-web/src/app/(dashboard)/projects/[id]/budget/components/MainBudgetArea.tsx` (634)
- Modificar: `ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx` (593)
- Modificar: `ArchSmart-web/src/components/layout/AppShell.tsx` (569)
- Modificar: `ArchSmart-web/src/components/projects/ProjectWizard.tsx` (551)
- Modificar: `tools/catraca.py`, `tools/catraca.json`

**Interfaces:**
- Não produz interface nova. **Nenhum comportamento pode mudar** — se você
  precisou mudar comportamento para quebrar, pare e pergunte.

- [ ] **Passo 1: Medir, e registrar os 12 arquivos acima de 400 linhas**

```bash
cd ArchSmart-web
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | awk '$1 > 400 && $2 != "total" {print $1, $2}' | sort -rn
```

Esperado: 12 arquivos. Os quatro desta tarefa são os quatro maiores;
`BuilderClient` (529) e `PortalBudget` (517) vêm logo atrás e **estão fora do
escopo de propósito** (ver o desenho).

- [ ] **Passo 2: Escrever a medida `arquivos_acima_de_400` na catraca**

Em `tools/catraca.py`:

```python
LIMITE_DE_LINHAS = 400


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
```

Em `medir()`: `"arquivos_acima_de_400": arquivos_grandes(SRC_WEB),` e o critério
correspondente em `CRITERIOS`.

- [ ] **Passo 3: Registrar o baseline com os 12**

```bash
cd .. && python tools/catraca.py                       # sai 1: chave sem baseline
cd ArchSmart-web && npx eslint . --format json -o eslint.json || true
cd .. && python tools/catraca.py --eslint-json ArchSmart-web/eslint.json --atualizar --aceitar-piora
git add tools/catraca.py tools/catraca.json
git commit -m "feat(secao-6): catraca lista os 12 arquivos acima de 400 linhas"
```

- [ ] **Passo 4: Caracterizar `AppShell` antes de tocar nele**

Comece pelo `AppShell`: é o que a Seção 8 usa em toda tela, então uma regressão
aqui aparece em todas.

**Este passo é caracterização, não TDD.** O teste descreve o que o código faz
**hoje** e tem que passar **na primeira execução, antes de qualquer refatoração**.
Se ele falhar de cara, você entendeu o componente errado — corrija o teste até
ele descrever o presente, e só então quebre o arquivo.

Crie `ArchSmart-web/src/__tests__/app-shell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/layout/AppShell"

// O shell usa roteador e tema; nenhum dos dois existe em jsdom puro.
vi.mock("next/navigation", () => ({
    usePathname: () => "/dashboard",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("next-themes", () => ({
    useTheme: () => ({ theme: "light", setTheme: vi.fn(), resolvedTheme: "light" }),
}))

describe("AppShell (caracterizacao — descreve o presente)", () => {
    it("renderiza o conteudo que recebe", () => {
        render(<AppShell><p>conteudo da tela</p></AppShell>)
        expect(screen.getByText("conteudo da tela")).toBeInTheDocument()
    })

    it("mostra a navegacao principal", () => {
        render(<AppShell><p>x</p></AppShell>)
        expect(screen.getAllByRole("link").length).toBeGreaterThan(0)
    })

    it("escreve a marca com Q, em toda ocorrencia", () => {
        const { container } = render(<AppShell><p>x</p></AppShell>)
        expect(container.textContent).toContain("Arq Smart")
        expect(container.textContent).not.toContain("Arch Smart")
    })
})
```

**Se `AppShell` for `export default`**, ajuste o import — confira antes de
rodar. E se ele exigir mais mocks (sessão, React Query), acrescente-os: o
objetivo é conseguir renderizar, não testar as dependências.

```bash
cd ArchSmart-web && npx vitest run src/__tests__/app-shell.test.tsx
```

Esperado: **3 passando, antes de você mexer em qualquer coisa.**

- [ ] **Passo 5: Quebrar `AppShell` — só mover, nunca reescrever**

Extraia por responsabilidade, não por tamanho: a navegação lateral, o cabeçalho
e o menu do usuário são três responsabilidades diferentes. Crie
`src/components/layout/app-shell/` com um arquivo por peça e deixe o `AppShell`
compondo. **Mover trecho, ajustar import, nada mais.**

- [ ] **Passo 6: Provar que nada mudou**

```bash
cd ArchSmart-web && npx vitest run && npm run typecheck && npm run build
```

Os testes de caracterização têm que continuar verdes **sem edição**. Se você
precisou editar um teste de caracterização, o comportamento mudou — desfaça.

- [ ] **Passo 7: Commit, e repetir para os outros três**

```bash
git add ArchSmart-web/src/components/layout ArchSmart-web/src/__tests__/app-shell.test.tsx
git commit -m "refactor(secao-6): quebra AppShell em navegacao, cabecalho e menu"
```

Repita os passos 4 a 7 para `dashboard/page.tsx` (593), `MainBudgetArea.tsx`
(634) e `ProjectWizard.tsx` (551) — **um commit por arquivo**, cada um com sua
caracterização. `MainBudgetArea` é o mais arriscado: é a Ação de Valor do
produto e tem ~300 queries por trás. Vá por último.

- [ ] **Passo 8: Baixar a catraca e fechar a seção**

```bash
cd .. && python tools/catraca.py
```

Esperado: `arquivos_acima_de_400: baixou — agora abaixo do limite: ...` com os
quatro. Então:

```bash
cd ArchSmart-web && npx eslint . --format json -o eslint.json || true
cd .. && python tools/catraca.py --eslint-json ArchSmart-web/eslint.json --atualizar
python tools/progresso.py --write
python tools/progresso.py --check
python tools/checa_links.py
cd tools && python -m unittest discover -p "test_*.py"
```

`--atualizar` sem `--aceitar-piora`: a medida **baixou**, que é o caminho
normal. Se ele recusar gravar, alguma outra medida piorou — descubra qual antes
de forçar.

```bash
cd ..
git add tools/catraca.json PROGRESS.md
git commit -m "chore(secao-6): catraca de arquivos grandes desce de 12 para 8"
```

---

## Fechamento da seção

- [ ] **Todos os portões, do jeito que o CI roda**

```bash
cd ArchSmart-web && npm run typecheck && npm test
cd .. && python tools/catraca.py && python tools/progresso.py --check && python tools/checa_links.py
cd tools && python -m unittest discover -p "test_*.py"
```

**Rode `checa_links.py` da raiz** — é assim que o CI o executa, e os caminhos
relativos dependem disso. E rode a suíte de `tools/` **de dentro de `tools/`**,
pelo mesmo motivo (o job usa `working-directory: tools`).

- [ ] **Escrever a nota da Seção 6 no `PROGRESS.md`**

No formato das Seções 4 e 5: o que mudou, os números medidos **com o comando**,
e o que ficou em aberto. Registre explicitamente:
- o resultado da medição da Tarefa 1 (ou o defeito, se a hidratação reprovou);
- que as 521 cores e as 25 imagens foram para a Seção 8, e por quê;
- que `BuilderClient` e `PortalBudget` seguem acima de 400 linhas, por decisão;
- que `secondary` continua reprovando contraste, e que isso é decisão de marca.

- [ ] **Abrir o PR**

Três checks têm que estar verdes. Eles não bloqueiam — quem mergeia é o portão.
Um X vermelho ali é defeito real.
