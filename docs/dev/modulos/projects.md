# Módulo: `features/projects` e a tela `/projects`

Terceira tela migrada na Seção 8, depois da Biblioteca e do Dashboard — e a
primeira que muta o que outra tela já migrada mostra (a spec de Projetos,
[`docs/superpowers/specs/2026-09-15-secao-8-projetos-design.md`](../../superpowers/specs/2026-09-15-secao-8-projetos-design.md),
chama isso de "núcleo do modelo"). **Este documento descrevia o estado depois
da Tarefa 4 — só a lista.** A Tarefa 5 migrou também o **detalhe**
(`/projects/[id]`); a seção "O detalhe" abaixo descreve o que mudou nela. **A
Tarefa 6 migrou as quatro mutações de projeto** (criar, editar, mudar status,
excluir) para `useMutation` com um mapa explícito de invalidação — ver "As
mutações de projeto (Tarefa 6)" abaixo. **A Tarefa 7 migrou as três mutações de
ambiente/DNA** (criar ambiente, excluir ambiente, salvar DNA) pelo mesmo
mecanismo, e fez o lint de `fetch` virar **erro** (em vez de aviso) em todo o
território de Projetos — ver "As mutações de ambiente e DNA (Tarefa 7)"
abaixo. Não leia este arquivo como "Projetos migrou" — leia como "lista,
detalhe e as sete mutações (quatro de projeto, três de ambiente/DNA)
migraram".

## O que `features/projects/` contém hoje

| Arquivo | O que tem |
|---|---|
| `types.ts` | `Projeto`, `ClienteDoProjeto`, `PaginaDeProjetos`, `Ambiente`, `DnaDoAmbiente` — espelham `ProjectResponse`/`PaginatedProjectResponse`/`EnvironmentResponse` do backend. `PaginaDeProjetos.active_count` é novo (ver "O backend", abaixo); o comentário no tipo já avisa "ativos da conta INTEIRA, contados no servidor — não conte `items`". |
| `queries.ts` | Três fábricas `queryOptions`: `queryDaListaDeProjetos(cliente, {page, size})`, `queryDoProjeto(cliente, id)` e `queryDosAmbientes(cliente, projectId)`. As duas últimas, trazidas prontas pela Tarefa 3, passaram a ser consumidas pelo **detalhe** na Tarefa 5. |
| `limite.ts` | `estadoDoLimite(ativos, limite)` — o cálculo de "no limite" e da fração da barra, num lugar só. Limite `<= 0` é tratado como "no limite", sem divisão (evita o `NaN` que `ProjectsLimitCard` do Dashboard tinha antes da Tarefa 3 desta seção existir). |
| `hooks.ts` | `useListaDeProjetos()` (usa `queryDaListaDeProjetos`), `useProjeto(id)` e `useAmbientes(projectId)` (usados pelo detalhe desde a Tarefa 5), mais dois hooks que **vieram de `features/library/hooks.ts`** na Tarefa 3 — `useProjetosParaMover(ativo)` (usado pelo `MoveToProjectModal` da Biblioteca) e `useAmbientesDoProjeto(projectId)`. Desde a Tarefa 6, também `useCriarProjeto()`, `useEditarProjeto()`, `useMudarStatusDoProjeto()` e `useExcluirProjeto()`. Desde a Tarefa 7, também `useCriarAmbiente(projectId)`, `useExcluirAmbiente(projectId)` e `useSalvarDna(projectId)`. |
| `api.ts` | Desde a Tarefa 6: as escritas de Projetos — `criarProjeto`, `editarProjeto`, `mudarStatusDoProjeto`, `excluirProjeto` (consumidas pelos quatro hooks acima), mais `criarAmbiente`, `excluirAmbiente`, `salvarDna` e os tipos `CorpoDeAmbiente`/`AreasDoDna`, que já existiam sem consumidor (o brief da Tarefa 6 mandou criá-los junto, para o arquivo nascer inteiro) e desde a Tarefa 7 são consumidos pelos três hooks de ambiente/DNA. |
| `invalidacao.ts` | Desde a Tarefa 6: o mapa `efeitos` (`EfeitoNoCache = { invalidar, descartar }`, uma entrada por mutação) e `aplicarEfeito(queryClient, efeito)`. Ver "As mutações de projeto (Tarefa 6)" abaixo. |

Não há `filters.ts` neste domínio — não há filtro de lista própria como o da
Biblioteca.

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

## O detalhe (`/projects/[id]`) — Tarefa 5

```
app/(dashboard)/projects/[id]/
├── page.tsx                      Server Component: <Suspense> em volta de ProjetoData
├── loading.tsx                   fallback ao trocar de aba (Ambientes/Orçamento/Apresentação) — NÃO tocado
└── components/
    ├── ProjetoData.tsx           prefetch no servidor + HydrationBoundary
    ├── ProjetoContent.tsx        "use client": duas regiões via QueryBoundary
    └── ProjetoComErro.tsx        estado de erro, com "Tentar de novo" e "Voltar para Projetos"
```

`ProjetoData` prefetcha **projeto e ambientes em paralelo** (`Promise.all`
dentro de `tentarPrefetch`, pelas fábricas `queryDoProjeto`/`queryDosAmbientes`)
— o `page.tsx` antigo fazia os dois `fetch` em sequência. `ProjetoContent` tem
**duas regiões** `QueryBoundary`: o cabeçalho (`ProjectHeader`, projeto) e os
ambientes (`EnvironmentsWorkspace`), com os ambientes marcados `principal` —
é a aba de conteúdo, e quem decide `load_ms`/`is_empty` da tela. O vazio dos
ambientes é o próprio `EnvironmentsWorkspace` com lista vazia (ele já tem
botão de adicionar embutido); o vazio do cabeçalho é `null` porque um
`Projeto` nunca é "vazio" para `vazioPorPadrao`.

**`notFound()` roda dentro do `<Suspense>`, não antes dele** (decisão
registrada na spec de Projetos, "Detalhe"): `ProjetoData` chama `notFound()`
quando o prefetch do projeto resolve com `ApiError` de status 404 — mas como
isso acontece depois que o `<Suspense>` do `page.tsx` já começou a fazer
stream, **a resposta HTTP sai como `200`**, com a UI de "não encontrado" no
corpo, não `404`. Confirmado ao vivo em 15/09/2026, com sessão real e
`/projects/00000000-0000-0000-0000-000000000000`:

```
fetch(location.href, { credentials: "include" }).then(r => r.status)   // 200
```

Um erro que **não** seja 404 (por exemplo o prefetch desistindo por tempo)
**não** chama `notFound()` — `dehydrate` só leva a query de sucesso, a
query fica sem estado hidratado, e o `QueryBoundary` do cliente busca de novo
e mostra `ProjetoComErro` se isso também falhar. Os três casos têm teste em
`src/__tests__/projeto-data.test.tsx`.

### A UI de não encontrado

Desde 16/09/2026 (branch de limpeza `secao-8-limpeza-projetos`, commits
`2011353` + `6ea0a36`), quem responde ao `notFound()` acima — e a todo outro
`notFound()` sob `projects/[id]/` que não tenha o próprio boundary — é
`ArchSmart-web/src/app/(dashboard)/projects/[id]/not-found.tsx`. Por estar
dentro do grupo `(dashboard)`, o shell (sidebar e cabeçalho) continua
renderizado — diferente do 404 embutido do Next, que substituiria o shell
inteiro.

Ele cobre **6 chamadas de `notFound()` em 5 arquivos**, não só a do detalhe
(medido, comando no próprio docstring do arquivo):

```
grep -rn "notFound()" "ArchSmart-web/src/app/(dashboard)/projects/[id]" --include=*.tsx
```

detalhe (`components/ProjetoData.tsx`), orçamento (`budget/page.tsx`, quando o
orçamento ainda não existe — o projeto continua vivo), apresentação
(`presentation/page.tsx`), impressão (`print/page.tsx`) e o construtor de
apresentação (`presentation/[presentation_id]/builder/page.tsx`, que chama
duas vezes: sem token de sessão, e sem apresentação). Por isso a copy é
deliberadamente genérica — "Isto pode não existir, ainda não ter sido criado,
ou não pertencer a esta conta." — para não mentir em nenhum dos cinco casos; e
não afirma qual motivo é o real, porque o backend responde 404 tanto para
"não existe" quanto para "existe, mas não pertence a esta conta"
(`ScopedRepository.obter`, nunca 403, de propósito). Testid
`projeto-nao-encontrado`; teste em
`src/__tests__/projeto-nao-encontrado.test.tsx`.

**O que continua faltando**: um `not-found.tsx` **de raiz**
(`src/app/not-found.tsx`), para uma URL que não casa com **nenhum** segmento
da aplicação (`/projetos-typo`, por exemplo). Sem ele, essa rota cai no 404
padrão do Next — página em inglês, fora do shell do produto. Medido: `find
ArchSmart-web/src -iname "not-found*"` → só o arquivo de `projects/[id]`
acima (17/09/2026). Não corrigido, de propósito: é decisão de design (o que
mostrar, em que idioma, com ou sem shell), fora do escopo desta limpeza.

`EnvironmentsWorkspace` deixou de copiar a lista para `useState`
(`EnvironmentsWorkspace({ projectId, ambientes })` — a prop `initialEnvironments`
não existe mais) e passou a ler `ambientes` por prop, vindo do
`QueryBoundary`. Texto original (Tarefa 5), para o histórico: **os três
`handle*` (adicionar/atualizar/excluir) continuavam existindo, mas escreviam
direto no cache do React Query
(`queryClient.setQueryData(queryKeys.projects.environments(projectId), ...)`)
em vez de `setState`** — marcado `PROVISORIO` no código, porque os modais
(`NewEnvironmentModal`, `DNAEditorSheet`, `EnvironmentCard`) ainda faziam
`fetch` manual e devolviam o resultado por callback. **A Tarefa 7 apagou os
três `handle*` e o trecho `PROVISORIO`**: ver "As mutações de ambiente e DNA
(Tarefa 7)" abaixo. Confirmado ao vivo (ver "Passada por agente" abaixo):
criar, excluir e completar o DNA de um ambiente atualizam a grade
imediatamente, sem `router.refresh()` nem reload.

`ProjectHeader` ganhou tipo: `project: Projeto` (era `project: any`). As
páginas de Orçamento e Apresentação (`budget/page.tsx`,
`presentation/page.tsx`) continuam no padrão antigo e passam o retorno de
`res.json()` — que o TypeScript aceita como `any`/implicitamente compatível —
então `npm run typecheck` continua limpo sem tocar nelas.

Os **cinco** `data-testid` que o detalhe produz: `projeto-shell-streaming`
(fallback do `<Suspense>` de `page.tsx`), `projeto-cabecalho` (wrapper do
`QueryBoundary` do cabeçalho), `projeto-ambientes` (wrapper do `QueryBoundary`
dos ambientes), `projeto-error` (o estado de erro, dos dois `QueryBoundary`) e,
desde 16/09/2026 (branch de limpeza `secao-8-limpeza-projetos`, commits
`2011353` + `6ea0a36`), `projeto-nao-encontrado` (o `not-found.tsx` do
segmento — ver "A UI de não encontrado", abaixo).

### Passada por agente (15/09/2026)

Subidos localmente `ArchSmart-api` (venv, porta 8000, `DATABASE_URL` do
pooler de staging) e `ArchSmart-web` (`npm run dev`, porta 3000), com sessão
da conta de teste E2E. Em `/projects/<id>` (Loft Pinheiros #3, 6 ambientes):

- Zero requisição de `/api/projects/{id}` ou `/api/projects/{id}/environments`
  saindo do navegador no primeiro carregamento (`read_network_requests`
  filtrado por `/api/`) — confirma prefetch + hidratação.
- Criar um ambiente ("Ambiente Teste Tarefa 5"): apareceu na grade
  imediatamente.
- Editar o DNA de "Quarto Casal" (piso, parede, depois teto): o badge mudou
  de "DNA Pendente" para "DNA Completo" na hora, sem reload — e reabrir o
  sheet mostrou os valores salvos, confirmando que a escrita chegou à API.
- Excluir "Ambiente Teste Tarefa 5": sumiu da grade com o toast "Ambiente
  Excluído", sem reload.
- `/projects/00000000-0000-0000-0000-000000000000`: UI de não encontrado,
  `HTTP 200` (comando acima).

Processos derrubados ao final pelo PID real (`Get-NetTCPConnection` nas
portas 8000/3000 → PID → `taskkill /PID <pid> /T /F`), nunca por nome.

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
`p-4 md:p-8`, como no Dashboard. ~~O `p-8` fixo é a causa medida do estouro de
42px da Biblioteca em 390px~~ — **essa atribuição foi desmentida em
17/09/2026, na branch de limpeza `secao-8-limpeza-projetos` (commit
`413c8f8`)**: com `min-w-0` na coluna do `AppShell`, `/library` zera o
estouro **sem** tocar o `p-8`, que continua no arquivo como redundância
inofensiva. A causa real era a mesma coluna do shell que também estourava em
`/projects/{id}`; ver
[`docs/dev/medicoes/2026-09-14-passada-de-navegador.md`](../medicoes/2026-09-14-passada-de-navegador.md)
(nota de correção datada) e
[`docs/dev/medicoes/2026-09-17-largura-do-shell.md`](../medicoes/2026-09-17-largura-do-shell.md).

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

## As mutações de projeto (Tarefa 6)

As quatro escritas de **projeto** — criar, editar, mudar status, excluir —
trocaram `fetch` manual por `useMutation`, com um mapa **explícito** de
invalidação de cache em `features/projects/invalidacao.ts`, no mesmo padrão
que a Biblioteca já usava (`useMutation` + invalidação no `onSuccess`, sem
atualização otimista). `ProjectWizard.tsx` (criar/editar),
`ProjectStatusSelect.tsx` (mudar status) e `DeleteProjectAlert.tsx` (excluir)
chamam os hooks; nenhum dos três monta mais `Authorization` à mão nem importa
`getAccessToken`/`apiUrl`.

### O mapa de invalidação

`invalidar` marca a query obsoleta **e** rebusca o que estiver montado na
tela; `descartar` marca obsoleta **sem** rebuscar (`refetchType: "none"`).

| Mutação | `invalidar` | `descartar` |
|---|---|---|
| criar projeto | `projects.lists()`, `dashboard.all` | — |
| editar projeto | `projects.lists()`, `projects.detail(id)`, `dashboard.all` | — |
| mudar status | `projects.lists()`, `projects.detail(id)`, `dashboard.all` | — |
| excluir projeto | `projects.lists()`, `dashboard.all` | `projects.detail(id)`, `projects.environments(id)` |

`dashboard.all` entra nas quatro: o Dashboard mostra projetos recentes e o
contador de ativos, e foi o esquecimento exato que abriu o teste desta tarefa
(`src/__tests__/projects-mutacoes.test.tsx`, que afirma o **conjunto exato**
de chaves por mutação — nem uma a mais, que custaria uma ida a mais à API a
0,17 s cada, nem uma a menos, que deixaria a tela mentindo). Ambiente não
entra: o Dashboard não mostra ambiente nem contagem de ambiente.

`excluir` **descarta** em vez de invalidar `projects.detail(id)` e
`projects.environments(id)`, e a razão é de timing, não de gosto: no instante
em que o `onSuccess` roda, a query do detalhe ainda está montada (a
navegação para `/projects` ainda não terminou) — invalidar com rebusca
imediata daria um 404 contra um projeto que acabou de sumir, e o usuário
veria o estado de erro piscar durante a própria navegação de saída. Descartar
marca a query obsoleta sem refazer a requisição; se o usuário voltar pelo
histórico do navegador, aí sim ela rebusca e mostra o erro — que é o
comportamento certo nesse caso. (`removeQueries` foi descartado como
alternativa: numa query com observador ainda montado, o v5 do React Query não
documenta o comportamento; `refetchType: "none"` documenta.)

`efeitos.mudarAmbientes(projectId)` e `efeitos.salvarDna(projectId)` já estão
neste arquivo, junto com `criarAmbiente`/`excluirAmbiente`/`salvarDna` em
`api.ts` — sem consumidor nesta tarefa, para a Tarefa 7 (ambientes e DNA)
encontrar o arquivo pronto em vez de editá-lo no meio de outra tarefa.

### Por que `router.refresh()` continua nas três telas

`ProjectWizard`, `ProjectStatusSelect` e `DeleteProjectAlert` continuam
chamando `router.refresh()` depois do `mutateAsync` ter sucesso — não por
esquecimento, mas porque as páginas de **Orçamento** e **Apresentação**
(`budget/page.tsx`, `presentation/page.tsx`) renderizam `ProjectHeader` com
dado buscado no **servidor**, fora do QueryClient. Sem o `refresh()`, mudar o
status de um projeto na aba Orçamento não atualizaria o cabeçalho dela — a
invalidação do React Query não alcança um Server Component. Confirmado ao
vivo em 15/09/2026 (ver "Passada por agente" abaixo): o `PUT` sai, o cabeçalho
da aba Orçamento reflete o novo status, e a lista/dashboard atualizam pela
invalidação, sem reload de página inteira. O comentário no código
(`ProjectWizard.tsx`, `ProjectStatusSelect.tsx`, `DeleteProjectAlert.tsx`) diz
a mesma coisa: o `refresh()` sai quando Orçamento e Apresentação migrarem para
`features/projects`.

### O teste de caracterização do wizard

`src/__tests__/project-wizard.test.tsx` foi ajustado em dois pontos, e só
esses dois: o mock de `fetch` passou a devolver um `Response` de verdade (o
cliente de `lib/api` lê `res.headers`), e `abrir()` passou a envolver o
componente num `QueryClientProvider` (o wizard usa `useMutation` agora).
Nenhuma asserção de comportamento mudou — URL, método, corpo, títulos de
toast, `onOpenChange(false)`, `refresh()` chamado continuam exatamente como
antes. O teste ajustado foi rodado **antes** de tocar `ProjectWizard.tsx` e
passou (12/12): é isso que prova que o ajuste só trocou o mecanismo, não
afrouxou o que o teste prende.

## As mutações de ambiente e DNA (Tarefa 7)

As três escritas de **ambiente/DNA** — criar ambiente, excluir ambiente,
salvar DNA — trocaram `fetch` manual por `useMutation`, no mesmo padrão das
quatro mutações de projeto da Tarefa 6: `useCriarAmbiente(projectId)`,
`useExcluirAmbiente(projectId)` e `useSalvarDna(projectId)` em
`features/projects/hooks.ts`, consumindo `criarAmbiente`/`excluirAmbiente`/
`salvarDna` de `api.ts` e invalidando pelo mapa `efeitos.mudarAmbientes(projectId)`
(criar/excluir) e `efeitos.salvarDna(projectId)` (DNA), já existentes desde a
Tarefa 6. `NewEnvironmentModal`, `EnvironmentCard` e `DNAEditorSheet` perderam
`onSuccess`/`onDelete` — quem muta agora invalida o cache, não devolve o
resultado por callback — e `EnvironmentsWorkspace` perdeu os três `handle*`
`PROVISORIO` da Tarefa 5. As três telas passaram a tratar erro como o resto de
Projetos desde a Tarefa 6: `erro instanceof ApiError ? erro.message : <frase
genérica>`, título "Ops!" — antes era um `catch` cego com frase fixa.

| Mutação | `invalidar` | `descartar` |
|---|---|---|
| criar ambiente | `projects.environments(id)`, `projects.lists()` | — |
| excluir ambiente | `projects.environments(id)`, `projects.lists()` | — |
| salvar DNA | `projects.environments(id)` | — |

`projects.lists()` entra em criar/excluir ambiente porque o card da lista
mostra `environments_count`; **não** entra em salvar DNA, que não muda a
contagem. `dashboard.all` não entra em nenhuma das três — o Dashboard não
mostra ambiente nem contagem de ambiente (mesma regra da Tarefa 6). **As três
chamam `router.refresh()`** depois do sucesso, no mesmo ponto do toast — ver
"Achado do Step 7" abaixo pela razão.

### Achado do Step 7, e a decisão que ele gerou: as três mutações chamam `router.refresh()`

O brief da Tarefa 7 mandava conferir, antes de decidir não chamar
`router.refresh()` nas mutações de ambiente, que nenhum Server Component fora
de `features/projects` lê a lista de ambientes — e mandava **parar e
reportar** se achasse um. Achou dois:

```
grep -rn "/environments" "src/app/(dashboard)/projects/[id]/budget" "src/app/(dashboard)/projects/[id]/presentation" "src/app/(dashboard)/projects/[id]/print" --include=*.tsx
```

```
src/app/(dashboard)/projects/[id]/budget/page.tsx:48:        const res = await fetch(apiUrl(`/api/projects/${id}/environments`), {
src/app/(dashboard)/projects/[id]/presentation/[presentation_id]/builder/components/EnvironmentAccordion.tsx:55: ...presentations/${presentationId}/environments/${env.id}
src/app/(dashboard)/projects/[id]/presentation/[presentation_id]/builder/components/EnvironmentAccordion.tsx:98: ...presentations/${presentationId}/environments/${env.id}/images
src/app/(dashboard)/projects/[id]/print/page.tsx:47:        const res = await fetch(apiUrl(`/api/projects/${id}/environments`), {
```

`EnvironmentAccordion.tsx` bate em `/api/presentations/.../environments/...`
— rota de apresentação, não a lista de ambientes do projeto; não conta.
`budget/page.tsx:42-57` e `print/page.tsx:41-56` **contam**: ambos são Server
Components (`export default async function`, sem `"use client"`) com uma
função `getProjectEnvironments(id)` que busca `GET
/api/projects/{id}/environments` com `cache: 'no-store'`, em paralelo com o
orçamento e o projeto.

**A premissa do brief estava errada, e quem executou a tarefa não decidiu
sozinho** — reportou o achado sem adicionar `router.refresh()` nem tocar
`budget/page.tsx`/`print/page.tsx`, porque essa decisão é de Thiago. **Decidida
por Thiago em 15/09/2026: as três mutações de ambiente/DNA passam a chamar
`router.refresh()`**, no mesmo lugar (depois do toast de sucesso) e pela mesma
razão que já mantinha o refresh nas quatro mutações de projeto — tratamento
consistente das duas famílias de mutação, não uma exceção. Cada uma ganhou o
comentário:

```
// Orcamento e Impressao leem a lista de ambientes pelo servidor e
// continuam no padrao antigo; sai quando essas telas migrarem.
router.refresh()
```

O `refresh()` fica **na tela que chama** (`NewEnvironmentModal.tsx`,
`EnvironmentCard.tsx`, `DNAEditorSheet.tsx`), não dentro dos hooks de
`features/projects/hooks.ts` — mesma regra das mutações de projeto: hook não
conhece roteador. Coberto por `src/__tests__/ambientes-refresh.test.tsx` (3
testes, um por mutação, cada um afirmando `expect(refresh).toHaveBeenCalled()`
depois do toast), no mesmo padrão de `project-wizard.test.tsx`/
`delete-project-alert.test.tsx`.

**Condição de saída:** o comentário e o refresh saem das três mutações quando
`budget/page.tsx` e `print/page.tsx` migrarem para ler ambientes por
`features/projects` (prefetch + `QueryBoundary`, como o detalhe já faz) — a
mesma condição que já valia para tirar o refresh das quatro mutações de
projeto. Até lá, o achado não é mais uma pendência aberta: é a razão
documentada de uma decisão tomada.

## O lint de `fetch` vira erro no território de Projetos (Tarefa 7)

`eslint.config.mjs`: o bloco que faz `no-restricted-syntax` (a regra que
proíbe `fetch(` fora de `lib/api/`) valer como **erro** em vez de aviso
ganhou, além de `library/**`, seis entradas de Projetos —
`src/components/projects/**/*.{ts,tsx}`,
`src/app/(dashboard)/projects/page.tsx`,
`src/app/(dashboard)/projects/ClientWizardDriver.tsx`,
`src/app/(dashboard)/projects/components/**/*.{ts,tsx}`,
`src/app/(dashboard)/projects/\[id\]/page.tsx` e
`src/app/(dashboard)/projects/\[id\]/components/Projeto*.tsx`. Os colchetes de
`[id]` são escapados porque em glob `[id]` é classe de caractere (casaria um
único `i` ou `d`, não o literal `[id]`) — e o escape funcionou de primeira
nesta versão do eslint (`eslint@9`/flat config), sem precisar do plano B
(`projects/*/page.tsx`) que o brief previa como alternativa:

```
npx eslint --print-config "src/app/(dashboard)/projects/[id]/page.tsx" | grep -A1 '"no-restricted-syntax"' | head -2
# "no-restricted-syntax": [2,   -> erro

npx eslint --print-config "src/app/(dashboard)/projects/[id]/budget/page.tsx" | grep -A1 '"no-restricted-syntax"' | head -2
# "no-restricted-syntax": [1,   -> aviso (budget/ fica de fora, de propósito)

npx eslint --print-config "src/app/(dashboard)/projects/[id]/components/PresentationsTab.tsx" | grep -A1 '"no-restricted-syntax"' | head -2
# "no-restricted-syntax": [1,   -> aviso (nao e Projeto*.tsx)
```

`budget/`, `presentation/` e `print/` sob `projects/[id]` continuam em "warn"
— são outras telas, fora do escopo desta seção. `npx eslint` sobre o
território inteiro de Projetos dá **zero** violações de `no-restricted-syntax`
(as três chamadas `fetch` de ambiente/DNA saíram) — os 6 erros que aparecem na
mesma passada (`@typescript-eslint/no-explicit-any` em
`EditProjectButton.tsx`/`ProjectWizard.tsx`/`DNAEditorSheet.tsx`/
`NewEnvironmentModal.tsx`, `react/no-unescaped-entities` em
`EnvironmentCard.tsx`) são pré-existentes e de outras regras, não desta
tarefa — confirmado rodando o mesmo eslint contra o código de antes desta
tarefa (via `git stash`): já existiam lá, em número igual ou maior (esta
tarefa **removeu** 4 usos de `any` ao tipar `environment`/`onSuccess` como
`Ambiente`/vazio em vez de `any`, o que também baixou `eslint_erros` de 79
para 75).

## O que esta tarefa (Tarefa 4) NÃO mudou — e o que a Tarefa 5 fechou depois

- ~~`/projects/[id]` (o detalhe) continua no padrão antigo~~ — **migrado na
  Tarefa 5** ("O detalhe", acima): prefetch em paralelo, `QueryBoundary` nas
  duas regiões, `notFound()` dentro do `<Suspense>`.
- ~~**As seis mutações continuam com `fetch` manual**~~ — **as quatro de
  projeto migraram na Tarefa 6** (criar/editar em `ProjectWizard.tsx`, mudar
  status em `ProjectStatusSelect.tsx`, excluir em `DeleteProjectAlert.tsx`);
  ver "As mutações de projeto (Tarefa 6)" acima. **As três de ambiente/DNA
  migraram na Tarefa 7**: `NewEnvironmentModal.tsx`, `EnvironmentCard.tsx`,
  `DNAEditorSheet.tsx` — ver "As mutações de ambiente e DNA (Tarefa 7)" acima.
  A Tarefa 5 não tinha mudado isso: os três `handle*` de
  `EnvironmentsWorkspace` passaram a escrever no cache do React Query em vez
  de `useState` (marcado `PROVISORIO` no código), mas os modais continuavam
  fazendo `fetch` e devolvendo o ambiente por callback — a Tarefa 7 apagou os
  três `handle*` e trocou por invalidação.
  Medido na Tarefa 4:

  ```
  grep -rn "fetch(" ArchSmart-web/src/components/projects "ArchSmart-web/src/app/(dashboard)/projects/[id]/page.tsx"   # 8, na Tarefa 4
  ```

  (eram 9 no território inteiro antes da Tarefa 4 — lista + detalhe +
  `components/projects`; a lista tinha 1, que a Tarefa 4 removeu.
  `tools/catraca.py`, `fetch_fora_de_lib_api`, baixou de 74 para 73 na
  Tarefa 4, de 73 para **71** na Tarefa 5 — os dois `fetch` sequenciais do
  `page.tsx` antigo do detalhe saíram —, de 71 para **68** na Tarefa 6, com
  a saída dos três `fetch` das mutações de projeto, e de 68 para **65** na
  Tarefa 7, com a saída dos três `fetch` das mutações de ambiente/DNA:

  ```
  grep -rn "fetch(" ArchSmart-web/src/components/projects "ArchSmart-web/src/app/(dashboard)/projects/page.tsx" "ArchSmart-web/src/app/(dashboard)/projects/[id]/page.tsx"   # sem saida, apos a Tarefa 7
  ```
  )
- ~~**`ClientWizardDriver.tsx` perdeu `onSuccess`/`handleSuccess`**~~ —
  **fechada na Tarefa 6**: criar um projeto pelo wizard agora atualiza a
  lista pela invalidação explícita de `useCriarProjeto()`
  (`projects.lists()` + `dashboard.all`), não só pelo `router.refresh()` que
  continua ali por outro motivo (ver "As mutações de projeto (Tarefa 6)",
  acima). Texto original, para o histórico: a lista lê do cache agora, e quem
  a atualizava depois de criar um projeto era só o `router.refresh()` do
  próprio `ProjectWizard`, que reconstrói o Server Component e refaz o
  prefetch — cobria o caso na prática, mas não era o mecanismo que a spec
  desenha para as mutações.
- **`QueryBoundary` com query desabilitada, `is_empty` com várias regiões,
  token `destructive`, acessibilidade do shell, LCP/JS "depois", axe/teclado
  por olho humano**: todos são tarefas próprias e posteriores no plano da
  spec de Projetos — nenhum foi tocado aqui.

## O que está medido, e o que está "a medir"

**Medido (Tarefa 4, lista):**
- Consultas de `/api/projects`: 5, constante 1–20 projetos (tabela acima).
- `fetch_fora_de_lib_api`: 73 (era 74).
- `npm test`: 264 testes, 35 arquivos, zero `failed`.

**Medido (Tarefa 5, detalhe):**
- `fetch_fora_de_lib_api`: 71 (era 73) — `python tools/catraca.py`.
- `eslint_erros`: 79 (era 83) — `python tools/catraca.py --eslint-json ArchSmart-web/eslint.json`.
- `npm test`: 270 testes, 37 arquivos, zero `failed` (uma corrida isolada
  reportou um `failed` em `project-wizard.test.tsx` por timeout sob carga —
  arquivo não tocado por esta tarefa; reexecutado isolado e na suíte cheia,
  passou as duas vezes).
- `npm run typecheck`: limpo, incluindo `budget/page.tsx` e
  `presentation/page.tsx` (que passam `any` para `ProjectHeader`).
- `notFound()` dentro do `<Suspense>` responde `HTTP 200` com a UI de não
  encontrado — medido ao vivo, comando na seção "O detalhe" acima.
- Zero requisição de `/api/projects/{id}` ou `/api/projects/{id}/environments`
  saindo do navegador no primeiro carregamento do detalhe — medido ao vivo
  (`read_network_requests`).
- Consultas de `GET /api/projects/{id}` e `/environments`: **não medidas por
  esta tarefa** — a Tarefa 2 mediu 4 e 3 respectivamente antes da Tarefa 5
  existir, e nenhuma delas mudou o endpoint; não há teste de contagem
  refazendo essa medição sobre o código de hoje.

**Medido (Tarefa 6, mutações de projeto):**
- `fetch_fora_de_lib_api`: 68 (era 71) — `python tools/catraca.py`.
- `eslint_erros`: 79, igual ao baseline.
- `cores_literais`, `hover_sem_focus`, `tabindex_negativo`,
  `contraste_reprovado`, `arquivos_acima_de_400`, `modulos_sem_doc`,
  `supabase_fora_de_lib_api`: todos iguais ao baseline — nenhuma regressão.
- `npm test`: 276 testes, 38 arquivos, zero `failed`.
- `npm run typecheck`: limpo.
- `src/__tests__/projects-mutacoes.test.tsx`: 5/5, afirmando o conjunto exato
  de chaves invalidadas/descartadas por mutação.
- `src/__tests__/project-wizard.test.tsx`: 12/12, rodado **antes** de tocar
  `ProjectWizard.tsx` (prova que o ajuste do mock não afrouxou nenhuma
  asserção) e de novo depois, isolado, para descartar o flake de timeout já
  registrado nesta tarefa.
- Passada por agente em 15/09/2026 (API local + `npm run dev`, sessão da
  conta de teste E2E): criar um projeto pelo wizard fez o card aparecer em
  `/projects` sem reload (`POST /api/projects` → `201`, seguido de refetch
  automático da lista) e o projeto apareceu no Dashboard em
  "Continuar Trabalhando" e no contador "Projetos Ativos" na navegação
  seguinte, sem esperar nenhum intervalo; mudar o status no detalhe refletiu
  no seletor e, na aba Orçamento do mesmo projeto (que lê `ProjectHeader` do
  servidor), o cabeçalho atualizou depois do `router.refresh()`
  (`PUT /api/projects/{id}` → `200`); excluir um projeto de teste navegou
  para `/projects` sem piscar estado de erro (`DELETE` → `204 No Content`,
  confirmado no log do servidor local — a extensão do navegador rotulou essa
  mesma requisição e uma de telemetria como `503`, mas é o proxy de
  RSC/telemetria abortando por navegação, não uma falha real: o servidor
  respondeu 204 e 204/200 respectivamente nas duas). Dados de teste
  restaurados ao estado original ao final (status do projeto usado para o
  teste devolvido a "Em Andamento", projeto de teste excluído). Processos
  derrubados pelo PID real (`netstat -ano` → PID → `taskkill /PID <pid> /T
  /F`), nunca por nome.

**Medido (Tarefa 7, mutações de ambiente/DNA + lint):**
- `fetch_fora_de_lib_api`: 65 (era 68) — `python tools/catraca.py`.
- `eslint_erros`: 75 (era 79) — `python tools/catraca.py --eslint-json ArchSmart-web/eslint.json`; caiu por remover 4 usos de `any` nos componentes tocados (não pelo `no-restricted-syntax`, que não conta para esta medida).
- `cores_literais`, `hover_sem_focus`, `tabindex_negativo`, `contraste_reprovado`, `arquivos_acima_de_400`, `modulos_sem_doc`, `supabase_fora_de_lib_api`: todos iguais ao baseline — nenhuma regressão.
- `npm test`: 285 testes, 41 arquivos, zero `failed` (era 282/40 antes de `router.refresh()` entrar; `src/__tests__/ambientes-refresh.test.tsx` acrescentou os 3).
- `npm run typecheck`: limpo.
- `src/__tests__/projects-mutacoes.test.tsx`: 8/8 (5 de projeto, Tarefa 6, mais 3 de ambiente/DNA, Tarefa 7), conjunto exato de chaves por mutação.
- `src/__tests__/ambientes-refresh.test.tsx`: 3/3 — uma por mutação, afirmando `router.refresh()` chamado depois do toast de sucesso (decisão de 15/09/2026, ver "Achado do Step 7" abaixo).
- `npx eslint --print-config` confirma a severidade do glob: `2` (erro) em `projects/[id]/page.tsx`, `1` (aviso) em `projects/[id]/budget/page.tsx` e em `PresentationsTab.tsx` — o escape `\[id\]` funcionou de primeira, sem precisar do plano B.
- `npx eslint` sobre o território de Projetos: zero violações de `no-restricted-syntax`; os 6 erros restantes são `no-explicit-any`/`no-unescaped-entities` pré-existentes, fora do escopo desta tarefa (ver "O lint de `fetch` vira erro..." acima).
- Passada por agente em 15/09/2026 (API local + `npm run dev`, sessão da conta de teste E2E), em "Loft Pinheiros #3" (6 ambientes): criar "Ambiente Teste Tarefa 7" apareceu na grade sem reload (`POST .../environments` → `201`); editar o DNA (15/20/10) mudou o badge de "DNA Pendente" para "DNA Completo" na hora (`PUT .../dna` → `200`); excluir sumiu da grade com o toast "Ambiente Excluído" (`DELETE` → `204`); voltar para `/projects` mostrou "Loft Pinheiros #3" de volta em **6 Ambientes** (o `GET /api/projects` refez sozinho, pela invalidação de `projects.lists()`). Zero erro no log do servidor durante a passada. Processos derrubados pelo PID real (`netstat -ano` → PID → `taskkill //PID <pid> //T //F`), nunca por nome.
- **Achado do Step 7, decidido**: `budget/page.tsx` e `print/page.tsx` leem a lista de ambientes no servidor — as três mutações passaram a chamar `router.refresh()` por isso (decisão de Thiago em 15/09/2026). Ver "Achado do Step 7" acima e `src/__tests__/ambientes-refresh.test.tsx` (3/3).

**A medir** (registro histórico da Tarefa 4 — dependiam de tarefas seguintes
do mesmo plano, ou de olho humano; nenhum número foi estimado no lugar):
- ~~Clique → dados da lista e do detalhe migrados~~ — **medido na Tarefa 12**
  (921 ms, ver "Clique → dados" acima).
- ~~P50/P95 de `GET /api/projects` e `GET /api/projects/{id}` na API
  implantada.~~ — **medido em 16/09/2026, depois do PR #12/merge `ccfe290`**:
  ver "P95 da API implantada" acima (a rota medida no lugar de
  `GET /api/projects/{id}` foi `GET /api/projects/{id}/environments`, que é a
  chamada que a tela de fato faz).
- ~~`load_ms` do `screen_viewed` de `/projects` e `/projects/[id]`~~ —
  **medido na Tarefa 12** (ver "`load_ms` do `screen_viewed` de `/projects`"
  acima).
- ~~axe em navegador, navegação por teclado, 390px/1440px~~ — **medido por
  agente na Tarefa 12, aprovação humana global em 16/09/2026** (ver "A passada
  por agente completa" e "Verificação humana" acima).

**Medido antes desta migração** (código antigo, commit `139b16b`, do
instrumento da Tarefa 1 — `docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md`),
citado aqui só como "antes" e **não** comparável a um "depois" que ainda não
existe:

| Rota | LCP mediana (ms) | JS (bytes, rede) | Arquivos JS |
|---|---:|---:|---:|
| `/projects` | 1308 | 358129 | 23 |

O "depois" desses dois números é entregável da Tarefa 12, não desta.

## A definição de pronto, item a item (lista + detalhe + as sete mutações)

| Item | Estado | Onde está a prova |
|---|---|---|
| Paridade da lista, com duas quebras deliberadas | ✅ | `src/__tests__/projetos-lista.test.tsx` |
| `features/projects/hooks.ts` consumido pela lista e pelo detalhe | ✅ | `ProjetosContent.tsx`, `ProjetoContent.tsx` |
| Prefetch da lista + `/me` fora da hidratação | ✅ | `src/__tests__/projetos-data.test.tsx` |
| Prefetch do projeto + ambientes em paralelo, `notFound()` no servidor | ✅ | `src/__tests__/projeto-data.test.tsx` |
| Os quatro estados via `QueryBoundary` (streaming, dados, vazio, erro), nas duas telas | ✅ | testes acima + `src/__tests__/projeto-detalhe.test.tsx` |
| `EnvironmentsWorkspace` sem cópia de estado (lê `ambientes` por prop), sem handlers `PROVISORIO` | ✅ | `src/__tests__/projeto-detalhe.test.tsx`; passada por agente (Tarefa 7) |
| `ProjectHeader` tipado (`project: Projeto`), sem quebrar Orçamento/Apresentação | ✅ | `npm run typecheck` limpo |
| Nenhuma cor, URL, id ou limite literal nos arquivos desta tarefa | ✅ | `npx eslint` limpo; sem cor literal nova |
| As quatro mutações de projeto por `useMutation`, com mapa explícito de invalidação | ✅ | `src/__tests__/projects-mutacoes.test.tsx` (Tarefa 6) |
| `dashboard.all` invalidado pelas quatro mutações de projeto | ✅ | mesmo teste, conjunto exato por mutação |
| Teste de caracterização do wizard sem afrouxar comportamento | ✅ | `project-wizard.test.tsx`, 12/12 antes e depois de tocar o componente |
| As três mutações de ambiente/DNA por `useMutation`, com mapa explícito de invalidação | ✅ | mesmo teste, `describe("mutacoes de ambiente")` (Tarefa 7) |
| Erro de domínio (`ApiError`) nas três telas de ambiente, sem `catch` cego | ✅ | leitura de código; sem teste dedicado a essa frase |
| `fetch` vira erro (não aviso) em todo o território de Projetos | ✅ | `npx eslint --print-config`, severidade `2` no glob (Tarefa 7) |
| ~~Orçamento de performance~~ | ~~⚠️ não medido — ver "A medir"~~ | **SUPERADO pela Tarefa 12 — ver "O que a Tarefa 12 fecha, na definição de pronto", mais abaixo** |
| ~~axe, teclado, 390/1440px~~ | ~~⚠️ não medido — dependem de olho humano, na verificação da Tarefa 12~~ | **SUPERADO pela Tarefa 12 — idem** |
| Consultas por carregamento < 8 (lista) | ✅ | 5, Tarefa 2, tabela acima |
| ~~Consultas por carregamento < 8 (detalhe)~~ | ~~⚠️ não remedido nesta tarefa — Tarefa 2 mediu 4+3 antes do detalhe migrar; endpoint não mudou~~ | **SUPERADO pela Tarefa 12 — reconfirmado ao vivo contra staging (4/3, sem regressão), ver a tabela mais abaixo** |
| Doc do módulo | ✅ | este arquivo |
| As três mutações de ambiente/DNA chamam `router.refresh()` (achado do Step 7: `budget/page.tsx`/`print/page.tsx` leem ambientes no servidor) | ✅ | `src/__tests__/ambientes-refresh.test.tsx` (Tarefa 7, decisão de 15/09/2026) |

⚠️ **As três linhas riscadas acima são registro histórico do que a Tarefa 4
via na hora em que este documento foi escrito — não republique "não medido"
para nenhuma delas.** As três foram medidas na Tarefa 12 (16/09/2026): a
tabela "O que a Tarefa 12 fecha, na definição de pronto", na seção "Tarefa
12" mais abaixo, é a versão vigente. O padrão é o mesmo que as Seções 6 e 7
usam no `CLAUDE.md`: risca o texto superado, não apaga a linha, e aponta para
onde a informação atual está.

Este documento cobria, até aqui, lista, detalhe e as sete mutações (quatro de
projeto, Tarefa 6; três de ambiente/DNA, Tarefa 7). O achado do Step 7
(Orçamento/Impressão lendo ambientes no servidor) não é mais pendência
aberta — Thiago decidiu em 15/09/2026 que as três mutações de ambiente/DNA
chamam `router.refresh()`, com condição de saída registrada (sai quando
`budget/`/`print/` migrarem para ler ambientes por `features/projects`) —
quando essa migração acontecer, revise este arquivo em vez de reescrevê-lo,
para não ficar descrevendo um estado que o código já passou. **A Tarefa 12
(guardas e2e, medições "depois", passada por agente e a parada para
verificação humana) fecha a seção abaixo.**

## Tarefa 12 — guardas, medições e a passada por agente completa

### Guardas novas no `e2e.yml`

`e2e/projetos-dados.ts` tem o mesmo contrato de `dashboard-dados.ts`/
`biblioteca.ts`, com uma diferença que a Tarefa 5 já tinha deixado registrada:
`esperarAmbientesDoProjeto` olha **dois** testids de erro, não um —
`projeto-error` (cabeçalho) e `projeto-ambientes-error` (ambientes), porque as
duas regiões do detalhe são `QueryBoundary` independentes e podem falhar
sozinhas ou juntas.

`e2e/hidratacao-projetos.spec.ts` (2 testes) foi **provado vermelho antes de
verde**, como o brief mandou: um `useEffect(() => { void api(...) }, [])`
temporário em `ProjetosContent.tsx` (`/api/projects?page=1&size=1`) e em
`ProjetoContent.tsx` (`/api/projects/{id}`) fez as duas guardas reprovarem
citando a URL —

```
Error: a lista pediu no navegador: http://localhost:8000/api/projects?page=1&size=1
Error: o detalhe pediu no navegador: http://localhost:8000/api/projects/31211f47-b9f7-4c0e-81f0-f2403b3fe710 (×2)
```

— e depois de desfeita a injeção (`git diff` limpo, conferido antes do
commit), `2 passed` de novo.

`e2e/telemetria-projetos.spec.ts` rodou **8 vezes** ao todo (não só as 3 que o
brief pedia): a primeira leva de 3 teve **1 falha isolada** na segunda
execução, num `waitFor` de precondição (`projetos-pagina` visível) que
estourou o timeout de 5 s **antes** de qualquer asserção de telemetria rodar
— não é o mecanismo de telemetria que falhou, é uma corrida contra o servidor
de desenvolvimento (mesma classe de flake já registrada no `PROGRESS.md` para
`project-wizard.test.tsx` sob carga, Tarefa 5). As 5 execuções seguintes,
rodadas imediatamente depois, deram `1 passed` cada. **7 de 8**, com a única
falha isolada a uma precondição, não à asserção do protocolo de telemetria.

### Medições "depois"

**LCP e JS da rota** — instrumento da Tarefa 1, rodado contra `next build &&
next start`. Números completos, com a explicação de por que Biblioteca e
Dashboard também mudaram (JS **compartilhado**, mexido pelas Tarefas 9–11
desta mesma migração), em
[`docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md`](../medicoes/2026-09-15-lcp-e-js-da-rota.md#o-depois--16092026-tarefa-12-da-migração-de-projetos):

| Rota | LCP antes | LCP depois | JS antes | JS depois |
|---|---:|---:|---:|---:|
| `/projects` | 1308 ms | **952 ms** | 358129 | 466888 |

**Clique → dados**, arranjo local (API local + `npm run dev`, como as outras
duas telas):

```bash
cd ArchSmart-api && ./venv/Scripts/python.exe -m uvicorn app.main:app --port 8000   # em background
cd ArchSmart-web && set -a && . ./.env.e2e.local && . ./.env.local && set +a
npx playwright test e2e/medicao-projetos.spec.ts --reporter=line --timeout=180000
```

```
AMOSTRAS=919,919,921,933,942
MEDIANA_MS=921
```

Alvo da spec-mãe (< 1,5 s): **atingido neste arranjo** — mesma ressalva das
outras duas telas: front e API locais contra o banco de staging, não o que um
usuário sente contra o ambiente implantado.

**Consultas por carregamento**, reconfirmadas ao vivo contra o banco de
staging com o app real (`ArchSmart-api/.env` no bloco `## staging ##`,
conferido antes de medir), via `TestClient(app)` + `before_cursor_execute`
(mesmo mecanismo de
[`docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md`](../medicoes/2026-09-13-custo-da-requisicao-autenticada.md)),
com um token real da conta de teste:

| Rota | Consultas | Constante? |
|---|---:|---|
| `GET /api/projects` | **5** | sim — igual com `size=1` e `size=20` |
| `GET /api/projects/{id}` | **4** | — |
| `GET /api/projects/{id}/environments` | **3** | — |

Os três números batem com os da Tarefa 2 (suíte): nenhum código de backend
mudou entre a Tarefa 2 e esta. As três rotas respondem com `307` para a URL
sem barra final quando chamadas com barra (`/api/projects/` → redireciona
para `/api/projects`); a contagem acima é da chamada final, depois do
redirecionamento — o próprio redirecionamento não faz consulta.

**`load_ms` do `screen_viewed` de `/projects`**, filtrado por
`medido_ate=dados` (as linhas vieram das 8 execuções de
`telemetria-projetos.spec.ts` mais o aquecimento de outras medições desta
tarefa — front e API locais contra o **banco de staging**, não o deployment):

| `medido_de` | n | Mediana | Faixa |
|---|---:|---:|---|
| `clique` | 8 | **521 ms** | 491 – 1020 |
| `commit` | 25 | **206 ms** | 103 – 2372 |

```bash
cd ArchSmart-api
./venv/Scripts/python.exe - <<'PY'
import os, psycopg2
from dotenv import load_dotenv; load_dotenv(".env")
c = psycopg2.connect(os.environ["DATABASE_URL"]); c.set_session(readonly=True); cur = c.cursor()
cur.execute("""select properties->>'medido_de', count(*),
  percentile_cont(0.5) within group (order by (properties->>'load_ms')::float)
  from product_events where name='screen_viewed' and properties->>'screen'='/projects'
  and properties->>'medido_ate'='dados' group by 1""")
print(cur.fetchall())
PY
```

**P95 da API implantada — medido em 16/09/2026**, depois do PR #12
(`develop` → `staging`, merge `ccfe290`). A verificação externa de que o
contêiner serve o código desta seção (58 rotas no `openapi.json`, `/health` →
200 em 0,31 s, `/health/db` → `{"status":"ok","db":"up"}`) já tinha sido feita
por Thiago; a impressão digital específica desta tarefa foi reconferida antes
de medir — `active_count` presente na resposta de `GET /api/projects`:

```bash
API=https://arqsmart-staging.onrender.com; H="Authorization: Bearer $TOKEN"
curl -s "$API/api/projects?page=1&size=20" -H "$H" | python -c "import json,sys; print('active_count' in json.load(sys.stdin))"
# True
```

**Volume declarado** — conta do usuário de teste: **5 projetos**,
`active_count=2`; o projeto usado para medir `/environments` é "Loft
Pinheiros #3" (`beaf469e-2b4f-4e47-b2e3-0ef6f7a5b7ee`), com **6 ambientes** — o
mesmo projeto que a passada por agente da Tarefa 5/7 já usava.

Medianas (P50) e P95 de **40 amostras** (45 chamadas, descartadas as 5
primeiras), controles com mediana de 7 amostras:

| Rota | Consultas | Status | P50 | P95 | Faixa (min–max) |
|---|---:|---|---:|---:|---|
| `/health` (controle) | 0 | 200 | **278 ms** | — | 270 – 735 |
| `/health/db` (controle) | 1 | 200 | **1048 ms** | — | 998 – 1926 |
| `/api/users/me`, token inválido (controle) | 0 | 401 | **614 ms** | — | 535 – 1325 |
| **`GET /api/projects?page=1&size=20`** | 5 | 200 | **1541 ms** | **1986 ms** | 1514 – 2014 |
| **`GET /api/projects/{id}/environments`** | 3 | 200 | **1192 ms** | **1358 ms** | 1160 – 1600 |

Comando (token pelo bloco "Como reproduzir" de
[`2026-09-13-custo-da-requisicao-autenticada.md`](../medicoes/2026-09-13-custo-da-requisicao-autenticada.md)):

```bash
API=https://arqsmart-staging.onrender.com; H="Authorization: Bearer $TOKEN"
for i in $(seq 7); do
  curl -s -o /dev/null -w "%{time_total}\n" "$API/health"
  curl -s -o /dev/null -w "%{time_total}\n" "$API/health/db"
  curl -s -o /dev/null -w "%{time_total}\n" -H "Authorization: Bearer nao.e.jwt" "$API/api/users/me"
done
for i in $(seq 45); do curl -s -o /dev/null -w "%{time_total}\n" -H "$H" "$API/api/projects?page=1&size=20"; done
for i in $(seq 45); do curl -s -o /dev/null -w "%{time_total}\n" -H "$H" "$API/api/projects/<id>/environments"; done
# P50/P95: descartar as 5 primeiras de cada serie de 45 antes de calcular
```

**Contra o modelo** (`0,29 + 0,24 (se autenticado) + 0,17 × (3 + consultas)`,
com 5 consultas na lista e 3 nos ambientes):

| Rota | Previsto | Medido (P50) | A previsão... |
|---|---:|---:|---|
| `/api/projects` (lista) | 1890 ms | **1541 ms** | pessimista em **23%** |
| `/api/projects/{id}/environments` | 1550 ms | **1192 ms** | pessimista em **30%** |

O modelo continua acertando a direção (as duas rotas estouram o orçamento por
uma margem grande, dominada pelas idas ao banco) mas superestima mais aqui do
que acertou para a Biblioteca (pessimista em 11%) e o Dashboard (pessimista em
8%) — a diferença provável é o número de consultas real ficar um pouco abaixo
do que o ajuste de mínimos quadrados original previa por consulta marginal (a
própria medição de 13/09 já registra que o resíduo é negativo e cresce com o
número de consultas). Não foi isolado nesta tarefa: é leitura do número, não
uma medição nova de onde o resíduo vem.

> **P95 de `GET /api/projects`: 1986 ms contra 400 ms — não atingido.** P95 de
> `GET /api/projects/{id}/environments`: 1358 ms contra 400 ms — também não
> atingido. **Estoura por distância (0,17 s × idas ao banco), não pela
> tela** — mesma frase e mesma causa já registradas para a Biblioteca e o
> Dashboard (decisão 1 da spec do Dashboard, carregada adiante). O alvo de
> consultas por carregamento (< 8) continua atingido nas duas rotas (5 e 3),
> porque não depende da distância.

### A passada por agente completa (axe, 390/1440, teclado)

⚠️ **Tudo nesta seção foi verificado por agente sobre captura de tela e
medição no DOM — não por olho humano.** O julgamento humano que a definição
de pronto pede (hierarquia, ordem de leitura, perceptibilidade do anel,
legibilidade) segue não verificado; é exatamente isso que a verificação
humana da Tarefa 12 (mais abaixo) resolve.

**axe-core**, `/projects` e `/projects/{id}`, dois temas, duas larguras — 8
combinações, com a API local quente e sessão real:

| Rota | Tema | Largura | Violações |
|---|---|---:|---|
| `/projects` | claro | 390 | `color-contrast`(6), `page-has-heading-one`(1) |
| `/projects` | claro | 1440 | `color-contrast`(6), `page-has-heading-one`(1) |
| `/projects` | escuro | 390 | `color-contrast`(6), `page-has-heading-one`(1) |
| `/projects` | escuro | 1440 | `color-contrast`(6), `page-has-heading-one`(1) |
| `/projects/{id}` | claro | 390 | `aria-required-children`(1), `aria-required-parent`(3), `aria-valid-attr-value`(1), `color-contrast`(3), `heading-order`(1) |
| `/projects/{id}` | claro | 1440 | mesmas 5, mesmas contagens |
| `/projects/{id}` | escuro | 390 | `aria-required-children`(1), `aria-required-parent`(3), `aria-valid-attr-value`(1), `heading-order`(1) — **sem** `color-contrast` |
| `/projects/{id}` | escuro | 1440 | mesmas 4, mesmas contagens |

A lista repete exatamente o que a Tarefa 11 já tinha medido (`color-contrast`
6 nós + `page-has-heading-one` 1, "da própria tela") — **sem violação nova**.
O **detalhe nunca tinha sido medido por axe em navegador antes desta tarefa**,
e tem um conjunto diferente: os três `aria-required-*`/`aria-valid-attr-value`
apontam para os `TabsTrigger` do `ProjectHeader` (Ambientes/Orçamento/
Apresentação) — casam com a estrutura `Tabs`/`TabsList`/`TabsTrigger` do Radix
envolvendo cada gatilho num `<Link>`, o que quebra a relação pai-filho que o
ARIA de abas exige; `heading-order` aponta para o `h3` de "Caderno de
Ambientes" (`EnvironmentsWorkspace`); `color-contrast` (3 nós, só no tema
claro) inclui `.bg-emerald-500\/10` — um verde literal fora do sistema de
tokens, achado novo. Comando:

```bash
cd ArchSmart-web; set -a; . ./.env.e2e.local; set +a
for tema in claro escuro; do for largura in 390 1440; do
  ROTA=/projects/<id> TEMA=$tema LARGURA=$largura npx playwright test e2e/medicao-axe.spec.ts --reporter=line
done; done
```

**Largura, 390px** — `scrollWidth` vs `innerWidth`, sessão real:

| Rota | `scrollWidth` | `innerWidth` | Estoura |
|---|---:|---:|---:|
| `/projects` | 390 | 390 | **0px** |
| `/projects/{id}` | 593 | 390 | **203px** |

⚠️ **Achado novo, maior que o estouro já conhecido da Biblioteca (42px) — e
não é o mesmo defeito.** O detalhe estoura 203px em 390px, nos dois temas.
Isolado por medição direta de retângulos (não por leitura de código): o
elemento mais largo que a viewport é `header .flex.h-16` (593px), da `Header`
**do shell** (`src/components/layout/app-shell/Header.tsx`), não de
`ProjectHeader.tsx` — a fileira de abas de `ProjectHeader` já tem `flex-wrap`
e não é a causa. Dentro do shell, a coluna esquerda (`.flex.flex-col.min-w-0`,
que tem `HeaderBreadcrumb` mais a linha de data) mede 204px de largura
intrínseca — o breadcrumb "Projetos › Loft Pinheiros #3" e a data por
extenso ("quarta-feira, 16 de setembro de 2026") não encolhem abaixo disso —,
e o grupo de ícones à direita mede 136px; somados ao botão de menu mobile e
ao padding (`px-6`), o total excede 390px e a fileira (`flex ... px-6
md:px-8`, sem `flex-wrap`) não quebra linha. **A lista não estoura** porque o
breadcrumb dela é só "Projetos" (um segmento, sem chevron) — bem mais curto.
Isto é **do shell**, reusado por toda tela com breadcrumb de dois segmentos e
um nome de projeto longo; não foi corrigido, de propósito (regra da casa:
registra, conserta só com ok de Thiago). Como reproduzir:

```js
// no console, em /projects/<id> a 390px
document.documentElement.scrollWidth - window.innerWidth   // 203
document.querySelector("header .flex.h-16").getBoundingClientRect().width   // 593
```

✅ **Fechado em 16–17/09/2026, na branch de limpeza `secao-8-limpeza-projetos`
— e a atribuição acima ("é do shell, `Header.tsx`") estava só parcialmente
certa.** Medido: **151 dos 203px** eram a barra de **ações** de
`ProjectHeader.tsx` (`ProjectStatusSelect`, "Caderno de Obras",
`EditProjectButton`, `DeleteProjectAlert`, em `space-x-2` sem quebra de
linha) — não a fileira de abas, e não o shell —, corrigida no commit
`564af1b` (`flex-wrap gap-2`), baixando o estouro para 52px. Os 52px
restantes não fecharam com `min-w-0` isolado em `Header.tsx` (zero efeito,
medido) — a causa era `AppShell.tsx:89` (a coluna `flex-1 flex flex-col`,
sem `min-w-0`), impedindo o shell inteiro de encolher. Corrigida no commit
`413c8f8`, o estouro caiu a **zero** em `/projects`, `/projects/<id>`,
`/dashboard` e `/library`, nas duas larguras e nos dois temas — a mesma
correção fechou de brinde o estouro de 42px da Biblioteca. Detalhe completo
em [`docs/dev/medicoes/2026-09-17-largura-do-shell.md`](../medicoes/2026-09-17-largura-do-shell.md).

**Teclado** — `Tab` a partir do topo, lista e detalhe, sessão real:

- **Lista**: sem parada invisível nas 30 primeiras paradas (sidebar → botões
  do `Header` → o botão do cabeçalho de Projetos → os cards). O botão do
  cabeçalho, nesta conta, é **"Slot Indisponível"** (`UpgradeAlertModal`), não
  "Novo Projeto" — a conta de teste está no limite do plano
  (`active_count=2`, `project_limit=2`, medido em `/api/users/me`). Alcançado
  no Tab 11, `Enter` abre o `AlertDialog` (`role="alertdialog"`), `Escape`
  fecha. O wizard em si (`ProjectWizard`, dirigido por `?action=new`) foi
  testado por URL direta, já que o botão que o abre não renderiza com esta
  conta: abre (`role="dialog"` presente) e `Escape` fecha — **com um atraso de
  ~1 s**, porque fechar passa por `router.push("/projects")`
  (`ClientWizardDriver.tsx`), uma navegação de verdade, não um `setState`
  local; um `waitForTimeout` curto (300 ms) mede "não fechou" por engano — o
  fechamento em si funciona.
- **Detalhe**: sem parada invisível nas 30 primeiras. `"Excluir"`
  (`DeleteProjectAlert`) alcançado no Tab 16; `Enter` abre o
  `AlertDialog` de confirmação, `Escape` fecha. As três abas
  (Ambientes/Orçamento/Apresentação) e "Novo Ambiente"/"Editar Dados" são
  alcançáveis e distintas no anel de foco.

Nenhum teclado ficou preso (nenhum elemento sem saída), e as duas ações que a
definição de pronto pede para testar sem mouse — abrir/fechar o wizard e o
diálogo de exclusão — funcionam.

**Capturas** — as 8 combinações (`/projects` e `/projects/{id}` × claro/escuro
× 390/1440) foram tiradas com `page.screenshot({ fullPage: true })` e salvas
fora do repositório (scratchpad da sessão que rodou a Tarefa 12) para a
verificação humana da Tarefa 12 olhar — este repositório não versiona
captura de tela.

### O que a Tarefa 12 fecha, na definição de pronto

| Item | Estado | Onde está a prova |
|---|---|---|
| Orçamento de performance (clique → dados) | ✅ no arranjo local — 921 ms < 1,5 s | seção acima |
| Orçamento de performance (API implantada, P95) | ⚠️ **registrado, não atingido** — 1986 ms (lista) / 1358 ms (ambientes) contra 400 ms, medido em 16/09/2026 após o merge `ccfe290`; estoura por distância (0,17 s × idas ao banco), não pela tela | seção acima |
| Consultas por carregamento (lista, detalhe, ambientes) | ✅ 5 / 4 / 3, reconfirmadas ao vivo contra staging | seção acima |
| LCP e JS da rota | ✅ medido (952 ms / 466888 bytes) — sem alvo formal isolado por rota nesta régua | `docs/dev/medicoes/2026-09-15-lcp-e-js-da-rota.md` |
| axe em navegador | ✅ **medido por agente, aprovação humana global em 16/09/2026** — lista repete achados já conhecidos (shell); detalhe tem achados novos (`aria-required-*` nas abas, `heading-order`, verde literal), registrados e não corrigidos | seção acima |
| Navegação só por teclado | ✅ **medido por agente, aprovação humana global em 16/09/2026** — sem parada invisível, wizard e diálogo de exclusão abrem/fecham sem mouse | seção acima |
| 390px e 1440px | ✅ **medido por agente, aprovação humana global em 16/09/2026** — lista sem estouro; ~~detalhe estoura 203px em 390px, achado novo, registrado e não corrigido~~ **fechado em 16–17/09/2026, branch `secao-8-limpeza-projetos` — ver ✅ na seção acima** | seção acima |
| Guardas e2e no `e2e.yml` | ✅ | `.github/workflows/e2e.yml` |
| Doc do módulo com números e comando | ✅ | este arquivo |
| Verificação humana (decisão 7 da spec) | ✅ **Concluída em 16/09/2026 — Thiago respondeu "verificado"** | seção "Verificação humana", abaixo |

⚠️ **A ressalva das três linhas de olho humano acima: a aprovação foi
global, não item a item.** Thiago respondeu "verificado" para a branch
inteira, sem apontar nenhum defeito e sem comentar cada achado da passada
por agente (axe, teclado, 390/1440px) individualmente. Isso é diferente de
"cada achado foi revisto e confirmado um por um" — e é essa a razão de as
três linhas virarem ✅ com a ressalva escrita, em vez de silenciosamente. Dos
achados que a passada por agente tinha listado como não corrigidos, o
**estouro de 203px fechou depois, em 16–17/09/2026, na branch de limpeza
`secao-8-limpeza-projetos`** (ver ✅ na seção "Largura, 390px", acima) — a
aprovação de 16/09 não o resolveu, mas não é mais um item aberto hoje. Os
demais (os `aria-*` do `ProjectHeader`, o `bg-emerald-500/10` literal,
`page-has-heading-one` e `color-contrast` da lista) continuam não
corrigidos — a aprovação não os resolveu, só confirmou que ninguém os achou
bloqueantes para o merge.

## Verificação humana

**Verificador:** Thiago. **Data:** 16/09/2026. **Forma:** **aprovação
global** — a resposta foi "verificado", para a branch inteira, sem apontar
nenhum defeito e sem comentar item a item a lista entregue. **Isto é
diferente de "cada item foi olhado e aprovado individualmente"**, e a
diferença é registrada aqui de propósito, porque é o tipo de coisa que se
perde se só o veredito final ficar escrito.

O que estava sob os olhos dele — a lista entregue em
`.superpowers/sdd/2026-09-15-secao-8-projetos/task-12-report.md` (Step 8 da
Tarefa 12): 4 rotas (`/projects`, `/projects/<id>`, `/dashboard`, `/library`)
× 2 larguras (390px, 1440px) × 2 temas (claro, escuro) — **16
combinações** —, mais 8 perguntas dirigidas:

1. Botão "Excluir"/"Excluir Projeto Permanentemente" no tema escuro (texto
   escuro sobre vermelho claro, com o token novo de destrutivo) — aceitável?
2. Dashboard: valores de despesa e saldo negativo, com o token novo no lugar
   de `text-red-*` — legíveis nos dois temas?
3. Sidebar: o item ativo passou de texto teal para texto padrão com borda e
   ícone teal — continua óbvio?
4. Lista de Projetos: card de limite (x/y), estado vazio e estado de erro.
5. Detalhe: cabeçalho, ambientes, criar/editar DNA/excluir ambiente.
6. Teclado: `Tab` do topo ao fim de `/projects` — o anel de foco visível em
   todos os passos? Algum foco some?
7. 390px: algo estoura na horizontal em alguma das 4 rotas, incluindo os
   dois já conhecidos (Biblioteca ~42px, detalhe de Projetos ~203px)?
8. Hierarquia e ordem de leitura das duas telas de Projetos.

**Nenhuma das 16 combinações nem das 8 perguntas recebeu resposta
individual** — a aprovação cobriu o conjunto, não cada linha. Os itens que a
própria lista já apontava como conhecidos e abertos (os dois estouros de
390px, a ausência de `not-found.tsx`, a copy dos erros de mutação nunca
revisada, `custom_installments` descartado, e os demais do bloco "O que
Projetos (Seção 8) deixou em aberto" no `CLAUDE.md`) seguem registrados como
**conhecidos e aceitos** — a aprovação global não os corrigiu nem os
reabriu, só liberou o merge com eles cientes e de pé.

> ✅ **Correção datada, 17/09/2026, na branch de limpeza
> `secao-8-limpeza-projetos`: três dos itens listados no parágrafo acima não
> "seguem" abertos hoje.** Os dois estouros de 390px fecharam (ver "Largura,
> 390px" e "`p-8` fixo virou `p-4 md:p-8`", acima); `custom_installments`
> passou a ser devolvido e a preservar parcelas recebidas (ver "O que
> Projetos (Seção 8) deixou em aberto", item 4, no `CLAUDE.md`); e passou a
> existir um `not-found.tsx` em `projects/[id]` — falta só o de raiz (ver "A
> UI de não encontrado", acima). A copy dos erros de mutação nunca revisada
> continua aberta, sem mudança.
