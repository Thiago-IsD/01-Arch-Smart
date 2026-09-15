# A passada de navegador — Dashboard, Biblioteca e a captura da Seção 6, 14/09/2026

> ⚠️ **Esta passada mede por agente e não fecha o que depende de olho humano.**
> Tudo o que está marcado como visual aqui foi verificado por agente sobre
> captura de tela e medição no DOM — não por olho humano. Nenhuma pessoa abriu
> estas telas. O que se afirma é o que o Chromium do Playwright renderizou, o
> que `axe-core` reportou, o que `getComputedStyle` e `getBoundingClientRect`
> devolveram, e o que o agente leu nas imagens. Por isso cada veredicto visual
> abaixo carrega o rótulo por extenso, e item que só olho humano decide
> (hierarquia, perceptibilidade do anel, legibilidade) vai como **não
> verificado**, nunca como passou.

Tarefa 6 da migração do Dashboard (Seção 8). Os três itens da definição de
pronto que a Biblioteca deixou abertos (item 2 de "O que a Biblioteca (Seção 8)
deixou em aberto" no `CLAUDE.md` da raiz: axe em navegador, teclado,
390px/1440px) **ganharam medição por agente — não foram fechados**: continuam
dependendo de alguém abrir as telas. A passada também olha os dois riscos do
item 3 e roda pela primeira vez a captura visual da Seção 6.

## Arranjo

- Front: `npm run dev` na máquina de desenvolvimento, branch `secao-8-dashboard`
  (commit `ed40e8f` na passada inicial; `f95dce2` na repassada do Dashboard e na
  reconferência de números).
- API: `uvicorn app.main:app --port 8000` local, apontada para o **banco de
  staging** — o mesmo arranjo das medições da Seção 8. Nada foi escrito no banco
  além do que login e telemetria já escrevem; o DELETE da captura do toast foi
  interceptado no navegador (`DELETE_INTERCEPTADO=true`, rota `**/*`) e nunca
  saiu.
- Conta: o usuário de teste E2E (`ana.arquiteta@seed.arqsmart.local`), senha em
  `ArchSmart-web/.env.e2e.local`.
- Navegador: Chromium do Playwright, headless. Larguras `390x844` e `1440x900`
  por `page.setViewportSize`.
- Os roteiros são scripts Node fora do repositório, não spec versionado: a saída
  deles é imagem e JSON lidos por quem executa, sem asserção que sirva de guarda,
  e um terceiro instrumento em `e2e/` seria mais um arquivo que o `e2e.yml`
  precisa lembrar de não rodar. **O código que produz cada número está neste
  arquivo**, nos blocos abaixo. Todos os números de largura, contraste,
  experimento de DOM, `min-height`, `aria-hidden` e foco foram **reconferidos
  numa segunda execução** do script de reconferência (fix round 1 da tarefa, no
  mesmo dia), e bateram com a primeira.

Como rodar (a partir de `ArchSmart-web/`, com API e front de pé):

```
set -a; . ./.env.e2e.local; set +a
node "$TEMP/passada-dashboard/reconferencia.cjs"   # fora do repo; e a juncao dos blocos abaixo
```

Login e navegação que todos os blocos usam:

```js
const { chromium } = require("playwright")
const page = await (await (await chromium.launch()).newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.goto(BASE + "/auth/login")
await page.getByLabel(/e-mail/i).fill(process.env.E2E_EMAIL)
await page.getByLabel(/senha/i).fill(process.env.E2E_PASSWORD)
await page.getByRole("button", { name: /entrar/i }).click()
await page.waitForURL("**/dashboard", { timeout: 120000 })

async function abrir(page, url, pronto) {       // pronto: os testids de painel/lista/erro
  await page.goto(BASE + url)
  await page.waitForSelector(pronto, { timeout: 120000 })
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(500)
}
```

**Tema** — o mecanismo da própria aplicação: `next-themes` com
`attribute="class"` e chave `theme` no `localStorage` (`src/app/layout.tsx`).
Conferido em cada combinação lendo a classe do `<html>` (saída abaixo, em
"Largura": `"html":"light"` / `"html":"dark"`).

```js
async function setTema(page, tema) {           // "light" | "dark", antes do goto
  await page.emulateMedia({ colorScheme: tema })
  await page.evaluate((t) => localStorage.setItem("theme", t), tema)
}
```

**axe em navegador:**

```js
await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js" })
const r = await page.evaluate(() => axe.run())  // r.violations[].id, .impact, .nodes (target, html, any[0].data)
```

**Largura** — estouro horizontal:

```js
await page.evaluate(() => ({
  html: document.documentElement.className,
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
}))
```

**Teclado** — `Tab` repetido a partir do topo, lendo o foco a cada passo.
"Anel visível" quer dizer `outline` com largura > 0 **ou** `box-shadow` ≠
`none`, **e** opacidade efetiva (produto das opacidades dos ancestrais) > 0.
Isso prova que existe anel pintado, não que ele seja perceptível — essa parte
é de olho humano e fica não verificada.

```js
await page.keyboard.press("Tab")
await page.evaluate(() => {
  const el = document.activeElement, cs = getComputedStyle(el)
  let op = 1
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity)
  const b = el.getBoundingClientRect()
  return { tag: el.tagName, texto: el.innerText, href: el.getAttribute("href"),
    outline: `${cs.outlineStyle} ${cs.outlineWidth}`, sombra: cs.boxShadow, opacidadeEfetiva: op,
    rect: [b.left, b.top, b.width, b.height] }
})

// Acionamento: Tab ate o alvo, depois a tecla, depois a URL
async function tabAte(page, predicado) {
  for (let i = 1; i <= 60; i++) { await page.keyboard.press("Tab"); if (await page.evaluate(predicado)) return i }
  return -1
}
await tabAte(page, () => (document.activeElement.innerText || "").includes("Criar Projeto"))
await page.keyboard.press("Space")             // e "Enter", noutra carga
await page.waitForURL("**/projects**", { timeout: 60000 })
```

## Os guardas do Dashboard

```
cd ArchSmart-web
set -a && . ./.env.e2e.local && . ./.env.local && set +a
npx playwright test e2e/hidratacao-dashboard.spec.ts e2e/telemetria-dashboard.spec.ts --reporter=line --timeout=180000 --repeat-each=3
```

**`6 passed`**, duas vezes antes do conserto de contraste (uma com
`--workers=1`, uma sem), e de novo depois de `f95dce2`. Os dois da Biblioteca,
sem edição, como prova de que a Tarefa 1 não mudou a tela:

```
npx playwright test e2e/hidratacao-biblioteca.spec.ts e2e/telemetria-biblioteca.spec.ts --reporter=line --timeout=180000
```

**`2 passed`**, antes e depois do conserto.

Os dois specs novos entraram na linha de guarda de `.github/workflows/e2e.yml`.

### O guarda de hidratação reprova — prova vermelho → verde

A primeira versão do `hidratacao-dashboard.spec.ts` afirmava logo depois de
`esperarPainelDoDashboard`, que resolve quando `dashboard-painel` está no DOM —
e esse painel vem renderizado do **servidor**. Uma chamada disparada por efeito
depois da hidratação sairia depois do `expect`. O spec passou a esperar
`page.waitForLoadState("networkidle")` antes de afirmar, e a prova de que ele
reprova foi feita assim:

1. Regressão **temporária**, nunca commitada, em
   `src/app/(dashboard)/dashboard/components/DashboardContent.tsx`:

   ```tsx
   import { api } from "@/lib/api/client"
   // dentro de DashboardContent(), logo depois de useDashboard():
   useEffect(() => { void api("/api/users/me").catch(() => {}) }, []) // REGRESSAO TEMPORARIA - NAO COMMITAR
   ```

2. Guarda com a regressão:

   ```
   npx playwright test e2e/hidratacao-dashboard.spec.ts --reporter=line --timeout=180000
   ```

   ```
   Error: o primeiro carregamento de /dashboard pediu no navegador: http://localhost:8000/api/users/me — o prefetch nao esta sendo aproveitado, ou o card voltou a chamar users/me
   expect(received).toHaveLength(expected)
   Expected length: 0
   Received length: 1
   Received array:  ["http://localhost:8000/api/users/me"]
     1 failed
   ```

3. Reversão: `git checkout -- "ArchSmart-web/src/app/(dashboard)/dashboard/components/DashboardContent.tsx"`;
   `git diff --stat` nesse arquivo → vazio (0 linhas).

4. Guarda sem a regressão:

   ```
   npx playwright test e2e/hidratacao-dashboard.spec.ts --reporter=line --timeout=180000 --repeat-each=3
     3 passed (8.5s)
   npx playwright test e2e/telemetria-dashboard.spec.ts --reporter=line --timeout=180000 --repeat-each=3
     3 passed (13.6s)
   ```

## Dashboard (`/dashboard`)

Dados da conta no dia: saldo, receitas e despesas **R$ 0,00**; 2 projetos
ativos (limite 2); nenhum compromisso; 5 produtos recentes, todos sem imagem.

### axe em navegador

Passada inicial (commit `ed40e8f`), violações por combinação — `id` (nós):

| Tema | Largura | Violações |
|---|---|---|
| claro | 390 | `button-name` (5), `color-contrast` (8), `region` (6) |
| claro | 1440 | `button-name` (5), `color-contrast` (9), `region` (6) |
| escuro | 390 | `button-name` (5), `region` (6) |
| escuro | 1440 | `button-name` (5), `region` (6) |

De onde vem cada nó (seletor e HTML do nó, lidos na saída do axe):

- **`color-contrast`, componentes do próprio Dashboard — consertado no commit
  `f95dce2`** (ver "Achados consertados"). Razões calculadas pelo axe
  (`any[0].data.contrastRatio`):
  - `ProjectsLimitCard`, badge "Plano Solo": `text-secondary` sobre
    `bg-secondary/10`, **2,28:1** (10px).
  - `UpcomingEventsColumn`, "Agenda Completa": `text-secondary` sobre branco,
    **2,48:1**.
  - `UpcomingEventsColumn`, "Agendar Reunião": `text-secondary` sobre branco,
    **2,48:1**.
  - `RecentProductsColumn`, "Sem imagem" (5 nós): `text-muted-foreground` sobre
    `bg-muted`, **4,34:1** (12px) — o par que a Tarefa 5 introduziu.
- **`color-contrast`, shell** — 1 nó só em 1440 (a sidebar some em 390): o item
  ativo da `Sidebar`, `#008080` sobre `#e6f2f2`, **4,17:1**.
- **`button-name` (5), shell**: o botão do menu do usuário no `Header`; o botão
  de fechar do `NotificationPanel`; fechar, enviar e o botão flutuante do widget
  de chat.
- **`region` (6), shell**: conteúdo do `NotificationPanel` e do widget de chat
  fora de landmark.

**Depois do conserto** (commit `f95dce2`, mesmo bloco de axe, as quatro
combinações): `color-contrast` dos componentes do Dashboard = **0**. Sobra, em
claro/1440, só o nó da `Sidebar`; `button-name` (5) e `region` (6) iguais, todos
do shell.

### Os valores grandes das métricas, e os dois vermelhos que a Tarefa 5 manteve

_Verificado por agente sobre captura de tela e medição no DOM — não por olho
humano._ Cor computada do texto sobre o primeiro fundo opaco ancestral, fórmula
WCAG, em 1440:

```js
await page.evaluate(() => {
  const rgb = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
  const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
  const fundo = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.a > 0.99) return c } return { r: 255, g: 255, b: 255 } }
  return [...document.querySelectorAll("div.text-2xl")].map((el) => {
    const fg = rgb(getComputedStyle(el).color), bg = fundo(el), [a, b] = [lum(fg), lum(bg)]
    return { classe: el.className, cor: getComputedStyle(el).color, contraste: ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2) }
  })
})
```

Saída (claro e escuro):

```
CONTRASTE[light]  text-foreground  rgb(54, 70, 78)    sobre rgb(255, 255, 255)  9.80
                  text-success     rgb(21, 127, 60)   sobre rgb(255, 255, 255)  5.08
                  text-red-600     rgb(220, 38, 38)   sobre rgb(255, 255, 255)  4.83
CONTRASTE[dark]   text-foreground  rgb(248, 250, 252) sobre rgb(2, 8, 23)       19.12
                  text-success     rgb(71, 209, 122)  sobre rgb(2, 8, 23)       10.16
                  dark:text-red-400 rgb(248, 113, 113) sobre rgb(2, 8, 23)      7.23
```

| Valor | Classe | Tema | Contraste |
|---|---|---|---|
| Despesas | `text-red-600` | claro | **4,83:1** |
| Despesas | `dark:text-red-400` | escuro | **7,23:1** |
| Saldo | `text-foreground` (saldo ≥ 0) | claro / escuro | 9,80:1 / 19,12:1 |
| Saldo negativo | `text-red-500` | — | **não verificado** |

O saldo da conta era R$ 0,00, então o ramo `financial_balance >= 0` renderizou
`text-foreground` e `text-red-500` **não apareceu na tela**. Medir exige uma
conta com saldo negativo — não criada, porque escrever lançamento em staging
está fora do que esta tarefa podia fazer.

### Largura

_Verificado por agente sobre captura de tela e medição no DOM — não por olho
humano._ Bloco "Largura" do Arranjo:

| Tema | Largura | `html` | `scrollWidth` / `innerWidth` | Resultado |
|---|---|---|---|---|
| claro | 390 | `light` | 390 / 390 | sem estouro medido |
| escuro | 390 | `dark` | 390 / 390 | sem estouro medido |
| claro | 1440 | `light` | 1440 / 1440 | sem estouro medido |
| escuro | 1440 | `dark` | 1440 / 1440 | sem estouro medido |

Largura do painel em 1440:

```js
await page.evaluate(() => ({
  painel: Math.round(document.querySelector("[data-testid='dashboard-painel']").getBoundingClientRect().width),
  main: Math.round(document.querySelector("main").getBoundingClientRect().width),
}))
// PAINEL_1440={"painel":1120,"main":1184}
```

O painel mede **1120 px** num `main` de 1184 px (`max-w-7xl` com padding): o
limite de largura atua. "A grade não fica esticada" como impressão visual —
_verificado por agente sobre captura de tela e medição no DOM — não por olho
humano_ (`dashboard-light-1440-viewport.png`).

Observado na mesma captura, **não verificado como defeito**: o título "Próximos
Compromissos" quebra em duas linhas, enquanto "Continuar Trabalhando" e "Adições
na Biblioteca", nas colunas vizinhas, cabem em uma. Se isso atrapalha a leitura
é pergunta de olho humano.

### Teclado

Bloco "Teclado" do Arranjo, nas quatro combinações; resultado igual nos dois
temas.

- **Alcance e ordem** — _verificado por agente sobre captura de tela e medição
  no DOM — não por olho humano._ 1440: sidebar (6 links, "Ocultar"), cabeçalho
  (tema, notificações, menu do usuário), 3 ações rápidas, "Ver Todos", 2
  projetos, "Agenda Completa", "Agendar Reunião", "Ver Biblioteca", 5 produtos.
  390: o mesmo sem a sidebar ("Menu" no lugar). A sequência medida vai por
  colunas, da esquerda para a direita. Se ela "segue a leitura" para uma pessoa:
  **não verificado**.
- **Anel pintado** — _verificado por agente sobre captura de tela e medição no
  DOM — não por olho humano._ Todos os elementos interativos **do Dashboard**
  têm `box-shadow` de anel com opacidade efetiva 1. Se o anel é perceptível:
  **não verificado**.
- **O `group-focus-within` da Tarefa 5 em `RecentProjectsColumn`** —
  _verificado por agente sobre captura de tela e medição no DOM — não por olho
  humano._

  ```js
  const antes = await page.evaluate(() => getComputedStyle(document.querySelector("a[href^='/projects/'] svg")).opacity)
  await tabAte(page, () => (document.activeElement.getAttribute("href") || "").startsWith("/projects/"))
  await page.waitForTimeout(450)   // transicao
  await page.evaluate(() => ({ seta: getComputedStyle(document.activeElement.querySelector("svg")).opacity,
                               nome: getComputedStyle(document.activeElement.querySelector("h3")).color }))
  // SETA_PROJETO_FOCO={"antes":"0","depois":{"seta":"1","nome":"rgb(0, 128, 128)"}}
  ```

  A seta vai de `opacity: 0` para **`1`** e o nome do projeto passa a
  `rgb(0, 128, 128)` (primary), no passo 15 em 1440. Captura:
  `chk-dashboard-projeto-foco.png`.
- **`Enter`/`Espaço` acionam** — medido pela URL depois da tecla (bloco
  `tabAte` do Arranjo): `Enter` no link do projeto → `/projects/<id>`; `Espaço`
  e `Enter` em "Criar Projeto" → `/projects`; `Enter` em "Agenda Completa" →
  `/calendar` (a primeira tentativa, com espera fixa de 2,5 s, ficou em
  `/dashboard` porque o dev server ainda compilava `/calendar`; com
  `waitForURL` navegou).
- **Shell** — _verificado por agente sobre captura de tela e medição no DOM —
  não por olho humano._ Depois do último produto o foco cai em **três paradas
  invisíveis**: o botão de fechar do `NotificationPanel` fechado (fora da tela,
  `left: 1776` em 1440) e o botão de fechar e o campo "Digite sua mensagem..."
  do widget de chat fechado (opacidade efetiva **0**). A parada `NEXTJS-PORTAL`
  seguinte é o indicador do Next em desenvolvimento, que não existe em produção.

## Biblioteca (`/library`)

**Nada consertado aqui, de propósito** — a regra desta tarefa é registrar.

### axe em navegador

| Tema | Largura | Violações |
|---|---|---|
| claro | 390 | `aria-valid-attr-value` (1), `button-name` (8), `color-contrast` (18), `page-has-heading-one` (1), `region` (6) |
| claro | 1440 | `aria-valid-attr-value` (1), `button-name` (8), `color-contrast` (19), `page-has-heading-one` (1), `region` (6) |
| escuro | 390 | `aria-valid-attr-value` (1), `button-name` (8), `color-contrast` (15), `page-has-heading-one` (1), `region` (6) |
| escuro | 1440 | `aria-valid-attr-value` (1), `button-name` (8), `color-contrast` (15), `page-has-heading-one` (1), `region` (6) |

De onde vem cada nó, e a correção barata sugerida:

- **`aria-valid-attr-value` (1)** — a aba ativa "Biblioteca"
  (`LibraryToolbar`) tem `aria-controls` apontando para um `TabsContent` que não
  existe no DOM (`grep -rn TabsContent ArchSmart-web/src/components/library
  "ArchSmart-web/src/app/(dashboard)/library"` → 0): as abas trocam o conteúdo
  por query string. Sugestão: `TabsContent` vazio por aba, ou links com
  `aria-current`.
- **`button-name` (8)** — 3 da tela: o `SelectTrigger` de ordenação
  (`.w-[160px]`), o botão de filtro (só ícone) e o `SelectTrigger` de itens por
  página (`.w-[70px]`); 5 do shell, os mesmos do Dashboard. Sugestão:
  `aria-label` nos três.
- **`color-contrast`** — da tela: o badge "Normalizado" (`secondary`,
  `#36464e` sobre `#f88277`, **3,94:1**, 10px) em **cada card** — 15 nós nos
  dois temas; só no claro, as abas inativas "Inbox"/"Web Clipper" (`#64748b`
  sobre `#f1f5f9`, **4,34:1**) e o badge de contagem do Inbox (`destructive`,
  `#f8fafc` sobre `#ef4444`, **3,59:1**); mais a `Sidebar` em 1440 claro
  (shell). Os três pares são os reprovados conhecidos de
  [`componentes.md`](../componentes.md) (`secondary`, `muted`, `destructive`).
- **`page-has-heading-one` (1)** — o título "Biblioteca" é `h2`
  (`library/page.tsx:17`), e a página não tem `h1`.
- **`region` (6)** — shell, igual ao Dashboard.

### Largura — **estoura em 390**

_Verificado por agente sobre captura de tela e medição no DOM — não por olho
humano._ Bloco "Largura" do Arranjo:

| Tema | Largura | `html` | `scrollWidth` / `innerWidth` | Resultado |
|---|---|---|---|---|
| claro | 390 | `light` | **432** / 390 | **estouro de 42 px** |
| escuro | 390 | `dark` | **432** / 390 | **estouro de 42 px** |
| claro | 1440 | `light` | 1440 / 1440 | sem estouro medido |
| escuro | 1440 | `dark` | 1440 / 1440 | sem estouro medido |

Na captura `library-light-390-viewport.png`, o avatar do cabeçalho aparece
cortado na borda direita e "Adicionar Produto" encosta nela.

Medidas da toolbar e da área útil em 390:

```js
await page.evaluate(() => {
  const busca = document.querySelector("input[aria-label='Buscar produtos']")
  const linha = busca.closest(".flex-1")
  const w = (el) => Math.round(el.getBoundingClientRect().width)
  const vw = window.innerWidth, main = getComputedStyle(document.querySelector("main"))
  const raiz = getComputedStyle(document.querySelector("main > .p-8"))
  return {
    areaUtilEm390: vw - parseFloat(main.paddingLeft) - parseFloat(main.paddingRight)
                      - parseFloat(raiz.paddingLeft) - parseFloat(raiz.paddingRight),
    linha: w(linha), busca: w(busca.parentElement),
    ordenacao: w(linha.querySelector("button[role='combobox']")),
    filtro: w(linha.querySelector("button[aria-haspopup='dialog']")),
  }
})
// LIBRARY_390={"areaUtilEm390":278,"linha":320,"busca":177,"ordenacao":104,"filtro":23}
```

**A causa medida não é a toolbar.** Experimento no DOM — estilo injetado em
tempo de execução, código intocado, página recarregada antes de cada injeção:

```js
const INJECOES = {
  nenhuma: () => {},
  minW0NaBusca: () => { const i = document.querySelector("input[aria-label='Buscar produtos']"); i.style.minWidth = "0"; i.parentElement.style.minWidth = "0" },
  flexWrapNaToolbar: () => { document.querySelector("input[aria-label='Buscar produtos']").closest(".flex-1").style.flexWrap = "wrap" },
  asDuasDaToolbar: () => { const i = document.querySelector("input[aria-label='Buscar produtos']"); i.style.minWidth = "0"; i.parentElement.style.minWidth = "0"; i.closest(".flex-1").style.flexWrap = "wrap" },
  raizP4: () => { document.querySelector("main > .p-8").style.padding = "16px" },
  raizP4MaisWrapNoTitulo: () => {
    document.querySelector("main > .p-8").style.padding = "16px"
    const linha = [...document.querySelectorAll("a")].find((a) => a.innerText.includes("Adicionar Produto")).closest(".justify-between")
    linha.style.flexWrap = "wrap"; linha.style.gap = "8px"
  },
}
for (const [nome, fn] of Object.entries(INJECOES)) {
  await abrir(page, "/library", LISTA)
  await page.evaluate(fn)
  await page.waitForTimeout(200)
  console.log(nome, await page.evaluate(() => document.documentElement.scrollWidth))
}
```

| Injeção | `scrollWidth` |
|---|---|
| `nenhuma` | 432 |
| `minW0NaBusca` (risco `:180`) | 432 |
| `flexWrapNaToolbar` (risco `:167`) | 432 — ordenação volta a 160 px e filtro a 40 px |
| `asDuasDaToolbar` | 432 |
| `raizP4` (padding 16 px na raiz, `library/page.tsx:14`, hoje `p-8`) | 400 |
| `raizP4MaisWrapNoTitulo` | **390** |

A raiz soma `p-8` ao `p-6` do `main`, o que deixa **278 px** de área útil em
390; o link "Adicionar Produto" (182 px, `whitespace-nowrap`) ao lado do título
e a lista de abas (295 px) não cabem nisso.

**Correção barata sugerida (não aplicada):** `p-4 md:p-8` em
`src/app/(dashboard)/library/page.tsx:14` **e** `flex-wrap gap-2` na linha do
título. As duas juntas levaram o `scrollWidth` a 390 no experimento.

### Os dois riscos do item 3

- **`LibraryToolbar.tsx:167` e `:180`, em 390, nos dois temas** — _verificado
  por agente sobre captura de tela e medição no DOM — não por olho humano._ Não
  causam o estouro (tabela acima), mas **espremem**: a linha fica em 320 px,
  busca 177 px, ordenação encolhida de 160 para **104 px** (a captura mostra
  "Mais..." truncado) e o botão de filtro de 40 para **23 px** de largura — alvo
  de toque abaixo de 44 px. Com `flex-wrap` na linha, os dois voltam a 160 px e
  40 px. Correção barata sugerida: `flex-wrap` em `:167`.
- **`group-focus-within:opacity-100` do menu do `ProductCard`** — _verificado
  por agente sobre captura de tela e medição no DOM — não por olho humano._

  ```js
  await tabAte(page, () => document.activeElement.querySelector?.(".sr-only")?.textContent === "Ações")
  await page.waitForTimeout(450)
  await page.evaluate(() => getComputedStyle(document.activeElement.closest(".absolute")).opacity)
  // CARD_MENU_FOCO[1440]={"passo":16,"opacidadeDoWrapper":"1"}
  // CARD_MENU_FOCO[390]={"passo":10,"opacidadeDoWrapper":"1"}
  ```

  O wrapper (`opacity: 0` em repouso) chega a **`1`** com o foco nas duas
  larguras. `Espaço` abriu o menu (3 itens: Editar, Mover para Projeto,
  Excluir) e `Escape` devolveu o foco ao gatilho. Capturas:
  `chk-library-card-menu-foco-1440.png`, `chk-library-card-menu-foco-390.png`.
  Deixou de ser só "classe na árvore": o comportamento foi medido em navegador.

### Teclado

- **Alcance e ordem** — _verificado por agente sobre captura de tela e medição
  no DOM — não por olho humano._ Sidebar/cabeçalho, "Adicionar Produto", a aba
  ativa (as outras por setas — `tabindex` itinerante do Radix), busca,
  ordenação, filtro, os 15 menus "Ações" na ordem dos cards, itens por página,
  próxima/última página. Se a ordem "segue a leitura": **não verificado**.
- **Anel pintado** — _verificado por agente sobre captura de tela e medição no
  DOM — não por olho humano._ Todos os elementos da tela com anel e opacidade
  efetiva 1; as três paradas invisíveis do shell aparecem aqui igual ao
  Dashboard. Perceptibilidade: **não verificado**.
- **`Enter`/`Espaço`** — `Espaço` no menu do card abre; `Escape` fecha e
  devolve o foco. Os demais controles não foram acionados um a um: **não
  verificado**.

## A captura visual da Seção 6

```
mkdir -p "$TEMP/capturas-secao-6"
CAPTURAS_DIR="$TEMP/capturas-secao-6" npx playwright test e2e/captura-visual-secao-6.spec.ts --reporter=line --timeout=180000
```

**`1 failed`**, e a falha é **defeito do spec, não mudança de tela.** Ele nunca
tinha rodado além do login. O alvo "card de produto" procura
`getByRole("button", { name: "Ações" })` sem `exact`, e o Playwright casa por
substring sem distinguir caixa: `.first()` pegou o botão **"Notificações"** do
cabeçalho (`aria-label` que existe desde o commit `5a50ea6`, da própria Seção 6).
O clique abriu o painel de notificações (a imagem `card-produto-desktop-1440x900.png`
da primeira execução mostra isso), `CARD_PRODUTO_MIN_HEIGHT` saiu `[]`, e o alvo
seguinte estourou o tempo esperando o item "Excluir". Um segundo defeito, de
leitura: `el.closest('[class*="destructive"]')` casa o **próprio** botão de
fechar (a classe dele contém `group-[.destructive]:`), então
`corDeFundoDoToast` sai sempre transparente. **Não consertado** — o spec é
instrumento da Seção 6; correção sugerida: `exact: true` nos seletores "Ações"
e `el.closest(".destructive")`.

Os alvos que faltavam rodaram por um script fora do repositório com **duas**
mudanças em relação ao spec: `exact: true` nos seletores "Ações", e a
interceptação do DELETE ampliada de `**/api/products/**` para **todo** DELETE
(`**/*`), para nenhum escapar para staging. O defeito do `closest` **não** foi
corrigido na cópia — por isso o fundo do toast não é reportado abaixo, só a cor
do botão.

### O que cada imagem mostra

**`min-h-11` no `DropdownMenuItem`** — valor medido no DOM, reconferido:

```js
const minHeights = (page) => page.getByRole("menuitem").evaluateAll((els) => els.map((el) => getComputedStyle(el).minHeight))

// alternador de tema, em "/" (abaixo de 1024 px abre antes o menu "Abrir menu")
await page.getByRole("button", { name: /alternar tema/i }).click();              await minHeights(page)
// galeria
await page.goto(BASE + "/dev/componentes"); await page.getByRole("button", { name: "Acoes", exact: true }).click(); await minHeights(page)
// menu do cabecalho
await page.goto(BASE + "/dashboard"); await page.locator("header").getByRole("button").last().click(); await minHeights(page)
// card de produto
const t = page.getByRole("button", { name: "Ações", exact: true }).first(); await t.hover(); await t.click(); await minHeights(page)
```

| Alvo | 390 | 1440 | Imagens |
|---|---|---|---|
| alternador de tema (`/`) | `44px` ×3 | `44px` ×3 | `alternador-tema-mobile-390x844.png`, `alternador-tema-desktop-1440x900.png` |
| galeria (`/dev/componentes`) | `44px` ×2 | `44px` ×2 | `galeria-dropdown-mobile-390x844.png`, `galeria-dropdown-desktop-1440x900.png` |
| menu do cabeçalho (`/dashboard`) | `44px` ×4 | `44px` ×4 | `menu-cabecalho-mobile-390x844.png`, `menu-cabecalho-desktop-1440x900.png` |
| card de produto (`/library`) | `44px` ×3 | `44px` ×3 | `card-produto-mobile-390x844.png`, `card-produto-desktop-1440x900.png` |
| tabela financeira (`/finance`) | não verificado | não verificado | — a conta não tem linha com menu |
| card de ambiente (`/projects/<id>`) | não verificado | não verificado | — o projeto aberto não tem ambiente com menu |

O `min-height` é medição de DOM. O que as imagens mostram — _verificado por
agente sobre captura de tela e medição no DOM — não por olho humano_ — é os
itens com espaçamento vertical da ordem de 44 px, e os menus "Minha Conta"
(4 itens + rótulo) e o do card de produto (3 itens) cabendo na tela nas duas
larguras. Todas as capturas de menu pegaram a **animação de abertura em
curso**, com itens semitransparentes, então a legibilidade do menu aberto é
**não verificada**.

**Fechar do toast destrutivo** — _verificado por agente sobre captura de tela e
medição no DOM — não por olho humano._ Toast de erro real (DELETE forçado a 500
no navegador). Medido no botão:

```js
const fechar = page.locator("[toast-close]")
await fechar.waitFor({ state: "visible", timeout: 30000 })
await fechar.evaluate((el) => ({ cor: getComputedStyle(el).color, opacidade: getComputedStyle(el).opacity, classe: el.className }))
// {"cor":"rgba(248, 250, 252, 0.7)","opacidade":"0", classe: "... group-[.destructive]:text-destructive-foreground/70 ..."}
```

A cor `rgba(248, 250, 252, 0.7)` é `destructive-foreground/70`, não `text-red-*`.
Sem hover o botão está com `opacity: 0` (o `x` não aparece em
`toast-destrutivo-desktop-1440x900.png`); com `fechar.hover()` ele aparece branco
sobre o vermelho (`toast-destrutivo-fechar-hover-*.png`). Em 390 o toast cobre
o topo do cabeçalho (`toast-destrutivo-mobile-390x844.png`). Se o `x` sem hover
basta numa tela de toque: **não verificado**, decisão de design.

**`aria-hidden` do `Skeleton`** — atributo, não aparece em imagem. Medido no DOM
da galeria, reconferido:

```js
await page.goto(BASE + "/dev/componentes")
await page.locator(".animate-pulse").evaluateAll((els) => els.map((el) => el.getAttribute("aria-hidden")))
// ARIA_HIDDEN_SKELETON[390]=["true","true","true"]
// ARIA_HIDDEN_SKELETON[1440]=["true","true","true"]
```

Nas capturas `galeria-mobile-390x844.png` e `galeria-desktop-1440x900.png` —
_verificado por agente sobre captura de tela e medição no DOM — não por olho
humano_ — as barras cinza-claras aparecem nas seções "QueryBoundary" e
"Skeleton".

Visto de passagem nas capturas, sem relação com as três mudanças: o logotipo
"arch smart" em `alternador-tema-*.png` (item 7 do bloco da Biblioteca no
`CLAUDE.md`, já registrado), e, na galeria, o rótulo do `FormField` colado ao
input ("E-mail" e "CPF").

## Achados consertados

| Commit | Tela | O quê |
|---|---|---|
| `f95dce2` | Dashboard | 3 textos `text-secondary` (2,28–2,48:1) e "Sem imagem" `text-muted-foreground` sobre `bg-muted` (4,34:1): badge e "Agendar Reunião" → `text-foreground`; "Agenda Completa" → `text-primary`, como os vizinhos; "Sem imagem" → `text-foreground/80`. Sem teste novo: jsdom não calcula contraste — a prova é o axe repassado. |
| fix round 1 | guarda | `hidratacao-dashboard.spec.ts` espera `networkidle` antes de afirmar; provado vermelho → verde (seção "O guarda de hidratação reprova"). |

## O que continua aberto

Cada item é pergunta para Thiago; nenhum foi consertado.

### Pauta para o plano da próxima tela (Projetos): o shell

Não são da tela Dashboard nem da Biblioteca — estão no `AppShell` (`Header`,
`Sidebar`, `NotificationPanel`) e no widget de chat, e aparecem **em toda rota
autenticada**. Consertar mexe em toda tela, por isso não entrou de passagem.

1. **`button-name`, 5 nós, impacto `critical`** (axe, nas quatro combinações das
   duas telas): botão do menu do usuário no `Header`; fechar do
   `NotificationPanel`; fechar, enviar e botão flutuante do chat. Leitor de tela
   anuncia "botão" sem nome.
2. **Três paradas de `Tab` invisíveis** (medido no bloco "Teclado"): fechar do
   `NotificationPanel` fechado (fora da tela), fechar e campo de mensagem do
   chat fechado (opacidade efetiva 0). Quem navega por teclado perde o foco de
   vista por três `Tab`s em toda tela.
3. **`region`, 6 nós, impacto `moderate`**: conteúdo de notificações e chat fora
   de landmark.
4. **`color-contrast`, 1 nó, impacto `serious`**: item ativo da `Sidebar`,
   `#008080` sobre `#e6f2f2`, 4,17:1, tema claro, larguras ≥ `lg`.

### Dashboard

5. **`UpcomingEventsColumn.tsx:58`, botão de cada compromisso:**
   `bg-secondary text-secondary-foreground`, par que mede **3,93:1** nos dois
   temas ([`componentes.md`](../componentes.md), e contado em
   `contraste_reprovado` da catraca). O axe não o viu porque a conta de teste não
   tem compromisso — o botão não renderizou. Não consertado: é defeito do
   **token** (o coral da marca), e mexer em `globals.css` é decisão de design.
6. **"Plano Solo" fixo em `ProjectsLimitCard.tsx:31`** — nome de plano escrito
   no front, possível violação do Art. 3 (limite e plano vêm dos `entitlements`
   da API).
7. **`text-red-500`/`text-red-600 dark:text-red-400` do saldo e da despesa
   negativos, medido.** A conta de teste tem saldo zero, então o axe nunca viu
   esses nós — a medida abaixo é do token, direto de `globals.css`, não de nó
   renderizado. `FinancialMetricCards.tsx:24-26` e `:70-71` apontavam para
   `task-5-report.md`, que está em `.superpowers/` (gitignored) e não existe
   neste repositório para quem ler o comentário depois. Reproduzido com
   `tools/contraste.py` (`luminancia`/`contraste`), contra `--card` e
   `--background` dos dois temas:

   ```
   python3 -c "
   import sys; sys.path.insert(0, 'tools')
   import contraste
   claro, escuro = contraste.tokens_dos_temas()
   for rotulo, tema in (('claro', claro), ('escuro', escuro)):
       d = tema['destructive']
       for fundo in ('card', 'background'):
           print(rotulo, fundo, f'{contraste.contraste(d, tema[fundo]):.2f}:1')
   "
   ```

   ```
   claro card 3.76:1
   claro background 3.76:1
   escuro card 2.00:1
   escuro background 2.00:1
   ```

   No tema escuro, `destructive` como texto grande mede **2,00:1** — abaixo do
   piso de 3:1 do Art. 6 para texto grande, e é essa a medida que os dois
   comentários citam (o número bate com o que estava escrito, `2,00:1`; a
   revisão final tinha calculado ~1,97:1 por outra via e não foi reproduzido
   aqui — o comando acima é o que este repositório agora tem para conferir).
   `text-red-500`/`text-red-600 dark:text-red-400` continuam a substituição
   deliberada enquanto o token não muda — mexer em `globals.css` é decisão de
   design, a mesma razão do item 5 acima.

   Aberto e não corrigido nesta passada (achado novo, não deste branch): no
   tema escuro, `text-destructive` também é usado para **ícones** a ~2:1 — o
   chip do cabeçalho "Despesas", o chip do `Wallet` e o `TrendingDown` quando o
   saldo é negativo em `FinancialMetricCards.tsx`, e o `AlertCircle` de
   `DashboardComErro.tsx:22`. Antes deste branch eram `text-red-600` sobre
   `dark:bg-red-950/30`. Como os ícones duplicam um rótulo de texto ao lado
   (não são a única pista), isto é discutivelmente fora do critério 1.4.11 —
   e o axe não avalia contraste de ícone. Registrado como aberto; as classes
   não foram alteradas.
8. **"Próximos Compromissos" quebra em duas linhas em 1440** — se é defeito é
   julgamento visual.

### Pré-existentes, não deste branch

Achados na revisão final desta passada, e nenhum dos dois nasceu na migração
do Dashboard — os dois mexem em código que qualquer tela migrada compartilha.
Nenhum foi corrigido aqui.

a. **`prefetchQuery` engole erro, e o `console.warn` de `tentarPrefetch` nunca
   dispara num timeout de `AbortSignal`.** `tentarPrefetch`
   (`ArchSmart-web/src/lib/query/hydration.ts`) chama
   `queryClient.prefetchQuery(...).catch((erro) => console.warn(...))` — mas o
   [contrato do `prefetchQuery`](https://tanstack.com/query/v5/docs/reference/QueryClient#queryclientprefetchquery)
   já engole o erro da `queryFn` internamente (ele só relança se não houver
   dado em cache), então o `.catch` encadeado por cima quase nunca tem o que
   capturar. Na prática, um timeout de prefetch — a `queryFn` abortando por
   `signal` — não aparece em log nenhum, nem no servidor nem no navegador: o
   prefetch falha em silêncio nas duas telas que já usam este mecanismo
   (Biblioteca e Dashboard), e todas as próximas que copiarem o padrão herdam o
   mesmo ponto cego.
b. **`ProjectsLimitCard` divide por `planLimit` sem checar zero.**
   `activeProjectsCount / planLimit` em
   `ArchSmart-web/src/app/(dashboard)/dashboard/components/ProjectsLimitCard.tsx`
   — um plano com limite `0` (entitlement zerado, por engano de dado ou por um
   plano novo sem limite configurado) produz `NaN`, propagado para
   `Math.min(NaN, 100)` (que também é `NaN`) e para a barra de progresso.
   `_get_plan_limit` (`app/api/endpoints/projects.py`) não impede `0` — só lê
   `repo.ctx.entitlements["project_limit"]` como veio.

### Biblioteca

9. **Estoura 42 px em 390** (os dois temas). Correção barata medida no DOM:
   `p-4 md:p-8` em `library/page.tsx:14` + `flex-wrap` na linha do título.
10. **Toolbar espremida em 390**: filtro com 23 px de largura, ordenação
    truncada. Sugestão: `flex-wrap` em `LibraryToolbar.tsx:167`.
11. **`button-name`** em ordenação, filtro e itens por página.
12. **`aria-valid-attr-value`**: `aria-controls` das abas aponta para
    `TabsContent` inexistente.
13. **`page-has-heading-one`**: título em `h2`, sem `h1`.
14. **Contraste dos tokens reprovados conhecidos, agora com nós reais**:
    `secondary` no badge "Normalizado" (3,94:1, todo card, dois temas), `muted`
    nas abas inativas (4,34:1, claro), `destructive` no badge do Inbox (3,59:1,
    claro). Decisão de token.

### Seção 6 e método

15. **`captura-visual-secao-6.spec.ts` tem dois defeitos de seletor** (`"Ações"`
    sem `exact` casa "Notificações"; `closest('[class*="destructive"]')` casa o
    próprio botão). Os alvos tabela financeira e card de ambiente seguem sem
    evidência, por falta de dado na conta de teste.
16. **Fechar do toast invisível sem hover**, o que em tela de toque o esconde
    enquanto não houver foco.
17. **Olho humano**: nada neste arquivo substitui alguém abrir as duas telas nos
    dois temas e nas duas larguras. Ordem de leitura, perceptibilidade do anel,
    hierarquia e legibilidade dos menus abertos continuam **não verificadas** —
    e por isso os três itens da definição de pronto da Biblioteca **não fecham**
    com esta passada.
