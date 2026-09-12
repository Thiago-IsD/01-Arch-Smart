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

**Esta seção está incompleta, e o item "`docs/dev/modulos/<modulo>.md` escrita,
com o número medido" da definição de pronto não está fechado.** O motivo é um
só: em 11/09/2026 a credencial do usuário de teste E2E passou a ser rejeitada
pelo Supabase de staging (`HTTP 400, "Invalid login credentials"`), e toda
medição desta tela exige sessão. Nenhum número foi estimado para preencher a
lacuna.

### O que existe

| Número | Valor | Quando |
|---|---|---|
| mediana clique → dados na grade | **1454 ms** (`AMOSTRAS=1434,1445,1454,1469,1948`) | 10/09/2026, Tarefa 1 da Seção 6 — **antes** das mudanças da Seção 8 |
| referência externa de agosto | 3,6 s | rotulada como externa; o "antes" do código nunca foi medido |
| cold start da API (free tier do Render) | 41,9 s na primeira chamada, 0,46 s nas seguintes | 06/09/2026 (ADR 0009); 41,4 s em 08/09/2026 |

### O que falta, item a item, com o comando de cada um

**1. A mediana depois da Seção 8.** A de 1454 ms é de antes de a tela passar a
usar `QueryBoundary` e de o badge entrar no prefetch. Uma piora grande aqui é
defeito desta seção, não ruído.

```
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line
```

**2. A hidratação continua de pé.** Guarda, não instrumento: se o prefetch
quebrar, a lista volta a buscar do navegador e ninguém vê erro nenhum.

```
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/hidratacao-biblioteca.spec.ts --reporter=line
```

**3. O `load_ms` real do `screen_viewed`.** O spec existe e nunca rodou.

```
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/telemetria-biblioteca.spec.ts --reporter=line
```

**4. A linha no banco.** É o que fecha a pendência 2 da Seção 7 de fora, e não
por vitest. Com a `DATABASE_URL` de **staging** (confira qual bloco do `.env`
está ativo antes):

```
cd ArchSmart-api
python -c "from app.db.session import SessionLocal; from sqlalchemy import text; db=SessionLocal(); print(db.execute(text(\"select name, properties->>'screen', properties->>'medido_ate', properties->>'load_ms' from product_events where name='screen_viewed' order by created_at desc limit 5\")).fetchall())"
```

**5. O P95 de `/api/products` contra staging, com dado realista.** O orçamento
da spec é **400 ms**; acima disso, abre-se tarefa de backend em vez de otimizar
query de passagem. O volume precisa vir do seed de volume
(`ArchSmart-api/tools/seed.py`, com os parâmetros da própria docstring), e o
número medido vai nesta tabela junto com **o volume com que foi medido** — P95
sem volume declarado não significa nada.

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
