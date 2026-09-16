# Módulo: `features/projects` e a tela `/projects`

Terceira tela migrada na Seção 8, depois da Biblioteca e do Dashboard — e a
primeira que muta o que outra tela já migrada mostra (a spec de Projetos,
[`docs/superpowers/specs/2026-09-15-secao-8-projetos-design.md`](../../superpowers/specs/2026-09-15-secao-8-projetos-design.md),
chama isso de "núcleo do modelo"). **Este documento descreve o estado depois
da Tarefa 4 do plano daquela spec** — só a **lista** migrou. O **detalhe**
(`/projects/[id]`) e as **seis mutações** (criar, editar, mudar status,
excluir projeto; criar/excluir ambiente; salvar DNA) continuam no padrão
antigo, como tarefas seguintes do mesmo plano (5 a 7). Não leia este arquivo
como "Projetos migrou" — leia como "a lista migrou".

## O que `features/projects/` contém hoje

| Arquivo | O que tem |
|---|---|
| `types.ts` | `Projeto`, `ClienteDoProjeto`, `PaginaDeProjetos`, `Ambiente`, `DnaDoAmbiente` — espelham `ProjectResponse`/`PaginatedProjectResponse`/`EnvironmentResponse` do backend. `PaginaDeProjetos.active_count` é novo (ver "O backend", abaixo); o comentário no tipo já avisa "ativos da conta INTEIRA, contados no servidor — não conte `items`". |
| `queries.ts` | Três fábricas `queryOptions`: `queryDaListaDeProjetos(cliente, {page, size})`, `queryDoProjeto(cliente, id)` e `queryDosAmbientes(cliente, projectId)`. Só a primeira é usada por uma tela migrada hoje — as outras duas existem porque a Tarefa 3 as trouxe já prontas para o detalhe (Tarefa 5), como o Dashboard fez com `queryDoDashboard` antes da Biblioteca ter par pareado. |
| `limite.ts` | `estadoDoLimite(ativos, limite)` — o cálculo de "no limite" e da fração da barra, num lugar só. Limite `<= 0` é tratado como "no limite", sem divisão (evita o `NaN` que `ProjectsLimitCard` do Dashboard tinha antes da Tarefa 3 desta seção existir). |
| `hooks.ts` | `useListaDeProjetos()` (usa `queryDaListaDeProjetos`), `useProjeto(id)`, `useAmbientes(projectId)`, mais dois hooks que **vieram de `features/library/hooks.ts`** na Tarefa 3 — `useProjetosParaMover(ativo)` (usado pelo `MoveToProjectModal` da Biblioteca) e `useAmbientesDoProjeto(projectId)`. |

Não existe `api.ts` nem `filters.ts` neste domínio — as fábricas de `queries.ts`
bastam, e não há filtro de lista própria como o da Biblioteca.

## Como a lista carrega os dados

```
app/(dashboard)/projects/
├── page.tsx                      Server Component: <Suspense> em volta de ProjetosData
├── ClientWizardDriver.tsx         "use client": dirige o ProjectWizard por ?action=new
└── components/
    ├── ProjetosData.tsx           prefetch no servidor + HydrationBoundary
    ├── ProjetosContent.tsx        "use client": hook, QueryBoundary, a Lista
    ├── CabecalhoDeProjetos.tsx    título, barra de limite, botão "Novo Projeto" ou UpgradeAlertModal
    ├── ProjetosVazio.tsx          o estado vazio
    ├── ProjetosComErro.tsx        o estado de erro
    └── ProjetosSkeleton.tsx       fallback do <Suspense> E skeleton do QueryBoundary
```

`page.tsx` não busca nada: monta o `<Suspense>` cujo fallback tem o testid
**`projetos-shell-streaming`**. Como no Dashboard, esse testid é diferente do
skeleton do cliente de propósito — `ProjetosSkeleton` é reaproveitado nos dois
papéis (fallback do `Suspense` e `skeleton` do `QueryBoundary`), mas o wrapper
do `Suspense` tem o testid próprio.

`ProjetosData` roda no servidor e faz duas chamadas em **paralelo**
(`Promise.all`): `tentarPrefetch` sobre `queryDaListaDeProjetos` (que hidrata a
lista) e `apiServer<Me>("/api/users/me")` (que não é prefetchado — só o
`project_limit` desce como prop; ver a exceção abaixo). Isso segue o mesmo
motivo do Dashboard e da Biblioteca: a API hiberna no free tier do Render
(41,9 s num cold start medido, ADR 0009), e um segundo `await` sequencial
dobraria essa exposição no pior caso.

`ProjetosContent` (o componente exportado, `ProjetosContent({ planLimit?:
number })`) chama `useListaDeProjetos()` e entrega o resultado ao
`QueryBoundary`, com `principal` marcado — uma requisição, uma região. O
`vazio` padrão do `QueryBoundary` já reconhece página (`items` vazio), então
`isEmpty` não é passado.

## A exceção de `/api/users/me` — igual à decisão do Dashboard, com escopo diferente

**Decisão 2 da spec de Projetos:** `features/account/queries.ts` não foi
criado nesta tela. A lista continua lendo `entitlements.project_limit` de
`/me` com `apiServer` direto, fora das fábricas de `queries.ts`, e **sem**
hidratar essa chamada — só o número desce como prop (`planLimit`) para
`ProjetosContent` e dali para `CabecalhoDeProjetos`. Se `/me` falhar, `planLimit`
fica `undefined` e a tela não inventa um número (Art. 3): sem contador, sem
barra, sem modal de upgrade — só o botão "Novo Projeto".

Isto é a mesma exceção que o Dashboard já tinha aberto (item 8 daquela seção),
mas com uma diferença de escopo importante: o Dashboard **parou** de chamar
`/api/users/me` de vez, porque `/api/dashboard/lean` já devolve `plan_limit`
calculado do mesmo `entitlements` da sessão. Projetos **continua** chamando
`/me`, porque `/api/projects` não devolve entitlement nenhum — só o `plan_limit`
antigo (nome que a Seção 4 não unificou) e, agora, `active_count`. A exceção
vale só para `/me`, e só até uma tela decidir criar `features/account/queries.ts`
— Orçamento e Financeiro não estão cobertos por ela.

Consequência aceita, por escrito na spec: "Plano Solo" continua fixo em
`CabecalhoDeProjetos.tsx` — o nome real do plano viria de `account.plan_name`,
que só chegaria por essa fábrica que não foi criada.

## As duas quebras de paridade desta tarefa

1. **Erro de rede deixa de virar lista vazia em silêncio.** O código antigo
   tinha um `catch` em `getProjects()` que devolvia `{ items: [], total: 0 }`
   sempre que a chamada falhasse — quem tinha projetos e só estava sem rede via
   "Nenhum projeto ainda", indistinguível de uma conta nova. Hoje o
   `QueryBoundary` mostra `ProjetosComErro` (`data-testid="projetos-error"`,
   `role="alert"`), com a frase de `erro.message` (que vem de
   `lib/api/errors.ts` — sentença de domínio em pt-BR ou o genérico) e um botão
   "Tentar de novo" que chama `refazer` (o `refetch` da query).
2. **O contador de ativos lê `active_count` da API, não conta a página.** O
   código antigo calculava `activeProjectsCount` no cliente, filtrando
   `status === "ACTIVE"` sobre os itens da **página 1 de 20** — com mais de 20
   projetos, o contador e a decisão de mostrar o modal de upgrade ficavam
   errados, e era regra de plano decidida no front (Art. 3). A Tarefa 2 deste
   plano acrescentou `active_count` à resposta de `GET /api/projects`, contado
   no banco sobre **todos** os projetos da conta, e `CabecalhoDeProjetos` lê
   `pagina.active_count` (ou, no estado vazio, `query.data?.active_count ?? 0`)
   em vez de `items.filter(...)`.

Mais um ajuste de layout, não de comportamento: `p-8` fixo virou
`p-4 md:p-8`, como no Dashboard — o `p-8` fixo é a causa medida do estouro de
42px da Biblioteca em 390px (`docs/dev/medicoes/2026-09-14-passada-de-navegador.md`).

## Os quatro `data-testid` que a tela produz

| `data-testid` | Quando aparece |
|---|---|
| `projetos-shell-streaming` | fallback do `<Suspense>` de `page.tsx`, enquanto o servidor ainda não entregou `ProjetosData` |
| `projetos-pagina` | com dados: cabeçalho + grade de `ProjectCard` |
| `projetos-vazio` | conta sem projeto nenhum: cabeçalho + `ProjetosVazio` |
| `projetos-error` | erro da API: `ProjetosComErro`, com "Tentar de novo" |

A Tarefa 12 do plano (guardas e2e) espera por um dos três últimos.

## O backend que a lista consome

`GET /api/projects` deixou de ter N+1 na Tarefa 2 deste mesmo plano
(`ArchSmart-api/app/api/endpoints/projects.py`): `joinedload(Project.client)`
na página, contagem de ambientes por subconsulta agregada (`GROUP BY
project_id`, sem carregar a coleção) em vez de uma consulta por linha, e
`active_count` numa consulta própria sobre a conta inteira. Medido pela suíte
(`tests/api/test_projetos_sem_n_mais_um.py`, contador de
`before_cursor_execute`), com 1 e com 20 projetos afirmando o **mesmo** número
de consultas — é isso que separa N+1 consertado de N+1 menor:

| | Antes | Depois |
|---|---:|---:|
| Lista, 20 projetos | **43** consultas | **5** consultas, constante entre 1 e 20 |

As 5 consultas de hoje: 1 de contexto/entitlements (caminho compartilhado,
resolvida antes de qualquer código deste endpoint rodar — não é deste
endpoint), contagem total, página com join do cliente, contagem agregada de
ambientes, `active_count`. `GET /api/projects/{id}` e
`/api/projects/{id}/environments` **não** foram tocados por esta tarefa (fora
do escopo de arquivos do brief) — continuam em 4 e 3 consultas
respectivamente, medido na mesma suíte; se têm N+1 próprio ou não é pergunta
da Tarefa 5 (o detalhe), não desta.

## O que esta tarefa NÃO mudou (a medir/decidir nas tarefas seguintes)

- **`/projects/[id]` (o detalhe) continua no padrão antigo**: dois `fetch`
  sequenciais no servidor, sem `QueryBoundary`, aba de ambientes só. É a
  Tarefa 5 do plano.
- **As seis mutações continuam com `fetch` manual**: `ProjectWizard.tsx`
  (criar/editar), `ProjectStatusSelect.tsx`, `DeleteProjectAlert.tsx`,
  `NewEnvironmentModal.tsx`, `EnvironmentCard.tsx`,
  `DNAEditorSheet.tsx`. Nenhuma virou `useMutation` ainda — é a Tarefa 6 e 7.
  Medido nesta tarefa:

  ```
  grep -rn "fetch(" ArchSmart-web/src/components/projects "ArchSmart-web/src/app/(dashboard)/projects/[id]/page.tsx"   # 8, hoje
  ```

  (eram 9 no território inteiro antes desta tarefa — lista + detalhe +
  `components/projects`; a lista tinha 1, que esta tarefa removeu.
  `tools/catraca.py`, `fetch_fora_de_lib_api`, baixou de 74 para **73**.)
- **`ClientWizardDriver.tsx` perdeu `onSuccess`/`handleSuccess`**: a lista lê
  do cache agora, e quem a atualizar depois de criar um projeto é a
  invalidação da Tarefa 6 — que ainda não existe. **Até a Tarefa 6 rodar,
  criar um projeto pelo wizard não atualiza a lista sozinha** (o
  `ProjectWizard` continua chamando `router.refresh()` por conta própria, o
  que reconstrói o Server Component e refaz o prefetch — isso cobre o caso na
  prática mesmo sem invalidação explícita, mas não é o mecanismo que a spec
  desenha para as mutações).
- **`QueryBoundary` com query desabilitada, `is_empty` com várias regiões,
  token `destructive`, acessibilidade do shell, LCP/JS "depois", axe/teclado
  por olho humano**: todos são tarefas próprias e posteriores no plano da
  spec de Projetos — nenhum foi tocado aqui.

## O que está medido, e o que está "a medir"

**Medido:**
- Consultas de `/api/projects`: 5, constante 1–20 projetos (tabela acima).
- `fetch_fora_de_lib_api`: 73 (era 74).
- `npm test`: 264 testes, 35 arquivos, zero `failed` (nesta tarefa).

**A medir** (dependem de tarefas seguintes do mesmo plano, ou de navegador com
sessão — nenhum número foi estimado no lugar):
- Clique → dados da lista migrada (o instrumento existe,
  `e2e/medicao-carga.spec.ts`, mas a medição "depois" é da Tarefa 12).
- P50/P95 de `GET /api/projects` na API implantada.
- `load_ms` do `screen_viewed` de `/projects` em `product_events`, filtrado por
  `medido_ate=dados`.
- axe em navegador, navegação por teclado, 390px/1440px, por agente e por olho
  humano (decisão 7 da spec: "a última tarefa **para** e entrega a Thiago uma
  lista de rotas × larguras × temas").

**Medido antes desta migração** (código antigo, commit `139b16b`, do
instrumento da Tarefa 1 — `docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md`),
citado aqui só como "antes" e **não** comparável a um "depois" que ainda não
existe:

| Rota | LCP mediana (ms) | JS (bytes, rede) | Arquivos JS |
|---|---:|---:|---:|
| `/projects` | 1308 | 358129 | 23 |

O "depois" desses dois números é entregável da Tarefa 12, não desta.

## A definição de pronto, item a item (só o que esta tarefa cobre)

| Item | Estado | Onde está a prova |
|---|---|---|
| Paridade da lista, com duas quebras deliberadas | ✅ | `src/__tests__/projetos-lista.test.tsx` |
| `features/projects/hooks.ts` consumido pela lista | ✅ | `ProjetosContent.tsx` |
| Prefetch da lista + `/me` fora da hidratação | ✅ | `src/__tests__/projetos-data.test.tsx` |
| Os quatro estados via `QueryBoundary` (streaming, dados, vazio, erro) | ✅ | testes acima |
| Nenhuma cor, URL, id ou limite literal nos arquivos desta tarefa | ✅ | `npx eslint` limpo; sem cor literal nova |
| Orçamento de performance | ⚠️ não medido nesta tarefa — ver "A medir" |
| axe, teclado, 390/1440px | ⚠️ não medido nesta tarefa — dependem de sessão de navegador, na verificação humana da Tarefa 12 |
| Consultas por carregamento < 8 | ✅ | 5, Tarefa 2, tabela acima |
| Doc do módulo | ✅ | este arquivo |

Este documento cobre só a lista. Quando o detalhe e as mutações migrarem, ele
precisa ser revisado — não reescrito do zero — para não ficar descrevendo
"depois da Tarefa 4" enquanto o código já está em outro lugar.
