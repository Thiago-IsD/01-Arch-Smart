# Módulo: `features/library` e a tela `/library`

A camada de dados do domínio Biblioteca — o piloto da Seção 5 — e a tela que a
consome, que foi a **primeira migrada na Seção 8** e é de onde as outras oito
vão copiar o padrão.

## O que expõe

| Símbolo | Onde | O que faz |
|---|---|---|
| `useProducts(filtros, { ativo })` | `hooks.ts` | Lista paginada e filtrada. `placeholderData` mantém a lista anterior visível ao paginar. |
| `useInboxCount()` | `hooks.ts` | Total de produtos `CAPTURED` (o badge do inbox). Devolve número, não a resposta inteira. |
| `useProduct(id, ativo)` | `hooks.ts` | Um produto, para editar ou normalizar. `retry: false`. |
| `useCreateProduct()` / `useUpdateProduct()` | `hooks.ts` | Cria e edita. Invalida `queryKeys.products.all`. |
| `useDeleteProduct()` | `hooks.ts` | Soft delete (o backend move para `INACTIVE`). |
| `useApproveProduct()` / `useBatchApprove()` | `hooks.ts` | Move de `CAPTURED` para `NORMALIZED`. |
| `useMoveToProject()` | `hooks.ts` | Cria item de orçamento a partir de um produto. Invalida `projects`, não `products`. |
| `useProjetosParaMover(ativo)` / `useAmbientesDoProjeto(id)` | `hooks.ts` | Alimentam o seletor de destino do "mover para projeto". |
| `stateDaAba(tab)` | `api.ts` | Traduz aba (`inbox`/`library`) para estado (`CAPTURED`/`NORMALIZED`). |
| `queryDeProdutos(filtros)` / `queryDoInbox()` | `api.ts` | **A forma única** do query de cada chave. Ver "O que o prefetch entrega". |
| `listarInboxCompleto(signal)` | `api.ts` | Pagina até esgotar: o modal de lote edita o inbox inteiro, não uma página. |

## Do que depende

`lib/api/client.ts` (header, erro, cancelamento) e `lib/query/keys.ts` (chaves
e política de cache). Não fala com Supabase e não monta URL — Art. 4.

**Zero `fetch` na tela e na camada**, medido:

```
grep -rnoE "\bfetch\(" "ArchSmart-web/src/app/(dashboard)/library" \
  ArchSmart-web/src/features/library ArchSmart-web/src/components/library | wc -l   # 0
```

> Cuidado com a régua: `grep "fetch("` sem `\b` conta `tentarPrefetch(` e
> reporta 2 onde são 0. Foi o que aconteceu na primeira medição desta linha.

## Invalidação

Todas as chaves de produto são filhas de `queryKeys.products.all`, então uma
mutação invalida o ramo inteiro — lista, detalhe e o badge do inbox — com uma
chamada. Antes da Seção 5, `["products"]` e `["inbox-count"]` eram irmãs
planas e o `BatchNormalizeModal` invalidava as duas à mão; três outras
mutações chamavam `router.refresh()`, que revalida Server Component e **não**
toca no cache do cliente de onde a grade lê.

## A tela: o que consome, e em que ordem

```
app/(dashboard)/library/
├── page.tsx                      Server Component: shell + <Suspense>
└── components/
    ├── LibraryData.tsx           prefetch no servidor + HydrationBoundary
    ├── LibraryContent.tsx        "use client": hooks, QueryBoundary, grade
    ├── BibliotecaVazia.tsx       o estado vazio
    └── ListaComErro.tsx          o estado de erro
```

`page.tsx` não busca nada: monta o cabeçalho e põe `LibraryData` dentro de um
`<Suspense>`, cujo fallback é um spinner com testid
**`library-shell-streaming`**. Esse fallback é o **servidor** fazendo stream; o
`skeleton` do `QueryBoundary` é o **cliente** carregando. Os dois tinham o mesmo
testid até a Tarefa 7 da Seção 8, e um teste que esperasse "o skeleton do
cliente apareceu" passava sem nunca chegar ao boundary.

## Os cinco estados

Via `QueryBoundary` (`components/ui/query-boundary.tsx`), que não tem default
para três deles — o caminho feliz sozinho deixa de compilar.

| Estado | Onde vive | Como se reconhece |
|---|---|---|
| carregando | `skeleton` do boundary, 10 `Skeleton` na mesma grade | `[data-testid="library-skeleton"]` |
| vazio | `BibliotecaVazia` | `[data-testid="library-empty"]` |
| erro | `ListaComErro`, com `refazer` | `[data-testid="library-error"]` |
| padrão | a grade de `ProductCard` + paginação | `[data-testid="product-grid"]` |
| hover/foco | `group-focus-within:opacity-100` no `ProductCard` | classe; ver a ressalva de verificação abaixo |

O esqueleto e a grade usam **a mesma** classe de grade
(`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`), o
que é o que evita o salto de layout entre um e outro.

Dentro do `children` do boundary a lista **nunca** está vazia — o boundary
desviou esse caso para `empty` antes de chamar o render. Por isso a paginação
não tem `items.length > 0` na frente: a guarda era resto da lógica manual, e
resto sem explicação é o que as outras oito telas copiariam junto.

### A paridade que se rompeu de propósito: a paginação some no erro

A Tarefa 9 tinha paridade verbatim como primeiro item da definição de pronto, e
**um comportamento visível ao usuário mudou mesmo assim** — aceito por decisão
registrada, e escrito aqui porque o relatório que o continha vive em
`.superpowers/`, que é gitignored e some no merge.

**Antes:** `placeholderData` mantém a lista anterior visível enquanto a nova
carrega. Um refetch que **falhava** caía nesse mesmo caminho: a grade anterior
continuava na tela, com a paginação junto, e o usuário podia voltar à página
anterior normalmente.

**Agora:** a região inteira vira o estado de erro (`ListaComErro`), e **os
controles de paginação somem com ela** — não dá para voltar à página anterior
pela interface. O que sobrevive é o que está **fora** do boundary: a barra de
ferramentas e as abas.

**Por que isso foi aceito:** o comportamento antigo **escondia a falha**. O
usuário via uma grade de dados que podia estar velha, sem nada dizendo que a
última requisição tinha falhado — e a saída dali era clicar em algo que falharia
de novo. Trocar dado silenciosamente velho por um erro explícito com `refazer` é
o que esta seção existe para fazer.

**Se um dia o conserto for quisto, ele é no `QueryBoundary`, não aqui** — seria
um modo "erro sobre os dados anteriores" (manter `children` e sobrepor o aviso
quando há `data` de placeholder). Feito lá, vale para as **nove** telas de uma
vez; feito nesta tela, vira mais uma coisa que as outras oito copiam sem saber
por quê.

## Quem é a região principal

```
<QueryBoundary query={query} principal …>   // LibraryContent.tsx
```

É a **lista**, não o badge do inbox: é ela que define "dados na tela" para esta
rota, e é dela que saem o `load_ms` e o `is_empty` do `screen_viewed`. O badge
também é uma query, e se ele fosse quem reportasse o número mediria a coisa
errada — foi exatamente o defeito da Seção 7. Ver
[`telemetry.md`](telemetry.md), seção "O protocolo de prontidão".

A consequência prática: o evento desta tela sai com
`medido_ate: "dados"` (ou `"vazio"`, ou `"erro"`) e
`principal_declarada: true`. Antes da Seção 8 saía `"pintura"` com
`is_empty: null`.

## O que o prefetch entrega

`LibraryData` roda no servidor e prefetcha **duas** chaves em `Promise.all`:

| Chave | Query | Quem consome no cliente |
|---|---|---|
| `queryKeys.products.list(filtros)` | `queryDeProdutos(filtros)` | `useProducts` — a lista |
| `queryKeys.products.inboxCount()` | `queryDoInbox()` | `useInboxCount` — o badge |

As duas montagens de cada query saem da **mesma função** que o cliente usa. Isso
não é elegância: duas montagens da mesma chave de cache divergem em silêncio, e
divergir aqui não dá erro nenhum — só faz o prefetch deixar de ser aproveitado e
virar custo puro. `useInboxCount` tem `select`, então o que se prefetcha é a
resposta **crua**, não o número.

O badge ficou **fora** do prefetch durante toda a Seção 5, e por isso era a
única requisição que a Biblioteca disparava do navegador no primeiro
carregamento — era ela que o `load_ms` quebrado da Seção 7 cronometrava. A
Tarefa 7 da Seção 8 fechou a lacuna.

Em série, as duas chamadas somariam latência dentro do `<Suspense>`, que é o
oposto do que a [ADR 0009](../decisoes/0009-prefetch-dentro-de-suspense.md)
buscava. E cada uma passa por `tentarPrefetch`, com teto de
`TIMEOUT_DO_PREFETCH_MS = 3_000`: num cold start o prefetch desiste, não hidrata
nada, e o cliente busca — o pior caso nunca fica pior que o de antes.

## Os números medidos, e os que faltam

**Medido em 12/09/2026.** A credencial do usuário de teste E2E voltou a
funcionar — verificada direto no endpoint de auth do Supabase de staging antes
de qualquer medição (`HTTP 200`, token recebido,
`email_confirmed_at: 2026-09-10T11:36:43Z`, usuário
`ana.arquiteta@seed.arqsmart.local`). Dos seis itens que faltavam, **cinco
fecharam**; o item 6 (olho humano) continua aberto.

Topologia de todas as medições de 12/09/2026, **idêntica à de 10/09/2026** — é
isso que torna os dois números comparáveis: Playwright → `localhost:3000`
(`npm run dev`) → API local em `localhost:8000` (`uvicorn app.main:app`) →
banco de **staging** → Supabase de **staging**.

### O que existe

| Número | Valor | Quando |
|---|---|---|
| mediana clique → dados na grade | **1415 ms** (`AMOSTRAS=1390,1403,1415,1418,1422`) | **12/09/2026, depois da Seção 8** |
| mediana clique → dados na grade | 1454 ms (`AMOSTRAS=1434,1445,1454,1469,1948`) | 10/09/2026, Tarefa 1 da Seção 6 — **antes** da Seção 8 |
| `load_ms` do `screen_viewed` de `/library` (clique → dados) | mediana **1068 ms**, n=21, mín 871, máx 3607 | 12/09/2026, lido de `product_events` em staging |
| P95 de `GET /api/products/` (300 produtos na conta, 90 `NORMALIZED`) | **634 ms** — acima do orçamento de 400 ms, e **não por causa da query** | 12/09/2026, API local |
| SQL puro da página da lista | P50 **16 ms**, P95 **17 ms** | 12/09/2026, direto no pooler de staging |
| referência externa de agosto | 3,6 s | rotulada como externa; o "antes" do código nunca foi medido |
| cold start da API (free tier do Render) | 41,9 s na primeira chamada, 0,46 s nas seguintes | 06/09/2026 (ADR 0009); 41,4 s em 08/09/2026; **52,8 s** em 12/09/2026 |

**A Seção 8 não piorou a Biblioteca:** 1415 ms contra 1454 ms é uma diferença de
39 ms a favor do código novo, dentro da variação entre execuções — não é ganho
reivindicado, é ausência de regressão. `QueryBoundary` e o badge no prefetch
entraram sem custo de tempo mensurável.

> ⚠️ **O `npm run dev` precisa estar quente, e isso domina o número.** Três
> execuções seguidas do mesmo comando, no mesmo servidor, deram medianas de
> **2426 ms**, **1923 ms** e **1409 ms**, nessa ordem — o `next dev` compila sob
> demanda e só para de compilar depois de algumas passagens. A quarta execução
> (1415 ms, amostras entre 1390 e 1422) é a que está na tabela, porque é a única
> com dispersão estreita. Quem repetir a medição num servidor recém-subido e
> parar na primeira execução vai reportar uma regressão que não existe. A
> medição de 10/09/2026 tropeçou na mesma pedra, e está registrada em
> [`../medicoes/2026-09-06-biblioteca-depois.md`](../medicoes/2026-09-06-biblioteca-depois.md).

### Os itens que fecharam, com o comando de cada um

**1. A mediana depois da Seção 8 — FECHOU: 1415 ms.** Contra 1454 ms de antes.
O `--timeout` aparece porque o orçamento padrão de 30 s por teste não cobre
login, compilação sob demanda de três rotas e as 5 amostras na primeira
execução de uma sessão; ele não altera nada do que é medido (as amostras são
`Date.now()` dentro do laço).

```
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line --timeout=180000
# AMOSTRAS=1390,1403,1415,1418,1422
# MEDIANA_MS=1415
```

**2. A hidratação continua de pé — FECHOU, e a asserção foi apertada.** Três
execuções consecutivas mediram **zero** pedido a `/api/products` saindo do
navegador no primeiro carregamento — `PEDIDOS_TOTAL=0`,
`PEDIDOS_NORMALIZED=0`, `PEDIDOS_CAPTURED=0`. Ou seja: o prefetch do badge do
inbox, que a Tarefa 7 da Seção 8 acrescentou, **está sendo aproveitado**, e a
lacuna aberta desde a Seção 5 fechou de fato. Por isso o spec deixou de filtrar
por `state=NORMALIZED` e passou a exigir zero pedido de qualquer tipo, na mesma
ocasião em que isso foi medido.

```
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/hidratacao-biblioteca.spec.ts --reporter=line
```

**3. O `load_ms` real do `screen_viewed` — FECHOU.** O spec
`e2e/telemetria-biblioteca.spec.ts`, que **nunca havia sido executado**, rodou
pela primeira vez em 12/09/2026 e **passou**, em três execuções consecutivas.
Ele afirma `medido_ate: "dados"`, `medido_de: "clique"`,
`principal_declarada: true`, `is_empty: false` e `load_ms` entre 200 ms e 10 s.

```
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/telemetria-biblioteca.spec.ts --reporter=line
```

**4. A linha no banco — FECHOU, e é o que encerra a pendência 2 da Seção 7.**
`product_events` estava com **0 linhas** antes desta medição (medido); depois
das execuções, as linhas de `/library` saem com `medido_ate=dados`,
`medido_de=clique`, `is_empty=false` e `load_ms` de mediana **1068 ms** — mesma
ordem de grandeza dos 1415 ms do E2E, e longe do `load_ms: 28` que a Seção 7
produzia. O `load_ms` **virou dado utilizável**; ver [`telemetry.md`](telemetry.md)
para a ressalva de como agregar a coluna.

```
cd ArchSmart-api
python -c "from app.db.session import SessionLocal; from sqlalchemy import text; db=SessionLocal(); print(db.execute(text(\"select name, properties->>'screen', properties->>'medido_ate', properties->>'medido_de', properties->>'load_ms', created_at from product_events where name='screen_viewed' order by created_at desc limit 5\")).fetchall())"
```

**5. O P95 de `/api/products` — MEDIDO, e ele estoura o orçamento: 634 ms
contra 400 ms. A causa não é a query, e por isso nada foi otimizado aqui.**
Volume declarado: **300 produtos** na conta de seed (a do usuário de teste),
dos quais **90 `NORMALIZED`** e **107 `CAPTURED`** — é o volume que
`tools/seed.py --biblioteca 300` produz, e ele já estava no banco. A requisição
medida é a que a tela realmente faz:
`GET /api/products/?page=1&size=15&sort_by=created_at_desc&state=NORMALIZED`.

A decomposição é o achado:

| O que foi medido | P50 | P95 |
|---|---|---|
| `GET /api/products/` (a lista, 300 produtos na conta) | 470 ms | **634 ms** |
| `GET /api/users/me` (rota autenticada que quase não faz trabalho) | 433 ms | 694 ms |
| o SQL da página da lista, direto no pooler | 16 ms | **17 ms** |

**A query custa 17 ms. O resto é autenticação.** Uma rota autenticada trivial
custa praticamente o mesmo que a lista inteira, o que só é possível se o custo
estiver antes do endpoint. E está: o Supabase de staging assina o JWT com
**ES256** (cabeçalho medido: `{"alg":"ES256","kid":"33477cd1-…"}`), enquanto a
API valida com segredo compartilhado HS256 (`SUPABASE_JWT_SECRET`). A validação
local falha e `resolve_identity` (`app/core/security.py:121`) cai no caminho
remoto — **uma chamada HTTP a `…/auth/v1/user` em toda requisição
autenticada**, 175 ocorrências no log desta sessão:

```
Validacao local do JWT falhou (The specified alg value is not allowed); tentando remota.
```

Então **a Tarefa 11 de backend precisa existir**, como a spec decidiu — e o que
ela tem para fazer não é índice nem `joinedload`: é fazer a API verificar ES256
(chave pública/JWKS do projeto) em vez de cair no caminho remoto. O ganho não é
de uma tela, é de toda requisição autenticada da plataforma. O fenômeno não
nasceu na Seção 8: está observado, sem número, na medição de 06/09/2026.

> Dois números que **não** servem como P95 do endpoint, registrados para
> ninguém os confundir com ele. Contra o Render de staging, o mesmo script deu
> P50 2303 ms e P95 **2762 ms** — isso mede a ida e volta Brasil → Render free
> tier somada à CPU do free tier, não a rota. E toda chamada da tela a
> `/api/products` (sem barra final) leva um **`307` antes do `200`**: medido no
> log, 44 redirecionamentos para 44 respostas, nas duas queries (lista e
> badge). São duas idas onde bastaria uma; não foi mexido aqui, e é candidato
> barato para a Tarefa 11.

### O que continua faltando

**6. axe no navegador, navegação só por teclado, e as larguras de 390px e
1440px.** Os três itens da definição de pronto que dependem de olho humano e de
layout real. O que foi entregue sem sessão: axe em **jsdom**
(`src/__tests__/library-a11y-imagens.test.tsx`), que cobre estrutura e ARIA e
**não** cobre contraste — a regra `color-contrast` cai em `incomplete`, nunca em
`violations`, porque o Tailwind não é compilado em jsdom.

```
cd ArchSmart-web && npm run dev
# com sessão, em /library:
#   Tab a partir do topo, sem tocar no mouse
#   DevTools > device toolbar > 390x844 e 1440x900
```

Para o axe no navegador, **nada injeta o `axe` no runtime**: `axe-core` é
`devDependency` e só é carregado pelo vitest em jsdom, então `axe.run(...)` no
console responde `axe is not defined`. Duas saídas que funcionam — a primeira
sem instalar nada:

```
# 1) cole o conteúdo do bundle no console e só então rode o axe
cat ArchSmart-web/node_modules/axe-core/axe.min.js   # copie a saída para o console
# no console, depois de colar:
#   axe.run().then(r => console.table(r.violations))
```

Ou **2)** instale a extensão **axe DevTools** no navegador e use a aba dela, que
é o caminho que não depende de colar 600 KB num console. Os dois medem a página
real, com o Tailwind compilado — que é a diferença que importa: em jsdom a regra
`color-contrast` cai em `incomplete`, nunca em `violations`.

Dois riscos já localizados por leitura, que só o navegador decide:

- **`LibraryToolbar.tsx:167`** é `flex flex-1 items-center gap-2 md:justify-end`
  — não quebra linha abaixo de `md`, e `:180` é um `SelectTrigger` de
  `w-[160px]` fixo ao lado de um input `w-full` sem `min-w-0`. Em 390px sobram
  ~358px úteis. Suspeita fundamentada, não medição; as saídas baratas, se
  confirmar, são `flex-wrap` em `:167` ou `min-w-0` em `:168`;
- **`group-focus-within:opacity-100` no `ProductCard`** está provado como
  **classe na árvore**, não como comportamento: jsdom não aplica Tailwind, então
  nada garante hoje que a ação escondida de fato apareça ao receber foco.

## Acessibilidade e tokens: o que a Seção 8 mudou aqui

- os dois `tabIndex={-1}` saíram, e os gatilhos ganharam `aria-label` no mesmo
  conserto — tirar o `tabIndex` sem dar nome acessível troca uma violação por
  outra (`button-name`);
- os sete campos sem rótulo da planilha de lote (`BatchNormalizeRow`) ganharam
  `aria-label`. Cabeçalho de coluna **não** rotula um input para leitor de tela;
- as 5 cores literais viraram token, e o aviso de loja bloqueada virou **chip
  preenchido** (`bg-warning` + `text-warning-foreground`, **4,91:1** no claro e
  10,83:1 no escuro) porque `text-warning` sobre `--background` dá **1,99:1** e
  reprova o Art. 6. A catraca **não** pega esse caso: `contraste_reprovado` mede
  só pares (cor, cor-foreground) de `globals.css`, nunca token de texto sobre
  `--background`;
- os três `<img>` viraram `next/image` com `unoptimized` — a imagem de produto
  vem da loja que o Web Clipper raspou, ou seja de qualquer domínio da internet,
  e `images.remotePatterns` não tem como declarar isso.

## Débito conhecido, não corrigido de passagem

**O aviso essencial preso num tooltip.** *"Sempre confira o valor!"*, sobre preço
possivelmente promocional, só existe atrás do hover/foco de um ícone. Quem não
passa o mouse nem tabula até lá nunca lê um alerta sobre a confiabilidade do
dado. Mover para texto visível é mudança de copy — decisão de produto.
