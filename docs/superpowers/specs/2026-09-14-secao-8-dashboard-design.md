# Seção 8 — Dashboard (desenho)

> Data: 14/09/2026 · Decisões de Thiago tomadas nesta data, no desenho.
>
> A segunda das nove telas. A spec-mãe a põe nesta posição porque ela **define
> shell, navegação e padrão de carregamento** — e é a primeira tela com mais de
> uma região, o que obriga a responder duas perguntas que a Biblioteca deixou em
> aberto. O padrão a copiar está em
> [`docs/dev/modulos/library.md`](../../dev/modulos/library.md) e na
> [spec da fundação](2026-09-11-secao-8-fundacao-e-biblioteca-design.md); este
> documento só registra o que **difere** dela ou o que ela não decidiu.

## Por que este documento existe

O `CLAUDE.md` exige que o plano da próxima tela ponha como tarefa, ou recuse por
escrito, cada item de "O que a Biblioteca (Seção 8) deixou em aberto". Eram
onze. O item 1 (a credencial) fechou em 12/09; os outros dez estão decididos
abaixo, em "Os itens em aberto".

E havia uma regra escrita que bloqueava esta tela:
[`2026-09-13-custo-da-requisicao-autenticada.md`](../../dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md)
diz **"não migre tela nenhuma antes de decidir isto"**, sobre a distância entre
a API e o banco. Ela foi decidida hoje — **carregada adiante, por escrito** —, e
a decisão 1 abaixo diz o que isso muda na definição de pronto.

## O Dashboard não foi migrado — foi quebrado

Vale escrever, porque a pergunta apareceu no desenho: o Dashboard **foi
mexido** duas vezes, e **nenhuma das duas foi migração**.

| Quando | O quê | Commit |
|---|---|---|
| Seção 5 | o limite de plano passou a vir de `useEntitlements()`, no lugar de `?? 2` no front (Art. 3) | `f9b7877` |
| Seção 6 | `page.tsx` quebrado de **593 para 142 linhas** em banner, métricas e colunas — refactor mecânico | `edfb860` |

O padrão de dados é o antigo: `"use client"`, `useEffect` + `fetch(apiUrl(...))`
+ `getAccessToken()` à mão, erro por `toast`, skeleton próprio, zero
`QueryBoundary`, zero prefetch, e `features/dashboard/` não existe. A telemetria
confirma de fora: em 12/09 `/dashboard` gravou `medido_ate=pintura` com mediana
de **18 ms** — o rótulo de tela que não declara prontidão. `PROGRESS.md` mantém
`- [ ] Dashboard`.

## O estado medido em 14/09/2026

**A tela** — 11 arquivos, 694 linhas:

```
find "ArchSmart-web/src/app/(dashboard)/dashboard" -type f | xargs wc -l
grep -rn "fetch(" "ArchSmart-web/src/app/(dashboard)/dashboard"      # 1, page.tsx:57
```

Cores literais em três componentes (`FinancialMetricCards` 10,
`RecentProductsColumn` 5, `QuickActions` 2 — contagem aproximada por regex; o
número que vale é o de `python tools/catraca.py`, que hoje dá **583** no
repositório inteiro), **1** `<img>`, e **10** ocorrências de
`group-hover`/`tabIndex` para conferir contra `hover_sem_focus` e
`tabindex_negativo`.

**As duas rotas que a tela consome**, contadas contra o banco de staging com
`before_cursor_execute` (o contador está em "Como reproduzir" do arquivo de
medição de 13/09):

| Rota | Consultas | Quais |
|---|---:|---|
| `/api/dashboard/lean` | **8** | `users` ×2, `projects`, contagem, `products`, `financial_entries` ×2, `events` |
| `/api/users/me` | **5** | `users` ×2, `accounts`, `subscriptions` ×2 |

**Contra a API implantada**, `/api/dashboard/lean` mede **~2,05 s** de mediana
(7 amostras, depois de um cold start de **49,7 s**). O modelo de 13/09 prevê
`0,29 + 0,17 × (3 + 8) = 2,16 s` — o custo desta rota é o mesmo fenômeno medido
na Biblioteca, não um defeito próprio.

**Quem consome `/api/users/me`**: quatro telas, não todas —

```
grep -rn "users/me" ArchSmart-web/src --include=*.ts --include=*.tsx | grep -v __tests__
```

Dashboard (via `useMe` em `features/account`), Billing, Perfil e Projetos.

**O que já existe e é reaproveitado:** o isolamento de `/api/dashboard/lean`
entre contas já tem teste
(`tests/isolation/test_join_entre_contas.py::test_dashboard_nao_devolve_cliente_nem_projeto_de_outra_conta`),
e `e2e/dashboard.spec.ts` só verifica o redirecionamento sem sessão.

## Decisões de fronteira

### 1. O orçamento de API é carregado adiante, por escrito

Com a distância aberta, o P95 do Dashboard vai estourar os **400 ms** por uma
causa que não é da tela: cada ida ao banco custa **0,17 s** a partir do
contêiner. **Decidido por Thiago: carregar adiante.**

O que isso muda, e o que não muda:

- O item "Orçamento de performance atingido" da definição de pronto **não é
  marcado como atingido**. Ele é registrado com o número, o comando, e a frase
  "estoura por distância (0,17 s × idas ao banco), não pela tela".
- A tela **continua obrigada** a reduzir o que é dela: consultas por rota e
  requisições por carregamento. Carregar a distância adiante não é licença para
  deixar consulta a mais.
- O alvo de **"queries por carregamento < 8"** da spec-mãe **continua valendo
  inteiro** — ele não depende da distância. Hoje um carregamento do Dashboard
  são **duas** requisições, somando 8 + 5 = **13**; com a decisão 5, passa a ser
  **uma**, e o alvo é alcançado com **5**.

### 2. Escopo: paridade total

Nada é cortado. Saudação com data, os três cards financeiros, o card de limite
de projetos, as ações rápidas e as três colunas migram como estão. Mudança de
produto fica para tarefa própria, sem misturar com migração.

### 3. "Dashboard vazio" é conta sem nada ainda

Resolve o item 5 da Biblioteca para esta tela. `is_empty` é `true` quando
**zero projetos, zero capturas, zero compromissos e zero lançamentos** — o estado
de conta recém-criada, que é o que interessa medir para onboarding. Conta só com
financeiro **não** é vazia.

Como o Dashboard é **uma** requisição, é **uma** região de `QueryBoundary`,
marcada `principal`. A pergunta "o que é vazio numa tela com várias regiões"
continua sem resposta geral: aqui ela foi evitada por construção, não resolvida.
A primeira tela com duas requisições de verdade a encontra.

### 4. Prefetch pareado: uma definição só, via `queryOptions`

Resolve o item 10 da Biblioteca. Cada query passa a ser uma fábrica em
`features/<dominio>/queries.ts`, que recebe o cliente e devolve chave, `queryFn`
e política de cache pelo `queryOptions` nativo do react-query v5:

```ts
export const queryDoDashboard = (cliente: ClienteApi) =>
    queryOptions({
        queryKey: queryKeys.dashboard.lean(),
        queryFn: ({ signal }) => cliente<DashboardLean>("/api/dashboard/lean", { signal }),
        ...cachePolicy.transacional,
    })

// servidor
queryClient.prefetchQuery(queryDoDashboard(apiServer))
// cliente
useQuery(queryDoDashboard(api))
```

Divergir de chave fica **impossível por construção**, em vez de proibido por um
teste escrito à mão para cada par. `select` continua no hook, porque o que se
prefetcha é a resposta crua — a mesma regra que a Biblioteca aprendeu com o badge
do inbox.

**A Biblioteca migra para o mecanismo neste mesmo plano.** Deixar o piloto no
mecanismo antigo faria as sete telas seguintes copiarem o errado.
`features/account` **não** migra aqui: com a decisão 5 o Dashboard deixa de
prefetchar `useMe`, e quem prefetcha `/api/users/me` hoje é Projetos, que migra
em seguida. A prova de que a
Biblioteca não mudou de comportamento é a que já existe:
`hidratacao-biblioteca.spec.ts` exige **zero** pedido a `/api/products` no
primeiro carregamento.

### 5. O limite de projetos vem de `/api/dashboard/lean`, e a tela faz uma requisição só

> **Decidida por Thiago em 14/09/2026, depois de a spec ter sido aprovada**, e
> por causa de um erro de conta nela: a primeira versão dizia que as três
> reduções levavam `lean` a 4. Levam a **5** — cada uma tira uma consulta, e
> 8 − 3 = 5. Somada às 3 de `/api/users/me`, a tela ficava em **8**, e o alvo de
> "< 8" era inalcançável pelo caminho que a spec descrevia.

O Dashboard chamava `/api/users/me` **só** para ler `project_limit`. E
`/api/dashboard/lean` **já devolve `plan_limit`**, calculado do mesmo
`repo.ctx.entitlements` no servidor (`_get_plan_limit` em
`app/api/endpoints/projects.py`). A tela fazia uma requisição inteira para
buscar um número que já recebia na outra.

**Decidido: o card lê `plan_limit` da resposta de `lean`.** O carregamento cai
para **uma** requisição e **5** consultas — o alvo de "< 8" é atingido —, e o
modelo de 13/09 estima ~1,3 s a menos na API implantada, por uma requisição
inteira que deixa de existir.

**Isto abre uma exceção escrita à regra da Seção 5**, que fixou
`useEntitlements()` como fonte única de limite de plano no front. A regra
continua sendo a regra; a exceção é esta e só esta: **quando o endpoint da tela
já traz o entitlement, calculado dos mesmos entitlements da sessão no servidor,
a tela lê de lá.** O Art. 3 continua inteiro — o número é decidido no servidor,
nenhum limite é fixado no front, e nenhum número é inventado enquanto o dado não
chega.

`/api/users/me` 5 → 3 **continua no plano**: Billing, Perfil e Projetos
continuam consumindo a rota.

## A tela

**`features/dashboard/`** nasce com `types.ts` (o `DashboardLeanResponse` sai de
`components/types.ts`), `queries.ts` e `hooks.ts`. A chave entra em
`queryKeys.dashboard.lean()`.

**`page.tsx` vira Server Component**, e um `<Suspense>` envolve `DashboardData`,
que prefetcha **`queryDoDashboard`** e entrega por `HydrationBoundary`.

A primeira versão desta spec punha `QuickActions` fora do `Suspense`, no shell.
**Não dá sem quebrar a paridade:** na tela, as ações rápidas ficam **entre** a
grade de métricas e as três colunas, e as duas dependem de dado. Renderizá-las
antes mudaria a ordem da página. A página inteira fica dentro da região; o
fallback do `Suspense` é o `DashboardSkeleton` que já existe, com um
`data-testid` **diferente** do skeleton do `QueryBoundary` — a lição da
Biblioteca, onde os dois tinham o mesmo e um teste passava sem nunca chegar ao
boundary. É o desenho da
[ADR 0009](../../dev/decisoes/0009-prefetch-dentro-de-suspense.md): prefetch
bloqueante transformaria o cold start de ~50 s numa tela em branco.

Somem da tela: `useEffect`, `fetch`, `getAccessToken`, e o
`router.push("/auth/login")` — a sessão é resolvida por `src/proxy.ts` antes de
a rota renderizar.

**Os cinco estados via `QueryBoundary`**, com a região `principal` e a definição
de vazio da decisão 3. **O estado vazio renderiza a mesma página que o estado
com dados** — as três colunas já têm suas mensagens de vazio, e a paridade é
total. O que o vazio muda é o `is_empty` que a telemetria grava, não o que o
usuário vê.

Para a decisão 3 ser exata, `lean` passa a devolver `financial_entries_count`:
"zero lançamentos" não se deduz de somas zeradas — lançamentos que se anulam
somam zero. A contagem sai **de graça** da agregação financeira única (um
`count` a mais no mesmo `SELECT`), então não acrescenta consulta.

**O erro deixa de ser `toast` e vira estado na tela**, com ação de tentar de
novo. **Isso quebra paridade de propósito**: um toast some sozinho e deixa a tela
com os números zerados parecendo dado real, que é o pior modo de falha de um
painel financeiro. Registrado na doc do módulo, como a Biblioteca registrou a
paginação que some no erro.

**A data da saudação fica no cliente**, num componente pequeno. Renderizada no
servidor, ela usaria o fuso do Render e mostraria o dia errado a quem abre a
tela perto da meia-noite.

**Cores literais, a imagem, e acessibilidade dos componentes** entram na mesma
passada — decisão da Seção 6: uma passada por tela, não duas.
`fetch_fora_de_lib_api` desce **1**.

## O backend que a tela consome

As duas rotas têm consulta que é **da tela**, não da distância. Cada redução
entra com o teste de contagem que reprova a volta, no formato de
`tests/api/test_produtos_sem_n_mais_um.py`: **a constância carrega a garantia**,
e o teto fixa o custo de hoje com folga de 1.

### `/api/dashboard/lean`: 8 → 5

- **`repo.get(User, ctx.user_id)` para ler `full_name`** é uma ida inteira para
  um usuário que o caminho compartilhado acabou de carregar. A identity map não
  ajuda — `repo.get` é um `SELECT` com filtro de conta. O plano decide o desenho
  (o dado precisa chegar ao endpoint sem nova consulta e sem alargar o contrato
  de `RequestContext` por conveniência), com teste.
- **Saldo realizado e entradas/saídas do mês** são duas agregações sobre
  `financial_entries` → **uma**, com soma condicional.
- **A contagem de projetos ativos e os 4 recentes** são duas → **uma**, se o
  custo de legibilidade couber. Se não couber, ficam em duas e o plano escreve
  por quê.

> **A conta, corrigida:** cada redução tira uma consulta, então as três levam
> `lean` a **5**. Se a terceira ficar de fora por legibilidade, `lean` fica em
> **6** — ainda < 8, porque pela decisão 5 a tela faz uma requisição só.

**A contagem na janela muda uma semântica, e isso fica escrito no código:**
`count(*) OVER ()` sobre o `JOIN` com `clients` conta projetos ativos **cujo
cliente é da mesma conta**, enquanto a consulta de hoje conta todo projeto
ativo. Os dois conjuntos só divergem num estado que o schema permite e nenhum
caminho de escrita produz — o mesmo que o comentário do `JOIN` já descreve.

Previsão pelo modelo de 13/09, **rotulada como previsão até o deploy**:
`0,29 + 0,17 × (3 + 5) ≈ 1,65 s`, contra ~2,05 s medidos — e a tela deixa de
pagar a segunda requisição inteira.

### `/api/users/me`: 5 → 3

Ela relê `users`, recalcula entitlements que o `RequestContext` já traz, e
busca `plans` numa consulta separada quando a assinatura tem plano. O ganho vale
para as **três** telas que continuam consumindo a rota: Billing, Perfil e
Projetos.

**Ponto cego declarado:** a rota assina a URL do logo no Supabase Storage
quando `accounts.logo_url` é um caminho privado — **uma ida remota** que não
aparece em contagem de consulta. A conta de teste **não tem logo**
(`logo_url IS NULL`, medido), então nenhuma medição deste plano vai ver esse
custo. Conta real com logo privado paga ele em toda chamada.

### O que não se faz aqui

O N+1 de `/api/projects` (12 consultas numa página de 5 projetos) **não** entra:
é da tela de Projetos, a próxima.

## Os itens em aberto da Biblioteca

**Viram tarefa:**

| # | Item | Como fecha |
|---|---|---|
| 2 | axe em navegador, teclado, 390px/1440px — **não verificados na Biblioteca** | uma passada de navegador fecha **as duas telas juntas**, em vez de a dívida crescer uma tela por vez; a credencial funciona desde 12/09 |
| — | captura visual da Seção 6 (`captura-visual-secao-6.spec.ts`, **nunca rodou**) | na mesma passada |
| 3 | `LibraryToolbar` em 390px e o `group-focus-within` do `ProductCard` | **observar e registrar** na mesma passada. Se o estouro aparecer, o conserto é commit próprio **e só com ok de Thiago**: é layout de tela já migrada |
| 5 | `is_empty` com várias regiões | decisão 3, vira código |
| 10 | prefetch pareado | decisão 4, vira `queryOptions` |

**Recusados por escrito:**

| # | Item | Por quê |
|---|---|---|
| 4 | teto de 60/min da telemetria, `429` engolido | decisão de produto; o Dashboard não acrescenta evento de interação que mude o risco |
| 6 | "Sempre confira o valor!" preso num tooltip | copy da Biblioteca; o Dashboard não mostra esse aviso |
| 7 | arte do logotipo escreve "arch smart" | decisão de design; o Dashboard não usa `BRAND_ASSETS` |
| 8 | `package.json` com `arch-smart-web` | Seção 9, como já está escrito |
| 9 | `keepalive` não garante a última navegação | mexe em `lib/api/`, que toda tela usa; decisão própria, fora de migração de tela |
| 11 | `QueryBoundary` com query desabilitada | o Dashboard não tem query com `enabled`; o primeiro caso real é Projetos |

## As tarefas, nesta ordem

1. **`queryOptions`** — fábricas em `features/library/queries.ts`; a
   Biblioteca migrada. Sem mudança
   visível: `hidratacao-biblioteca.spec.ts` e a suíte provam.
2. **Backend** — `/api/users/me` 5 → 3 e `/api/dashboard/lean` 8 → 5 com
   `financial_entries_count`, cada um com teste de contagem e, o de `lean`, com
   caracterização dos valores escrita **antes** da mudança.
3. **`features/dashboard` e a tela** — Server Component, `Suspense`,
   `QueryBoundary`, os cinco estados, erro como estado.
4. **Cores, imagem e acessibilidade** dos componentes, com a catraca descendo no
   mesmo commit.
5. **Passada de navegador** — Dashboard + Biblioteca + captura da Seção 6; o
   `hidratacao` e o `telemetria` ganham a versão do Dashboard, acrescentada à
   linha de specs de guarda do `e2e.yml`.
6. **Deploy e medição** — clique→dados, P95 das duas rotas contra a API
   implantada com volume declarado, contagem de consultas;
   `docs/dev/modulos/dashboard.md` com os números e os comandos.

Branch `secao-8-dashboard`, merge em `develop`, PR `develop` → `staging`.

## Como saber que fechou

Os nove itens da definição de pronto, com uma diferença declarada — o orçamento
de API é registrado e **não** marcado como atingido (decisão 1):

- paridade, com a quebra do erro-como-estado escrita;
- `features/dashboard/hooks.ts` consumido, **zero** `fetch` na tela;
- os cinco estados via `QueryBoundary`;
- isolamento: o teste existente continua verde;
- **consultas por carregamento < 8** — uma requisição, 5 consultas;
- axe sem violação **em navegador**, contraste AA nos dois temas, navegação só
  por teclado;
- nenhuma cor, URL, id ou limite literal;
- 390px e 1440px, **olhados**;
- `docs/dev/modulos/dashboard.md` com o número medido.

E `load_ms` de `/dashboard` em `product_events` com `medido_ate=dados` —
deixando de ser os 18 ms de `pintura`.

## Riscos

- **A exceção à regra da Seção 5 pode virar precedente frouxo.** Ela está
  escrita com a condição exata ("o endpoint da tela já traz o entitlement,
  calculado dos mesmos entitlements da sessão"); uma tela que calcule limite de
  outro jeito não está coberta por ela.
- **A passada de navegador pode achar defeito na Biblioteca.** É o propósito
  dela; o risco é a tentação de consertar de passagem. Regra da decisão acima:
  registra, e conserta só com ok.
- **Soma condicional e contagem com janela deixam o SQL menos óbvio.** O ganho é
  0,17 s por consulta a menos na API implantada; se o código ficar ilegível para
  um ganho desses, a consulta fica e o motivo fica escrito.
