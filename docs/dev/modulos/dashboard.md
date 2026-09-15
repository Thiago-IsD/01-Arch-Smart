# Módulo: `features/dashboard` e a tela `/dashboard`

A camada de dados do domínio Dashboard e a tela que a consome — a **segunda**
migrada na Seção 8, depois da Biblioteca. Ela não nasceu do zero: o Dashboard já
existia, no padrão antigo (`useEffect` + `fetch` + `getAccessToken()` à mão,
toast de erro, skeleton próprio, zero `QueryBoundary`, zero prefetch), e a
Tarefa 3 do plano trocou o mecanismo mantendo a paridade da tela — ver a spec
para o antes.

## O que expõe

| Símbolo | Onde | O que faz |
|---|---|---|
| `useDashboard()` | `hooks.ts` | Um `useQuery` sobre `queryDoDashboard(api)` — a única query da tela. |
| `queryDoDashboard(cliente)` | `queries.ts` | **A forma única** da query: recebe o cliente (`api` no navegador, `apiServer` no servidor) e devolve chave, `queryFn` e política de cache pelo `queryOptions` nativo do react-query v5. |
| `DashboardLean` | `types.ts` | O formato de `GET /api/dashboard/lean`: nome do usuário, projetos recentes, produtos recentes, contagem de projetos ativos, `plan_limit`, os três números financeiros, `financial_entries_count`, compromissos futuros. |
| `dashboardVazio(d)` | `vazio.ts` | Decide o `is_empty` da telemetria — não o que a tela renderiza. Ver "Quem é a região principal e o que é vazio". |

## Do que depende

`lib/api/client.ts` (header, erro, cancelamento) no cliente, `lib/api/server.ts`
(`apiServer`) no servidor, e `lib/query/keys.ts` (`queryKeys.dashboard.lean()` e
`cachePolicy.transacional`). Não fala com Supabase e não monta URL — Art. 4.

**Zero `fetch` na tela e na camada**, medido:

```
grep -rnoE "\bfetch\(" "ArchSmart-web/src/app/(dashboard)/dashboard" ArchSmart-web/src/features/dashboard | wc -l   # 0
```

O teste `src/__tests__/dashboard-content.test.tsx` prende isso do lado do
cliente ("busca `/api/dashboard/lean` pela camada de dados, sem fetch na
tela"), e `src/__tests__/dashboard-data.test.tsx` do lado do servidor
("prefetcha `/api/dashboard/lean` sob a chave que `useDashboard` lê, e nada
mais").

## Invalidação

**Hoje nenhuma mutação invalida `queryKeys.dashboard.all`.** O Dashboard não
tem mutação própria — é só leitura —, e nenhuma tela migrada até aqui (a
própria Biblioteca) chama `queryClient.invalidateQueries` sobre a chave do
Dashboard:

```
grep -rn "dashboard.all\|dashboard\.lean" ArchSmart-web/src --include=*.ts --include=*.tsx
```

Isso é achado, não decisão: os números do Dashboard (projetos ativos,
lançamentos, produtos recentes) mudam por ações que acontecem em **outras**
telas — criar projeto, aprovar produto, lançar uma despesa —, e nenhuma delas
sabe que o Dashboard existe. Sem invalidação, o card fica com o número velho até
o `staleTime` de `cachePolicy.transacional` vencer ou a navegação remontar a
query. **Esta é a próxima pergunta de quem migrar Projetos** (a primeira tela
com mutação capaz de mudar `active_projects_count`): decidir se a saída é
invalidar `dashboard.all` a partir de `features/projects`, ou aceitar o atraso
até o `staleTime` vencer.

## A tela: o que consome, e em que ordem

```
app/(dashboard)/dashboard/
├── page.tsx                      Server Component: <Suspense> em volta de DashboardData
└── components/
    ├── DashboardData.tsx         prefetch no servidor + HydrationBoundary
    ├── DashboardContent.tsx      "use client": hook, QueryBoundary, o Painel
    ├── DashboardSkeleton.tsx     fallback do <Suspense> E skeleton do QueryBoundary
    ├── DashboardComErro.tsx      o estado de erro
    ├── GreetingBanner.tsx, FinancialMetricCards.tsx, ProjectsLimitCard.tsx,
    │   QuickActions.tsx, RecentProjectsColumn.tsx, UpcomingEventsColumn.tsx,
    │   RecentProductsColumn.tsx, format.ts
    │                              os pedaços do Painel — não têm estado próprio
```

`page.tsx` não busca nada: monta o `<Suspense>` cujo fallback tem o testid
**`dashboard-shell-streaming`**. Diferente da Biblioteca, esse testid **não** é
igual ao do skeleton do cliente de propósito — na Biblioteca os dois tinham o
mesmo nome e um teste que esperava "o skeleton do cliente apareceu" passava sem
nunca chegar ao `QueryBoundary`; aqui `DashboardSkeleton` é reaproveitado nos
dois papéis (fallback do `Suspense` e `skeleton` do boundary), mas o wrapper do
`Suspense` tem o testid próprio que os distingue.

`DashboardContent` monta um único `Painel` com todos os pedaços — banner,
grade de métricas, `ProjectsLimitCard`, ações rápidas e as três colunas — dentro
do `children` do `QueryBoundary`; o mesmo `Painel` é usado no estado `empty`.

## Os cinco estados

Via `QueryBoundary` (`components/ui/query-boundary.tsx`), a mesma peça da
Biblioteca.

| Estado | Onde vive | Como se reconhece |
|---|---|---|
| carregando | `DashboardSkeleton` (o `skeleton` do boundary) | dentro de `[data-testid="dashboard-shell-streaming"]` (SSR) e depois disso, do cliente |
| vazio | o mesmo `Painel`, renderizado com os dados vazios | `[data-testid="dashboard-painel"]` — **não tem testid próprio de vazio** |
| erro | `DashboardComErro`, com `refazer` | `[data-testid="dashboard-error"]` |
| padrão | o `Painel` com dados | `[data-testid="dashboard-painel"]` |
| hover/foco | seta e nome do projeto em `RecentProjectsColumn` (`group-focus-within:opacity-100`) | classe; ver o registro de medição por agente abaixo |

### A quebra de paridade deliberada: o erro vira estado na tela, não toast

Diferente da Biblioteca — que manteve o toast e só tirou a paginação do estado
de erro —, aqui o **próprio mecanismo de erro muda**: o Dashboard antigo
mostrava um `toast` que sumia sozinho, deixando o painel com os números
**zerados** parecendo dado real. Para um painel financeiro, esse é o pior modo
de falha possível — o usuário vê "Saldo R$ 0,00" sem nenhum sinal de que a
requisição falhou.

`DashboardComErro` (`data-testid="dashboard-error"`, `role="alert"`) substitui
o `Painel` inteiro enquanto durar o erro, com a mensagem de `erro.message` (que
vem de `lib/api/errors.ts` — frase de domínio em pt-BR ou o genérico, pelo
mesmo contrato da Biblioteca) e um botão "Tentar de novo" que chama `refazer`.
Isso é a mesma disciplina de "erro explícito em vez de dado velho escondido"
que a Biblioteca já tinha aplicado à paginação — aplicada aqui ao painel
inteiro, e registrada como quebra de paridade porque o comportamento visível ao
usuário mudou de propósito.

## Quem é a região principal, e o que é vazio

```
<QueryBoundary query={query} principal isEmpty={dashboardVazio} …>   // DashboardContent.tsx
```

Como o Dashboard faz **uma** requisição, há **uma** região — a única pergunta
que a Biblioteca deixou em aberto (item 5, "o que é vazio numa tela com várias
regiões") foi **evitada por construção aqui, não respondida em geral**: a
decisão 3 da spec resolve só o caso de uma região, e a primeira tela com duas
requisições de verdade (Projetos) é quem encontra a pergunta geral.

`dashboardVazio` (`features/dashboard/vazio.ts`) define "vazio" como conta
**sem nada ainda** — o estado de conta recém-criada, que é o que interessa
medir para onboarding:

```ts
d.active_projects_count === 0 &&
d.recent_products.length === 0 &&
d.upcoming_events.length === 0 &&
d.financial_entries_count === 0
```

`financial_entries_count`, e não as somas: lançamentos que se anulam somam
zero, e deduzir "sem lançamentos" de "saldo zero" mentiria justamente aí — é
por isso que `/api/dashboard/lean` passou a devolver essa contagem (ver
"O backend que a tela consome").

**Isto decide só o `is_empty` da telemetria, não o que a tela mostra**: o
estado `empty` do `QueryBoundary` renderiza o **mesmo** `Painel` que o estado
com dados — as três colunas já têm mensagem de vazio própria, então a paridade
entre "vazio" e "com dados" é total, ao contrário do erro.

## O que o prefetch entrega

`DashboardData` roda no servidor e prefetcha **uma** chave:

| Chave | Query | Quem consome no cliente |
|---|---|---|
| `queryKeys.dashboard.lean()` | `queryDoDashboard(clienteComSinal(apiServer, signal))` | `useDashboard` |

A montagem no servidor e a montagem no cliente (`useDashboard` chama
`queryDoDashboard(api)`) saem da **mesma função** de `queries.ts` — o mecanismo
que resolve o item 10 da Biblioteca (ver a seção seguinte). `clienteComSinal` e
`tentarPrefetch` (`lib/query/hydration.ts`) são os mesmos da Biblioteca: teto de
`TIMEOUT_DO_PREFETCH_MS = 3_000`, e num cold start o prefetch desiste e não
hidrata nada — o cliente busca, e o pior caso nunca fica pior que o de antes.

### O prefetch pareado deixou de depender de disciplina manual

A Biblioteca resolveu o item 10 ("o prefetch pareado é garantido por teste
escrito à mão, uma query de cada vez") migrando as duas queries dela
(`queryDaListaDeProdutos`, `queryDoBadgeDoInbox`, em
`features/library/queries.ts`) para fábricas `queryOptions`, no mesmo commit
que criou `queryDoDashboard`. Cada fábrica recebe o cliente e devolve chave,
`queryFn` e política de cache num lugar só; divergir de chave entre servidor e
cliente deixa de ser possível por construção, em vez de proibido por um teste
escrito à mão para cada par.

```
grep -n "queryOptions" ArchSmart-web/src/features/library/queries.ts ArchSmart-web/src/features/dashboard/queries.ts
```

## A exceção à regra da Seção 5

A Seção 5 fixou `useEntitlements()` como fonte única de limite de plano no
front. `ProjectsLimitCard` lê `plan_limit` direto da resposta de
`/api/dashboard/lean`, e não de `useEntitlements()` — **é uma exceção escrita,
e vale só sob esta condição exata** (decisão 5 da spec do Dashboard):

> Quando o endpoint da tela já traz o entitlement, calculado dos mesmos
> entitlements da sessão no servidor, a tela lê de lá.

`/api/dashboard/lean` calcula `plan_limit` com a mesma função que
`/api/users/me` usa para o mesmo número (`_get_plan_limit`,
`app/api/endpoints/projects.py`), a partir de `repo.ctx.entitlements` —
nenhum limite é decidido no front, e o Art. 3 continua inteiro. A exceção
**não** cobre uma tela que calcule limite de outro jeito, ou que precise de um
entitlement que o endpoint dela não devolve: essa tela continua obrigada a
`useEntitlements()`.

O efeito prático: o Dashboard deixou de chamar `/api/users/me` só para ler
`project_limit`, o carregamento caiu de duas requisições para **uma**, e
`features/account` (dona de `useMe`) não foi tocado por esta migração —
Billing, Perfil e Projetos continuam consumindo `/api/users/me` normalmente.

## O backend que a tela consome

**Uma** requisição, `GET /api/dashboard/lean`. As contagens de consulta são
travadas por teste, não por leitura de código — a régua é
`ContadorDeQueries`, a mesma peça que `tests/api/test_produtos_sem_n_mais_um.py`
usa na Biblioteca.

| Rota | Teto do teste | Teste |
|---|---:|---|
| `GET /api/dashboard/lean` | **≤ 5** consultas, e constante ao crescer de 1 para 6 projetos | `tests/api/test_dashboard_lean.py::test_lean_nao_cresce_com_os_projetos_e_gasta_no_maximo_cinco` |
| `GET /api/users/me` | **≤ 3** consultas | `tests/api/test_me.py::test_me_gasta_no_maximo_tres_consultas_com_assinatura_e_plano` |

`lean` também ganhou `financial_entries_count`, testado em
`test_dashboard_lean.py::test_lean_conta_os_lancamentos` — a contagem sai de
graça da mesma agregação financeira (um `count` a mais no `SELECT`), sem
consulta adicional. `test_lean_devolve_os_mesmos_valores` é o teste de
caracterização: fixa os valores que o endpoint devolvia **antes** da mudança de
consultas, para uma agregação errada não escapar como "número parecido".

`/api/users/me` desceu de 5 para 3 consultas no mesmo plano — ganho que vale
para as três telas que continuam consumindo a rota (Billing, Perfil e
Projetos), não só para o Dashboard, que deixou de chamá-la (ver a exceção
acima).

O isolamento entre contas já tinha teste antes desta migração, reaproveitado:
`tests/isolation/test_join_entre_contas.py::test_dashboard_nao_devolve_cliente_nem_projeto_de_outra_conta`.

## Os números medidos, e os que faltam

**Nada nesta seção existe ainda.** Esta tarefa (7) foi dividida em duas partes
pela mesma regra que rege todo este repositório — número afirmado sem medição é
número errado —, e o código não pode ser medido contra a API implantada antes
de o merge chegar a `staging`. O que segue são os comandos exatos que vão
produzir cada número, depois do deploy; nenhum valor foi estimado no lugar
deles.

### P50/P95 de `/api/dashboard/lean` e `/api/users/me`, contra a API implantada

```bash
# token: bloco "Como reproduzir" de docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md
API=https://arqsmart-staging.onrender.com; H="Authorization: Bearer $TOKEN"
# controles: tem de bater com 13/09 (health ~0,29 s, health/db ~0,99 s, token invalido ~0,52 s)
for i in $(seq 8); do
  curl -s -o /dev/null -w "health %{time_total}\n"   "$API/health"
  curl -s -o /dev/null -w "healthdb %{time_total}\n" "$API/health/db"
  curl -s -o /dev/null -w "invalido %{time_total}\n" -H "Authorization: Bearer nao.e.jwt" "$API/api/users/me"
  curl -s -o /dev/null -w "lean %{time_total}\n"     -H "$H" "$API/api/dashboard/lean"
  curl -s -o /dev/null -w "me %{time_total}\n"       -H "$H" "$API/api/users/me"
done
# P50/P95 de lean: 45 chamadas, descartadas as 5 primeiras
for i in $(seq 45); do curl -s -o /dev/null -w "%{time_total}\n" -H "$H" "$API/api/dashboard/lean"; done
```

Com o volume declarado para a conta de teste (projetos ativos, produtos,
lançamentos e eventos futuros, contados por consulta de leitura contra o banco
de staging com o `venv` da API), o número vai ao lado do P95 quando existir. O
orçamento vai escrito assim, como a decisão 1 da spec manda:

> **P95 de `/api/dashboard/lean`: X ms contra 400 ms — não atingido.** Estoura
> por distância (0,17 s × idas ao banco), não pela tela: 5 consultas + 3 idas de
> protocolo. Decisão 1 da spec do Dashboard: carregado adiante, por escrito.

Previsão escrita **antes** da medição, para a medição julgar (modelo de
[13/09/2026](../medicoes/2026-09-13-custo-da-requisicao-autenticada.md)):
`lean` ≈ `0,29 + 0,17 × (3 + 5)` = **1,65 s**.

### A tela: clique → dados

```bash
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/medicao-dashboard.spec.ts --reporter=line --timeout=180000
```

Produz `AMOSTRAS=` e `MEDIANA_MS=` no mesmo formato de
`medicao-biblioteca.spec.ts`. Arranjo: API local em `:8000`.

### `load_ms` do `screen_viewed` de `/dashboard`

Consulta de leitura em `product_events` de staging, filtrando
**`screen='/dashboard'` e `medido_ate='dados'`** — nunca sem esse filtro:
linhas antigas de `/dashboard` são `medido_ate='pintura'`, com mediana de
18 ms, e misturar as duas mediria o gatilho velho junto com o novo.

```
cd ArchSmart-api
python -c "from app.db.session import SessionLocal; from sqlalchemy import text; db=SessionLocal(); print(db.execute(text(\"select properties->>'medido_ate', properties->>'medido_de', properties->>'load_ms', created_at from product_events where name='screen_viewed' and properties->>'screen'='/dashboard' order by created_at desc limit 10\")).fetchall())"
```

## O que a passada de navegador já mediu, e o que ela deixou aberto

[`docs/dev/medicoes/2026-09-14-passada-de-navegador.md`](../medicoes/2026-09-14-passada-de-navegador.md)
tem o que a Tarefa 6 mediu no navegador para o Dashboard e para a Biblioteca —
axe, largura em 390px/1440px, teclado, e a captura visual da Seção 6. **Tudo lá
foi verificado por agente sobre captura de tela e medição no DOM, não por olho
humano**: o próprio arquivo carrega esse aviso em destaque, e nenhum item que
depende de julgamento humano (hierarquia, perceptibilidade do anel,
legibilidade) foi marcado como fechado ali. Para o Dashboard, o que ficou em
aberto de propósito: `text-red-500` do saldo negativo (a conta de teste tem
saldo zero), o par `secondary` do botão de compromisso (defeito de token, fora
do escopo desta migração) e o nome de plano fixo em `ProjectsLimitCard.tsx:25`.
