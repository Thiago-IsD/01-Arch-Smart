# Seção 8 — Projetos: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar Projetos (lista + detalhe) para o padrão da Biblioteca e do Dashboard, com leitura por prefetch e `QueryBoundary`, as seis escritas como `useMutation` com invalidação explícita, o N+1 de `/api/projects` consertado, e os débitos transversais escolhidos por Thiago (token `destructive`, shell, `tentarPrefetch`, `QueryBoundary inativo`, instrumento de LCP/JS e verificação humana).

**Architecture:** `features/projects/` ganha fábricas `queryOptions` (lista, detalhe, ambientes) chamadas com `apiServer` nos Server Components `ProjetosData`/`ProjetoData` e com `api` nos hooks. As telas viram Server Component → `<Suspense>` → prefetch → `HydrationBoundary` → componente cliente com `QueryBoundary principal`. As mutações moram em `features/projects/hooks.ts` e declaram o conjunto exato de chaves que removem e invalidam. No backend, `/api/projects` passa a anotar `environments_count` numa consulta agregada e a devolver `active_count`.

**Tech Stack:** Next.js 16 (App Router), React 19, `@tanstack/react-query` 5, Vitest + Testing Library, Playwright, `axe-core`; FastAPI + SQLAlchemy 2 + Postgres 17, pytest contra Postgres em Docker; `tools/` em Python só com biblioteca padrão.

**Spec:** [`docs/superpowers/specs/2026-09-15-secao-8-projetos-design.md`](../specs/2026-09-15-secao-8-projetos-design.md) — leia inteira antes da Tarefa 1, **inclusive as três notas "Revisado em 15/09/2026"**: elas mudaram a tabela de invalidação, mantiveram `router.refresh()` nas mutações de projeto e trocaram o método de medir JS.

## Global Constraints

- Branch: `secao-8-projetos` (já existe, com a spec). Merge em `develop`, PR `develop` → `staging`. **A branch não tem upstream de propósito** — no primeiro push, `git push -u origin secao-8-projetos`.
- A marca é **"Arq Smart"** — nunca `ArchSmart`, `Ark Smart` ou `Ecowe` em código, copy ou comentário (Art. 8).
- Nenhuma cor literal em classe utilitária (`text-red-500`, `bg-[#...]`) — só tokens semânticos (Art. 7).
- Nenhum `account_id`, URL, host ou limite de plano literal no código (Arts. 1, 3, 4).
- Endpoint lê e escreve por `ScopedRepository`; `tests/test_arquitetura.py` reprova `db.query()` direto.
- **Não migre área de passagem.** `projects/[id]/budget/`, `projects/[id]/presentation/` e `projects/[id]/print/` continuam no padrão antigo.
- **`/api/users/me` continua por `apiServer` direto na lista** (decisão 2 da spec). Não crie `features/account/queries.ts`. O "Plano Solo" fixo fica.
- **Número afirmado sem medição é número errado.** Todo número que entrar em commit ou doc vai com o comando que o produz.
- **Nada de "é esperado que falhe".** Comando vermelho é defeito — exceto o passo de TDD que diz explicitamente "Esperado: FAIL".
- Catraca: quando uma medida descer, `python tools/catraca.py --atualizar` **no mesmo commit**, e **no mesmo commit** `cd tools && python -m unittest discover -p "test_*.py"` (item 13 do Dashboard). Nunca editar `tools/catraca.json` à mão.
- Specs de medição e2e rodam com **API local em `:8000`** (o `.env.local` do front aponta para ela), credencial carregada com `set -a; . ./.env.e2e.local; set +a`, e `--timeout=180000`.
- Antes de qualquer script que leia `settings` do backend: confira qual bloco do `ArchSmart-api/.env` está ativo. Nunca rode `alembic upgrade head` à mão.
- Passada feita por agente é rotulada *"verificado por agente sobre captura de tela e medição no DOM — não por olho humano"*. Nunca promova a "verificado".
- Todo commit termina com:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```

### Comandos que o plano usa

```bash
# frontend, de ArchSmart-web/
npx vitest run src/__tests__/<arquivo>     # um arquivo
npm run typecheck && npm test              # o que o CI roda
npx eslint <arquivos>                      # lint dos arquivos tocados

# backend, de ArchSmart-api/ (Docker Desktop precisa estar de pé; sem ele o
# pytest sai com ~164 errors de "Connection refused" na porta 55432, e isso
# NAO e defeito de codigo)
docker compose -f docker-compose.test.yml up -d --wait
./venv/Scripts/python.exe -m pytest <arquivo>::<teste> -q

# repositorio, da raiz
python tools/catraca.py
cd tools && python -m unittest discover -p "test_*.py"; cd ..
python tools/checa_links.py
python tools/progresso.py --check
```

## Mapa de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `ArchSmart-web/e2e/medicao-carga.spec.ts` | instrumento: LCP em 4G simulado e JS baixado na carga dura de uma rota | 1 |
| `docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md` | registro dos números "antes" e "depois" | 1, 12 |
| `ArchSmart-api/app/api/endpoints/projects.py` | lista sem N+1, `active_count` | 2 |
| `ArchSmart-api/app/models/all_models.py` | `Project.environments_count` aceita contagem anotada | 2 |
| `ArchSmart-api/app/schemas/project_schema.py` | `active_count` em `PaginatedProjectResponse` | 2 |
| `ArchSmart-api/app/api/routers/environments_router.py` | lista de ambientes com `joinedload(dna)` | 2 |
| `ArchSmart-api/tests/api/test_projetos_sem_n_mais_um.py` | constância de consultas e `active_count` | 2 |
| `ArchSmart-web/src/lib/query/keys.ts` | chave `projects.detail(id)` | 3 |
| `ArchSmart-web/src/features/projects/types.ts` | `Projeto`, `PaginaDeProjetos`, `Ambiente`, `DnaDoAmbiente` | 3 |
| `ArchSmart-web/src/features/projects/queries.ts` | fábricas `queryOptions` | 3 |
| `ArchSmart-web/src/features/projects/limite.ts` | `estadoDoLimite(ativos, limite)` | 3 |
| `ArchSmart-web/src/features/projects/hooks.ts` | hooks de leitura (3) e de mutação (6, 7) | 3, 6, 7 |
| `ArchSmart-web/src/features/projects/api.ts` | chamadas de escrita | 6, 7 |
| `ArchSmart-web/src/features/projects/invalidacao.ts` | o mapa explícito de chaves por mutação | 6 |
| `ArchSmart-web/src/app/(dashboard)/projects/page.tsx` + `components/` | lista: `ProjetosData`, `ProjetosContent`, `CabecalhoDeProjetos`, `ProjetosVazio`, `ProjetosComErro`, `ProjetosSkeleton` | 4 |
| `ArchSmart-web/src/app/(dashboard)/projects/[id]/page.tsx` + `components/` | detalhe: `ProjetoData`, `ProjetoContent`, `ProjetoComErro` | 5 |
| `ArchSmart-web/src/components/projects/**` | componentes passam a consumir os hooks | 5, 6, 7 |
| `ArchSmart-web/eslint.config.mjs` | lint de `fetch` vira erro no território de Projetos | 7 |
| `ArchSmart-web/src/components/ui/query-boundary.tsx` | prop `inativo` | 8 |
| `ArchSmart-web/src/lib/query/hydration.ts` | `tentarPrefetch` que enxerga a desistência | 9 |
| `ArchSmart-web/src/app/globals.css` | token `destructive` | 10 |
| `tools/contraste.py`, `tools/catraca.py` | medida `texto_sobre_fundo_reprovado` | 10 |
| `ArchSmart-web/src/components/layout/**` | acessibilidade do shell | 11 |
| `ArchSmart-web/e2e/hidratacao-projetos.spec.ts`, `telemetria-projetos.spec.ts`, `projetos-dados.ts` | guardas | 12 |
| `docs/dev/modulos/projects.md` | doc do módulo com os números | 12 |

---

### Task 1: Instrumento de LCP e JS da rota, e a medição "antes"

Esta tarefa vem **antes** de qualquer mudança de código, para que Projetos tenha número de "antes" (decisão 6 da spec). Biblioteca e Dashboard entram na mesma rodada, porque nunca tiveram esses dois números. É **instrumento**, não guarda: não entra no `e2e.yml`.

**Files:**
- Create: `ArchSmart-web/e2e/medicao-carga.spec.ts`
- Create: `docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md`

**Interfaces:**
- Produces: o comando `ROTA=/projects npx playwright test e2e/medicao-carga.spec.ts`, que imprime `LCP_AMOSTRAS=`, `LCP_MEDIANA_MS=`, `JS_BYTES=` e `JS_ARQUIVOS=`. A Tarefa 12 roda o mesmo comando para o "depois".

- [ ] **Step 1: Escrever o instrumento**

```ts
import { test, type CDPSession } from "@playwright/test"

/**
 * Mede, numa CARGA DURA de `ROTA`, o LCP sob rede e CPU limitadas e o JS que o
 * navegador baixou.
 *
 * Instrumento, nao guarda (Secao 8, Projetos, Tarefa 1). Produz numero; nao
 * entra no e2e.yml.
 *
 * ## O perfil — escrito aqui porque o numero so vale com ele
 *
 * "4G" e o perfil "Slow 4G" do Lighthouse, aplicado por CDP: RTT 150 ms,
 * 1,6 Mbps de descida, 750 Kbps de subida, CPU 4x mais lenta. NAO e rede 4G
 * real — e throttling do Chromium, e o numero e rotulado assim.
 *
 * ## JS
 *
 * Soma de `encodedBodySize` (bytes pela rede, ja comprimidos) dos recursos
 * `.js` da carga dura, com cache DESABILITADO. E JS compartilhado + da rota,
 * nao so da rota. So vale contra `next build && next start`: em `next dev` o
 * JS nao e minificado e o numero nao diz nada.
 *
 * ## Como rodar
 *
 * ```
 * cd ArchSmart-web
 * npm run build && npm run start          # outro terminal; o playwright reusa a :3000
 * set -a; . ./.env.e2e.local; set +a
 * ROTA=/projects npx playwright test e2e/medicao-carga.spec.ts --reporter=line --timeout=180000
 * ```
 */
const REPETICOES = 5

const SLOW_4G = {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
}
const CPU_LENTA = 4

async function limitar(cdp: CDPSession): Promise<void> {
    await cdp.send("Network.enable")
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })
    await cdp.send("Network.emulateNetworkConditions", SLOW_4G)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_LENTA })
}

test("mede LCP e JS da carga dura de ROTA", async ({ page }) => {
    const rota = process.env.ROTA
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!rota) throw new Error("ROTA nao definida. Ex.: ROTA=/projects")
    if (!email || !password) {
        throw new Error("E2E_EMAIL e/ou E2E_PASSWORD nao definidos. Localmente: ArchSmart-web/.env.e2e.local")
    }

    // Login SEM limitacao: o que se mede e a rota, nao o formulario de login.
    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    // Aquece a API (cold start do Render nao e o front) antes de limitar.
    await page.goto(rota)
    await page.waitForLoadState("networkidle")

    await page.addInitScript(() => {
        const w = window as unknown as { __lcp: number }
        w.__lcp = 0
        new PerformanceObserver((lista) => {
            for (const entrada of lista.getEntries()) w.__lcp = entrada.startTime
        }).observe({ type: "largest-contentful-paint", buffered: true })
    })

    const cdp = await page.context().newCDPSession(page)
    await limitar(cdp)

    const lcps: number[] = []
    let jsBytes = 0
    let jsArquivos = 0

    for (let i = 0; i < REPETICOES; i++) {
        await page.goto(rota)
        await page.waitForLoadState("networkidle")
        lcps.push(await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp))

        if (i === 0) {
            const js = await page.evaluate(() =>
                performance
                    .getEntriesByType("resource")
                    .map((r) => r as PerformanceResourceTiming)
                    .filter((r) => new URL(r.name).pathname.endsWith(".js")),
            )
            jsArquivos = js.length
            jsBytes = js.reduce((soma, r) => soma + r.encodedBodySize, 0)
        }
    }

    if (lcps.some((v) => v <= 0)) {
        throw new Error(`LCP nao foi observado em alguma amostra: ${lcps.join(",")}`)
    }

    lcps.sort((a, b) => a - b)
    console.log(`ROTA=${rota}`)
    console.log(`PERFIL=slow4g-cdp rtt=150ms down=1.6Mbps up=750Kbps cpu=${CPU_LENTA}x`)
    console.log(`LCP_AMOSTRAS=${lcps.map(Math.round).join(",")}`)
    console.log(`LCP_MEDIANA_MS=${Math.round(lcps[Math.floor(lcps.length / 2)])}`)
    console.log(`JS_BYTES=${jsBytes}`)
    console.log(`JS_ARQUIVOS=${jsArquivos}`)
})
```

- [ ] **Step 2: Conferir tipos e lint do spec**

Run (de `ArchSmart-web/`): `npx tsc --noEmit -p . && npx eslint e2e/medicao-carga.spec.ts`
Esperado: sem erro. Se o `tsconfig` não incluir `e2e/`, rode `npx tsc --noEmit e2e/medicao-carga.spec.ts --target es2022 --moduleResolution bundler --module esnext --skipLibCheck` e registre qual dos dois rodou.

- [ ] **Step 3: Build de produção e API local**

```bash
cd ArchSmart-api && ./venv/Scripts/python.exe -m uvicorn app.main:app --port 8000   # terminal 1
cd ArchSmart-web && npm run build && npm run start                                  # terminal 2
```
Esperado: `next start` escutando em `:3000`. Se `npm run build` falhar, **pare**: é defeito anterior a esta seção, e vai para Thiago antes de qualquer outra coisa.

- [ ] **Step 4: Rodar nas três rotas**

```bash
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
for r in /library /dashboard /projects; do
  ROTA=$r npx playwright test e2e/medicao-carga.spec.ts --reporter=line --timeout=180000 2>&1 | grep -E "^(ROTA|PERFIL|LCP_|JS_)"
done
```
Esperado: seis linhas por rota. Se alguma rota lançar "LCP nao foi observado", rode de novo **uma** vez; se repetir, registre a falha no documento em vez de inventar número.

- [ ] **Step 5: Escrever o registro**

Crie `docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md` com: o perfil (copiado do docstring), o commit medido (`git rev-parse --short HEAD`), o arranjo (`next start` local + API local em `:8000` + banco de staging), a tabela abaixo preenchida **com a saída colada do Step 4**, e o bloco de comando do Step 4.

```markdown
| Rota | LCP mediana (ms) | Amostras | JS (bytes, rede) | Arquivos JS | Momento |
|---|---:|---|---:|---:|---|
| /library | … | … | … | … | antes da migração de Projetos |
| /dashboard | … | … | … | … | antes da migração de Projetos |
| /projects | … | … | … | … | **antes** |
```

Uma seção final "O que este número não é": não é 4G real; JS inclui o compartilhado; LCP de rota autenticada com API local, não a implantada.

- [ ] **Step 6: Links e commit**

```bash
python tools/checa_links.py
git add ArchSmart-web/e2e/medicao-carga.spec.ts docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md
git commit -m "test(e2e): instrumento de LCP e JS da rota, e a medicao antes de Projetos

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend — `/api/projects` sem N+1, `active_count`, e ambientes com DNA

**Files:**
- Create: `ArchSmart-api/tests/api/test_projetos_sem_n_mais_um.py`
- Modify: `ArchSmart-api/app/api/endpoints/projects.py` (função `get_projects`)
- Modify: `ArchSmart-api/app/models/all_models.py` (propriedade `Project.environments_count`)
- Modify: `ArchSmart-api/app/schemas/project_schema.py` (`PaginatedProjectResponse`)
- Modify: `ArchSmart-api/app/api/routers/environments_router.py` (`get_environments`)

**Interfaces:**
- Produces: `GET /api/projects` devolve `{"total", "page", "size", "pages", "items", "plan_limit", "active_count"}`; `active_count` é `int`, contado sobre **todos** os projetos `ACTIVE` da conta, ignorando `page`, `size` e `search`. A Tarefa 3 tipa isso em `PaginaDeProjetos`.

- [ ] **Step 1: Escrever os testes**

```python
"""
Projetos: a lista, o detalhe e os ambientes nao consultam uma vez por linha.

Mesmo principio de `test_produtos_sem_n_mais_um.py`: quem carrega a garantia e
a CONSTANCIA (1 linha e 20 linhas custam o mesmo numero de consultas), mais um
teto com folga. Cada consulta e uma ida a rede, a 0,17 s na API implantada
(docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md). Antes desta
tarefa a lista gastava 12 consultas numa pagina de 5 projetos (13/09/2026):
`client` e `environments` carregados por linha.

`db.expunge_all()` antes de contar e obrigatorio: os objetos criados pelo teste
ficam na identity map, e um many-to-one (`Project.client`) resolvido por chave
primaria sai da identity map SEM ir ao banco — o N+1 ficaria invisivel aqui e
continuaria vivo na producao, onde nenhuma requisicao chega com o cliente ja
carregado.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Account, Client, Environment, EnvironmentDNA, Project
from tests.contador_de_queries import ContadorDeQueries


def _projetos(
    db: Session, conta: Account, quantos: int, ambientes: int = 2, status: str = "ACTIVE"
) -> list:
    """`quantos` projetos, cada um com o SEU cliente e `ambientes` ambientes com DNA."""
    ids = []
    for indice in range(quantos):
        cliente = Client(account_id=conta.id, name=f"Cliente {status} {indice}")
        db.add(cliente)
        db.flush()
        projeto = Project(
            account_id=conta.id, client_id=cliente.id, name=f"Projeto {status} {indice}", status=status
        )
        db.add(projeto)
        db.flush()
        for j in range(ambientes):
            ambiente = Environment(account_id=conta.id, project_id=projeto.id, name=f"Ambiente {j}")
            db.add(ambiente)
            db.flush()
            db.add(EnvironmentDNA(account_id=conta.id, environment_id=ambiente.id, floor_area=10.0))
        ids.append(projeto.id)
    db.flush()
    return ids


def _contar(db: Session, client, url: str):
    db.expunge_all()
    with ContadorDeQueries(db.connection()) as contador:
        resposta = client.get(url)
    assert resposta.status_code == 200, resposta.text
    return len(contador), resposta.json(), contador


def test_a_lista_nao_consulta_por_projeto(db: Session, conta_a, client_a):
    conta, _ = conta_a
    _projetos(db, conta, 1)
    com_um, corpo, _ = _contar(db, client_a, "/api/projects?page=1&size=1")
    assert len(corpo["items"]) == 1

    _projetos(db, conta, 19)
    com_vinte, corpo, contador = _contar(db, client_a, "/api/projects?page=1&size=20")
    assert len(corpo["items"]) == 20
    # Se o cliente ou a contagem sumissem da resposta, a contagem cairia e o
    # teste passaria por engano.
    assert all(item["client"] and item["client"]["name"] for item in corpo["items"])
    assert all(item["environments_count"] == 2 for item in corpo["items"])

    assert com_um == com_vinte, (
        f"a lista cresceu com a pagina: {com_um} para 1 projeto, {com_vinte} para 20.\n  "
        + contador.resumo()
    )
    # 1 contagem + 1 pagina com join do cliente + 1 contagem de ambientes
    # agregada + 1 active_count. Quem trocar a estrategia ajusta no mesmo commit.
    assert com_vinte <= 4, f"{com_vinte} consultas na lista:\n  " + contador.resumo()


def test_active_count_e_da_conta_inteira_e_nao_da_pagina(db: Session, conta_a, client_a):
    conta, _ = conta_a
    _projetos(db, conta, 3, ambientes=0, status="ACTIVE")
    _projetos(db, conta, 2, ambientes=0, status="COMPLETED")

    corpo = client_a.get("/api/projects?page=1&size=2").json()

    assert len(corpo["items"]) == 2
    assert corpo["active_count"] == 3


def test_active_count_ignora_a_busca(db: Session, conta_a, client_a):
    conta, _ = conta_a
    _projetos(db, conta, 2, ambientes=0, status="ACTIVE")

    corpo = client_a.get("/api/projects?search=nao-existe-nenhum").json()

    assert corpo["items"] == []
    assert corpo["active_count"] == 2


def test_active_count_ignora_outra_conta(db: Session, conta_a, conta_b, client_a):
    _projetos(db, conta_b[0], 4, ambientes=0)
    _projetos(db, conta_a[0], 1, ambientes=0)

    assert client_a.get("/api/projects").json()["active_count"] == 1


def test_o_detalhe_custa_o_mesmo_com_1_e_com_20_ambientes(db: Session, conta_a, client_a):
    conta, _ = conta_a
    [com_um_ambiente] = _projetos(db, conta, 1, ambientes=1)
    [com_vinte_ambientes] = _projetos(db, conta, 1, ambientes=20)

    c1, corpo1, _ = _contar(db, client_a, f"/api/projects/{com_um_ambiente}")
    c20, corpo20, contador = _contar(db, client_a, f"/api/projects/{com_vinte_ambientes}")

    assert corpo1["environments_count"] == 1 and corpo20["environments_count"] == 20
    assert corpo20["client"]["name"]
    assert c1 == c20, f"{c1} contra {c20}:\n  " + contador.resumo()
    assert c20 <= 3, f"{c20} consultas no detalhe:\n  " + contador.resumo()


def test_a_lista_de_ambientes_nao_consulta_um_dna_por_ambiente(db: Session, conta_a, client_a):
    conta, _ = conta_a
    [com_um] = _projetos(db, conta, 1, ambientes=1)
    [com_vinte] = _projetos(db, conta, 1, ambientes=20)

    c1, corpo1, _ = _contar(db, client_a, f"/api/projects/{com_um}/environments")
    c20, corpo20, contador = _contar(db, client_a, f"/api/projects/{com_vinte}/environments")

    assert len(corpo1) == 1 and len(corpo20) == 20
    assert all(a["dna"] and a["dna"]["floor_area"] == 10.0 for a in corpo20)
    assert c1 == c20, f"{c1} contra {c20}:\n  " + contador.resumo()
    # 1 obter do projeto + 1 ambientes com join do DNA.
    assert c20 <= 2, f"{c20} consultas nos ambientes:\n  " + contador.resumo()
```

- [ ] **Step 2: Rodar e registrar o "antes"**

Run: `./venv/Scripts/python.exe -m pytest tests/api/test_projetos_sem_n_mais_um.py -q`
Esperado: FAIL em `test_a_lista_nao_consulta_por_projeto` (constância), nos três de `active_count` (`KeyError: 'active_count'`) e em `test_a_lista_de_ambientes_nao_consulta_um_dna_por_ambiente`. **`test_o_detalhe_custa_o_mesmo...` pode passar já** — o detalhe carrega a coleção de ambientes numa consulta só, independentemente do tamanho. Copie para as notas da tarefa os números "antes" que as mensagens imprimem (1 vs 20 da lista, 1 vs 20 dos ambientes, e o do detalhe). Eles vão para a doc do módulo na Tarefa 12.

- [ ] **Step 3: `environments_count` aceita contagem anotada**

Em `ArchSmart-api/app/models/all_models.py`, substitua a propriedade de `Project`:

```python
    @property
    def environments_count(self) -> int:
        # A lista de projetos anota a contagem numa consulta agregada
        # (`_anotar_contagem_de_ambientes`, app/api/endpoints/projects.py):
        # sem isso, cada linha carregava a colecao inteira so para o `len`.
        # Sem anotacao — detalhe, criacao, edicao —, conta pela colecao.
        anotado = self.__dict__.get("_environments_count")
        if anotado is not None:
            return anotado
        return len(self.environments) if self.environments else 0
```

- [ ] **Step 4: Schema**

Em `ArchSmart-api/app/schemas/project_schema.py`, na `PaginatedProjectResponse`, logo abaixo de `plan_limit`:

```python
    # Projetos ACTIVE da conta inteira — nao da pagina, nao da busca. Existe
    # porque o front contava ativos sobre a pagina 1 de 20 e decidia o limite
    # de plano com esse numero (Art. 3). Obrigatorio de proposito: um default 0
    # esconderia a rota que esquecesse de preencher.
    active_count: int
```

- [ ] **Step 5: A lista**

Em `ArchSmart-api/app/api/endpoints/projects.py`: troque os imports do topo e a função `get_projects` inteira.

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from typing import Any
from uuid import UUID

from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Client, Environment, Project
```

```python
def _anotar_contagem_de_ambientes(repo: ScopedRepository, projetos: list[Project]) -> None:
    """
    Uma consulta agregada para a pagina inteira, no lugar de carregar a colecao
    `environments` de cada projeto so para contar. Ver `Project.environments_count`.
    """
    if not projetos:
        return
    contagens = dict(
        repo.query(Environment)
        .with_entities(Environment.project_id, func.count(Environment.id))
        .filter(Environment.project_id.in_([p.id for p in projetos]))
        .group_by(Environment.project_id)
        .all()
    )
    for projeto in projetos:
        projeto._environments_count = contagens.get(projeto.id, 0)


@router.get("", response_model=PaginatedProjectResponse)
def get_projects(
    repo: ScopedRepository = Depends(get_repo),
    page: int = 1,
    size: int = 20,
    search: str = None
) -> Any:
    """
    Lista os projetos da conta. Custo fixo de 4 consultas, qualquer que seja o
    tamanho da pagina (tests/api/test_projetos_sem_n_mais_um.py).
    """
    query = repo.query(Project)

    if search:
        query = query.filter(Project.name.ilike(f"%{search}%"))

    query = query.order_by(Project.created_at.desc())

    total = query.count()
    pages = (total + size - 1) // size
    items = (
        query.options(joinedload(Project.client))
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    _anotar_contagem_de_ambientes(repo, items)
    active_count = repo.query(Project).filter(Project.status == "ACTIVE").count()

    return {
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
        "items": items,
        "plan_limit": _get_plan_limit(repo),
        "active_count": active_count,
    }
```

- [ ] **Step 6: Os ambientes**

Em `ArchSmart-api/app/api/routers/environments_router.py`, acrescente `from sqlalchemy.orm import joinedload` aos imports e troque o corpo de `get_environments`:

```python
    repo.obter(Project, project_id)

    # `EnvironmentResponse` aninha `dna`: sem o join, a serializacao emitia uma
    # consulta por ambiente (tests/api/test_projetos_sem_n_mais_um.py).
    environments = (
        repo.query(Environment)
        .options(joinedload(Environment.dna))
        .filter(Environment.project_id == project_id)
        .all()
    )
    return environments
```

- [ ] **Step 7: Rodar os testes novos e os de projetos e ambientes**

Run: `./venv/Scripts/python.exe -m pytest tests/api/test_projetos_sem_n_mais_um.py tests/api/test_projetos.py tests/api/test_ambientes.py tests/test_arquitetura.py -q`
Esperado: PASS, todos. Se o detalhe passar de 3 consultas, **não afrouxe o teto**: leia `contador.resumo()` e diga qual consulta é a nova.

- [ ] **Step 8: Suíte inteira**

Run: `./venv/Scripts/python.exe -m pytest -q`
Esperado: `N passed, 1 skipped` com N maior que os 360 do merge do Dashboard, e zero `failed`. Cole a última linha nas notas.

- [ ] **Step 9: Commit**

```bash
git add ArchSmart-api/tests/api/test_projetos_sem_n_mais_um.py ArchSmart-api/app/api/endpoints/projects.py ArchSmart-api/app/models/all_models.py ArchSmart-api/app/schemas/project_schema.py ArchSmart-api/app/api/routers/environments_router.py
git commit -m "perf(api): lista de projetos sem N+1, active_count da conta, ambientes com DNA num join

Lista: <antes> -> <depois> consultas para 20 projetos; ambientes: <antes> -> 2
para 20 ambientes (numeros do Step 2 e do Step 7).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
(Troque os `<antes>`/`<depois>` pelos números medidos antes de commitar.)

---

### Task 3: `features/projects/` — chaves, tipos, fábricas, limite, e os dois hooks que saem da Biblioteca

Nenhuma mudança visível: a Biblioteca passa a importar dois hooks de outro lugar, e a suíte prova que nada mudou.

**Files:**
- Modify: `ArchSmart-web/src/lib/query/keys.ts` (bloco `projects`)
- Create: `ArchSmart-web/src/features/projects/types.ts`
- Create: `ArchSmart-web/src/features/projects/queries.ts`
- Create: `ArchSmart-web/src/features/projects/limite.ts`
- Create: `ArchSmart-web/src/features/projects/hooks.ts`
- Modify: `ArchSmart-web/src/features/library/hooks.ts` (remove `useProjetosParaMover`, `useAmbientesDoProjeto`)
- Modify: `ArchSmart-web/src/features/library/api.ts` (remove `listarProjetos`, `listarAmbientes`)
- Modify: `ArchSmart-web/src/components/library/MoveToProjectModal.tsx` (import)
- Test: `ArchSmart-web/src/__tests__/projects-queries.test.ts`
- Test: `ArchSmart-web/src/__tests__/query-keys.test.ts` (um caso novo)

**Interfaces:**
- Consumes: `active_count` da Tarefa 2.
- Produces:
  - `queryKeys.projects.detail(id: string)` → `["projects", "detail", id]`
  - tipos `Projeto`, `ClienteDoProjeto`, `PaginaDeProjetos`, `Ambiente`, `DnaDoAmbiente`
  - `PAGINA_PADRAO: { page: 1; size: 20 }`, `queryDaListaDeProjetos(cliente, pagina?)`, `queryDoProjeto(cliente, id)`, `queryDosAmbientes(cliente, projectId)`
  - `estadoDoLimite(ativos: number, limite: number): { noLimite: boolean; fracao: number; livres: number }`
  - hooks `useListaDeProjetos()`, `useProjeto(id)`, `useAmbientes(projectId)`, `useProjetosParaMover(ativo)`, `useAmbientesDoProjeto(projectId?)`

- [ ] **Step 1: Testes que falham**

Em `src/__tests__/query-keys.test.ts`, dentro do `describe("queryKeys")`:

```ts
    it("detail de projeto e filho de projects e nao colide com lists nem com environments", () => {
        expect(ehPrefixoDe(queryKeys.projects.all, queryKeys.projects.detail("p1"))).toBe(true)
        expect(ehPrefixoDe(queryKeys.projects.lists(), queryKeys.projects.detail("p1"))).toBe(false)
        expect(queryKeys.projects.detail("p1")).not.toEqual(queryKeys.projects.environments("p1"))
    })
```

Crie `src/__tests__/projects-queries.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import type { ClienteApi } from "@/lib/api/core"
import { cachePolicy, queryKeys } from "@/lib/query/keys"
import {
    PAGINA_PADRAO,
    queryDaListaDeProjetos,
    queryDoProjeto,
    queryDosAmbientes,
} from "@/features/projects/queries"
import { estadoDoLimite } from "@/features/projects/limite"

/**
 * A fabrica e a fonte unica: `ProjetosData`/`ProjetoData` (servidor) chamam com
 * `apiServer`, os hooks com `api`. Estes testes prendem chave, caminho e query
 * string; o que prende que o servidor USA a fabrica sao `projetos-data.test.tsx`
 * e `projeto-data.test.tsx`.
 */
function clienteFalso(resposta: unknown = {}) {
    return vi.fn().mockResolvedValue(resposta) as unknown as ClienteApi & ReturnType<typeof vi.fn>
}

describe("fabricas de query de Projetos", () => {
    it("a lista padrao pede page=1&size=20 sob projects.list(1, 20)", async () => {
        const cliente = clienteFalso({ items: [] })
        const opcoes = queryDaListaDeProjetos(cliente)
        expect(PAGINA_PADRAO).toEqual({ page: 1, size: 20 })
        expect(opcoes.queryKey).toEqual(queryKeys.projects.list(1, 20))
        expect(opcoes.staleTime).toBe(cachePolicy.transacional.staleTime)

        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/projects", { signal: sinal, query: { page: 1, size: 20 } })
    })

    it("a pagina pedida entra na chave E na query string — a chave nao mente sobre a resposta", async () => {
        const cliente = clienteFalso({ items: [] })
        const opcoes = queryDaListaDeProjetos(cliente, { page: 1, size: 100 })
        expect(opcoes.queryKey).toEqual(queryKeys.projects.list(1, 100))
        await opcoes.queryFn!({ signal: new AbortController().signal } as never)
        expect(cliente.mock.calls[0][1].query).toEqual({ page: 1, size: 100 })
    })

    it("o detalhe usa projects.detail(id) e nao tenta de novo num 404", async () => {
        const cliente = clienteFalso({ id: "p1" })
        const opcoes = queryDoProjeto(cliente, "p1")
        expect(opcoes.queryKey).toEqual(queryKeys.projects.detail("p1"))
        expect(opcoes.retry).toBe(false)
        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/projects/p1", { signal: sinal })
    })

    it("os ambientes usam projects.environments(id)", async () => {
        const cliente = clienteFalso([])
        const opcoes = queryDosAmbientes(cliente, "p1")
        expect(opcoes.queryKey).toEqual(queryKeys.projects.environments("p1"))
        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/projects/p1/environments", { signal: sinal })
    })
})

describe("estadoDoLimite", () => {
    it("abaixo do limite", () => {
        expect(estadoDoLimite(1, 3)).toEqual({ noLimite: false, fracao: 1 / 3, livres: 2 })
    })

    it("no limite e acima dele a fracao para em 1 e ninguem fica com vaga negativa", () => {
        expect(estadoDoLimite(3, 3)).toEqual({ noLimite: true, fracao: 1, livres: 0 })
        expect(estadoDoLimite(5, 3)).toEqual({ noLimite: true, fracao: 1, livres: 0 })
    })

    it("limite 0 e 'no limite', nunca NaN — o defeito do ProjectsLimitCard (item 9 do Dashboard)", () => {
        const estado = estadoDoLimite(0, 0)
        expect(estado).toEqual({ noLimite: true, fracao: 1, livres: 0 })
        expect(Number.isNaN(estado.fracao)).toBe(false)
    })
})
```

- [ ] **Step 2: Rodar**

Run (de `ArchSmart-web/`): `npx vitest run src/__tests__/projects-queries.test.ts src/__tests__/query-keys.test.ts`
Esperado: FAIL — `Failed to resolve import "@/features/projects/queries"` e `queryKeys.projects.detail is not a function`.

- [ ] **Step 3: A chave**

Em `src/lib/query/keys.ts`, no bloco `projects`, entre `list` e `environments`:

```ts
        detail: (id: string) => [...queryKeys.projects.all, "detail", id] as const,
```

- [ ] **Step 4: Tipos**

Confira os campos contra os schemas antes de escrever:

```bash
grep -n "class ProjectBase\|class ProjectResponse\|class ClientBase\|class ClientResponse" -A12 ArchSmart-api/app/schemas/project_schema.py
grep -n "class EnvironmentDNABase\|class EnvironmentDNAResponse\|class EnvironmentBase\|class EnvironmentResponse" -A8 ArchSmart-api/app/schemas/environment_schema.py
```

Se algum campo abaixo não existir lá, **tire-o** (não invente); se existir campo que a tela usa e não está aqui, acrescente.

`src/features/projects/types.ts`:

```ts
/**
 * O que `/api/projects` e `/api/projects/{id}/environments` devolvem.
 * Espelha `ProjectResponse`/`PaginatedProjectResponse` (project_schema.py) e
 * `EnvironmentResponse` (environment_schema.py).
 */

export interface ClienteDoProjeto {
    id: string
    name: string
    email?: string | null
    phone?: string | null
}

export interface Projeto {
    id: string
    account_id: string
    client_id: string
    name: string
    /** A API tipa como string. Valores em uso: ACTIVE, COMPLETED, DRAFT. */
    status: string
    service_type?: string | null
    service_value?: number | null
    payment_installments?: number | null
    payment_method?: string | null
    created_at: string
    environments_count: number
    client?: ClienteDoProjeto | null
    custom_installments?: { amount: number; due_date: string; description?: string | null }[] | null
}

export interface PaginaDeProjetos {
    items: Projeto[]
    total: number
    page: number
    size: number
    pages: number
    plan_limit: number
    /** Ativos da conta INTEIRA, contados no servidor (Art. 3). Nao conte `items`. */
    active_count: number
}

export interface DnaDoAmbiente {
    id: string
    environment_id: string
    floor_area: number
    wall_area: number
    ceiling_area: number
    is_complete: boolean
}

export interface Ambiente {
    id: string
    project_id: string
    name: string
    type?: string | null
    created_at: string
    dna?: DnaDoAmbiente | null
}
```

- [ ] **Step 5: Fábricas**

`src/features/projects/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"

import type { ClienteApi } from "@/lib/api/core"
import { cachePolicy, queryKeys } from "@/lib/query/keys"

import type { Ambiente, PaginaDeProjetos, Projeto } from "./types"

/**
 * As queries de Projetos, definidas UMA vez. O servidor chama com `apiServer`,
 * o hook com `api`. Ver `features/library/queries.ts` para o porque.
 *
 * NAO importa `@/lib/api/client` ("use client"): quem escolhe o cliente e quem
 * chama. `enabled` e `select` ficam nos hooks.
 */
export const PAGINA_PADRAO = { page: 1, size: 20 } as const

export interface Pagina {
    page: number
    size: number
}

export const queryDaListaDeProjetos = (cliente: ClienteApi, pagina: Pagina = PAGINA_PADRAO) =>
    queryOptions({
        queryKey: queryKeys.projects.list(pagina.page, pagina.size),
        queryFn: ({ signal }) =>
            cliente<PaginaDeProjetos>("/api/projects", {
                signal,
                query: { page: pagina.page, size: pagina.size },
            }),
        ...cachePolicy.transacional,
    })

export const queryDoProjeto = (cliente: ClienteApi, id: string) =>
    queryOptions({
        queryKey: queryKeys.projects.detail(id),
        queryFn: ({ signal }) => cliente<Projeto>(`/api/projects/${id}`, { signal }),
        // Um 404 nao melhora tentando de novo; os 3 retries padrao custariam
        // 3 idas a mais a 0,17 s cada na API implantada.
        retry: false,
        ...cachePolicy.transacional,
    })

export const queryDosAmbientes = (cliente: ClienteApi, projectId: string) =>
    queryOptions({
        queryKey: queryKeys.projects.environments(projectId),
        queryFn: ({ signal }) => cliente<Ambiente[]>(`/api/projects/${projectId}/environments`, { signal }),
        ...cachePolicy.transacional,
    })
```

- [ ] **Step 6: Limite**

`src/features/projects/limite.ts`:

```ts
/**
 * O estado do limite de projetos, calculado num lugar so.
 *
 * A lista de Projetos e o `ProjectsLimitCard` do Dashboard mostram a mesma
 * barra; ate aqui cada um fazia a conta, e o card dividia por `planLimit` sem
 * guarda — limite 0 dava NaN (item 9 do bloco do Dashboard no CLAUDE.md).
 *
 * Limite 0 e "no limite": o plano nao admite projeto ativo. Nao existe
 * sentinela de "ilimitado" nos entitlements (app/services/entitlements.py,
 * PADRAO com project_limit 2, lido em 15/09/2026); se um dia existir, e aqui
 * que ele entra.
 */
export interface EstadoDoLimite {
    noLimite: boolean
    /** Entre 0 e 1, para a largura da barra. */
    fracao: number
    livres: number
}

export function estadoDoLimite(ativos: number, limite: number): EstadoDoLimite {
    if (limite <= 0) return { noLimite: true, fracao: 1, livres: 0 }
    return {
        noLimite: ativos >= limite,
        fracao: Math.min(ativos / limite, 1),
        livres: Math.max(limite - ativos, 0),
    }
}
```

- [ ] **Step 7: Hooks de leitura, com a mudança de casa**

`src/features/projects/hooks.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api/client"

import { queryDaListaDeProjetos, queryDoProjeto, queryDosAmbientes } from "./queries"

export function useListaDeProjetos() {
    return useQuery(queryDaListaDeProjetos(api))
}

export function useProjeto(id: string) {
    return useQuery(queryDoProjeto(api, id))
}

export function useAmbientes(projectId: string) {
    return useQuery(queryDosAmbientes(api, projectId))
}

/**
 * Usados pelo `MoveToProjectModal` da Biblioteca. Moravam em
 * `features/library/hooks.ts` ate `features/projects` existir (nota da Secao 5
 * no PROGRESS.md). A chave `projects.list(1, 100)` e a mesma de antes.
 */
export function useProjetosParaMover(ativo: boolean) {
    return useQuery({
        ...queryDaListaDeProjetos(api, { page: 1, size: 100 }),
        enabled: ativo,
        select: (pagina) => pagina.items,
    })
}

export function useAmbientesDoProjeto(projectId: string | undefined) {
    return useQuery({
        ...queryDosAmbientes(api, projectId ?? ""),
        enabled: !!projectId,
    })
}
```

- Em `src/features/library/hooks.ts`: apague `useProjetosParaMover` e `useAmbientesDoProjeto`, e tire `listarAmbientes, listarProjetos` do import de `./api`.
- Em `src/features/library/api.ts`: apague `listarProjetos` e `listarAmbientes`.
- Em `src/components/library/MoveToProjectModal.tsx`: os dois hooks passam a vir de `"@/features/projects/hooks"`. Outros imports de `@/features/library/hooks`, se houver, ficam.

- [ ] **Step 8: Rodar**

```bash
npx vitest run src/__tests__/projects-queries.test.ts src/__tests__/query-keys.test.ts
grep -rn "listarProjetos\|listarAmbientes" src   # sem saida
npm run typecheck && npm test
```
Esperado: os dois arquivos PASS; o grep sem saída; typecheck limpo; `npm test` com zero `failed`. Cole as duas linhas de resumo do vitest.

- [ ] **Step 9: Commit**

```bash
git add ArchSmart-web/src/lib/query/keys.ts ArchSmart-web/src/features/projects ArchSmart-web/src/features/library/hooks.ts ArchSmart-web/src/features/library/api.ts ArchSmart-web/src/components/library/MoveToProjectModal.tsx ArchSmart-web/src/__tests__/projects-queries.test.ts ArchSmart-web/src/__tests__/query-keys.test.ts
git commit -m "feat(projects): features/projects com fabricas queryOptions, limite e os hooks que saem da Biblioteca

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: A lista de Projetos no padrão novo

**Files:**
- Modify: `ArchSmart-web/src/app/(dashboard)/projects/page.tsx` (reescrita)
- Modify: `ArchSmart-web/src/app/(dashboard)/projects/ClientWizardDriver.tsx` (sai o `onSuccess` com `router.refresh()`)
- Create, em `ArchSmart-web/src/app/(dashboard)/projects/components/`: `ProjetosData.tsx`, `ProjetosContent.tsx`, `CabecalhoDeProjetos.tsx`, `ProjetosVazio.tsx`, `ProjetosComErro.tsx`, `ProjetosSkeleton.tsx`
- Test: `ArchSmart-web/src/__tests__/projetos-data.test.tsx`, `ArchSmart-web/src/__tests__/projetos-lista.test.tsx`

**Interfaces:**
- Consumes: `queryDaListaDeProjetos`, `useListaDeProjetos`, `estadoDoLimite`, `PaginaDeProjetos` (Tarefa 3); `Me` de `@/features/account/types`.
- Produces: `data-testid` `projetos-pagina` (com dados), `projetos-vazio`, `projetos-error`, `projetos-shell-streaming`. A Tarefa 12 espera por um dos três primeiros.

**Duas quebras de paridade, deliberadas (vão no commit):** (1) erro de rede deixa de virar lista vazia em silêncio e vira estado de erro com "Tentar de novo"; (2) o contador de ativos lê `active_count` da API em vez de contar a página. E um ajuste de layout: `p-8` vira `p-4 md:p-8`, como no Dashboard — o `p-8` fixo é a causa medida do estouro de 42px da Biblioteca em 390px.

- [ ] **Step 1: Teste do servidor**

`src/__tests__/projetos-data.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"

const PAGINA = { items: [], total: 0, page: 1, size: 20, pages: 0, plan_limit: 3, active_count: 0 }
const apiServerMock = vi.fn()
vi.mock("@/lib/api/server", () => ({ apiServer: (...args: unknown[]) => apiServerMock(...args) }))
vi.mock("@/app/(dashboard)/projects/components/ProjetosContent", () => ({
    ProjetosContent: () => null,
}))

type Elemento = {
    props: { state: { queries: { queryKey: unknown }[] }; children: { props: { planLimit?: number } } }
}

beforeEach(() => {
    apiServerMock.mockReset()
})

describe("ProjetosData", () => {
    it("prefetcha a lista pela fabrica, le o limite de /me, e hidrata so a lista", async () => {
        apiServerMock.mockImplementation(async (path: string) =>
            path === "/api/users/me" ? { entitlements: { project_limit: 3 } } : PAGINA,
        )
        const { ProjetosData } = await import("@/app/(dashboard)/projects/components/ProjetosData")

        const elemento = (await ProjetosData()) as Elemento

        expect(apiServerMock.mock.calls.map((c) => c[0]).sort()).toEqual(["/api/projects", "/api/users/me"])
        expect(elemento.props.state.queries.map((q) => q.queryKey)).toEqual([queryKeys.projects.list(1, 20)])
        expect(elemento.props.children.props.planLimit).toBe(3)
    })

    it("se /me falhar, planLimit fica undefined — a tela nao inventa numero", async () => {
        apiServerMock.mockImplementation(async (path: string) => {
            if (path === "/api/users/me") throw new Error("fora do ar")
            return PAGINA
        })
        const { ProjetosData } = await import("@/app/(dashboard)/projects/components/ProjetosData")

        const elemento = (await ProjetosData()) as Elemento

        expect(elemento.props.children.props.planLimit).toBeUndefined()
    })
})
```

- [ ] **Step 2: Teste da tela**

`src/__tests__/projetos-lista.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"
import type { PaginaDeProjetos, Projeto } from "@/features/projects/types"
import { ProjetosContent } from "@/app/(dashboard)/projects/components/ProjetosContent"

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "tok" }))
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/projects",
}))

function projeto(parcial: Partial<Projeto> = {}): Projeto {
    return {
        id: "p1",
        account_id: "a",
        client_id: "c",
        name: "Casa Jardim",
        status: "ACTIVE",
        created_at: "2026-09-01T10:00:00",
        environments_count: 2,
        client: { id: "c", name: "Ana" },
        ...parcial,
    }
}

function pagina(parcial: Partial<PaginaDeProjetos> = {}): PaginaDeProjetos {
    return { items: [projeto()], total: 1, page: 1, size: 20, pages: 1, plan_limit: 3, active_count: 1, ...parcial }
}

function renderizar(dados: PaginaDeProjetos | undefined, planLimit?: number) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    if (dados) client.setQueryData(queryKeys.projects.list(1, 20), dados)
    return render(
        <QueryClientProvider client={client}>
            <ProjetosContent planLimit={planLimit} />
        </QueryClientProvider>,
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("ProjetosContent", () => {
    it("com dados, mostra os cards, o contador e o botao Novo Projeto abaixo do limite", () => {
        renderizar(pagina(), 3)
        expect(screen.getByTestId("projetos-pagina")).toBeInTheDocument()
        expect(screen.getByText("Casa Jardim")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /novo projeto/i })).toHaveAttribute("href", "/projects?action=new")
        expect(screen.getByText("1/3")).toBeInTheDocument()
    })

    it("o limite usa active_count da API, nao os itens da pagina", () => {
        // Um item na pagina, mas 3 ativos na conta: esta no limite.
        renderizar(pagina({ active_count: 3 }), 3)
        expect(screen.getByText("3/3")).toBeInTheDocument()
        expect(screen.queryByRole("link", { name: /novo projeto/i })).not.toBeInTheDocument()
    })

    it("sem planLimit nao mostra contador nem inventa limite", () => {
        renderizar(pagina(), undefined)
        expect(screen.queryByText("1/3")).not.toBeInTheDocument()
        expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument()
        expect(screen.getByRole("link", { name: /novo projeto/i })).toBeInTheDocument()
    })

    it("pagina vazia vira o estado vazio, com o cabecalho", () => {
        renderizar(pagina({ items: [], total: 0, active_count: 0 }), 3)
        expect(screen.getByTestId("projetos-vazio")).toBeInTheDocument()
        expect(screen.getByRole("heading", { name: "Projetos" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /criar primeiro projeto/i })).toBeInTheDocument()
    })

    it("erro da API vira estado de erro com a frase dela — nao lista vazia", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ detail: "Servico indisponivel." }), {
                    status: 503,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        )
        renderizar(undefined, 3)
        const erro = await screen.findByTestId("projetos-error")
        expect(erro).toHaveTextContent("Servico indisponivel.")
        expect(screen.getByRole("button", { name: /tentar de novo/i })).toBeInTheDocument()
        expect(screen.queryByTestId("projetos-vazio")).not.toBeInTheDocument()
    })
})
```

- [ ] **Step 3: Rodar**

Run: `npx vitest run src/__tests__/projetos-data.test.tsx src/__tests__/projetos-lista.test.tsx`
Esperado: FAIL — os módulos de `projects/components/` não existem.

- [ ] **Step 4: Os componentes**

`components/ProjetosData.tsx`:

```tsx
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { apiServer } from "@/lib/api/server"
import { clienteComSinal, criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { queryDaListaDeProjetos } from "@/features/projects/queries"
import type { Me } from "@/features/account/types"

import { ProjetosContent } from "./ProjetosContent"

/**
 * Busca no servidor e entrega hidratado, dentro do <Suspense> de page.tsx.
 *
 * EXCECAO ESCRITA (decisao 2 da spec de Projetos): `/api/users/me` e chamado
 * por `apiServer` direto, fora das fabricas, e NAO e hidratado — so o
 * `project_limit` desce, como prop. Vale so para `/me` e so ate uma tela criar
 * `features/account/queries.ts`. Orcamento e Financeiro nao estao cobertos.
 *
 * As duas correm em paralelo: a API hiberna no free tier do Render (41,9 s num
 * cold start, ADR 0009), e um segundo await sequencial dobraria a exposicao.
 */
export async function ProjetosData() {
    const queryClient = criarQueryClientDoServidor()

    const [, me] = await Promise.all([
        tentarPrefetch((signal) =>
            queryClient.prefetchQuery(queryDaListaDeProjetos(clienteComSinal(apiServer, signal))),
        ),
        apiServer<Me>("/api/users/me").catch(() => undefined),
    ])

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ProjetosContent planLimit={me?.entitlements?.project_limit} />
        </HydrationBoundary>
    )
}
```

`components/CabecalhoDeProjetos.tsx`:

```tsx
import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { UpgradeAlertModal } from "@/components/projects/UpgradeAlertModal"
import { estadoDoLimite } from "@/features/projects/limite"

/**
 * `ativos` vem de `active_count` da API — nunca contado sobre a pagina.
 * Sem `planLimit` (a chamada a /me falhou) nao ha contador nem modal: a tela
 * nao inventa limite (Art. 3). "Plano Solo" continua fixo: recusado por
 * escrito na spec de Projetos, decisao 2.
 */
export function CabecalhoDeProjetos({ ativos, planLimit }: { ativos: number; planLimit?: number }) {
    const limite = planLimit === undefined ? undefined : estadoDoLimite(ativos, planLimit)

    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <div className="mb-1 flex flex-wrap items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight">Projetos</h2>

                    {limite && (
                        <div className="flex items-center gap-3 rounded-full border bg-muted/40 px-3 py-1.5 shadow-sm">
                            <span className="hidden text-xs font-medium text-muted-foreground sm:inline-block">
                                Plano Solo
                            </span>
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                <div
                                    className={`h-full ${limite.noLimite ? "bg-destructive" : "bg-primary"} transition-all duration-500`}
                                    style={{ width: `${limite.fracao * 100}%` }}
                                />
                            </div>
                            <span className={`text-xs font-bold ${limite.noLimite ? "text-destructive" : "text-primary"}`}>
                                {ativos}/{planLimit}
                            </span>
                        </div>
                    )}
                </div>

                <p className="text-muted-foreground">Acompanhe seus projetos, ambientes e faturamento centralizados.</p>
            </div>

            <div className="flex items-center gap-2">
                {limite?.noLimite && planLimit !== undefined ? (
                    <UpgradeAlertModal planLimit={planLimit} />
                ) : (
                    <Button asChild>
                        <Link href="/projects?action=new">
                            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Novo Projeto
                        </Link>
                    </Button>
                )}
            </div>
        </div>
    )
}
```

`components/ProjetosVazio.tsx`:

```tsx
import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ProjetosVazio() {
    return (
        <div
            data-testid="projetos-vazio"
            className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 py-20"
        >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Plus className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Nenhum projeto ainda</h3>
            <p className="mb-6 max-w-sm text-center text-muted-foreground">
                Comece criando seu primeiro projeto arquitetônico e vincule o seu cliente.
            </p>
            <Button asChild>
                <Link href="/projects?action=new">Criar Primeiro Projeto</Link>
            </Button>
        </div>
    )
}
```

`components/ProjetosComErro.tsx`:

```tsx
"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Erro vira estado na tela. Quebra de paridade DE PROPOSITO: antes, o `catch`
 * de `getProjects` devolvia `{ items: [] }` e a tela dizia "Nenhum projeto
 * ainda" para quem tinha projetos e so estava sem rede. A frase vem de
 * `lib/api/errors.ts`.
 */
export function ProjetosComErro({ erro, refazer }: { erro: Error; refazer: () => void }) {
    return (
        <div
            data-testid="projetos-error"
            role="alert"
            className="flex w-full flex-col items-center justify-center gap-3 py-16 text-center"
        >
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="font-medium text-foreground">Não foi possível carregar os projetos.</p>
            <p className="max-w-sm text-sm text-muted-foreground">{erro.message}</p>
            <Button variant="outline" onClick={refazer}>
                Tentar de novo
            </Button>
        </div>
    )
}
```

`components/ProjetosSkeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export function ProjetosSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 w-full rounded-xl" />
                ))}
            </div>
        </div>
    )
}
```

`components/ProjetosContent.tsx`:

```tsx
"use client"

import { ProjectCard } from "@/components/projects/ProjectCard"
import { QueryBoundary } from "@/components/ui/query-boundary"
import { useListaDeProjetos } from "@/features/projects/hooks"
import type { PaginaDeProjetos } from "@/features/projects/types"

import { CabecalhoDeProjetos } from "./CabecalhoDeProjetos"
import { ProjetosComErro } from "./ProjetosComErro"
import { ProjetosSkeleton } from "./ProjetosSkeleton"
import { ProjetosVazio } from "./ProjetosVazio"

function Lista({ pagina, planLimit }: { pagina: PaginaDeProjetos; planLimit?: number }) {
    return (
        <div data-testid="projetos-pagina" className="flex flex-col gap-6">
            <CabecalhoDeProjetos ativos={pagina.active_count} planLimit={planLimit} />
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pagina.items.map((projeto) => (
                    <ProjectCard
                        key={projeto.id}
                        id={projeto.id}
                        name={projeto.name}
                        clientName={projeto.client?.name}
                        status={projeto.status}
                        serviceType={projeto.service_type ?? undefined}
                        createdAt={projeto.created_at}
                        environmentsCount={projeto.environments_count}
                    />
                ))}
            </div>
        </div>
    )
}

/**
 * Uma requisicao, uma regiao `principal`. O vazio padrao do `QueryBoundary`
 * ja reconhece pagina (`items` vazio), entao `isEmpty` nao e passado.
 * O vazio leva o cabecalho junto: quem nao tem projeto precisa do botao.
 */
export function ProjetosContent({ planLimit }: { planLimit?: number }) {
    const query = useListaDeProjetos()

    return (
        <div className="flex h-full flex-col p-4 md:p-8">
            <QueryBoundary
                query={query}
                principal
                skeleton={<ProjetosSkeleton />}
                empty={
                    <>
                        <CabecalhoDeProjetos ativos={query.data?.active_count ?? 0} planLimit={planLimit} />
                        <ProjetosVazio />
                    </>
                }
                error={(erro, refazer) => <ProjetosComErro erro={erro} refazer={refazer} />}
            >
                {(pagina) => <Lista pagina={pagina} planLimit={planLimit} />}
            </QueryBoundary>
        </div>
    )
}
```

- [ ] **Step 5: A página e o driver do wizard**

`page.tsx` (substitui o arquivo inteiro):

```tsx
import { Suspense } from "react"

import { ClientWizardDriver } from "./ClientWizardDriver"
import { ProjetosData } from "./components/ProjetosData"
import { ProjetosSkeleton } from "./components/ProjetosSkeleton"

/**
 * Server Component. O fallback e o SERVIDOR fazendo stream; o skeleton do
 * QueryBoundary, dentro de ProjetosContent, e o CLIENTE carregando — por isso
 * o testid do wrapper e outro (ver dashboard/page.tsx).
 *
 * O wizard continua dirigido por `?action=new` e fica FORA do Suspense: abrir o
 * dialogo nao espera a lista.
 */
export default async function ProjectsPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams

    return (
        <>
            <Suspense
                fallback={
                    <div data-testid="projetos-shell-streaming" className="p-4 md:p-8">
                        <ProjetosSkeleton />
                    </div>
                }
            >
                <ProjetosData />
            </Suspense>
            <ClientWizardDriver isOpen={searchParams.action === "new"} />
        </>
    )
}
```

Em `ClientWizardDriver.tsx`: apague `handleSuccess` e a prop `onSuccess={handleSuccess}`. A lista lê do cache, e quem a atualiza depois de criar é a invalidação da Tarefa 6. (O `ProjectWizard` continua chamando `router.refresh()` por conta própria, pelo motivo escrito na Tarefa 6.)

- [ ] **Step 6: Rodar**

```bash
npx vitest run src/__tests__/projetos-data.test.tsx src/__tests__/projetos-lista.test.tsx
npx eslint "src/app/(dashboard)/projects/page.tsx" "src/app/(dashboard)/projects/components" "src/app/(dashboard)/projects/ClientWizardDriver.tsx"
npm run typecheck && npm test
```
Esperado: PASS nos dois; eslint sem erro nem aviso nesses arquivos; typecheck limpo; `npm test` sem `failed`.

- [ ] **Step 7: Catraca**

Run (da raiz): `python tools/catraca.py`
Esperado: `fetch_fora_de_lib_api` **73** (saiu 1, o da lista). Anote qualquer outra medida que mudar. Então:

```bash
python tools/catraca.py --atualizar
cd tools && python -m unittest discover -p "test_*.py"; cd ..
```
Esperado: grava **sem** `--aceitar-piora`; unittest `OK`. Se um teste de `tools/` tiver o 74 fixo e reprovar, ajuste-o **neste commit**.

- [ ] **Step 8: Olhar a tela rodando (por agente)**

Com API local e `npm run dev`, abrir `/projects` com a conta de teste, capturar em 1440px e 390px, e confirmar: os cards aparecem; o contador bate com `active_count` da resposta; nenhuma requisição a `/api/projects` sai do navegador no primeiro carregamento (`page.on("request")`). Registrar nas notas da tarefa com o rótulo de passada por agente.

- [ ] **Step 9: Commit**

```bash
git add "ArchSmart-web/src/app/(dashboard)/projects/page.tsx" "ArchSmart-web/src/app/(dashboard)/projects/ClientWizardDriver.tsx" "ArchSmart-web/src/app/(dashboard)/projects/components" ArchSmart-web/src/__tests__/projetos-data.test.tsx ArchSmart-web/src/__tests__/projetos-lista.test.tsx tools/
git commit -m "feat(projects): lista no padrao novo — prefetch, QueryBoundary e active_count da API

Quebras de paridade deliberadas: erro deixa de virar lista vazia em silencio;
o contador de ativos le active_count em vez de contar a pagina 1 de 20.
/api/users/me segue por apiServer direto (decisao 2 da spec).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: O detalhe do projeto no padrão novo

**Files:**
- Modify: `ArchSmart-web/src/app/(dashboard)/projects/[id]/page.tsx` (reescrita)
- Create, em `ArchSmart-web/src/app/(dashboard)/projects/[id]/components/`: `ProjetoData.tsx`, `ProjetoContent.tsx`, `ProjetoComErro.tsx`
- Modify: `ArchSmart-web/src/components/projects/ProjectHeader.tsx` (tipo da prop)
- Modify: `ArchSmart-web/src/components/projects/environments/EnvironmentsWorkspace.tsx` (lê a lista por prop, sem cópia em `useState`)
- Test: `ArchSmart-web/src/__tests__/projeto-data.test.tsx`, `ArchSmart-web/src/__tests__/projeto-detalhe.test.tsx`

**Interfaces:**
- Consumes: `queryDoProjeto`, `queryDosAmbientes`, `useProjeto`, `useAmbientes`, `Projeto`, `Ambiente` (Tarefa 3); `ApiError` de `@/lib/api/errors`.
- Produces:
  - `EnvironmentsWorkspace({ projectId: string; ambientes: Ambiente[] })` — **a prop `initialEnvironments` deixa de existir**. A Tarefa 7 tira os três `handle*` que esta tarefa deixa atualizando o cache à mão.
  - `ProjectHeader({ project: Projeto; activeTab? })` — `budget/page.tsx` e `presentation/page.tsx` continuam passando o JSON cru do servidor, que é compatível.
  - `data-testid` `projeto-cabecalho`, `projeto-ambientes`, `projeto-error`, `projeto-shell-streaming`.

**O `notFound()`:** fica no servidor, mas agora **dentro** do `<Suspense>` — a resposta vai com status 200 e a UI de não encontrado, não 404 (nota revisada da spec, "Detalhe"). Se o prefetch desistir por tempo, o 404 chega ao cliente e vira o estado de erro com a frase da API.

**Duas regiões:** o cabeçalho (projeto) e os ambientes, marcados `principal`. O `load_ms` da tela é o dos ambientes.

- [ ] **Step 1: Teste do servidor**

`src/__tests__/projeto-data.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/query/keys"

const apiServerMock = vi.fn()
vi.mock("@/lib/api/server", () => ({ apiServer: (...args: unknown[]) => apiServerMock(...args) }))
vi.mock("@/app/(dashboard)/projects/[id]/components/ProjetoContent", () => ({
    ProjetoContent: () => null,
}))

const notFound = vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
})
vi.mock("next/navigation", () => ({ notFound: () => notFound() }))

beforeEach(() => {
    apiServerMock.mockReset()
    notFound.mockClear()
})

describe("ProjetoData", () => {
    it("prefetcha projeto e ambientes pelas fabricas, e hidrata os dois", async () => {
        apiServerMock.mockImplementation(async (path: string) =>
            path.endsWith("/environments") ? [] : { id: "p1", name: "Casa" },
        )
        const { ProjetoData } = await import("@/app/(dashboard)/projects/[id]/components/ProjetoData")

        const elemento = (await ProjetoData({ id: "p1" })) as {
            props: { state: { queries: { queryKey: unknown }[] } }
        }

        expect(apiServerMock.mock.calls.map((c) => c[0]).sort()).toEqual([
            "/api/projects/p1",
            "/api/projects/p1/environments",
        ])
        const chaves = elemento.props.state.queries.map((q) => JSON.stringify(q.queryKey)).sort()
        expect(chaves).toEqual(
            [queryKeys.projects.detail("p1"), queryKeys.projects.environments("p1")].map((k) => JSON.stringify(k)).sort(),
        )
        expect(notFound).not.toHaveBeenCalled()
    })

    it("404 da API no projeto vira notFound() da rota", async () => {
        apiServerMock.mockImplementation(async (path: string) => {
            if (path.endsWith("/environments")) throw new ApiError(404, "Não encontrado.", "Não encontrado.", false)
            throw new ApiError(404, "Não encontrado.", "Não encontrado.", false)
        })
        const { ProjetoData } = await import("@/app/(dashboard)/projects/[id]/components/ProjetoData")

        await expect(ProjetoData({ id: "sumido" })).rejects.toThrow("NEXT_NOT_FOUND")
        expect(notFound).toHaveBeenCalledTimes(1)
    })

    it("erro que nao e 404 NAO vira notFound — degrada para o cliente buscar", async () => {
        apiServerMock.mockImplementation(async () => {
            throw new ApiError(503, "Indisponivel.", "Indisponivel.", false)
        })
        const { ProjetoData } = await import("@/app/(dashboard)/projects/[id]/components/ProjetoData")

        await ProjetoData({ id: "p1" })

        expect(notFound).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Teste da tela**

`src/__tests__/projeto-detalhe.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"
import type { Ambiente, Projeto } from "@/features/projects/types"
import { ProjetoContent } from "@/app/(dashboard)/projects/[id]/components/ProjetoContent"

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "tok" }))
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/projects/p1",
}))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

const PROJETO: Projeto = {
    id: "p1",
    account_id: "a",
    client_id: "c",
    name: "Casa Jardim",
    status: "ACTIVE",
    created_at: "2026-09-01T10:00:00",
    environments_count: 1,
    client: { id: "c", name: "Ana" },
}

const SALA: Ambiente = {
    id: "e1",
    project_id: "p1",
    name: "Sala de Estar",
    type: "Interna/Seca",
    created_at: "2026-09-01T10:00:00",
    dna: { id: "d1", environment_id: "e1", floor_area: 10, wall_area: 20, ceiling_area: 10, is_complete: true },
}

function renderizar(projeto?: Projeto, ambientes?: Ambiente[]) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    if (projeto) client.setQueryData(queryKeys.projects.detail("p1"), projeto)
    if (ambientes) client.setQueryData(queryKeys.projects.environments("p1"), ambientes)
    return render(
        <QueryClientProvider client={client}>
            <ProjetoContent id="p1" />
        </QueryClientProvider>,
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("ProjetoContent", () => {
    it("com dados, mostra o cabecalho do projeto e os ambientes", () => {
        renderizar(PROJETO, [SALA])
        expect(screen.getByRole("heading", { name: "Casa Jardim" })).toBeInTheDocument()
        expect(screen.getByText("Ana")).toBeInTheDocument()
        expect(screen.getByText("Sala de Estar")).toBeInTheDocument()
    })

    it("sem ambientes, mostra o vazio proprio do workspace, com o botao de adicionar", () => {
        renderizar(PROJETO, [])
        expect(screen.getByText("Construa o projeto")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /adicionar primeiro ambiente/i })).toBeInTheDocument()
    })

    it("erro ao buscar o projeto vira estado de erro com a frase da API", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ detail: "Projeto não encontrado." }), {
                    status: 404,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        )
        renderizar(undefined, [SALA])
        const erro = await screen.findByTestId("projeto-error")
        expect(erro).toHaveTextContent("Projeto não encontrado.")
    })
})
```

- [ ] **Step 3: Rodar**

Run: `npx vitest run src/__tests__/projeto-data.test.tsx src/__tests__/projeto-detalhe.test.tsx`
Esperado: FAIL — os módulos de `[id]/components/Projeto*` não existem.

- [ ] **Step 4: Os componentes**

`[id]/components/ProjetoData.tsx`:

```tsx
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { notFound } from "next/navigation"

import { apiServer } from "@/lib/api/server"
import { ApiError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/query/keys"
import { clienteComSinal, criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { queryDoProjeto, queryDosAmbientes } from "@/features/projects/queries"

import { ProjetoContent } from "./ProjetoContent"

/**
 * Projeto e ambientes em paralelo — o page.tsx antigo fazia os dois `fetch` em
 * sequencia.
 *
 * 404 da API vira `notFound()`: projeto de outra conta tambem responde 404
 * (ScopedRepository.obter, nunca 403), e a rota nao pode mostrar skeleton nem
 * "erro, tente de novo" para um id que nao existe para quem pergunta. Chamado
 * DENTRO do <Suspense>, entao a resposta sai 200 com a UI de nao encontrado
 * (nota revisada da spec de Projetos, "Detalhe").
 *
 * `dehydrate` so leva query com sucesso: um erro que nao seja 404 nao desce,
 * e o cliente busca de novo — o mesmo caminho de quando o prefetch desiste.
 */
export async function ProjetoData({ id }: { id: string }) {
    const queryClient = criarQueryClientDoServidor()

    await tentarPrefetch((signal) => {
        const cliente = clienteComSinal(apiServer, signal)
        return Promise.all([
            queryClient.prefetchQuery(queryDoProjeto(cliente, id)),
            queryClient.prefetchQuery(queryDosAmbientes(cliente, id)),
        ])
    })

    const erro = queryClient.getQueryState(queryKeys.projects.detail(id))?.error
    if (erro instanceof ApiError && erro.status === 404) notFound()

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ProjetoContent id={id} />
        </HydrationBoundary>
    )
}
```

`[id]/components/ProjetoComErro.tsx`:

```tsx
"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ProjetoComErro({ erro, refazer }: { erro: Error; refazer: () => void }) {
    return (
        <div
            data-testid="projeto-error"
            role="alert"
            className="flex w-full flex-col items-center justify-center gap-3 py-16 text-center"
        >
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="font-medium text-foreground">Não foi possível carregar o projeto.</p>
            <p className="max-w-sm text-sm text-muted-foreground">{erro.message}</p>
            <div className="flex gap-2">
                <Button variant="outline" onClick={refazer}>
                    Tentar de novo
                </Button>
                <Button variant="ghost" asChild>
                    <Link href="/projects">Voltar para Projetos</Link>
                </Button>
            </div>
        </div>
    )
}
```

`[id]/components/ProjetoContent.tsx`:

```tsx
"use client"

import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { EnvironmentsWorkspace } from "@/components/projects/environments/EnvironmentsWorkspace"
import { QueryBoundary } from "@/components/ui/query-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { useAmbientes, useProjeto } from "@/features/projects/hooks"

import { ProjetoComErro } from "./ProjetoComErro"

function CabecalhoSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
        </div>
    )
}

function AmbientesSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
        </div>
    )
}

/**
 * Duas regioes. Os ambientes sao a `principal`: e o conteudo da aba, e o que
 * decide `load_ms` e `is_empty`. O vazio dos ambientes renderiza o proprio
 * workspace com lista vazia, porque o estado vazio dele tem o botao de
 * adicionar — mesma paridade da tela antiga.
 *
 * O objeto do projeto nunca e "vazio" (`vazioPorPadrao` so chuta array e
 * pagina), entao o `empty` do cabecalho nao e alcancavel e fica `null`.
 */
export function ProjetoContent({ id }: { id: string }) {
    const projeto = useProjeto(id)
    const ambientes = useAmbientes(id)

    return (
        <div className="flex h-full flex-col space-y-6 p-4 md:p-8">
            <div data-testid="projeto-cabecalho">
                <QueryBoundary
                    query={projeto}
                    skeleton={<CabecalhoSkeleton />}
                    empty={null}
                    error={(erro, refazer) => <ProjetoComErro erro={erro} refazer={refazer} />}
                >
                    {(dados) => <ProjectHeader project={dados} activeTab="ambientes" />}
                </QueryBoundary>
            </div>

            <div data-testid="projeto-ambientes" className="mt-6 flex-1">
                <QueryBoundary
                    query={ambientes}
                    principal
                    skeleton={<AmbientesSkeleton />}
                    empty={<EnvironmentsWorkspace projectId={id} ambientes={[]} />}
                    error={(erro, refazer) => <ProjetoComErro erro={erro} refazer={refazer} />}
                >
                    {(lista) => <EnvironmentsWorkspace projectId={id} ambientes={lista} />}
                </QueryBoundary>
            </div>
        </div>
    )
}
```

- [ ] **Step 5: A página**

`[id]/page.tsx` (substitui o arquivo inteiro):

```tsx
import { Suspense } from "react"

import { ProjectWorkspaceSkeleton } from "@/components/projects/ProjectWorkspaceSkeleton"

import { ProjetoData } from "./components/ProjetoData"

export default async function ProjectWorkspacePage(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params

    return (
        <Suspense
            fallback={
                <div data-testid="projeto-shell-streaming">
                    <ProjectWorkspaceSkeleton />
                </div>
            }
        >
            <ProjetoData id={id} />
        </Suspense>
    )
}
```

O `[id]/loading.tsx` continua: ele cobre a troca de aba entre rotas irmãs (Orçamento, Apresentação), e o `<Suspense>` acima cobre o stream desta rota.

- [ ] **Step 6: `ProjectHeader` tipado**

Em `src/components/projects/ProjectHeader.tsx`: `import type { Projeto } from "@/features/projects/types"`, e a interface passa a ser `project: Projeto;`. Rode `npm run typecheck`; se `budget/page.tsx` ou `presentation/page.tsx` reclamarem (eles passam `any`, então não devem), **não** mexa neles para tipar — registre e pare, é tela de outra tarefa.

- [ ] **Step 7: `EnvironmentsWorkspace` sem cópia de estado**

Substitua o topo do componente (props, estados e handlers) por:

```tsx
"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Ambiente } from "@/features/projects/types"
import { queryKeys } from "@/lib/query/keys"

import { DNAEditorSheet } from "./DNAEditorSheet"
import { EnvironmentCard } from "./EnvironmentCard"
import { NewEnvironmentModal } from "./NewEnvironmentModal"

interface EnvironmentsWorkspaceProps {
    projectId: string
    ambientes: Ambiente[]
}

export function EnvironmentsWorkspace({ projectId, ambientes }: EnvironmentsWorkspaceProps) {
    const [isNewModalOpen, setIsNewModalOpen] = useState(false)
    const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null)
    const queryClient = useQueryClient()

    // PROVISORIO ate a Tarefa 7: os modais ainda fazem `fetch` e devolvem o
    // ambiente por callback. Em vez da copia em useState (que era a fonte da
    // tela), a mesma atualizacao local vai direto no cache de onde a tela le.
    // A Tarefa 7 troca isto por invalidacao e apaga os tres handlers.
    const chave = queryKeys.projects.environments(projectId)
    const handleEnvironmentAdded = (novo: Ambiente) =>
        queryClient.setQueryData<Ambiente[]>(chave, (atual = []) => [...atual, novo])
    const handleEnvironmentUpdated = (atualizado: Ambiente) =>
        queryClient.setQueryData<Ambiente[]>(chave, (atual = []) =>
            atual.map((a) => (a.id === atualizado.id ? atualizado : a)),
        )
    const handleEnvironmentDeleted = (id: string) =>
        queryClient.setQueryData<Ambiente[]>(chave, (atual = []) => atual.filter((a) => a.id !== id))

    const selectedEnv = ambientes.find((e) => e.id === selectedEnvId)
```

E no JSX, troque as duas leituras de `environments` por `ambientes` (`ambientes.length > 0` e `ambientes.map(env => ...)`). O resto do JSX não muda.

- [ ] **Step 8: Rodar**

```bash
npx vitest run src/__tests__/projeto-data.test.tsx src/__tests__/projeto-detalhe.test.tsx
npx eslint "src/app/(dashboard)/projects/[id]/page.tsx" "src/app/(dashboard)/projects/[id]/components/Projeto*.tsx" src/components/projects/ProjectHeader.tsx src/components/projects/environments/EnvironmentsWorkspace.tsx
npm run typecheck && npm test
python ../tools/catraca.py
```
Esperado: PASS; eslint sem erro; typecheck limpo; `npm test` sem `failed`; `fetch_fora_de_lib_api` **71** (saíram os 2 do detalhe). Então `python ../tools/catraca.py --atualizar` e `cd ../tools && python -m unittest discover -p "test_*.py"`.

- [ ] **Step 9: Olhar rodando (por agente)**

Com API local e `npm run dev`: abrir `/projects/<id de um projeto da conta de teste>`, criar um ambiente, apagar esse ambiente, editar o DNA de outro, e confirmar que a lista reflete cada ação **sem recarregar a página**. Abrir `/projects/00000000-0000-0000-0000-000000000000` e confirmar a UI de não encontrado. Registrar com o rótulo de passada por agente.

- [ ] **Step 10: Commit**

```bash
git add "ArchSmart-web/src/app/(dashboard)/projects/[id]/page.tsx" "ArchSmart-web/src/app/(dashboard)/projects/[id]/components/ProjetoData.tsx" "ArchSmart-web/src/app/(dashboard)/projects/[id]/components/ProjetoContent.tsx" "ArchSmart-web/src/app/(dashboard)/projects/[id]/components/ProjetoComErro.tsx" ArchSmart-web/src/components/projects/ProjectHeader.tsx ArchSmart-web/src/components/projects/environments/EnvironmentsWorkspace.tsx ArchSmart-web/src/__tests__/projeto-data.test.tsx ArchSmart-web/src/__tests__/projeto-detalhe.test.tsx tools/
git commit -m "feat(projects): detalhe no padrao novo — projeto e ambientes em paralelo, notFound no servidor

O notFound agora roda dentro do Suspense: status 200 com a UI de nao
encontrado, nao 404 (nota revisada da spec).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Mutações de projeto — criar, editar, mudar status, excluir

**Files:**
- Create: `ArchSmart-web/src/features/projects/api.ts`
- Create: `ArchSmart-web/src/features/projects/invalidacao.ts`
- Modify: `ArchSmart-web/src/features/projects/hooks.ts` (acrescenta quatro hooks)
- Modify: `ArchSmart-web/src/components/projects/ProjectWizard.tsx`
- Modify: `ArchSmart-web/src/components/projects/ProjectStatusSelect.tsx`
- Modify: `ArchSmart-web/src/components/projects/DeleteProjectAlert.tsx`
- Test: `ArchSmart-web/src/__tests__/projects-mutacoes.test.tsx` (novo)
- Test: `ArchSmart-web/src/__tests__/project-wizard.test.tsx` (ajuste deliberado, ver Step 7)

**Interfaces:**
- Consumes: `queryKeys` (Tarefa 3), `ApiError` de `@/lib/api/errors`.
- Produces:
  - `efeitos.criarProjeto()`, `efeitos.editarProjeto(id)`, `efeitos.excluirProjeto(id)`, `efeitos.mudarAmbientes(projectId)`, `efeitos.salvarDna(projectId)` — cada um devolve `EfeitoNoCache = { invalidar: QueryKey[]; descartar: QueryKey[] }`; e `aplicarEfeito(queryClient, efeito): Promise<void>`. **A Tarefa 7 usa `mudarAmbientes` e `salvarDna`**, que esta tarefa já define.
  - hooks `useCriarProjeto()`, `useEditarProjeto()`, `useMudarStatusDoProjeto()`, `useExcluirProjeto()`.

**`invalidar` vs. `descartar`.** `invalidar` marca obsoleto **e** rebusca o que estiver na tela. `descartar` marca obsoleto **sem** rebuscar (`refetchType: "none"`). Excluir projeto descarta detalhe e ambientes: a query do detalhe ainda está montada no instante do sucesso, e rebuscá-la daria 404 e piscaria o estado de erro durante a navegação para `/projects`. Se o usuário voltar pelo histórico, a query obsoleta rebusca e mostra o erro — que é o certo. (Por que não `removeQueries`: numa query com observador montado ele não tem comportamento documentado no react-query v5, e `refetchType: "none"` tem — a nota revisada da spec registra isso.)

**`router.refresh()` fica nas três telas desta tarefa** (nota revisada da spec, "Mutações"): Orçamento e Apresentações renderizam `ProjectHeader` com dado do servidor.

- [ ] **Step 1: Testes dos hooks**

`src/__tests__/projects-mutacoes.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"
import {
    useCriarProjeto,
    useEditarProjeto,
    useExcluirProjeto,
    useMudarStatusDoProjeto,
} from "@/features/projects/hooks"

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "tok" }))

/**
 * Cada mutacao afirma o CONJUNTO EXATO de chaves que invalida e descarta.
 * Conjunto, nao "contem": acrescentar uma chave a mais (custo de rede a 0,17 s
 * por ida ao banco) reprova tanto quanto esquecer uma (tela mentindo). Foi o
 * esquecimento do Dashboard que abriu este teste: nenhuma mutacao invalidava
 * `dashboard.all` (item 7 do bloco do Dashboard no CLAUDE.md).
 */
function montar() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidadas: string[] = []
    const descartadas: string[] = []
    const original = client.invalidateQueries.bind(client)
    client.invalidateQueries = ((filtros?: { queryKey?: QueryKey; refetchType?: string }, opcoes?: unknown) => {
        const chave = JSON.stringify(filtros?.queryKey)
        if (filtros?.refetchType === "none") descartadas.push(chave)
        else invalidadas.push(chave)
        return original(filtros as never, opcoes as never)
    }) as typeof client.invalidateQueries
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return { Wrapper, invalidadas, descartadas }
}

const ordenado = (chaves: readonly QueryKey[]) => chaves.map((c) => JSON.stringify(c)).sort()

function respostaOk(corpo: unknown = { id: "p1" }, status = 200) {
    return status === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } })
}

const fetchMock = vi.fn()
beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => respostaOk())
    vi.stubGlobal("fetch", fetchMock)
})

describe("mutacoes de projeto", () => {
    it("criar: POST /api/projects; invalida lists e dashboard; nao descarta nada", async () => {
        const { Wrapper, invalidadas, descartadas } = montar()
        const { result } = renderHook(() => useCriarProjeto(), { wrapper: Wrapper })

        await result.current.mutateAsync({ name: "Novo", client_name: "Ana" } as never)

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/projects$/)
        expect(init.method).toBe("POST")
        expect(invalidadas.sort()).toEqual(ordenado([queryKeys.projects.lists(), queryKeys.dashboard.all]))
        expect(descartadas).toEqual([])
    })

    it("editar: PUT /api/projects/<id>; invalida lists, detail(id) e dashboard", async () => {
        const { Wrapper, invalidadas, descartadas } = montar()
        const { result } = renderHook(() => useEditarProjeto(), { wrapper: Wrapper })

        await result.current.mutateAsync({ id: "p1", dados: { name: "Outro" } as never })

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/projects\/p1$/)
        expect(init.method).toBe("PUT")
        expect(invalidadas.sort()).toEqual(
            ordenado([queryKeys.projects.lists(), queryKeys.projects.detail("p1"), queryKeys.dashboard.all]),
        )
        expect(descartadas).toEqual([])
    })

    it("mudar status: PUT so com status; mesmo efeito de editar", async () => {
        const { Wrapper, invalidadas } = montar()
        const { result } = renderHook(() => useMudarStatusDoProjeto(), { wrapper: Wrapper })

        await result.current.mutateAsync({ id: "p1", status: "COMPLETED" })

        const [, init] = fetchMock.mock.calls[0]
        expect(JSON.parse(init.body)).toEqual({ status: "COMPLETED" })
        expect(invalidadas.sort()).toEqual(
            ordenado([queryKeys.projects.lists(), queryKeys.projects.detail("p1"), queryKeys.dashboard.all]),
        )
    })

    it("excluir: DELETE; invalida lists e dashboard; DESCARTA detail e environments sem rebuscar", async () => {
        fetchMock.mockImplementation(async () => respostaOk(undefined, 204))
        const { Wrapper, invalidadas, descartadas } = montar()
        const { result } = renderHook(() => useExcluirProjeto(), { wrapper: Wrapper })

        await result.current.mutateAsync("p1")

        expect(fetchMock.mock.calls[0][1].method).toBe("DELETE")
        expect(invalidadas.sort()).toEqual(ordenado([queryKeys.projects.lists(), queryKeys.dashboard.all]))
        expect(descartadas.sort()).toEqual(
            ordenado([queryKeys.projects.detail("p1"), queryKeys.projects.environments("p1")]),
        )
    })

    it("falha nao invalida nada e entrega ApiError com o status", async () => {
        fetchMock.mockImplementation(async () =>
            respostaOk({ detail: "Limite do plano atingido." }, 403),
        )
        const { Wrapper, invalidadas } = montar()
        const { result } = renderHook(() => useCriarProjeto(), { wrapper: Wrapper })

        await expect(result.current.mutateAsync({ name: "X" } as never)).rejects.toMatchObject({
            status: 403,
            message: "Limite do plano atingido.",
        })
        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(invalidadas).toEqual([])
    })
})
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run src/__tests__/projects-mutacoes.test.tsx`
Esperado: FAIL — `useCriarProjeto` não é exportado por `@/features/projects/hooks`.

- [ ] **Step 3: As chamadas**

`src/features/projects/api.ts`:

```ts
import { api } from "@/lib/api/client"
import type { WizardFormValues } from "@/components/projects/project-wizard/schema"

import type { Ambiente, DnaDoAmbiente, Projeto } from "./types"

/**
 * As escritas de Projetos. As leituras moram em `queries.ts`, que nao importa
 * `@/lib/api/client` porque o servidor tambem as usa; estas so rodam no
 * navegador.
 *
 * `fallbackDeErro` e a frase que aparece quando a API nao manda uma de dominio
 * (`lib/api/errors.ts`) — as mesmas frases dos toasts de antes da migracao.
 */
export type DadosDoProjeto = WizardFormValues

const ERRO_AO_SALVAR = "Ocorreu um erro ao tentar salvar o projeto."

export function criarProjeto(dados: DadosDoProjeto): Promise<Projeto> {
    return api<Projeto>("/api/projects", { method: "POST", body: dados, fallbackDeErro: ERRO_AO_SALVAR })
}

export function editarProjeto(id: string, dados: Partial<DadosDoProjeto>): Promise<Projeto> {
    return api<Projeto>(`/api/projects/${id}`, { method: "PUT", body: dados, fallbackDeErro: ERRO_AO_SALVAR })
}

export function mudarStatusDoProjeto(id: string, status: string): Promise<Projeto> {
    return api<Projeto>(`/api/projects/${id}`, {
        method: "PUT",
        body: { status },
        fallbackDeErro: "Não foi possível atualizar o status.",
    })
}

export function excluirProjeto(id: string): Promise<void> {
    return api<void>(`/api/projects/${id}`, {
        method: "DELETE",
        fallbackDeErro: "Não foi possível excluir o projeto.",
    })
}

export interface CorpoDeAmbiente {
    name: string
    type: string
    dna: { floor_area: number; wall_area: number; ceiling_area: number }
}

export function criarAmbiente(projectId: string, corpo: CorpoDeAmbiente): Promise<Ambiente> {
    return api<Ambiente>(`/api/projects/${projectId}/environments`, {
        method: "POST",
        body: corpo,
        fallbackDeErro: "Não foi possível criar o ambiente.",
    })
}

export function excluirAmbiente(envId: string): Promise<void> {
    return api<void>(`/api/environments/${envId}`, {
        method: "DELETE",
        fallbackDeErro: "Erro ao excluir o ambiente.",
    })
}

export interface AreasDoDna {
    floor_area: number
    wall_area: number
    ceiling_area: number
}

export function salvarDna(envId: string, areas: AreasDoDna): Promise<DnaDoAmbiente> {
    return api<DnaDoAmbiente>(`/api/environments/${envId}/dna`, {
        method: "PUT",
        body: areas,
        fallbackDeErro: "Erro ao salvar as áreas.",
    })
}
```

(As três de ambiente entram aqui para o arquivo nascer inteiro; a Tarefa 7 as consome.)

- [ ] **Step 4: O mapa**

`src/features/projects/invalidacao.ts`:

```ts
import type { QueryClient, QueryKey } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query/keys"

/**
 * O que cada mutacao de Projetos faz com o cache — declarado, nao espalhado.
 *
 * `invalidar`: marca obsoleto e rebusca o que estiver montado.
 * `descartar`: marca obsoleto SEM rebuscar (`refetchType: "none"`). Existe para
 * excluir projeto: o detalhe ainda esta montado no instante do sucesso, e
 * rebusca-lo daria 404 e piscaria o estado de erro durante a navegacao.
 *
 * `dashboard.all` entra em toda mutacao que muda projeto: o Dashboard mostra
 * projetos recentes e o contador de ativos (item 7 do bloco do Dashboard).
 * Ambiente nao entra: o Dashboard nao mostra ambiente nem contagem de ambiente.
 *
 * O teste (`projects-mutacoes.test.tsx`) afirma o CONJUNTO EXATO por mutacao.
 */
export interface EfeitoNoCache {
    invalidar: QueryKey[]
    descartar: QueryKey[]
}

export const efeitos = {
    criarProjeto: (): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.lists(), queryKeys.dashboard.all],
        descartar: [],
    }),
    editarProjeto: (id: string): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.lists(), queryKeys.projects.detail(id), queryKeys.dashboard.all],
        descartar: [],
    }),
    excluirProjeto: (id: string): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.lists(), queryKeys.dashboard.all],
        descartar: [queryKeys.projects.detail(id), queryKeys.projects.environments(id)],
    }),
    /** Criar e excluir ambiente: a lista mostra `environments_count` no card. */
    mudarAmbientes: (projectId: string): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.environments(projectId), queryKeys.projects.lists()],
        descartar: [],
    }),
    salvarDna: (projectId: string): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.environments(projectId)],
        descartar: [],
    }),
}

export async function aplicarEfeito(queryClient: QueryClient, efeito: EfeitoNoCache): Promise<void> {
    await Promise.all([
        ...efeito.descartar.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" }),
        ),
        ...efeito.invalidar.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ])
}
```

- [ ] **Step 5: Os hooks**

Em `src/features/projects/hooks.ts`, troque o import do react-query por `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"`, acrescente os imports abaixo e, no fim do arquivo, os quatro hooks:

```ts
import {
    criarProjeto,
    editarProjeto,
    excluirProjeto,
    mudarStatusDoProjeto,
    type DadosDoProjeto,
} from "./api"
import { aplicarEfeito, efeitos } from "./invalidacao"
```

```ts
/**
 * Mutacoes de projeto. Quem chama continua fazendo `router.refresh()` depois do
 * sucesso — nao por causa desta tela, mas porque Orcamento e Apresentacoes
 * renderizam `ProjectHeader` com dado do SERVIDOR (nota revisada da spec de
 * Projetos, "Mutacoes"). O refresh sai quando essas duas telas migrarem.
 */
export function useCriarProjeto() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (dados: DadosDoProjeto) => criarProjeto(dados),
        onSuccess: () => aplicarEfeito(queryClient, efeitos.criarProjeto()),
    })
}

export function useEditarProjeto() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, dados }: { id: string; dados: Partial<DadosDoProjeto> }) => editarProjeto(id, dados),
        onSuccess: (_projeto, { id }) => aplicarEfeito(queryClient, efeitos.editarProjeto(id)),
    })
}

export function useMudarStatusDoProjeto() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => mudarStatusDoProjeto(id, status),
        onSuccess: (_projeto, { id }) => aplicarEfeito(queryClient, efeitos.editarProjeto(id)),
    })
}

export function useExcluirProjeto() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => excluirProjeto(id),
        onSuccess: (_vazio, id) => aplicarEfeito(queryClient, efeitos.excluirProjeto(id)),
    })
}
```

- [ ] **Step 6: Rodar os testes dos hooks**

Run: `npx vitest run src/__tests__/projects-mutacoes.test.tsx`
Esperado: PASS, 5 testes.

- [ ] **Step 7: Ajustar o teste de caracterização do wizard — deliberadamente**

O cabeçalho de `project-wizard.test.tsx` diz que editar o teste significa que o comportamento mudou. **Mudou, de propósito, em dois pontos**, e só esses dois são tocados:

1. **A requisição passa por `lib/api`**: o mock de `fetch` precisa devolver `Response` de verdade (o cliente lê `res.headers`), e os headers chegam como objeto `Headers`.
2. **O wizard passa a precisar de um `QueryClientProvider`** (usa `useMutation`).

Asserções de **comportamento** — URL, método, corpo, títulos dos toasts, `onOpenChange(false)`, `refresh` chamado — **não mudam**. Alterações:

No topo, acrescente:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

function resposta(corpo: unknown, status = 200) {
    return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } })
}
```

No `beforeEach`, troque a linha do `fetchMock.mockResolvedValue(...)` por:

```tsx
    fetchMock.mockImplementation(async () => resposta({ id: "novo" }))
```

Troque `abrir` por:

```tsx
function abrir(props: Record<string, unknown> = {}) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <ProjectWizard isOpen onOpenChange={onOpenChange} {...props} />
        </QueryClientProvider>,
    )
}
```

No teste do POST, troque a asserção de headers por:

```tsx
        const headers = new Headers(init.headers)
        expect(headers.get("Content-Type")).toBe("application/json")
        expect(headers.get("Authorization")).toBe("Bearer token-de-teste")
```

No teste do 403, troque o `fetchMock.mockResolvedValue({ ok: false, ... })` por:

```tsx
        fetchMock.mockImplementation(async () => resposta({ detail: "Seu plano permite 2 projetos." }, 403))
```

Procure outros `mockResolvedValue({ ok:` no arquivo (`grep -n "ok:" src/__tests__/project-wizard.test.tsx`) e converta cada um para `resposta(corpo, status)` com os mesmos valores. No bloco do comentário do topo, acrescente uma linha: `Ajustado na Tarefa 6 da migracao de Projetos (Secao 8): mock de fetch como Response e QueryClientProvider — a requisicao passou a sair por lib/api. Nenhuma asserção de comportamento mudou.`

Run: `npx vitest run src/__tests__/project-wizard.test.tsx`
Esperado **agora, antes de tocar o componente**: PASS. Os ajustes são compatíveis com o código antigo — `new Headers({...}).get` lê objeto simples, o `fetch` manual chama `res.json()` num `Response` sem problema, e o provider não atrapalha quem não o usa. **É isso que prova que o teste só ganhou o mecanismo novo, sem afrouxar comportamento.** Se algo reprovar aqui, o ajuste está errado: desfaça e refaça antes de seguir.

- [ ] **Step 8: Os três componentes**

`ProjectWizard.tsx`:
- Remova `import { getAccessToken } from "@/lib/api/auth"` e `import { apiUrl } from "@/lib/api-url"`.
- Acrescente `import { ApiError } from "@/lib/api/errors"` e `import { useCriarProjeto, useEditarProjeto } from "@/features/projects/hooks"`.
- Troque `const [isSubmitting, setIsSubmitting] = useState(false)` por:

```tsx
    const criar = useCriarProjeto()
    const editar = useEditarProjeto()
    const isSubmitting = criar.isPending || editar.isPending
```

- Troque `onSubmit` inteiro por:

```tsx
    const onSubmit = async (data: WizardFormValues) => {
        if (step !== 3) return

        try {
            if (mode === "edit") {
                await editar.mutateAsync({ id: String(initialData.id), dados: data })
            } else {
                await criar.mutateAsync(data)
            }

            toast({
                title: mode === "edit" ? "Projeto Atualizado" : "Projeto Criado",
                description: mode === "edit" ? "Os dados do projeto foram atualizados com sucesso." : `O projeto ${data.name} foi iniciado com sucesso.`,
            })

            form.reset()
            setStep(1)
            onOpenChange(false)
            onSuccess?.()

            // Orcamento e Apresentacoes renderizam ProjectHeader com dado do
            // SERVIDOR; sem isto, editar ali nao atualiza o cabecalho. Sai
            // quando as duas telas migrarem (spec de Projetos, "Mutacoes").
            router.refresh()
        } catch (erro) {
            const mensagem = erro instanceof ApiError ? erro.message : "Ocorreu um erro ao tentar salvar o projeto."
            toast({
                variant: "destructive",
                title: erro instanceof ApiError && erro.status === 403 ? "Limite de Plano" : "Ops!",
                description: mensagem,
            })
        }
    }
```

- Se `useState` deixou de ser usado para outra coisa, **não** o remova do import sem conferir: `step` usa `useState`.

`ProjectStatusSelect.tsx` — substitua o arquivo inteiro:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { ApiError } from "@/lib/api/errors"
import { useMudarStatusDoProjeto } from "@/features/projects/hooks"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProjectStatusSelectProps {
    projectId: string
    currentStatus: string
}

export function ProjectStatusSelect({ projectId, currentStatus }: ProjectStatusSelectProps) {
    const { toast } = useToast()
    const router = useRouter()
    const mudar = useMudarStatusDoProjeto()

    const handleStatusChange = async (novoStatus: string) => {
        try {
            await mudar.mutateAsync({ id: projectId, status: novoStatus })
            toast({ title: "Status Atualizado", description: "O status do projeto foi alterado com sucesso." })
            // Ver o comentario em ProjectWizard: Orcamento e Apresentacoes ainda
            // leem o cabecalho do servidor.
            router.refresh()
        } catch (erro) {
            if (erro instanceof ApiError && erro.status === 403) {
                toast({ variant: "destructive", title: "Limite de Plano", description: erro.message })
                return
            }
            toast({ variant: "destructive", title: "Ops!", description: "Não foi possível atualizar o status." })
        }
    }

    return (
        <div className="relative">
            {mudar.isPending && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/50">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                </div>
            )}
            <Select defaultValue={currentStatus} onValueChange={handleStatusChange} disabled={mudar.isPending}>
                <SelectTrigger className="h-9 w-[180px]" aria-label="Status do projeto">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ACTIVE">Em Andamento (Ativo)</SelectItem>
                    <SelectItem value="COMPLETED">Concluído</SelectItem>
                    <SelectItem value="DRAFT">Rascunho</SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}
```

(O `aria-label` no `SelectTrigger` é a mesma classe de defeito `button-name` que o axe achou na Biblioteca; custa uma linha e o arquivo já está sendo reescrito.)

`DeleteProjectAlert.tsx`: remova os imports de `getAccessToken` e `apiUrl`; acrescente `import { useExcluirProjeto } from "@/features/projects/hooks"`; troque `const [isDeleting, setIsDeleting] = useState(false)` por `const excluir = useExcluirProjeto()` e `const isDeleting = excluir.isPending`; troque `handleDelete` por:

```tsx
    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault()
        if (confirmName !== projectName) return

        try {
            await excluir.mutateAsync(projectId)
            toast({ title: "Projeto Excluído", description: "O projeto e todos os seus ambientes foram excluídos com sucesso." })
            setIsOpen(false)
            router.push("/projects")
            // Ver o comentario em ProjectWizard.
            router.refresh()
        } catch {
            toast({ variant: "destructive", title: "Ops!", description: "Não foi possível excluir o projeto." })
        }
    }
```

As classes `text-red-*`/`border-red-*` do botão **ficam** nesta tarefa: saem na Tarefa 10, junto com o token que as substitui.

- [ ] **Step 9: Rodar**

```bash
npx vitest run src/__tests__/projects-mutacoes.test.tsx src/__tests__/project-wizard.test.tsx
npx eslint src/features/projects src/components/projects/ProjectWizard.tsx src/components/projects/ProjectStatusSelect.tsx src/components/projects/DeleteProjectAlert.tsx
npm run typecheck && npm test
python ../tools/catraca.py
grep -rn "invalidateQueries" src --include=*.ts --include=*.tsx | grep -c "dashboard\|invalidacao"
```
Esperado: PASS nos dois arquivos, **todos os testes do wizard verdes sem nenhuma asserção de comportamento editada**; eslint limpo; typecheck limpo; `npm test` sem `failed`; `fetch_fora_de_lib_api` **68** (saíram 3); a contagem do grep ≥ 1. Então `python ../tools/catraca.py --atualizar` e `cd ../tools && python -m unittest discover -p "test_*.py"`.

- [ ] **Step 10: Olhar rodando (por agente)**

Com API local e `npm run dev`: na lista, criar um projeto pelo wizard e ver o card aparecer sem recarregar; abrir `/dashboard` em seguida e ver o projeto nos recentes sem esperar 30 s. No detalhe, trocar o status e ver o seletor refletir. Na aba Orçamento do mesmo projeto, trocar o status e ver o cabecalho atualizar (é o que o `router.refresh()` garante). Excluir um projeto de teste e confirmar que a navegação para `/projects` não pisca o estado de erro. Registrar com o rótulo de passada por agente.

- [ ] **Step 11: Commit**

```bash
git add ArchSmart-web/src/features/projects ArchSmart-web/src/components/projects/ProjectWizard.tsx ArchSmart-web/src/components/projects/ProjectStatusSelect.tsx ArchSmart-web/src/components/projects/DeleteProjectAlert.tsx ArchSmart-web/src/__tests__/projects-mutacoes.test.tsx ArchSmart-web/src/__tests__/project-wizard.test.tsx tools/
git commit -m "feat(projects): mutacoes de projeto por useMutation, com mapa explicito de invalidacao

Criar, editar, status e excluir invalidam dashboard.all (item 7 do Dashboard).
router.refresh() fica: Orcamento e Apresentacoes leem ProjectHeader do servidor.
project-wizard.test: mock como Response e QueryClientProvider; nenhuma
assercao de comportamento mudou.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Mutações de ambiente e DNA, e o lint de `fetch` vira erro no território

**Files:**
- Modify: `ArchSmart-web/src/features/projects/hooks.ts` (três hooks)
- Modify: `ArchSmart-web/src/components/projects/environments/NewEnvironmentModal.tsx`
- Modify: `ArchSmart-web/src/components/projects/environments/EnvironmentCard.tsx`
- Modify: `ArchSmart-web/src/components/projects/environments/DNAEditorSheet.tsx`
- Modify: `ArchSmart-web/src/components/projects/environments/EnvironmentsWorkspace.tsx` (saem os handlers provisórios da Tarefa 5)
- Modify: `ArchSmart-web/eslint.config.mjs`
- Test: `ArchSmart-web/src/__tests__/projects-mutacoes.test.tsx` (um `describe` a mais)

**Interfaces:**
- Consumes: `criarAmbiente`, `excluirAmbiente`, `salvarDna`, `CorpoDeAmbiente`, `AreasDoDna` (Tarefa 6, `api.ts`); `efeitos.mudarAmbientes`, `efeitos.salvarDna`, `aplicarEfeito` (Tarefa 6).
- Produces: `useCriarAmbiente(projectId)`, `useExcluirAmbiente(projectId)`, `useSalvarDna(projectId)`. **As props `onSuccess` de `NewEnvironmentModal` e `DNAEditorSheet` e `onDelete` de `EnvironmentCard` deixam de existir.**

Sem `router.refresh()` aqui: ambiente não aparece no `ProjectHeader`, e nenhuma tela de servidor não migrada lê a lista de ambientes (conferir no Step 7).

- [ ] **Step 1: Testes**

Em `src/__tests__/projects-mutacoes.test.tsx`, acrescente aos imports `useCriarAmbiente, useExcluirAmbiente, useSalvarDna` e, no fim do arquivo:

```tsx
describe("mutacoes de ambiente", () => {
    it("criar ambiente: POST no projeto; invalida environments(id) e lists — nao dashboard, nao detail", async () => {
        fetchMock.mockImplementation(async () => respostaOk({ id: "e1", project_id: "p1", name: "Sala" }, 201))
        const { Wrapper, invalidadas, descartadas } = montar()
        const { result } = renderHook(() => useCriarAmbiente("p1"), { wrapper: Wrapper })

        await result.current.mutateAsync({ name: "Sala", type: "Interna/Seca", dna: { floor_area: 0, wall_area: 0, ceiling_area: 0 } })

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/projects\/p1\/environments$/)
        expect(init.method).toBe("POST")
        expect(invalidadas.sort()).toEqual(ordenado([queryKeys.projects.environments("p1"), queryKeys.projects.lists()]))
        expect(descartadas).toEqual([])
    })

    it("excluir ambiente: DELETE no ambiente; mesmo efeito de criar", async () => {
        fetchMock.mockImplementation(async () => respostaOk(undefined, 204))
        const { Wrapper, invalidadas } = montar()
        const { result } = renderHook(() => useExcluirAmbiente("p1"), { wrapper: Wrapper })

        await result.current.mutateAsync("e1")

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/environments\/e1$/)
        expect(init.method).toBe("DELETE")
        expect(invalidadas.sort()).toEqual(ordenado([queryKeys.projects.environments("p1"), queryKeys.projects.lists()]))
    })

    it("salvar DNA: PUT .../dna; invalida SO environments(id) — a contagem da lista nao muda", async () => {
        const { Wrapper, invalidadas } = montar()
        const { result } = renderHook(() => useSalvarDna("p1"), { wrapper: Wrapper })

        await result.current.mutateAsync({ envId: "e1", areas: { floor_area: 10, wall_area: 20, ceiling_area: 10 } })

        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/api\/environments\/e1\/dna$/)
        expect(init.method).toBe("PUT")
        expect(JSON.parse(init.body)).toEqual({ floor_area: 10, wall_area: 20, ceiling_area: 10 })
        expect(invalidadas).toEqual(ordenado([queryKeys.projects.environments("p1")]))
    })
})
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run src/__tests__/projects-mutacoes.test.tsx`
Esperado: FAIL — `useCriarAmbiente` não é exportado.

- [ ] **Step 3: Os hooks**

Em `src/features/projects/hooks.ts`, amplie o import de `./api` com `criarAmbiente, excluirAmbiente, salvarDna, type AreasDoDna, type CorpoDeAmbiente`, e acrescente no fim:

```ts
/** Ambientes: sem `router.refresh()` — nenhuma tela de servidor le a lista de ambientes. */
export function useCriarAmbiente(projectId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (corpo: CorpoDeAmbiente) => criarAmbiente(projectId, corpo),
        onSuccess: () => aplicarEfeito(queryClient, efeitos.mudarAmbientes(projectId)),
    })
}

export function useExcluirAmbiente(projectId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (envId: string) => excluirAmbiente(envId),
        onSuccess: () => aplicarEfeito(queryClient, efeitos.mudarAmbientes(projectId)),
    })
}

export function useSalvarDna(projectId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ envId, areas }: { envId: string; areas: AreasDoDna }) => salvarDna(envId, areas),
        onSuccess: () => aplicarEfeito(queryClient, efeitos.salvarDna(projectId)),
    })
}
```

Run: `npx vitest run src/__tests__/projects-mutacoes.test.tsx`
Esperado: PASS, 8 testes.

- [ ] **Step 4: `NewEnvironmentModal`**

- Remova os imports de `getAccessToken` e `apiUrl`; acrescente `import { useCriarAmbiente } from "@/features/projects/hooks"`.
- Na interface de props, apague `onSuccess: (env: any) => void`; na assinatura, tire `onSuccess`.
- Troque `const [isSubmitting, setIsSubmitting] = useState(false)` por `const criar = useCriarAmbiente(projectId)` e `const isSubmitting = criar.isPending` (se `useState` ficar sem uso, tire-o do import).
- Troque `onSubmit` por:

```tsx
    const onSubmit = async (data: EnvironmentFormValues) => {
        try {
            await criar.mutateAsync({
                name: data.name,
                type: data.type,
                dna: {
                    floor_area: data.floor_area || 0,
                    wall_area: data.wall_area || 0,
                    ceiling_area: data.ceiling_area || 0,
                },
            })
            toast({ title: "Ambiente Criado", description: "DNA Técnico gerado com sucesso." })
            form.reset()
            onOpenChange(false)
        } catch {
            toast({ variant: "destructive", title: "Ops!", description: "Não foi possível criar o ambiente." })
        }
    }
```

Se `data.type` for opcional no schema do formulário, passe `data.type ?? "Interna/Seca"` — o valor padrão do próprio formulário — e registre no commit.

- [ ] **Step 5: `EnvironmentCard`**

- Remova os imports de `getAccessToken` e `apiUrl`; acrescente `import { useExcluirAmbiente } from "@/features/projects/hooks"` e `import type { Ambiente } from "@/features/projects/types"`.
- Props: `environment: Ambiente` e `onClick: () => void` — **sem** `onDelete`. Tire `onDelete` da assinatura.
- Troque `const [isDeleting, setIsDeleting] = useState(false)` por `const excluir = useExcluirAmbiente(environment.project_id)` e `const isDeleting = excluir.isPending`.
- Troque `confirmDelete` por:

```tsx
    const confirmDelete = async () => {
        try {
            await excluir.mutateAsync(environment.id)
            toast({ title: "Ambiente Excluído", description: "O ambiente foi removido com sucesso." })
        } catch {
            toast({ variant: "destructive", title: "Ops!", description: "Erro ao excluir o ambiente." })
        }
    }
```

- [ ] **Step 6: `DNAEditorSheet` e `EnvironmentsWorkspace`**

`DNAEditorSheet`:
- Remova os imports de `getAccessToken` e `apiUrl`; acrescente `import { useSalvarDna } from "@/features/projects/hooks"` e `import type { Ambiente } from "@/features/projects/types"`.
- Props: `environment: Ambiente | undefined`, **sem** `onSuccess`.
- Troque `const [isSubmitting, setIsSubmitting] = useState(false)` por `const salvar = useSalvarDna(environment?.project_id ?? "")` e `const isSubmitting = salvar.isPending`. (Hooks antes do `if (!environment) return null`, como já está.)
- Troque `onSubmit` por:

```tsx
    const onSubmit = async (data: DNAFormValues) => {
        if (!environment) return
        try {
            await salvar.mutateAsync({ envId: environment.id, areas: data })
            toast({ title: "Sucesso!", description: "DNA Técnico atualizado." })
            onOpenChange(false)
        } catch {
            toast({ variant: "destructive", title: "Ops!", description: "Erro ao salvar as áreas." })
        }
    }
```

`EnvironmentsWorkspace`: apague `useQueryClient`, `queryKeys`, a constante `chave`, os três `handle*` e o comentário "PROVISORIO" da Tarefa 5. No JSX: `<EnvironmentCard ... onDelete={...} />` perde `onDelete`; `<NewEnvironmentModal ... onSuccess={...} />` e `<DNAEditorSheet ... onSuccess={...} />` perdem `onSuccess`.

- [ ] **Step 7: Conferir que nada de servidor lê ambientes**

```bash
grep -rn "/environments" "src/app/(dashboard)/projects/[id]/budget" "src/app/(dashboard)/projects/[id]/presentation" "src/app/(dashboard)/projects/[id]/print" --include=*.tsx
```
Se algum Server Component desses buscar a lista de ambientes, **pare e reporte**: a decisão de não pôr `router.refresh()` nas mutações de ambiente depende de não haver. Cole a saída nas notas.

- [ ] **Step 8: O lint vira erro no território de Projetos**

Em `ArchSmart-web/eslint.config.mjs`, no bloco de `"error"`, acrescente ao array `files` (os colchetes de `[id]` são escapados porque em glob `[id]` é classe de caractere e casaria `i` ou `d`):

```js
      "src/components/projects/**/*.{ts,tsx}",
      "src/app/(dashboard)/projects/page.tsx",
      "src/app/(dashboard)/projects/ClientWizardDriver.tsx",
      "src/app/(dashboard)/projects/components/**/*.{ts,tsx}",
      "src/app/(dashboard)/projects/\\[id\\]/page.tsx",
      "src/app/(dashboard)/projects/\\[id\\]/components/Projeto*.tsx",
```

E atualize o comentário acima do bloco: `Territorio que a Secao 5 ja migrou` → `Territorio ja migrado: Biblioteca (Secoes 5 e 8) e Projetos (Secao 8). budget/, presentation/ e print/ sob projects/[id] continuam em "warn" — sao outras telas.`

Confira que o glob pega o que deve e **não** pega o que não deve:

```bash
npx eslint --print-config "src/app/(dashboard)/projects/[id]/page.tsx" | grep -A1 '"no-restricted-syntax"' | head -2
npx eslint --print-config "src/app/(dashboard)/projects/[id]/budget/page.tsx" | grep -A1 '"no-restricted-syntax"' | head -2
npx eslint --print-config "src/app/(dashboard)/projects/[id]/components/PresentationsTab.tsx" | grep -A1 '"no-restricted-syntax"' | head -2
```
Esperado: o primeiro com severidade `2` (erro); os outros dois com `1` (aviso). Se o primeiro sair `1`, o escape não funcionou nesta versão do eslint — troque por `"src/app/(dashboard)/projects/*/page.tsx"` e `"src/app/(dashboard)/projects/*/components/Projeto*.tsx"` e confira de novo.

- [ ] **Step 9: Rodar tudo**

```bash
npx eslint src/components/projects "src/app/(dashboard)/projects/page.tsx" "src/app/(dashboard)/projects/ClientWizardDriver.tsx" "src/app/(dashboard)/projects/components" "src/app/(dashboard)/projects/[id]/page.tsx" "src/app/(dashboard)/projects/[id]/components"
npm run typecheck && npm test
grep -rn "fetch(" src/components/projects "src/app/(dashboard)/projects/page.tsx" "src/app/(dashboard)/projects/[id]/page.tsx"   # sem saida
python ../tools/catraca.py
```
Esperado: eslint **zero erros** (avisos em `PresentationsTab.tsx` podem existir e não são desta tarefa); typecheck limpo; `npm test` sem `failed`; grep sem saída; `fetch_fora_de_lib_api` **65** — o número que a spec previu (74 − 9). Se sair diferente de 65, **diga qual é e por quê** antes de atualizar. Então `python ../tools/catraca.py --atualizar` e `cd ../tools && python -m unittest discover -p "test_*.py"`.

- [ ] **Step 10: Olhar rodando (por agente)**

No detalhe de um projeto de teste: criar ambiente, editar DNA, excluir ambiente — cada um refletido sem recarregar; voltar para `/projects` e ver o `environments_count` do card atualizado. Registrar com o rótulo de passada por agente.

- [ ] **Step 11: Commit**

```bash
git add ArchSmart-web/src/features/projects/hooks.ts ArchSmart-web/src/components/projects/environments ArchSmart-web/eslint.config.mjs ArchSmart-web/src/__tests__/projects-mutacoes.test.tsx tools/
git commit -m "feat(projects): ambientes e DNA por useMutation; lint de fetch vira erro no territorio de Projetos

fetch_fora_de_lib_api 74 -> 65 na tela inteira.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `QueryBoundary` com prop `inativo`

**Medido ao planejar (15/09/2026):** Projetos **não** tem query desabilitada dentro de `QueryBoundary`. A única query gateada que a tela toca é `useAmbientesDoProjeto`, usada pelo `MoveToProjectModal` da Biblioteca, fora de boundary. As quatro de `features/library/hooks.ts` também não passam por boundary desabilitadas — a Biblioteca escapa por construção. Então esta tarefa **desenha a API sem migrar consumidor**, e isso fica escrito na docstring: é o que Orçamento (query dependente de ambiente selecionado) vai precisar.

**Files:**
- Modify: `ArchSmart-web/src/components/ui/query-boundary.tsx`
- Test: `ArchSmart-web/src/__tests__/query-boundary.test.tsx` (um `describe` a mais)

**Interfaces:**
- Produces: prop opcional `inativo?: ReactNode` em `QueryBoundary`. Com a query desabilitada: se `inativo` foi passado, renderiza-o; se não, renderiza `skeleton` como hoje **e** emite `console.warn` uma vez por montagem, fora de produção. Em nenhum dos dois casos anuncia à telemetria (comportamento já existente, preservado).

- [ ] **Step 1: Teste**

No fim de `src/__tests__/query-boundary.test.tsx` (acrescente aos imports o que faltar: `useQuery`, `QueryClient`, `QueryClientProvider`, `render`, `screen`, `vi`, `ReactNode`):

```tsx
describe("QueryBoundary com query desabilitada", () => {
    function Regiao({ inativo }: { inativo?: ReactNode }) {
        const query = useQuery({ queryKey: ["desligada"], queryFn: async () => [1], enabled: false })
        return (
            <QueryBoundary
                query={query}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
                inativo={inativo}
            >
                {(d) => <p>{d.length} itens</p>}
            </QueryBoundary>
        )
    }

    function comCliente(ui: ReactNode) {
        return <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
    }

    it("com `inativo`, renderiza o inativo — nao o skeleton eterno", () => {
        render(comCliente(<Regiao inativo={<p>escolha um ambiente</p>} />))
        expect(screen.getByText("escolha um ambiente")).toBeInTheDocument()
        expect(screen.queryByText("carregando")).not.toBeInTheDocument()
    })

    it("sem `inativo`, mantem o skeleton e AVISA — o esquecimento deixa de ser silencioso", () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
        render(comCliente(<Regiao />))
        expect(screen.getByText("carregando")).toBeInTheDocument()
        expect(aviso).toHaveBeenCalledTimes(1)
        expect(String(aviso.mock.calls[0][0])).toContain("inativo")
        aviso.mockRestore()
    })

    it("query habilitada nunca avisa", async () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
        function Ligada() {
            const query = useQuery({ queryKey: ["ligada"], queryFn: async () => [1] })
            return (
                <QueryBoundary query={query} skeleton={<p>carregando</p>} empty={<p>vazio</p>} error={() => <p>erro</p>}>
                    {(d) => <p>{d.length} itens</p>}
                </QueryBoundary>
            )
        }
        render(comCliente(<Ligada />))
        expect(await screen.findByText("1 itens")).toBeInTheDocument()
        expect(aviso).not.toHaveBeenCalled()
        aviso.mockRestore()
    })
})
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run src/__tests__/query-boundary.test.tsx`
Esperado: FAIL — erro de tipo não reprova no vitest, então o que falha é o primeiro teste (mostra "carregando") e o segundo (`console.warn` não chamado).

- [ ] **Step 3: Implementar**

Em `src/components/ui/query-boundary.tsx`:

1. No `type Props<T>`, depois de `principal`:

```tsx
    /**
     * O que renderizar enquanto a query esta DESABILITADA (`enabled: false`).
     * Sem isto, uma query desabilitada mostra `skeleton` para sempre — ver o
     * aviso no docstring. Existe desde a migracao de Projetos (Secao 8), para o
     * caso de query dependente (ex.: itens de um ambiente que o usuario ainda
     * nao escolheu), que e comum nas telas seguintes.
     */
    inativo?: ReactNode
```

2. Na desestruturação dos props, acrescente `inativo,`.

3. Logo depois da linha `const desabilitada = query.isPending && query.fetchStatus === "idle"`:

```tsx
    // Quem esquecer `inativo` numa query desabilitada ve skeleton eterno. O
    // aviso torna isso visivel no console de desenvolvimento, uma vez por
    // montagem; em producao nao sai nada.
    const esqueceuInativo = desabilitada && inativo === undefined
    useEffect(() => {
        if (!esqueceuInativo || process.env.NODE_ENV === "production") return
        console.warn(
            "[QueryBoundary] query desabilitada sem a prop `inativo`: a regiao mostra skeleton ate a query ser ligada.",
        )
    }, [esqueceuInativo])
```

4. Antes de `if (query.isPending) return <>{skeleton}</>`:

```tsx
    if (desabilitada && inativo !== undefined) return <>{inativo}</>
```

5. No docstring do topo, na seção "⚠️ NAO passe uma query DESABILITADA", troque o parágrafo "**O certo e nao renderizar o boundary nesse caso**..." por:

```
 * **Passe `inativo`** com o que a regiao deve mostrar enquanto a pergunta nao
 * faz sentido — ou nao renderize o boundary nesse caso, como a Biblioteca faz
 * na aba que nao precisa da lista. Sem `inativo`, o boundary mostra o skeleton
 * e avisa no console de desenvolvimento.
```

- [ ] **Step 4: Rodar**

```bash
npx vitest run src/__tests__/query-boundary.test.tsx src/__tests__/telemetry-contexto.test.tsx
npm run typecheck && npm test
```
Esperado: PASS; typecheck limpo; `npm test` sem `failed`, e **nenhum teste pré-existente de telemetria mudou de resultado** — o "não anuncia quando desabilitada" continua valendo.

- [ ] **Step 5: Commit**

```bash
git add ArchSmart-web/src/components/ui/query-boundary.tsx ArchSmart-web/src/__tests__/query-boundary.test.tsx
git commit -m "feat(ui): QueryBoundary ganha prop inativo e avisa query desabilitada sem ela

Nenhum consumidor migrado: Projetos e Biblioteca nao passam query desabilitada
ao boundary (medido). E API para Orcamento.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `tentarPrefetch` que enxerga a desistência, e o `NaN` do card de limite

Item 9 do bloco do Dashboard. Dois defeitos pequenos, commit próprio cada um.

**O defeito do prefetch:** `queryClient.prefetchQuery` **engole** o erro da `queryFn` — ela nunca rejeita. Então o `catch` de `tentarPrefetch` nunca roda, e o `console.warn("[prefetch] desistiu...")` nunca aparece: prefetch que desiste por tempo ou por erro é **invisível** no log do servidor, nas quatro telas que o usam.

**Files:**
- Modify: `ArchSmart-web/src/lib/query/hydration.ts` (`tentarPrefetch`)
- Modify: `ArchSmart-web/src/app/(dashboard)/library/components/LibraryData.tsx`, `ArchSmart-web/src/app/(dashboard)/dashboard/components/DashboardData.tsx`, `ArchSmart-web/src/app/(dashboard)/projects/components/ProjetosData.tsx`, `ArchSmart-web/src/app/(dashboard)/projects/[id]/components/ProjetoData.tsx` (chamadas)
- Modify: `ArchSmart-web/src/app/(dashboard)/dashboard/components/ProjectsLimitCard.tsx`
- Test: `ArchSmart-web/src/__tests__/prefetch.test.ts` (novo), `ArchSmart-web/src/__tests__/projects-limit-card.test.tsx` (novo)

**Interfaces:**
- Consumes: `estadoDoLimite` (Tarefa 3).
- Produces: **assinatura nova** `tentarPrefetch(queryClient: QueryClient, tarefa: (signal: AbortSignal) => Promise<unknown>): Promise<void>`. O `queryClient` é obrigatório de propósito: é por ele que a função enxerga o desfecho, e um parâmetro opcional seria esquecido.

- [ ] **Step 1: Teste do prefetch**

`src/__tests__/prefetch.test.ts`:

```ts
import { QueryClient } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TIMEOUT_DO_PREFETCH_MS, criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"

let aviso: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
    aviso.mockRestore()
    vi.useRealTimers()
})

describe("tentarPrefetch", () => {
    it("prefetch com sucesso nao avisa", async () => {
        const queryClient = criarQueryClientDoServidor()
        await tentarPrefetch(queryClient, () =>
            queryClient.prefetchQuery({ queryKey: ["ok"], queryFn: async () => 1 }),
        )
        expect(aviso).not.toHaveBeenCalled()
    })

    it("queryFn que falha AVISA, com a chave — prefetchQuery engole o erro, e antes isto era invisivel", async () => {
        const queryClient = criarQueryClientDoServidor()
        await tentarPrefetch(queryClient, () =>
            queryClient.prefetchQuery({
                queryKey: ["projects", "detail", "p1"],
                queryFn: async () => {
                    throw new Error("fora do ar")
                },
            }),
        )
        expect(aviso).toHaveBeenCalledTimes(1)
        expect(aviso.mock.calls[0].map(String).join(" ")).toContain("projects")
        expect(aviso.mock.calls[0].map(String).join(" ")).toContain("fora do ar")
    })

    it("estourar o teto AVISA", async () => {
        vi.useFakeTimers()
        const queryClient = criarQueryClientDoServidor()
        const promessa = tentarPrefetch(queryClient, (signal) =>
            queryClient.prefetchQuery({
                queryKey: ["lento"],
                queryFn: () =>
                    new Promise((_, rejeitar) => {
                        signal.addEventListener("abort", () => rejeitar(new Error("abortado pelo teto")))
                    }),
            }),
        )
        await vi.advanceTimersByTimeAsync(TIMEOUT_DO_PREFETCH_MS + 1)
        await promessa
        expect(aviso).toHaveBeenCalledTimes(1)
        expect(aviso.mock.calls[0].map(String).join(" ")).toContain("lento")
    })

    it("so olha as queries da propria tarefa: uma query ja com erro no cliente, de antes, nao conta", async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        await queryClient
            .prefetchQuery({ queryKey: ["velha"], queryFn: async () => { throw new Error("antiga") } })
        aviso.mockClear()

        await tentarPrefetch(queryClient, () =>
            queryClient.prefetchQuery({ queryKey: ["nova"], queryFn: async () => 1 }),
        )
        expect(aviso).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run src/__tests__/prefetch.test.ts`
Esperado: FAIL — a assinatura antiga recebe o `queryClient` como `tarefa` (erro de tipo não reprova no vitest; o que reprova é `tarefa is not a function` ou os `toHaveBeenCalledTimes(1)`).

- [ ] **Step 3: Implementar**

Em `src/lib/query/hydration.ts`, acrescente `import type { Query } from "@tanstack/react-query"` (junto do import de `QueryClient`, que deixa de ser só valor) e substitua `tentarPrefetch` e o docstring dele por:

```ts
/**
 * `tarefa` recebe o `AbortSignal` do teto e tem que repassa-lo ate o `fetch`
 * (via `clienteComSinal`). Sem isso o teto so para de *esperar* — a chamada
 * continua correndo no servidor ate a API responder (ate ~42 s num cold start).
 *
 * ## Por que recebe o `queryClient`
 *
 * `prefetchQuery` NUNCA rejeita: o erro da `queryFn` fica no estado da query.
 * Ate 15/09/2026 esta funcao so tinha um `catch`, que portanto nunca rodava —
 * prefetch que desistia era invisivel no log do servidor, nas quatro telas
 * (item 9 do bloco do Dashboard no CLAUDE.md). Agora ela olha o estado das
 * queries que a TAREFA tocou e avisa as que nao terminaram em sucesso.
 *
 * "Que a tarefa tocou" = as que nao existiam ou mudaram de `dataUpdatedAt`/
 * `errorUpdatedAt` durante a chamada. Um QueryClient de servidor nasce vazio
 * por requisicao, entao na pratica sao todas; o filtro existe para a funcao
 * nao mentir se um dia receber um cliente com historico.
 */
export async function tentarPrefetch(
    queryClient: QueryClient,
    tarefa: (signal: AbortSignal) => Promise<unknown>,
): Promise<void> {
    const cache = queryClient.getQueryCache()
    const antes = new Map(
        cache.getAll().map((q) => [q.queryHash, `${q.state.dataUpdatedAt}:${q.state.errorUpdatedAt}`]),
    )
    const tocada = (q: Query) => antes.get(q.queryHash) !== `${q.state.dataUpdatedAt}:${q.state.errorUpdatedAt}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_DO_PREFETCH_MS)
    try {
        await tarefa(controller.signal)
    } catch (erro) {
        // Tarefa que nao e `prefetchQuery` pode rejeitar de verdade. Prefetch
        // e otimizacao, nao contrato: degrada para busca no cliente.
        console.warn("[prefetch] desistiu, o cliente vai buscar:", erro)
        return
    } finally {
        clearTimeout(timer)
    }

    for (const query of cache.getAll()) {
        if (tocada(query) && query.state.status !== "success") {
            console.warn(
                "[prefetch] desistiu, o cliente vai buscar:",
                JSON.stringify(query.queryKey),
                query.state.error,
            )
        }
    }
}
```

- [ ] **Step 4: As quatro chamadas**

Em cada arquivo, `tentarPrefetch((signal) => ...)` vira `tentarPrefetch(queryClient, (signal) => ...)`. Encontre todas:

```bash
grep -rn "tentarPrefetch(" src --include=*.ts --include=*.tsx | grep -v "lib/query/hydration.ts" | grep -v __tests__
```
Esperado: 4 linhas (Library, Dashboard, Projetos, Projeto). Se houver outra, converta também e diga qual.

Run:
```bash
npx vitest run src/__tests__/prefetch.test.ts src/__tests__/dashboard-data.test.tsx src/__tests__/projetos-data.test.tsx src/__tests__/projeto-data.test.tsx src/__tests__/library-query-payload.test.tsx
npm run typecheck
```
Esperado: PASS e typecheck limpo.

- [ ] **Step 5: Commit do prefetch**

```bash
git add ArchSmart-web/src/lib/query/hydration.ts ArchSmart-web/src/__tests__/prefetch.test.ts "ArchSmart-web/src/app/(dashboard)/library/components/LibraryData.tsx" "ArchSmart-web/src/app/(dashboard)/dashboard/components/DashboardData.tsx" "ArchSmart-web/src/app/(dashboard)/projects/components/ProjetosData.tsx" "ArchSmart-web/src/app/(dashboard)/projects/[id]/components/ProjetoData.tsx"
git commit -m "fix(query): tentarPrefetch enxerga a desistencia — prefetchQuery engolia o erro

O aviso '[prefetch] desistiu' nunca aparecia no log do servidor.
Item 9 do bloco do Dashboard.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Teste do card**

`src/__tests__/projects-limit-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ProjectsLimitCard } from "@/app/(dashboard)/dashboard/components/ProjectsLimitCard"

describe("ProjectsLimitCard", () => {
    it("abaixo do limite mostra as vagas livres", () => {
        render(<ProjectsLimitCard activeProjectsCount={1} planLimit={3} />)
        expect(screen.getByText("2 espaço(s) livre(s)")).toBeInTheDocument()
    })

    it("limite 0 nao produz NaN e diz que o limite foi atingido", () => {
        const { container } = render(<ProjectsLimitCard activeProjectsCount={0} planLimit={0} />)
        expect(container.innerHTML).not.toContain("NaN")
        expect(screen.getByText("Limite de projetos atingido")).toBeInTheDocument()
    })

    it("acima do limite nao mostra vaga negativa", () => {
        render(<ProjectsLimitCard activeProjectsCount={5} planLimit={3} />)
        expect(screen.getByText("Limite de projetos atingido")).toBeInTheDocument()
        expect(screen.queryByText(/-\d+ espaço/)).not.toBeInTheDocument()
    })
})
```

Run: `npx vitest run src/__tests__/projects-limit-card.test.tsx`
Esperado: FAIL no segundo teste (`width: NaN%` no HTML).

- [ ] **Step 7: Implementar o card**

Em `ProjectsLimitCard.tsx`: `import { estadoDoLimite } from "@/features/projects/limite"`; troque `const projectPercentage = ...` por `const limite = estadoDoLimite(activeProjectsCount, planLimit)`; e no JSX:
- `projectPercentage >= 100 ? 'bg-secondary' : 'bg-primary'` → `limite.noLimite ? 'bg-secondary' : 'bg-primary'`
- `style={{ width: \`${projectPercentage}%\` }}` → `style={{ width: \`${limite.fracao * 100}%\` }}`
- `{projectPercentage >= 100 ? "Limite de projetos atingido" : \`${planLimit - activeProjectsCount} espaço(s) livre(s)\`}` → `{limite.noLimite ? "Limite de projetos atingido" : \`${limite.livres} espaço(s) livre(s)\`}`

```bash
npx vitest run src/__tests__/projects-limit-card.test.tsx src/__tests__/dashboard-content.test.tsx
npm run typecheck && npm test
```
Esperado: PASS; typecheck limpo; `npm test` sem `failed`.

- [ ] **Step 8: Commit do card**

```bash
git add "ArchSmart-web/src/app/(dashboard)/dashboard/components/ProjectsLimitCard.tsx" ArchSmart-web/src/__tests__/projects-limit-card.test.tsx
git commit -m "fix(dashboard): card de limite usa estadoDoLimite — limite 0 dava NaN

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Token `destructive` e a medida que faltava na catraca

Decisão 5 da spec. **Dois commits, nesta ordem:** primeiro a régua passa a ver o defeito (a medida nova nasce com o valor de hoje), depois o token muda e a medida desce. Na ordem inversa, a medida nasceria já sem o defeito e nada provaria que ela o enxerga.

**Files:**
- Modify: `tools/contraste.py`, `tools/test_contraste.py`, `tools/catraca.py`
- Modify: `ArchSmart-web/src/app/globals.css`
- Modify: `ArchSmart-web/src/app/(dashboard)/dashboard/components/FinancialMetricCards.tsx`
- Modify: `ArchSmart-web/src/components/projects/DeleteProjectAlert.tsx`

**Interfaces:**
- Produces: `contraste.tokens_usados_como_texto(src: Path, tokens: dict) -> set[str]` e `contraste.texto_sobre_fundo_reprovados(css: str | None = None, usados: set | None = None) -> list[str]`, no formato `tema:token`; medida `texto_sobre_fundo_reprovado` na catraca.

**O que a medida vê, e o que não vê — escrito para ninguém tomar régua por prova:** tokens usados em `text-<token>` no código, medidos contra `--background` a 4,5:1. **Não** mede `X-foreground` quando `X` é token (é par, e `pares()` já o mede sobre `X` — o que deixa `muted-foreground` sobre `background` de fora, e isso vai escrito); **não** mede texto sobre `card`, `popover` ou `muted`; **não** mede opacidade (`text-destructive/80`).

- [ ] **Step 1: Testes da medida**

Em `tools/test_contraste.py`, acrescente (ajuste o import para `import tempfile` e `from pathlib import Path` no topo):

```python
CSS_DE_HOJE = """
:root {
  --background: 0 0% 100%; --foreground: 222.2 84% 4.9%;
  --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 40% 98%;
  --muted: 210 40% 96.1%; --muted-foreground: 215.4 16.3% 46.9%;
}
.dark {
  --background: 222.2 84% 4.9%; --foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 40% 98%;
}
"""

CSS_NOVO = CSS_DE_HOJE.replace("--destructive: 0 84.2% 60.2%", "--destructive: 0 84.2% 40%").replace(
    "--destructive: 0 62.8% 30.6%; --destructive-foreground: 210 40% 98%",
    "--destructive: 0 84.2% 60%; --destructive-foreground: 222.2 84% 4.9%",
)


class TestTextoSobreFundo(unittest.TestCase):
    def test_destructive_como_texto_reprova_nos_dois_temas_hoje(self):
        # 3,76:1 no claro e 2,00:1 no escuro (medido em 15/09/2026, spec de
        # Projetos, decisao 5). A catraca antiga so media o par com o
        # foreground (3,59 no claro, 9,56 no escuro) e nunca viu o 2,00.
        fora = contraste.texto_sobre_fundo_reprovados(CSS_DE_HOJE, usados={"destructive"})
        self.assertEqual(fora, ["claro:destructive", "escuro:destructive"])

    def test_os_valores_novos_passam_como_texto_e_como_par(self):
        self.assertEqual(contraste.texto_sobre_fundo_reprovados(CSS_NOVO, usados={"destructive"}), [])
        self.assertNotIn("claro:destructive", contraste.reprovados(CSS_NOVO))
        self.assertNotIn("escuro:destructive", contraste.reprovados(CSS_NOVO))

    def test_foreground_de_par_e_background_nao_sao_medidos_sobre_o_fundo(self):
        # `destructive-foreground` e texto SOBRE destructive, nao sobre o fundo;
        # `background` sobre ele mesmo daria 1:1. Os dois ficam de fora.
        fora = contraste.texto_sobre_fundo_reprovados(
            CSS_DE_HOJE, usados={"destructive-foreground", "background"}
        )
        self.assertEqual(fora, [])

    def test_tokens_usados_como_texto_le_o_codigo_e_cruza_com_os_tokens(self):
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                'const x = <p className="hover:text-destructive text-muted-foreground text-lg context-menu">oi</p>',
                encoding="utf-8",
            )
            Path(pasta, "b.css").write_text(".x { color: text-primary }", encoding="utf-8")
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(Path(pasta), claro)
        # `text-lg` nao e token; `context-menu` nao e classe de texto; `.css` nao e lido.
        self.assertEqual(usados, {"destructive", "muted-foreground"})
```

Run: `cd tools && python -m unittest test_contraste -v; cd ..`
Esperado: FAIL — `module 'contraste' has no attribute 'texto_sobre_fundo_reprovados'`.

- [ ] **Step 2: Implementar a medida**

Em `tools/contraste.py`, depois de `reprovados`:

```python
SRC_WEB = RAIZ / "ArchSmart-web" / "src"
RE_CLASSE_DE_TEXTO = re.compile(r"\btext-([a-z]+(?:-[a-z]+)*)")


def tokens_usados_como_texto(src: Path = SRC_WEB, tokens: dict | None = None) -> set:
    """Nomes de token que aparecem como `text-<token>` em .ts/.tsx de `src`."""
    if tokens is None:
        tokens, _ = tokens_dos_temas()
    achados = set()
    for arquivo in src.rglob("*"):
        if arquivo.suffix in (".ts", ".tsx"):
            achados.update(RE_CLASSE_DE_TEXTO.findall(arquivo.read_text(encoding="utf-8")))
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
```

Em `tools/catraca.py`, logo abaixo de cada linha de `contraste_reprovado`:
- no dicionário de descrições (perto da linha 185): `"texto_sobre_fundo_reprovado": "tokens usados como text-<token> abaixo de 4.5:1 sobre --background, nos dois temas (ver contraste.texto_sobre_fundo_reprovados para o que fica de fora)",`
- no dicionário de medições (perto da linha 380): `"texto_sobre_fundo_reprovado": lambda: contraste.texto_sobre_fundo_reprovados(),`
- no docstring do topo, perto da descrição de `contraste_reprovado`, uma linha para a medida nova.

Run: `cd tools && python -m unittest discover -p "test_*.py"; cd ..`
Esperado: OK. Se `test_catraca.py` tiver um teste que enumera as chaves de medida, ele reprova aqui — acrescente a chave nova nele, neste commit.

- [ ] **Step 3: Medir e registrar a medida nova — antes do token**

```bash
python tools/catraca.py
```
Esperado: a medida nova aparece como `SEM BASELINE`, com uma lista que **inclui** `claro:destructive` e `escuro:destructive`. **Cole a lista inteira nas notas** — ela provavelmente traz outros (`text-warning` mediu 1,99:1 na Biblioteca). Então:

```bash
python tools/catraca.py --atualizar --aceitar-piora
```
Siga o que a ferramenta imprimir sobre o campo `motivo` de `_pioras_aceitas`. Motivo: `medida nova (Secao 8, Projetos, Tarefa 10): a regua passa a ver token de texto sobre --background; nasce com o valor de hoje, nenhum defeito novo entrou`.

- [ ] **Step 4: Commit da régua**

```bash
cd tools && python -m unittest discover -p "test_*.py"; cd ..
git add tools/contraste.py tools/test_contraste.py tools/catraca.py tools/catraca.json tools/test_catraca*.py
git commit -m "feat(tools): catraca mede token de texto sobre --background

Nasce com o valor de hoje, incluindo destructive nos dois temas (2,00:1 no
escuro). contraste_reprovado so media pares e nunca viu isso.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: O token**

Em `ArchSmart-web/src/app/globals.css`:
- em `:root`: `--destructive: 0 84.2% 60.2%;` → `--destructive: 0 84.2% 40%;` (o `--destructive-foreground` do claro fica `210 40% 98%`).
- em `.dark`: `--destructive: 0 62.8% 30.6%;` → `--destructive: 0 84.2% 60%;` e `--destructive-foreground: 210 40% 98%;` → `--destructive-foreground: 222.2 84% 4.9%;`

Acima da linha do `.dark`, um comentário: `/* destructive no escuro: vermelho claro com texto escuro por cima. Com texto branco nenhuma luminosidade passa 4,5:1 como texto E como preenchimento (spec de Projetos, decisao 5). */`

Run: `python tools/contraste.py`
Esperado: `destructive` com `[v]` nos dois temas, 6,23:1 no claro e 5,29:1 no escuro; `3 par(es) abaixo de 4.5:1: claro:muted, claro:secondary, escuro:secondary`.

- [ ] **Step 6: Os consumidores que contornavam o token**

`FinancialMetricCards.tsx`:
- `'text-red-500'` → `'text-destructive'`, e apague o comentário `{/* text-red-500: NAO migrado de proposito... */}` acima.
- `text-red-600 dark:text-red-400` → `text-destructive`, e apague o comentário `{/* text-red-600 dark:text-red-400: NAO migrado... */}`.

`DeleteProjectAlert.tsx`, no botão que abre o diálogo: `className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300 hidden md:flex"` → `className="hidden border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive md:flex"`.

Confira: `grep -rn "text-red-\|border-red-\|bg-red-" "src/app/(dashboard)/dashboard/components/FinancialMetricCards.tsx" src/components/projects/DeleteProjectAlert.tsx` → sem saída.

- [ ] **Step 7: Atualizar o teste de contraste que enumera os pares**

Em `tools/test_contraste.py`, `test_lista_os_quatro_pares_reprovados_de_hoje` vira:

```python
    def test_lista_os_tres_pares_reprovados_de_hoje(self):
        # Eram quatro ate 15/09/2026: destructive no claro saiu com o token
        # novo (spec de Projetos, decisao 5).
        self.assertEqual(
            contraste.reprovados(),
            ["claro:muted", "claro:secondary", "escuro:secondary"],
        )
```

E no docstring de `tools/contraste.py`, depois de "Quatro pares reprovavam quando esta ferramenta nasceu...", acrescente: `Tres desde 15/09/2026, quando destructive mudou (spec de Projetos).`

- [ ] **Step 8: Rodar tudo**

```bash
cd tools && python -m unittest discover -p "test_*.py"; cd ..
python tools/catraca.py
cd ArchSmart-web && npm run typecheck && npm test; cd ..
```
Esperado: unittest OK; catraca com `contraste_reprovado` 4 → **3**, `texto_sobre_fundo_reprovado` sem as duas entradas de `destructive`, `cores_literais` **menor** (anote de quanto para quanto — são 2 no card e 8 no botão, mas meça); `npm test` sem `failed`. Então `python tools/catraca.py --atualizar` (sem `--aceitar-piora`: tudo desceu) e unittest de novo.

- [ ] **Step 9: Olhar (por agente)** o botão "Excluir" do cabeçalho do projeto e o botão "Excluir Projeto Permanentemente" do diálogo, e os cards de despesa e saldo negativo do Dashboard, **nos dois temas**, em 1440px. Capturas vão para as notas; o julgamento estético fica para a Tarefa 12, com Thiago.

- [ ] **Step 10: Commit do token**

```bash
git add ArchSmart-web/src/app/globals.css "ArchSmart-web/src/app/(dashboard)/dashboard/components/FinancialMetricCards.tsx" ArchSmart-web/src/components/projects/DeleteProjectAlert.tsx tools/
git commit -m "fix(tema): destructive passa como texto e como preenchimento nos dois temas

Claro 0 84.2% 40% (6,53 texto / 6,23 par); escuro 0 84.2% 60% com foreground
escuro (5,29 / 5,29). contraste_reprovado 4 -> 3. Saem as text-red-* que
contornavam o token. Decisao 5 da spec de Projetos.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Acessibilidade do shell

Item 4 do bloco do Dashboard. Os quatro defeitos estão descritos, com nó e medida, em `docs/dev/medicoes/2026-09-14-passada-de-navegador.md`, seção "Pauta para o plano da próxima tela (Projetos): o shell". Vale para **toda** rota autenticada — por isso é tarefa própria, depois da tela, em commit próprio.

**Files:**
- Create: `ArchSmart-web/e2e/medicao-axe.spec.ts` (instrumento)
- Modify: `ArchSmart-web/src/components/layout/app-shell/Header.tsx`
- Modify: `ArchSmart-web/src/components/layout/app-shell/NotificationPanel.tsx`
- Modify: `ArchSmart-web/src/components/layout/GlobalChatWidget.tsx`
- Modify: `ArchSmart-web/src/components/layout/app-shell/Sidebar.tsx`
- Test: `ArchSmart-web/src/__tests__/shell-acessibilidade.test.tsx` (novo)

**Interfaces:**
- Produces: `ROTA=/projects TEMA=escuro LARGURA=390 npx playwright test e2e/medicao-axe.spec.ts` imprime `AXE_VIOLACOES=<id>(<n>),...` e `AXE_TOTAL_NOS=<n>`. A Tarefa 12 usa o mesmo comando.

**`inert`, não `tabIndex={-1}`:** painel e chat fechados saem da ordem de `Tab` e da árvore de acessibilidade com o atributo `inert` (React 19 aceita `inert` booleano). `tabIndex={-1}` faria subir `tabindex_negativo` na catraca e ainda deixaria o conteúdo na árvore do leitor de tela.

- [ ] **Step 1: O instrumento de axe, e o "antes"**

`e2e/medicao-axe.spec.ts`:

```ts
import path from "node:path"
import { test } from "@playwright/test"

/**
 * axe-core em navegador numa rota autenticada. Instrumento, nao guarda.
 *
 * Usa o axe-core do node_modules (devDependency), nao CDN: o numero nao pode
 * depender da versao que um CDN servir no dia.
 *
 * ROTA (obrigatoria), TEMA=claro|escuro (padrao claro), LARGURA em px (padrao 1440).
 * O tema e forcado por `localStorage.theme`, que e onde o next-themes le.
 */
// O Playwright roda a partir de ArchSmart-web/ (onde esta playwright.config.ts).
const AXE = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js")

test("axe na ROTA", async ({ page }) => {
    const rota = process.env.ROTA
    const tema = process.env.TEMA === "escuro" ? "dark" : "light"
    const largura = Number(process.env.LARGURA ?? 1440)
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!rota) throw new Error("ROTA nao definida")
    if (!email || !password) throw new Error("E2E_EMAIL/E2E_PASSWORD nao definidos (ArchSmart-web/.env.e2e.local)")

    await page.setViewportSize({ width: largura, height: 900 })
    await page.addInitScript((t) => localStorage.setItem("theme", t), tema)

    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    await page.goto(rota)
    await page.waitForLoadState("networkidle")
    await page.addScriptTag({ path: AXE })

    const violacoes = await page.evaluate(async () => {
        const r = await (window as unknown as { axe: { run: () => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe.run()
        return r.violations.map((v) => ({ id: v.id, impacto: v.impact, alvos: v.nodes.map((n) => n.target.join(" ")) }))
    })

    console.log(`ROTA=${rota} TEMA=${tema} LARGURA=${largura}`)
    console.log(`AXE_VIOLACOES=${violacoes.map((v) => `${v.id}(${v.alvos.length})`).join(",") || "nenhuma"}`)
    console.log(`AXE_TOTAL_NOS=${violacoes.reduce((s, v) => s + v.alvos.length, 0)}`)
    for (const v of violacoes) console.log(`  ${v.id} [${v.impacto}]: ${v.alvos.join(" | ")}`)
})
```

Rode o "antes" (API local, `npm run dev`, credencial carregada), nas 8 combinações:

```bash
for r in /dashboard /projects; do for t in claro escuro; do for l in 390 1440; do
  ROTA=$r TEMA=$t LARGURA=$l npx playwright test e2e/medicao-axe.spec.ts --reporter=line --timeout=180000 2>&1 | grep -E "^(ROTA|AXE_|  )"
done; done; done
```
Esperado: `button-name` e `region` nas oito, `color-contrast` do item ativo da Sidebar em claro/1440. **Cole a saída inteira nas notas** — é o "antes".

- [ ] **Step 2: Teste de unidade**

`src/__tests__/shell-acessibilidade.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Header } from "@/components/layout/app-shell/Header"
import { NotificationPanel } from "@/components/layout/app-shell/NotificationPanel"
import { GlobalChatWidget } from "@/components/layout/GlobalChatWidget"

vi.mock("next/navigation", () => ({
    usePathname: () => "/projects",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn(), resolvedTheme: "light" }) }))
vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "tok", signOut: vi.fn() }))

/**
 * Os quatro defeitos do shell que o axe achou em 14/09/2026
 * (docs/dev/medicoes/2026-09-14-passada-de-navegador.md, "o shell").
 * jsdom nao mede contraste nem visibilidade; o que ele prova e nome acessivel,
 * landmark e `inert`. O resto e o instrumento `e2e/medicao-axe.spec.ts`.
 */
describe("shell: nome acessivel, landmark e foco fora do que esta fechado", () => {
    it("o menu do usuario no Header tem nome", () => {
        render(
            <Header
                notificationsOpen={false}
                setNotificationsOpen={vi.fn()}
                mobileMenuOpen={false}
                setMobileMenuOpen={vi.fn()}
                unreadCount={0}
            />,
        )
        expect(screen.getByRole("button", { name: "Menu da conta" })).toBeInTheDocument()
    })

    it("o painel de notificacoes e uma regiao nomeada e, fechado, fica inert", () => {
        const { rerender, container } = render(
            <NotificationPanel isOpen={false} onClose={vi.fn()} notifications={[]} onMarkAsRead={vi.fn()} />,
        )
        const painel = container.querySelector("aside")
        expect(painel).not.toBeNull()
        expect(painel).toHaveAttribute("aria-label", "Notificações")
        expect(painel).toHaveAttribute("inert")

        rerender(<NotificationPanel isOpen onClose={vi.fn()} notifications={[]} onMarkAsRead={vi.fn()} />)
        expect(painel).not.toHaveAttribute("inert")
        expect(within(painel as HTMLElement).getByRole("button", { name: "Fechar notificações" })).toBeInTheDocument()
    })

    it("o chat: botao flutuante com nome; janela fechada inert; aberta, o flutuante fica inert", async () => {
        const usuario = userEvent.setup()
        const { container } = render(<GlobalChatWidget />)

        const regiao = container.querySelector("aside")
        expect(regiao).toHaveAttribute("aria-label", "Assistente Arq Smart")

        const abrir = screen.getByRole("button", { name: "Abrir assistente" })
        const janela = container.querySelector("[data-chat-janela]")
        expect(janela).toHaveAttribute("inert")

        await usuario.click(abrir)
        expect(janela).not.toHaveAttribute("inert")
        expect(abrir).toHaveAttribute("inert")
        expect(screen.getByRole("button", { name: "Fechar assistente" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeInTheDocument()
    })
})
```

Confira as props reais de `NotificationPanel` (`grep -n "interface NotificationPanelProps" -A6 src/components/layout/app-shell/NotificationPanel.tsx`) e ajuste o teste se o nome ou o tipo de alguma divergir — sem mudar o que ele afirma.

Run: `npx vitest run src/__tests__/shell-acessibilidade.test.tsx`
Esperado: FAIL nos três.

- [ ] **Step 3: Consertar**

`Header.tsx`, no `<button suppressHydrationWarning ...>` do `DropdownMenuTrigger`: acrescente `aria-label="Menu da conta"`, e `aria-hidden="true"` no `<User .../>` e no `<ChevronDown .../>`.

`NotificationPanel.tsx`:
- O `<div className={\`fixed top-0 right-0 ...\`}>` raiz vira `<aside aria-label="Notificações" inert={!isOpen} className={...mesmas classes...}>`, e o `</div>` de fechamento correspondente vira `</aside>`.
- O `<button onClick={onClose} ...>` ganha `aria-label="Fechar notificações"`; o `<X .../>` dentro dele ganha `aria-hidden="true"`.

`GlobalChatWidget.tsx`:
- Envolva o fragmento retornado (`<>...</>`) num `<aside aria-label="Assistente Arq Smart">...</aside>` no lugar do fragmento.
- O `<Card className={...}>` da janela ganha `data-chat-janela` e `inert={!isOpen}`.
- O botão de fechar do `CardHeader` ganha `aria-label="Fechar assistente"`; o de enviar, `aria-label="Enviar mensagem"`; o flutuante, `aria-label="Abrir assistente"` e `inert={isOpen}`. Os ícones dentro dos três ganham `aria-hidden="true"`.

`Sidebar.tsx`, no `Link` de cada item:
- a classe ativa `"bg-primary/10 text-primary shadow-sm border-l-2 border-primary"` vira `"bg-primary/10 text-foreground font-semibold shadow-sm border-l-2 border-primary"` — texto do item ativo sobre o tom de `primary` media 4,17:1; `foreground` sobre o mesmo fundo passa com folga, e o destaque continua na borda e no ícone;
- `<item.icon className="h-4 w-4" />` vira `<item.icon className={\`h-4 w-4 ${isActive ? "text-primary" : ""}\`} aria-hidden="true" />` (ícone é não-texto: piso de 3:1, e 4,17 passa);
- acrescente `aria-current={isActive ? "page" : undefined}` ao `Link`.

Se `MobileSidebar.tsx` repetir a mesma classe ativa (`grep -n "text-primary shadow-sm" src/components/layout/app-shell/MobileSidebar.tsx`), aplique a mesma troca e diga no commit.

- [ ] **Step 4: Rodar**

```bash
npx vitest run src/__tests__/shell-acessibilidade.test.tsx src/__tests__/app-shell.test.tsx
npm run typecheck && npm test
python ../tools/catraca.py
```
Esperado: PASS; o `app-shell.test.tsx` (caracterização) **verde sem edição** — se precisar editar, a mudança alterou comportamento e deve ser revista, não o teste; typecheck limpo; `tabindex_negativo` **igual** (3); nenhuma medida pior.

- [ ] **Step 5: O "depois" do axe**

Rode o mesmo laço do Step 1. Esperado: `button-name` e `region` **somem** das oito combinações e o `color-contrast` da Sidebar some em claro/1440. O que sobrar (da própria tela) vai listado. Cole antes e depois lado a lado nas notas.

- [ ] **Step 6: Teclado (por agente)**

Em `/projects`, 1440px: dar `Tab` desde o topo até o fim da página e registrar a sequência de elementos focados (`document.activeElement` a cada passo). Esperado: **nenhuma** parada em elemento com opacidade efetiva 0 ou fora da viewport — as três paradas invisíveis de 14/09 não aparecem. Registrar com o rótulo de passada por agente.

- [ ] **Step 7: Commit**

```bash
git add ArchSmart-web/e2e/medicao-axe.spec.ts ArchSmart-web/src/components/layout ArchSmart-web/src/__tests__/shell-acessibilidade.test.tsx
git commit -m "fix(shell): nome acessivel, landmarks e inert no que esta fechado; contraste do item ativo

Item 4 do bloco do Dashboard: button-name (5 nos, critico), 3 paradas de Tab
invisiveis, region (6 nos), Sidebar ativa a 4,17:1. axe antes/depois nas notas
da Tarefa 11.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Guardas e2e, medições "depois", doc do módulo — e a parada para a verificação humana

**Files:**
- Create: `ArchSmart-web/e2e/projetos-dados.ts`, `ArchSmart-web/e2e/hidratacao-projetos.spec.ts`, `ArchSmart-web/e2e/telemetria-projetos.spec.ts`
- Modify: `.github/workflows/e2e.yml` (a linha dos specs de guarda)
- Modify: `docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md` (o "depois")
- Create: `docs/dev/modulos/projects.md`
- Modify: `PROGRESS.md`, `CLAUDE.md`

- [ ] **Step 1: A espera compartilhada**

`e2e/projetos-dados.ts`:

```ts
import type { Page } from "@playwright/test"

/**
 * Espera a lista de Projetos resolver — e nomeia a falha quando o desfecho foi
 * erro. Mesmo contrato de `dashboard-dados.ts`: esperar so pelo sucesso faria
 * uma falha virar timeout mudo.
 */
export async function esperarListaDeProjetos(page: Page): Promise<void> {
    await page.waitForSelector("[data-testid='projetos-pagina'], [data-testid='projetos-vazio'], [data-testid='projetos-error']")
    await falharSeErro(page, "projetos-error", "a lista de Projetos")
}

/** Espera os ambientes do detalhe resolverem (a regiao `principal`). */
export async function esperarAmbientesDoProjeto(page: Page): Promise<void> {
    await page.waitForSelector(
        "[data-testid='projeto-ambientes'] :is(h3, h4), [data-testid='projeto-error']",
    )
    await falharSeErro(page, "projeto-error", "o detalhe do projeto")
}

async function falharSeErro(page: Page, testid: string, oQue: string): Promise<void> {
    const erro = page.locator(`[data-testid='${testid}']`)
    if ((await erro.count()) > 0) {
        const texto = (await erro.first().innerText()).replace(/\s+/g, " ").trim()
        throw new Error(`${oQue} falhou em vez de carregar: ${texto}`)
    }
}
```

(O seletor dos ambientes casa o `h3` "Caderno de Ambientes" do workspace com dados e o `h4` "Construa o projeto" do vazio — os dois só existem depois de a região resolver; o skeleton não tem título.)

- [ ] **Step 2: Guarda de hidratação**

`e2e/hidratacao-projetos.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

import { esperarAmbientesDoProjeto, esperarListaDeProjetos } from "./projetos-dados"

/**
 * O prefetch de Projetos hidrata: abrir a lista e o detalhe direto (navegacao
 * de servidor) nao pode emitir /api/projects* do navegador.
 *
 * `networkidle` antes de contar: o conteudo vem renderizado do SERVIDOR, e uma
 * chamada disparada por efeito depois da hidratacao sairia depois do seletor
 * (o defeito que a guarda do Dashboard so pegou depois de provada vermelha).
 */
async function entrar(page: import("@playwright/test").Page) {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
        throw new Error("E2E_EMAIL e/ou E2E_PASSWORD nao definidos. Localmente: ArchSmart-web/.env.e2e.local")
    }
    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")
}

function contarPedidos(page: import("@playwright/test").Page): string[] {
    const pedidos: string[] = []
    page.on("request", (r) => {
        if (new URL(r.url()).pathname.startsWith("/api/projects")) pedidos.push(r.url())
    })
    return pedidos
}

test("a lista de Projetos nao busca /api/projects no navegador no primeiro carregamento", async ({ page }) => {
    await entrar(page)
    await page.goto("/projects")
    await esperarListaDeProjetos(page) // aquece: cold start nao e falha de hidratacao

    const pedidos = contarPedidos(page)
    await page.goto("/projects")
    await esperarListaDeProjetos(page)
    await page.waitForLoadState("networkidle")

    expect(pedidos, `a lista pediu no navegador: ${pedidos.join(", ")}`).toHaveLength(0)
})

test("o detalhe nao busca projeto nem ambientes no navegador no primeiro carregamento", async ({ page }) => {
    await entrar(page)
    await page.goto("/projects")
    await esperarListaDeProjetos(page)
    const href = await page.locator("a[href^='/projects/']").first().getAttribute("href")
    if (!href) throw new Error("a conta de teste nao tem projeto: a guarda do detalhe precisa de um")

    await page.goto(href)
    await esperarAmbientesDoProjeto(page) // aquece

    const pedidos = contarPedidos(page)
    await page.goto(href)
    await esperarAmbientesDoProjeto(page)
    await page.waitForLoadState("networkidle")

    expect(pedidos, `o detalhe pediu no navegador: ${pedidos.join(", ")}`).toHaveLength(0)
})
```

**Provar vermelho, antes de acreditar no verde:** em `ProjetosContent.tsx`, acrescente temporariamente `useEffect(() => { void api("/api/projects", { query: { page: 1, size: 1 } }) }, [])` (com os imports de `useEffect` e `api`), rode a guarda da lista, **confirme que reprova** citando a URL, e desfaça. Repita no `ProjetoContent.tsx` com `/api/projects/<id>`. Registre as duas reprovações nas notas. Nenhuma das duas mudanças temporárias pode entrar em commit (`git diff` limpo antes do Step 9).

```bash
cd ArchSmart-web && set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/hidratacao-projetos.spec.ts --reporter=line --timeout=180000
```
Esperado, sem a injeção: 2 passed.

- [ ] **Step 3: Guarda de telemetria**

Copie `e2e/telemetria-dashboard.spec.ts` para `e2e/telemetria-projetos.spec.ts` e troque **só** o que é da tela — mesma regra de duplicação aceita que o spec do Dashboard registra:
- o import de espera: `import { esperarListaDeProjetos } from "./projetos-dados"`;
- toda chamada a `esperarPainelDoDashboard(page)` → `esperarListaDeProjetos(page)`;
- a rota de partida do clique: de `/library` para `/dashboard`;
- o link clicado: `a[href='/projects']` (o da sidebar, `src/config/navigation.ts`);
- o `screen` filtrado: `/projects`;
- a precondição de dados, se o spec do Dashboard tiver uma: a conta precisa ter ao menos um projeto (`projetos-pagina` visível), senão `is_empty` sai `true` e a asserção de dados muda;
- o docstring: "Copia adaptada de `telemetria-dashboard.spec.ts` (Tarefa 12 da migração de Projetos, Seção 8)".

As asserções finais (`medido_ate: "dados"`, `medido_de: "clique"`, `principal_declarada: true`, faixa de `load_ms`, uma linha só) **não mudam**.

```bash
npx playwright test e2e/telemetria-projetos.spec.ts --reporter=line --timeout=180000
```
Esperado: 1 passed. Rode **três vezes** seguidas; as três passam.

- [ ] **Step 4: As guardas no workflow**

Em `.github/workflows/e2e.yml`, na linha dos specs de guarda, depois de `e2e/telemetria-dashboard.spec.ts`:

```yaml
          e2e/hidratacao-projetos.spec.ts
          e2e/telemetria-projetos.spec.ts
```

E em `CLAUDE.md`, na seção "Portões de CI", a enumeração dos specs de guarda ganha os dois nomes, e a de instrumentos ganha `medicao-carga` e `medicao-axe`.

- [ ] **Step 5: As medições "depois"**

Com `npm run build && npm run start` e API local:

1. **LCP e JS** — o laço do Step 4 da Tarefa 1, nas três rotas. Preencha a coluna "depois" de `docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md`. Biblioteca e Dashboard mudaram só pelas Tarefas 9–11 (shell, token, prefetch); diga isso ao lado dos números deles.
2. **Clique → dados** — crie `e2e/medicao-projetos.spec.ts` copiando `e2e/medicao-dashboard.spec.ts` e trocando só: o import para `esperarListaDeProjetos` de `./projetos-dados`; o aquecimento para `page.goto("/projects")` + `esperarListaDeProjetos(page)`; no laço, a partida para `page.goto("/dashboard")` e o clique para `a[href='/projects']`; a espera final para `esperarListaDeProjetos(page)`; o título do teste e o docstring ("cópia adaptada, Tarefa 12 da migração de Projetos"). É instrumento, fora do `e2e.yml`. Rode com `npx playwright test e2e/medicao-projetos.spec.ts --reporter=line --timeout=180000` (API local, `npm run dev`, como as medições das telas anteriores) e registre `AMOSTRAS` e `MEDIANA_MS` contra o alvo de < 1,5 s.
3. **Consultas por carregamento** — os números da Tarefa 2 (suíte). Contra o banco de staging com o app real, **só** se o `ArchSmart-api/.env` apontar para staging — confira o bloco ativo antes, e registre qual conferiu.
4. **P95 da API implantada** — **só depois do deploy** em staging (PR `develop` → `staging`). Mesmo procedimento de `docs/dev/modulos/dashboard.md`, "Os números medidos", trocando `lean` por `/api/projects` e `/api/projects/<id>/environments`. Primeiro, a impressão digital: a resposta de `/api/projects` tem `active_count`; sem ele, o contêiner ainda não é o desta tarefa e nenhum número vale. Registrado como **"não atingido, por distância, não pela tela"** se estourar os 400 ms (decisão 1 da spec do Dashboard).
5. **`load_ms` em `product_events`** — `/projects` com `medido_ate=dados`, mediana e n, lembrando que linha vinda de front local contra banco de staging não é linha do deployment.

- [ ] **Step 6: A passada por agente**

Com o instrumento de axe (Tarefa 11) em `/projects` e `/projects/<id>`, nos dois temas, em 390px e 1440px; teclado em lista e detalhe (incluindo abrir e fechar o wizard e o diálogo de excluir sem mouse); e capturas das 8 combinações. Tudo registrado em `docs/dev/modulos/projects.md` com o rótulo *"verificado por agente sobre captura de tela e medição no DOM — não por olho humano"*.

- [ ] **Step 7: A doc do módulo**

`docs/dev/modulos/projects.md`, no molde de `docs/dev/modulos/dashboard.md`: o que a tela é; a exceção de `/me` (decisão 2) com a condição exata; o mapa de invalidação (a tabela da spec) e por que `router.refresh()` fica nas mutações de projeto; `invalidar` vs. `descartar`; o `notFound` dentro do Suspense (200, não 404); os números medidos com comando; e a **tabela da definição de pronto item a item**, com ✅, ❌ ou ⚠️ e o rótulo honesto de cada um (por agente, por olho humano, não medido).

Rode `python tools/checa_links.py` e `python tools/catraca.py` — `modulos_sem_doc`, se medir `features/projects`, deve continuar igual ou descer.

- [ ] **Step 8: ⛔ PARADA — verificação humana antes do merge**

**Não siga para o merge.** Entregue a Thiago esta lista, preenchida com os ids reais, e **espere a resposta**:

```
Verificação humana — Projetos (Seção 8). Rodando em: <URL local ou de preview>

Para cada linha: abrir, olhar, e responder "ok" ou o que está errado.

Rotas: /projects, /projects/<id>, /dashboard, /library
Larguras: 390px e 1440px · Temas: claro e escuro  (16 combinações)

1. Botão "Excluir" do projeto e "Excluir Projeto Permanentemente" — o vermelho
   novo. No escuro, o texto do botão destrutivo agora é ESCURO sobre vermelho
   claro. Aceitável?
2. Dashboard: valores de despesa e saldo negativo — trocaram text-red-* pelo
   token. Legíveis nos dois temas?
3. Sidebar: o item ativo passou de texto teal para texto padrão com borda e
   ícone teal. O item ativo continua óbvio?
4. Lista de Projetos: card de limite (x/y), estado vazio (conta sem projeto, se
   houver), e o estado de erro (derrubar a API local e recarregar).
5. Detalhe: cabeçalho, ambientes, criar/editar DNA/excluir ambiente.
6. Teclado: Tab do topo ao fim de /projects — o anel de foco é visível em
   todos os passos? Algum foco some da tela?
7. 390px: algo estoura na horizontal em alguma das 4 rotas? (A Biblioteca
   estourava 42px; a causa conhecida é o p-8 de library/page.tsx:14, que esta
   tarefa NÃO mexeu.)
8. Hierarquia e ordem de leitura das duas telas de Projetos: fazem sentido?
```

O que Thiago responder vai para `docs/dev/modulos/projects.md`, numa seção "Verificação humana", **com o nome dele como verificador e a data**, item a item. Defeito apontado vira commit próprio **só com ok dele**; item não olhado continua ⚠️ na tabela de pronto, nunca ✅.

- [ ] **Step 9: Fechar a documentação**

Depois da resposta de Thiago:
- `PROGRESS.md`: `- [ ] Projetos (lista + detalhe)` → `- [x]`, e uma nota "## Projetos, <data> — a terceira tela" no molde da nota do Dashboard: o que entrou, os números, os itens da definição de pronto em ⚠️ e por quê, e o que fica em aberto.
- `CLAUDE.md`: no parágrafo "Estado em...", a Seção 8 passa a 3/9; o bloco "O que o Dashboard (Seção 8) deixou em aberto" ganha, em cada item fechado, a nota de fechamento datada (itens 2, 4, 7, 8-metade, 9, 11, 12); e um bloco novo "O que Projetos (Seção 8) deixou em aberto — planejar antes da próxima tela", com no mínimo: `router.refresh()` nas mutações de projeto até Orçamento e Apresentações migrarem; a exceção de `/me`; o "Plano Solo"; o que `texto_sobre_fundo_reprovado` não mede; o `notFound` com status 200; e cada defeito que a verificação humana apontou e não foi consertado.
- `python tools/progresso.py --check`, `python tools/checa_links.py`, `python tools/catraca.py`, `cd tools && python -m unittest discover -p "test_*.py"`.

- [ ] **Step 10: Portões finais e commit**

```bash
cd ArchSmart-web && npm run typecheck && npm test && cd ..
cd ArchSmart-api && ./venv/Scripts/python.exe -m pytest -q && cd ..
python tools/catraca.py && python tools/progresso.py --check && python tools/checa_links.py
cd tools && python -m unittest discover -p "test_*.py"; cd ..
git status   # sem a injecao temporaria do Step 2
```
Esperado: tudo verde; cole as linhas de resumo no corpo do commit.

```bash
git add ArchSmart-web/e2e .github/workflows/e2e.yml docs PROGRESS.md CLAUDE.md
git commit -m "docs(secao-8): fecha Projetos — guardas e2e, medicoes, doc do modulo e verificacao humana

<linhas de resumo dos portoes>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Depois: `superpowers:finishing-a-development-branch` — merge em `develop` e PR `develop` → `staging`, como nas duas telas anteriores. O P95 da API implantada (Step 5, item 4) é medido **depois** desse deploy e entra num commit `docs` em `develop`, como o Dashboard fez.
