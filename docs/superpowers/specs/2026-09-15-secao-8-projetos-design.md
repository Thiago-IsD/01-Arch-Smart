# Seção 8 — Projetos (desenho)

> Data: 15/09/2026 · Decisões de Thiago tomadas nesta data, no desenho.
>
> A terceira das nove telas: **Projetos (lista + detalhe)**, "núcleo do modelo"
> na tabela da spec-mãe. É a **primeira tela que muta** o que outra tela já
> migrada mostra, então é aqui que nasce o padrão de escrita (`useMutation` +
> invalidação) que Orçamento e Financeiro vão copiar. O padrão de leitura a
> copiar está em [`docs/dev/modulos/dashboard.md`](../../dev/modulos/dashboard.md)
> e [`docs/dev/modulos/library.md`](../../dev/modulos/library.md); este
> documento registra o que **difere** deles ou o que eles não decidiram.

## Por que este documento existe

O `CLAUDE.md` exige que o plano de Projetos ponha como tarefa, ou recuse por
escrito, cada item de "O que o Dashboard (Seção 8) deixou em aberto" (13 itens)
e os itens ainda abertos de "O que a Biblioteca (Seção 8) deixou em aberto"
(4, 6, 7, 8, 9, 11; e 2, 3, 5 parcialmente). Todos estão decididos abaixo, em
"Os itens em aberto".

## O estado medido em 15/09/2026

| O quê | Onde | Medida |
|---|---|---|
| Lista | `app/(dashboard)/projects/page.tsx` | 149 linhas; `fetch` manual no servidor; erro vira lista vazia **em silêncio** (`catch` devolve `{items: []}`); `/api/users/me` por `apiServer` direto; `any` |
| Detalhe | `app/(dashboard)/projects/[id]/page.tsx` | 74 linhas; dois `fetch` **sequenciais** no servidor; só a aba "ambientes" |
| Componentes | `components/projects/` | 17 arquivos, 1750 linhas; **6** `fetch(`, todos mutação |
| `fetch(` no território | lista + detalhe + `components/projects` | **9** |
| Atualização depois de mutar | `ProjectWizard`, `ProjectStatusSelect`, `DeleteProjectAlert`, `ClientWizardDriver` | `router.refresh()`; ambientes por `setEnvironments` na mão em `EnvironmentsWorkspace` |
| `/api/projects` | `ArchSmart-api/app/api/endpoints/projects.py` | **N+1**: 12 consultas numa página de 5 projetos (13/09/2026) |
| Catraca | `python tools/catraca.py` | `fetch_fora_de_lib_api` 74, `contraste_reprovado` 4, `cores_literais` 553 |

```
grep -rn "fetch(" ArchSmart-web/src/components/projects "ArchSmart-web/src/app/(dashboard)/projects/page.tsx" "ArchSmart-web/src/app/(dashboard)/projects/[id]/page.tsx" | wc -l   # 9
grep -rn "enabled" ArchSmart-web/src/features/*/hooks.ts   # 4, todos em library
```

**Fora do escopo por ser outra tela:** `projects/[id]/budget/` (Orçamento, tela
4), `projects/[id]/presentation/` (Apresentações, tela 6) e
`projects/[id]/print/`. Moram sob a mesma rota e continuam no padrão antigo.

## Decisões de fronteira

### 1. Escopo: leitura **e** mutações

Lista e detalhe no padrão novo, e os 6 `fetch` de mutação viram `useMutation`.
A alternativa "só leitura" foi recusada: adiaria a pergunta de invalidação para
Orçamento, e a rota não zeraria `fetch`.

### 2. `/api/users/me` continua por `apiServer` direto — exceção escrita

`features/account/queries.ts` **não** é criado nesta tela (item 8 do Dashboard,
metade recusada). A lista prefetcha `/api/projects` pela fábrica nova e continua
lendo `entitlements.project_limit` de `/me` com `apiServer`, como hoje. É uma
exceção à regra "prefetch pela fábrica", válida **só** para `/me` e **só** até
uma tela decidir criar a fábrica de conta. Consequência aceita: o "Plano Solo"
fixo (item 6 do Dashboard) continua, porque o nome real viria de
`account.plan_name` por essa fábrica.

### 3. Invalidação por mapa explícito, sem otimista

Cada hook de mutação declara exatamente as chaves que invalida. Nada de
`invalidateQueries()` sem chave (rebuscaria Biblioteca e badge a 0,17 s por ida
ao banco), nada de atualização otimista (o seletor de status não justifica o
código de rollback). Fecha o item 7 do Dashboard.

### 4. O contador de ativos vem da API

Hoje `activeProjectsCount` é contado **no cliente, sobre a página 1 de 20**.
Com mais de 20 projetos, o contador e a troca para o modal de upgrade ficam
errados — e é regra de plano decidida no front (Art. 3). `/api/projects` passa a
devolver `active_count`, contado no banco sobre todos os projetos da conta, ao
lado do `plan_limit` que já devolve. Muda o contrato da resposta (acréscimo de
campo, não quebra).

### 5. Token `destructive`: um token por tema, foreground invertido no escuro

Medido com a fórmula WCAG:

| | texto sobre `--background` | foreground sobre o token |
|---|---|---|
| claro hoje, `0 84.2% 60.2%` | 3,76 | 3,59 |
| escuro hoje, `0 62.8% 30.6%` | **2,00** | 9,56 |
| claro novo, `0 84.2% 40%` + fg `210 40% 98%` | **6,53** | **6,23** |
| escuro novo, `0 84.2% 60%` + fg `222.2 84% 4.9%` | **5,29** | **5,29** |

Com foreground branco, nenhuma luminosidade passa 4,5:1 nos dois papéis no
escuro (o melhor, L50, dá 4,42/4,32). Recusadas: token separado para texto
(cria um segundo vermelho a escolher em cada tela, a mesma bifurcação que os
dois `FormField` eram) e meio-termo L50 (não fecha o item). Custo aceito: botão
destrutivo no escuro passa a ter texto escuro sobre vermelho claro — por isso
entra na verificação humana (decisão 7). As duas `text-red-*` de
`FinancialMetricCards.tsx` saem.

A catraca ganha a medida que faltava — token de texto sobre `--background` —
com teste no mesmo commit, senão o próximo token reprovado passa verde de novo.

### 6. LCP e JS da rota ganham instrumento **antes** da migração

Para Projetos ser a primeira tela com "antes" e "depois" dos dois números, e
Biblioteca e Dashboard ganharem o número que nunca tiveram.

### 7. Olho humano antes do merge

A última tarefa **para** e entrega a Thiago uma lista de rotas × larguras ×
temas, com o que olhar em cada uma. O merge não acontece até a resposta; o que
for visto vai ao registro com o verificador nomeado. Biblioteca e Dashboard
entram na mesma rodada. A passada por agente continua existindo e continua
rotulada como tal.

## A tela

### `features/projects/`

`types.ts`, `api.ts`, `queries.ts`, `hooks.ts`, `limite.ts`, no molde do
Dashboard.

| Fábrica | Chave |
|---|---|
| `queryDaListaDeProjetos(cliente, {page, size})` | `queryKeys.projects.list(page, size)` |
| `queryDoProjeto(cliente, id)` | `queryKeys.projects.detail(id)` — **nova** |
| `queryDosAmbientes(cliente, id)` | `queryKeys.projects.environments(id)` |

`useProjetosParaMover` e `useAmbientesDoProjeto` saem de
`features/library/hooks.ts` e passam a consumir essas fábricas (a mudança de
casa já prevista em `PROGRESS.md`). A Biblioteca continua importando-os, de
`features/projects`.

`limite.ts` concentra o cálculo de "no limite" e da fração da barra, usado pela
lista **e** por `ProjectsLimitCard` do Dashboard — com limite 0 tratado como "no
limite", sem divisão (item 9 do Dashboard, o `NaN`).

### Lista

Server Component → `<Suspense>` → prefetch da lista pela fábrica, em
`Promise.all` com `/me` (decisão 2) → `HydrationBoundary` → `QueryBoundary
principal`. Estados `vazio` (o card "Nenhum projeto ainda" de hoje) e `erro`
(estado na tela, não lista vazia silenciosa). O wizard continua dirigido por
`?action=new`.

### Detalhe

Prefetch de projeto e ambientes em `Promise.all`. O `notFound()` continua no
servidor: 404 da API é 404 da rota, não skeleton nem estado de erro — o
servidor resolve o projeto antes de renderizar, e só os ambientes dependem do
prefetch tolerante. `EnvironmentsWorkspace` para de copiar
`initialEnvironments` para `useState` e lê de `useQuery`. Região principal: a
lista de ambientes.

### Mutações

| Hook | Substitui | Invalida |
|---|---|---|
| `useCriarProjeto`, `useEditarProjeto` | `ProjectWizard` + `router.refresh()` | `projects.all`, `dashboard.all` |
| `useMudarStatusDoProjeto` | `ProjectStatusSelect` + `router.refresh()` | `projects.all`, `dashboard.all` |
| `useExcluirProjeto` | `DeleteProjectAlert` + `push` + `refresh` | `projects.all`, `dashboard.all`; depois navega para `/projects` |
| `useCriarAmbiente` (`POST`), `useExcluirAmbiente` (`DELETE`) | `NewEnvironmentModal`, `EnvironmentCard` + `setEnvironments` | `projects.environments(id)`, `projects.detail(id)` |
| `useSalvarDna` (`PUT .../dna`) | `DNAEditorSheet` + `onSuccess(env)` | `projects.environments(id)` |

Seis `fetch`, sete hooks: `ProjectWizard` usa o mesmo `fetch` para criar
(`POST`) e editar (`PUT`). Não existe edição de ambiente além do DNA.

- `router.refresh()` sai de todas: com a tela lendo do cache, só pagaria outra
  ida ao servidor.
- Os callbacks `onSuccess(env)` dos modais somem; quem atualiza é a invalidação.
- Erro de mutação continua **toast** (ação do usuário, não região de dados), com
  a mensagem lida de `detail` por `lib/api/errors.ts`. Desabilitar botão por
  `isPending`, não por `useState` próprio.
- Teste por hook afirmando o **conjunto exato** de chaves invalidadas.

O lint de `fetch` vira **erro** em `components/projects/**`,
`app/(dashboard)/projects/page.tsx`, `[id]/page.tsx` e `ClientWizardDriver.tsx`
— sem pegar `budget/`, `presentation/` e `print/`.

## O backend que a tela consome

### `/api/projects`: N+1 → ≤ 4 consultas, mais `active_count`

`joinedload(Project.client)` e a contagem de ambientes numa subconsulta
agregada (`GROUP BY project_id`), sem carregar a coleção; `active_count` numa
consulta sobre a conta inteira. Contagem pela suíte (contador de
`before_cursor_execute`) **e** contra o banco de staging com o app real, antes e
depois. Teste de regressão com **1 e com 20** projetos afirmando o **mesmo**
número de consultas — é isso que separa N+1 consertado de N+1 menor.

### `GET /api/projects/{id}` e `/environments`

Contados. Se tiverem N+1 próprio, o conserto entra; se não, o número fica
registrado.

### O que não se faz aqui

Nenhuma rota nova, nenhuma migração. A distância API↔banco continua como
decidida em 14/09 (decisão 1 da spec do Dashboard).

## Débitos transversais que entram

- **`tentarPrefetch`** (item 9 do Dashboard): depois do `prefetchQuery`, lê o
  estado da query no `QueryClient` e loga quando ela não resolveu, em vez de
  depender de exceção que `prefetchQuery` engole. Teste com prefetch que estoura
  o tempo.
- **`QueryBoundary` com prop `inativo`** (item 11 da Biblioteca): com a query
  em `enabled: false`, renderiza o que `inativo` mandar e **não anuncia** à
  telemetria. Sem o prop numa query desabilitada: aviso em desenvolvimento. A
  tarefa mede primeiro se Projetos tem query gateada; se não tiver, é desenhada
  sobre os quatro casos da Biblioteca, e isso fica escrito.
- **Acessibilidade do shell** (item 4 do Dashboard), tarefa própria e isolada:
  `button-name` no menu do usuário do `Header` (5 nós, crítico), 3 paradas de
  Tab invisíveis, `region` (6 nós, `NotificationPanel` e chat), contraste do item
  ativo da `Sidebar` (4,17:1) por token. axe em navegador em `/dashboard` e
  `/projects`, antes e depois.
- **Token `destructive`** (item 2 do Dashboard): decisão 5.

## Instrumentos

- **LCP em 4G** — `e2e/medicao-lcp.spec.ts`: Chromium com throttling por CDP
  (perfil 4G fixado e escrito no arquivo), `largest-contentful-paint` por
  `PerformanceObserver`, 5 amostras e mediana, rota por parâmetro.
- **JS da rota** — script que lê o manifesto de `next build` e soma os chunks
  de cada rota (gzip). Só em build de produção local, nunca em `dev`.
- Os dois são **instrumentos**, fora do `e2e.yml`.
- **Guardas novas** no `e2e.yml`: `hidratacao-projetos` (zero pedido a
  `/api/projects*` no primeiro carregamento da lista e do detalhe, provado
  vermelho antes de verde) e `telemetria-projetos` (`medido_ate=dados`,
  `principal_declarada=true`).

## Os itens em aberto

### Do bloco do Dashboard

| # | Item | Decisão |
|---|---|---|
| 1 | distância API↔banco | **recusado aqui**: carregado adiante em 14/09; P95 registrado "por distância" |
| 2 | `destructive` como texto | **tarefa** (decisão 5) |
| 3 | `secondary` 3,93:1 | **recusado**: é o coral da marca, decisão de design; já contado em `contraste_reprovado` |
| 4 | acessibilidade do shell | **tarefa** |
| 5 | Biblioteca estoura 42px em 390px | **recusado**: layout de tela já migrada, só com ok de Thiago; a verificação humana (decisão 7) olha e decide |
| 6 | "Plano Solo" fixo | **recusado** (decisão 2) |
| 7 | nenhuma mutação invalida `dashboard.all` | **tarefa** (decisão 3) |
| 8 | N+1 de `/api/projects`; `/me` fora das fábricas | N+1 **tarefa**; `/me` **recusado** (decisão 2) |
| 9 | `tentarPrefetch` silencioso; `NaN` com limite 0 | **tarefa** |
| 10 | `captura-visual-secao-6.spec.ts` não roda limpo | **recusado**: instrumento de seção fechada; a verificação humana substitui o que ele capturaria |
| 11 | LCP e JS sem instrumento | **tarefa** (decisão 6) |
| 12 | nada visto por olho humano | **tarefa** (decisão 7) |
| 13 | rodar testes de `tools/` quando a catraca muda | **regra do plano**: toda tarefa que mexe em medida roda `cd tools && python -m unittest discover -p "test_*.py"` no mesmo commit |

### Do bloco da Biblioteca

| # | Item | Decisão |
|---|---|---|
| 2, 3 | axe/teclado/larguras; toolbar e `ProductCard` | **tarefa**, na verificação humana (decisão 7) |
| 4 | teto de 60/min da telemetria | **recusado**: decisão de produto; Projetos não acrescenta evento de interação |
| 5 | `is_empty` com várias regiões | **recusado aqui**: lista e detalhe têm uma região principal cada |
| 6 | aviso preso em tooltip | **recusado**: copy da Biblioteca |
| 7 | logotipo "arch smart" | **recusado**: decisão de design; Projetos não usa `BRAND_ASSETS` |
| 8 | `package.json` | **recusado**: Seção 9 |
| 9 | `keepalive` | **recusado**: mexe em `lib/api/`, decisão própria |
| 11 | `QueryBoundary` com query desabilitada | **tarefa** |

## As tarefas, nesta ordem

1. **Instrumentos** de LCP e JS da rota, e a medição "antes" de Biblioteca,
   Dashboard e Projetos.
2. **Backend**: N+1 de `/api/projects` + `active_count`, contado antes e depois;
   contagem de detalhe e ambientes.
3. **`features/projects/`**: fábricas, chave `detail`, tipos, `limite.ts`, e a
   mudança de casa dos dois hooks da Biblioteca.
4. **Lista** migrada.
5. **Detalhe** migrado.
6. **Mutações de projeto** (criar, editar, status, excluir).
7. **Mutações de ambiente e DNA**, e o lint de `fetch` vira erro no território.
8. **`QueryBoundary inativo`**.
9. **`tentarPrefetch`** e o `NaN` do limite.
10. **Token `destructive`** e a medida nova da catraca.
11. **Acessibilidade do shell**.
12. **Guardas e2e, medições "depois", passada por agente, `docs/dev/modulos/projects.md`**
    — e a parada para a verificação humana antes do merge.

Os débitos transversais (8–11) vêm **depois** da tela e em commits próprios,
para a medição "depois" da tela não misturar efeitos.

Branch `secao-8-projetos`, merge em `develop`, PR `develop` → `staging`.

## Como saber que fechou

- paridade, com as quebras escritas (erro como estado na lista; contador de
  ativos da API);
- `features/projects/hooks.ts` consumido; **zero** `fetch` no território
  (`fetch_fora_de_lib_api` 74 → **65**);
- os cinco estados via `QueryBoundary` na lista e no detalhe;
- isolamento: o teste existente continua verde;
- **consultas por carregamento < 8** na lista e no detalhe, com número;
- P95 da API registrado, **não** marcado como atingido se estourar por
  distância;
- clique → dados < 1,5 s no arranjo local;
- **LCP em 4G e JS da rota com número** — antes e depois;
- axe, teclado, 390/1440px **por agente** e **por olho humano**, cada um
  rotulado;
- nenhuma cor, URL, id ou limite literal;
- `grep -rn "invalidateQueries" ArchSmart-web/src --include=*.ts --include=*.tsx | grep dashboard` > 0;
- `docs/dev/modulos/projects.md` com os números e os comandos.

E `load_ms` de `/projects` em `product_events` com `medido_ate=dados`.

## Riscos

- **Escopo largo: doze tarefas, com quatro transversais.** O risco é uma
  regressão sem dono. Mitigação: transversais depois da tela, commit próprio
  cada uma, medição "depois" da tela antes delas.
- **O token `destructive` muda a aparência de toda tela**, migrada ou não. É o
  propósito; a verificação humana é onde isso é julgado, e o valor pode voltar
  se ficar ruim — o número fica registrado de qualquer forma.
- **Remover `router.refresh()` pode esconder dependência de Server Component**
  ainda não migrado que lia o mesmo dado. A tarefa de mutações lista, por grep,
  quem mais lê projeto ou ambiente antes de remover (o `HeaderBreadcrumb` foi
  conferido e usa rótulo fixo, "Projetos").
- **A exceção de `/me` pode virar hábito.** Está escrita com o limite exato
  (decisão 2); Orçamento e Financeiro não estão cobertos por ela.
- **LCP por throttling de CDP não é 4G real.** O perfil fica escrito no
  instrumento, e o número é rotulado com ele.
