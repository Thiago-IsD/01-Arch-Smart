# A passada de navegador — Dashboard, Biblioteca e a captura da Seção 6, 14/09/2026

> ⚠️ **Tudo o que está marcado como visual neste arquivo foi verificado por
> agente sobre captura de tela e medição no DOM — não por olho humano.** Nenhuma
> pessoa abriu estas telas. O que se afirma aqui é o que o Chromium do
> Playwright renderizou, o que `axe-core` reportou, o que `getComputedStyle` e
> `getBoundingClientRect` devolveram, e o que o agente leu nas imagens. Item que
> só olho humano decide (hierarquia, "está bonito", "o anel é perceptível para
> quem tem baixa visão") vai como **não verificado**, nunca como passou.

Tarefa 6 da migração do Dashboard (Seção 8). Fecha, com a ressalva acima, os
três itens da definição de pronto que a Biblioteca deixou abertos (item 2 de "O
que a Biblioteca (Seção 8) deixou em aberto" no `CLAUDE.md` da raiz: axe em
navegador, teclado, 390px/1440px), olha os dois riscos do item 3, e roda pela
primeira vez a captura visual da Seção 6.

## Arranjo

- Front: `npm run dev` na máquina de desenvolvimento, branch `secao-8-dashboard`
  (commit `ed40e8f` na passada inicial; `f95dce2` na repassada do Dashboard).
- API: `uvicorn app.main:app --port 8000` local, apontada para o **banco de
  staging** — o mesmo arranjo das medições da Seção 8. Nada foi escrito no banco
  além do que login e telemetria já escrevem; o DELETE da captura do toast foi
  interceptado no navegador (`DELETE_INTERCEPTADO=true`, rota `**/*`) e nunca
  saiu.
- Conta: o usuário de teste E2E (`ana.arquiteta@seed.arqsmart.local`), senha em
  `ArchSmart-web/.env.e2e.local`.
- Navegador: Chromium do Playwright, headless. Tema pelo mecanismo da aplicação:
  `next-themes` com `attribute="class"` e chave `theme` no `localStorage`
  (`src/app/layout.tsx`), mais `emulateMedia({ colorScheme })`; conferido em cada
  combinação lendo `document.documentElement.className` (`light`/`dark`).
- Larguras: `390x844` e `1440x900` por `page.setViewportSize`.
- **Os roteiros foram scripts descartáveis fora do repositório** (em
  `$TEMP/passada-dashboard/` e `$TEMP/capturas-secao-6/`), não spec versionado:
  a saída deles é imagem e JSON lidos por quem executa, sem asserção que sirva de
  guarda, e um terceiro instrumento em `e2e/` seria mais um arquivo que o
  `e2e.yml` precisa lembrar de não rodar. O núcleo de cada medição está abaixo,
  para quem quiser repetir:

```js
// axe em navegador
await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js" })
const r = await page.evaluate(() => axe.run())       // r.violations: id, impact, nodes

// estouro horizontal
await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

// teclado: Tab repetido, lendo o foco a cada passo
await page.keyboard.press("Tab")
await page.evaluate(() => {
  const el = document.activeElement, cs = getComputedStyle(el)
  return { tag: el.tagName, texto: el.innerText, outline: cs.outlineStyle + " " + cs.outlineWidth, sombra: cs.boxShadow }
})
```

"Anel visível" abaixo quer dizer: `outline` com largura > 0 **ou** `box-shadow`
diferente de `none` **e** opacidade efetiva (produto das opacidades dos
ancestrais) > 0. Isso prova que existe anel pintado, não que ele seja
perceptível — essa segunda parte é de olho humano e fica não verificada.

## Os guardas do Dashboard

```
cd ArchSmart-web
set -a && . ./.env.e2e.local && . ./.env.local && set +a
npx playwright test e2e/hidratacao-dashboard.spec.ts e2e/telemetria-dashboard.spec.ts --reporter=line --timeout=180000 --repeat-each=3
```

**`6 passed`**, duas vezes (uma com `--workers=1`, uma sem), antes do conserto
de contraste; e de novo depois dele (ver o fim deste arquivo). Os dois da
Biblioteca, sem edição, como prova de que a Tarefa 1 não mudou a tela:

```
npx playwright test e2e/hidratacao-biblioteca.spec.ts e2e/telemetria-biblioteca.spec.ts --reporter=line --timeout=180000
```

**`2 passed`**.

Os dois specs novos entraram na linha de guarda de `.github/workflows/e2e.yml`.

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

De onde vem cada nó:

- **`color-contrast`, componentes do próprio Dashboard — consertado no commit
  `f95dce2`** (ver "Achados consertados"):
  - `ProjectsLimitCard`, badge "Plano Solo": `text-secondary` sobre
    `bg-secondary/10`, **2,28:1** (10px).
  - `UpcomingEventsColumn`, "Agenda Completa": `text-secondary` sobre branco,
    **2,48:1**.
  - `UpcomingEventsColumn`, "Agendar Reunião": `text-secondary` sobre branco,
    **2,48:1**.
  - `RecentProductsColumn`, "Sem imagem" (5 nós): `text-muted-foreground` sobre
    `bg-muted`, **4,34:1** (12px) — o par que a Tarefa 5 introduziu.
- **`color-contrast`, shell** — 1 nó só em 1440 (a sidebar some em 390): o item
  ativo da `Sidebar`, `#008080` sobre `#e6f2f2`, **4,17:1**. Não consertado:
  é do shell, compartilhado por todas as telas.
- **`button-name` (5), shell**: o botão do menu do usuário no `Header` (sem nome
  acessível); o botão de fechar do `NotificationPanel`; e três do widget de chat
  (fechar, enviar, e o botão flutuante). Não consertado: shell.
- **`region` (6), shell**: conteúdo do `NotificationPanel` e do widget de chat
  fora de landmark. Não consertado: shell.

**Depois do conserto** (commit `f95dce2`, mesmo instrumento, as quatro
combinações): `color-contrast` dos componentes do Dashboard = **0**. Sobra, em
claro/1440, só o nó da `Sidebar`; `button-name` (5) e `region` (6) iguais, todos
do shell.

### Os dois valores vermelhos que a Tarefa 5 manteve literais

Contraste medido no DOM (cor computada do texto sobre o primeiro fundo opaco
ancestral, fórmula WCAG):

| Valor | Classe | Tema | Cor | Fundo | Contraste |
|---|---|---|---|---|---|
| Despesas | `text-red-600` | claro | `rgb(220, 38, 38)` | `rgb(255, 255, 255)` | **4,83:1** |
| Despesas | `dark:text-red-400` | escuro | `rgb(248, 113, 113)` | `rgb(2, 8, 23)` | **7,23:1** |
| Saldo negativo | `text-red-500` | — | — | — | **não verificado** |

O saldo da conta era R$ 0,00, então o ramo `financial_balance >= 0` renderizou
`text-foreground` (9,80:1 claro, 19,12:1 escuro) e `text-red-500` **não apareceu
na tela**. Medir exige uma conta com saldo negativo — não criada, porque escrever
lançamento em staging está fora do que esta tarefa podia fazer.

### Largura

| Tema | Largura | `scrollWidth` / `innerWidth` | Resultado |
|---|---|---|---|
| claro | 390 | 390 / 390 | passou — nada estoura |
| escuro | 390 | 390 / 390 | passou |
| claro | 1440 | 1440 / 1440 | passou |
| escuro | 1440 | 1440 / 1440 | passou |

Em 1440 o painel mede **1120 px** dentro de um `main` de 1184 px (`max-w-7xl`
com padding), grade de 4 colunas nas métricas e 3 nas colunas de baixo — não
fica esticado.

Observado na captura de 1440 (`dashboard-light-1440-viewport.png`), **não
verificado como defeito**: o título "Próximos Compromissos" quebra em duas
linhas, enquanto "Continuar Trabalhando" e "Adições na Biblioteca", nas colunas
vizinhas, cabem em uma. Se isso atrapalha a leitura é pergunta de olho humano.

### Teclado

`Tab` a partir do topo, nas quatro combinações; resultado igual nos dois temas.

- **Alcance e ordem:** 1440 — sidebar (6 links, "Ocultar"), cabeçalho (tema,
  notificações, menu do usuário), 3 ações rápidas, "Ver Todos", 2 projetos,
  "Agenda Completa", "Agendar Reunião", "Ver Biblioteca", 5 produtos. 390 — o
  mesmo sem a sidebar ("Menu" no lugar). A ordem segue colunas da esquerda para
  a direita, de cima para baixo: **passou** (a ordem medida; se ela "segue a
  leitura" para uma pessoa é julgamento que confere com a captura, não com olho
  humano).
- **Anel visível:** todos os elementos interativos **do Dashboard** têm anel
  (`box-shadow` do `focus-visible:ring`) com opacidade efetiva 1: **passou**.
- **O `group-focus-within` da Tarefa 5 em `RecentProjectsColumn`:** ao focar o
  `Link` do primeiro projeto por `Tab` (passo 15 em 1440), a seta foi de
  `opacity: 0` para **`1`**, `transform` para identidade, e o nome do projeto de
  `rgb(54, 70, 78)` para **`rgb(0, 128, 128)`** (primary); anel
  `rgba(0, 128, 128, 0.5) 0 0 0 4px`. Captura: `chk-dashboard-projeto-foco.png`.
  **Passou.**
- **`Enter`/`Espaço` acionam:** `Enter` no link do projeto → `/projects/<id>`;
  `Espaço` e `Enter` em "Criar Projeto" → `/projects`; `Enter` em "Agenda
  Completa" → `/calendar` (a primeira tentativa, com espera de 2,5 s, ficou em
  `/dashboard` porque o dev server ainda compilava `/calendar`; com
  `waitForURL` navegou). **Passou.**
- **Achados de shell, não consertados:** depois do último produto, o foco cai
  em **três paradas invisíveis**: o botão de fechar do `NotificationPanel`
  fechado (fora da tela, `left: 1776` em 1440), e o botão de fechar e o campo
  "Digite sua mensagem..." do widget de chat fechado (opacidade efetiva **0**).
  Quem navega por teclado perde o foco de vista por três `Tab`s. A parada
  `NEXTJS-PORTAL` que vem depois é o indicador do Next em desenvolvimento, não
  existe em produção.

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
  existe no DOM: as abas trocam o conteúdo por query string, não por
  `TabsContent`. Sugestão: renderizar `TabsContent` vazio por aba, ou trocar
  `Tabs` por um grupo de links com `aria-current`.
- **`button-name` (8)** — da tela: o `SelectTrigger` de ordenação
  (`.w-[160px]`), o botão de filtro (só ícone, `aria-haspopup="dialog"`) e o
  `SelectTrigger` de itens por página (`.w-[70px]`); o resto é o mesmo shell do
  Dashboard. Sugestão: `aria-label` nos três.
- **`color-contrast`** — da tela: o badge "Normalizado" (`secondary`,
  `#36464e` sobre `#f88277`, **3,94:1**, 10px) em **cada card** — 15 nós nos
  dois temas, é quem domina a contagem; e, só no claro, as abas inativas
  "Inbox"/"Web Clipper" (`#64748b` sobre `#f1f5f9`, **4,34:1**) e o badge de
  contagem do Inbox (`destructive`, `#f8fafc` sobre `#ef4444`, **3,59:1**). Mais
  a `Sidebar` em 1440 claro (shell). Os três pares são os reprovados conhecidos
  de `docs/dev/componentes.md` (`secondary`, `muted`, `destructive`) — corrigir
  é decisão de token, não de tela.
- **`page-has-heading-one` (1)** — o título "Biblioteca" é `h2`, e a página não
  tem `h1`. Sugestão: `h1`.
- **`region` (6)** — shell (notificações e chat), igual ao Dashboard.

### Largura — **estoura em 390**

| Tema | Largura | `scrollWidth` / `innerWidth` | Resultado |
|---|---|---|---|
| claro | 390 | **432** / 390 | **estouro de 42 px** |
| escuro | 390 | **432** / 390 | **estouro de 42 px** |
| claro | 1440 | 1440 / 1440 | passou |
| escuro | 1440 | 1440 / 1440 | passou |

Captura: `library-light-390-viewport.png` — o avatar do cabeçalho aparece
cortado na borda direita, e o botão "Adicionar Produto" encosta nela.

**A causa medida não é a toolbar.** Experimento no DOM (estilo aplicado em
tempo de execução, código intocado), com `document.documentElement.scrollWidth`:

| Mudança aplicada no DOM | `scrollWidth` |
|---|---|
| nenhuma | 432 |
| `min-width: 0` na busca e no wrapper dela (risco `:180`) | 432 |
| `flex-wrap: wrap` na linha da toolbar (risco `:167`) | 432 |
| as duas acima | 432 |
| padding de 16 px na raiz da página (`page.tsx:14`, hoje `p-8`) | 400 |
| isso **mais** `flex-wrap` na linha do título com "Adicionar Produto" | **390** |

Com `min-width: 0` no contêiner do shell, os dois filhos que transbordam a área
útil são a linha do título (o link "Adicionar Produto", 182 px e
`whitespace-nowrap`) e a lista de abas (295 px). A raiz da página soma `p-8` ao
`p-6` do `main`, o que deixa 278 px de área útil em 390.

**Correção barata sugerida (não aplicada):** `p-4 md:p-8` na raiz de
`src/app/(dashboard)/library/page.tsx:14` **e** `flex-wrap gap-2` na linha do
título. As duas juntas levaram o `scrollWidth` a 390 no experimento.

### Os dois riscos do item 3

- **`LibraryToolbar.tsx:167` (sem quebra abaixo de `md`) e `:180`
  (`SelectTrigger` `w-[160px]` ao lado de input sem `min-w-0`), em 390, nos
  dois temas:** não causam o estouro (tabela acima), mas **espremem**. A linha
  fica em 320 px: busca 177 px, ordenação encolhida de 160 para **104 px**
  (captura mostra "Mais..." truncado), e o botão de filtro encolhido de 40 para
  **23 px** de largura — alvo de toque abaixo de 44 px. Com `flex-wrap` na
  linha, a ordenação e o filtro descem para uma segunda linha e voltam a 160 px
  e 40 px. Correção barata sugerida: `flex-wrap` em `:167`.
- **`group-focus-within:opacity-100` do menu do `ProductCard`:** chegando por
  `Tab` (passo 16 em 1440, passo 10 em 390), o wrapper foi de `opacity: 0` para
  **`1`**, com anel `rgba(0, 128, 128, 0.5) 0 0 0 4px`; `Espaço` abriu o menu
  (3 itens: Editar, Mover para Projeto, Excluir) e `Escape` devolveu o foco ao
  gatilho. Captura: `chk-library-card-menu-foco-1440.png`,
  `chk-library-card-menu-foco-390.png`. **Deixou de ser "classe na árvore": o
  comportamento foi medido em navegador e passou.**

### Teclado

- **Alcance e ordem:** sidebar/cabeçalho, "Adicionar Produto", a aba ativa (as
  outras por setas — `tabindex` itinerante do Radix, o comportamento correto),
  busca, ordenação, filtro, os 15 menus "Ações" na ordem dos cards, itens por
  página, próxima/última página. **Passou.**
- **Anel visível:** todos os elementos da tela, **passou**. As três paradas
  invisíveis do shell (notificações fechadas, chat fechado) aparecem aqui igual
  ao Dashboard.
- **`Enter`/`Espaço`:** `Espaço` no menu do card abre; `Escape` fecha e devolve
  o foco. Os demais controles não foram acionados um a um.

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
O clique abriu o painel de notificações (`card-produto-desktop-1440x900.png` da
primeira execução mostra isso), `CARD_PRODUTO_MIN_HEIGHT` saiu `[]`, e o alvo
seguinte estourou o tempo esperando o item "Excluir". Um segundo defeito, de
leitura: `el.closest('[class*="destructive"]')` casa o **próprio** botão de
fechar (a classe dele contém `group-[.destructive]:`), então
`corDeFundoDoToast` sai sempre transparente. **Não consertado** — o spec é
instrumento da Seção 6; correção sugerida: `exact: true` nos dois seletores
"Ações" e `el.closest(".destructive")`.

Os alvos que faltavam rodaram por um script descartável
(`$TEMP/capturas-secao-6/resto.cjs`) que copia o spec com uma única troca,
`exact: true`, e intercepta **todo** DELETE, não só o de `/api/products`.

### O que cada imagem mostra

**`min-h-11` no `DropdownMenuItem`** — medido no DOM, `min-height` de cada
`[role="menuitem"]`:

| Alvo | 390 | 1440 | Imagens |
|---|---|---|---|
| alternador de tema (`/`) | `44px` ×3 | `44px` ×3 | `alternador-tema-mobile-390x844.png`, `alternador-tema-desktop-1440x900.png` |
| galeria (`/dev/componentes`) | `44px` ×2 | `44px` ×2 | `galeria-dropdown-mobile-390x844.png`, `galeria-dropdown-desktop-1440x900.png` |
| menu do cabeçalho (`/dashboard`) | `44px` ×4 | `44px` ×4 | `menu-cabecalho-mobile-390x844.png`, `menu-cabecalho-desktop-1440x900.png` |
| card de produto (`/library`) | `44px` ×3 | `44px` ×3 | `card-produto-mobile-390x844.png`, `card-produto-desktop-1440x900.png` |
| tabela financeira (`/finance`) | não verificado | não verificado | — a conta não tem linha com menu |
| card de ambiente (`/projects/<id>`) | não verificado | não verificado | — o projeto aberto não tem ambiente com menu |

Nas capturas, os itens aparecem com espaçamento vertical de ~44 px, e menus
como "Minha Conta" (4 itens + rótulo) e o do card de produto (3 itens) cabem na
tela nas duas larguras sem cortar. Todas as capturas de menu pegaram a
**animação de abertura em curso** — itens semitransparentes sobre o conteúdo —,
então a legibilidade do menu aberto **não é avaliável** nelas: não verificado.

**Fechar do toast destrutivo** — `toast-destrutivo-*.png` e
`toast-destrutivo-fechar-hover-*.png`. Toast de erro real (DELETE forçado a 500
no navegador), fundo vermelho, título "Erro". Cor computada do botão de fechar:
`rgba(248, 250, 252, 0.7)` — é o `group-[.destructive]:text-destructive-foreground/70`
aplicado, **não** `text-red-*`: passou. Sem hover o botão tem **`opacity: 0`**
(o `x` não aparece em `toast-destrutivo-desktop-1440x900.png`); com hover
aparece branco sobre o vermelho (`toast-destrutivo-fechar-hover-*.png`). Em 390
o toast cobre o topo do cabeçalho. Observação, **não verificada como defeito**:
em tela de toque não há hover, então o `x` só aparece com foco — se isso basta é
decisão de design.

**`aria-hidden` do `Skeleton`** — atributo, não aparece em imagem. Medido no DOM
da galeria: os 3 elementos `.animate-pulse` têm **`aria-hidden="true"`** nas
duas larguras: passou. Na captura (`galeria-mobile-390x844.png`,
`galeria-desktop-1440x900.png`) as barras cinza-claras aparecem nas seções
"QueryBoundary" e "Skeleton".

Visto de passagem nas capturas, sem relação com as três mudanças: o logotipo
"arch smart" em `alternador-tema-*.png` (item 7 do bloco da Biblioteca no
`CLAUDE.md`, já registrado), e, na galeria, o rótulo do `FormField` colado ao
input sem espaço ("E-mail" e "CPF").

## Achados consertados

| Commit | Tela | O quê |
|---|---|---|
| `f95dce2` | Dashboard | 3 textos `text-secondary` (2,28–2,48:1) e "Sem imagem" `text-muted-foreground` sobre `bg-muted` (4,34:1): badge e "Agendar Reunião" → `text-foreground`; "Agenda Completa" → `text-primary`, como os vizinhos; "Sem imagem" → `text-foreground/80`. Sem teste novo: jsdom não calcula contraste — a prova é o axe acima. |

Repassada depois do commit: `npx playwright test e2e/hidratacao-dashboard.spec.ts e2e/telemetria-dashboard.spec.ts --reporter=line --timeout=180000 --repeat-each=3` → **`6 passed`**; e os dois da Biblioteca → **`2 passed`**.

## O que continua aberto

Cada item é pergunta para Thiago; nenhum foi consertado.

1. **Biblioteca estoura 42 px em 390** (os dois temas). Correção barata medida no
   DOM: `p-4 md:p-8` em `library/page.tsx:14` + `flex-wrap` na linha do título.
2. **Toolbar da Biblioteca espremida em 390**: filtro com 23 px de largura,
   ordenação truncada. Sugestão: `flex-wrap` em `LibraryToolbar.tsx:167`.
3. **Biblioteca, `button-name`**: ordenação, filtro e itens-por-página sem nome
   acessível.
4. **Biblioteca, `aria-valid-attr-value`**: `aria-controls` das abas aponta para
   `TabsContent` inexistente.
5. **Biblioteca, `page-has-heading-one`**: título em `h2`, sem `h1`.
6. **Contraste dos tokens reprovados conhecidos, agora com nós reais**:
   `secondary` no badge "Normalizado" (3,94:1, todo card, dois temas), `muted`
   nas abas inativas (4,34:1, claro), `destructive` no badge do Inbox (3,59:1,
   claro). Decisão de token/identidade visual.
7. **Shell, em todas as telas**: botão do menu do usuário sem nome; três paradas
   de `Tab` invisíveis (fechar do `NotificationPanel` fechado, fechar e campo do
   chat fechado); `region` (6) em notificações e chat; item ativo da `Sidebar`
   a 4,17:1 no claro. Não é do Dashboard nem da Biblioteca — conserto no shell
   mexe em toda tela.
8. **`text-red-500` do saldo negativo não medido**: a conta tem saldo zero.
9. **Dashboard, "Próximos Compromissos" quebra em duas linhas em 1440** — se é
   defeito, é julgamento visual.
10. **`captura-visual-secao-6.spec.ts` tem dois defeitos de seletor** (`"Ações"`
    sem `exact` casa "Notificações"; `closest('[class*="destructive"]')` casa o
    próprio botão). E os alvos tabela financeira e card de ambiente seguem sem
    evidência, por falta de dado na conta de teste.
11. **Fechar do toast invisível sem hover**, o que em toque vira invisível sem
    foco.
12. **Olho humano**: nada neste arquivo substitui alguém abrir as duas telas nos
    dois temas e nas duas larguras. Hierarquia, perceptibilidade do anel e
    legibilidade dos menus abertos continuam não verificadas.
