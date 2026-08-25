# Reestruturação da plataforma Arq Smart — Design

**Data:** 23/08/2026 · **Status:** aprovado, aguardando plano de implementação
**Base:** `develop` @ `5d8100b` · **Decidido com:** Thiago Rodrigues

---

## 1. Por que este trabalho existe

A plataforma está lenta e cada iteração a deixa mais lenta. A suspeita inicial era de que seria preciso reescrevê-la inteira. Uma auditoria de código e um spike de medição em navegador mostraram que **reescrever não resolveria nenhuma das causas** — elas são de arquitetura e de processo, não de código legado.

Este documento descreve o que fazer no lugar: construir as camadas que faltam, e depois migrar as telas para cima delas.

**Contexto que define o risco aceitável:** a plataforma **não foi lançada**. Não há cliente real, não há dado a preservar. Isso torna migrações de banco baratas e permite descartar o banco atual em vez de reconciliá-lo.

**Contexto que define a prioridade da documentação:** haverá uma **segunda pessoa desenvolvendo** após a conclusão deste trabalho, e toda a implementação é feita com **assistência de IA**. Em desenvolvimento assistido, o código é o prompt: um padrão ruim que sobrevive vira exemplo, e exemplo vira o próximo arquivo. Por isso não basta criar o caminho certo — é preciso eliminar ou cercar o errado.

---

## 2. Diagnóstico — o que foi medido

Tudo abaixo é evidência, não estimativa. Detalhe completo em `spec-kit-2/auditoria-codigo-2026-08-23.md`.

### 2.1 Segurança — 13 endpoints com falha de autorização

| Onde | Quantos | Falha |
|---|---|---|
| `budgets_router.py` linhas 122, 157, 178, 205, 230, 266 | 6 | sem filtro por `account_id`; dois com `# TODO` escrito no código |
| `public.py` linhas 310, 349, 390, 432, 493 | 5 | ações do portal não verificam o token de acesso; a senha protege só a leitura |
| `product_router.py` linhas 16, 175 | 2 | sem autenticação alguma; o segundo chama o Gemini e queima orçamento de IA |

### 2.2 Performance — medido em navegador, com sessão real, em localhost

| Tela | Clique → rota | Clique → dados na tela |
|---|---|---|
| Projetos | 821 ms | **3,0 s** |
| Biblioteca | 175 ms | **3,6 s** |
| Financeiro | 143 ms | **4,3 s** |

Latência de API: `/api/products` 1.220 ms · `/api/dashboard/lean` 881 ms · `/api/presentations` 868 ms · `/api/financial` 510 ms.

**Quatro causas, todas confirmadas:**

1. **Nada era cacheado.** Em 6 ciclos de navegação, `/api/presentations`, `/api/events` e `/api/financial` foram chamados 12× cada. `/api/products` foi chamado 4× — porque a Biblioteca é a única das 33 telas que usa TanStack Query.

   ⚠️ Correção de 24/08/2026: o achado original dizia, no presente, "nada é cacheado", o que já era falso na data desta medição (23/08/2026). O `QueryProvider` (`staleTime` de 30 s) já estava montado em `src/app/(dashboard)/layout.tsx`, e 3 dos 144 arquivos já usavam `useQuery` — nenhuma seção desta reestruturação construiu isso, a medição original só errou. O que ela mostrou de fato é que as outras 141 telas refazem a chamada a cada navegação. Ver `docs/dev/arquitetura.md` e `docs/dev/convencoes.md` para o estado atual do cache.
2. **Query lenta e piorando com o volume.** 4 `index=True` no modelo inteiro; 6 `create_index` em 27 migrações; **zero em `account_id`**. Toda listagem por conta faz varredura sequencial, contra um banco remoto (`aws-1-sa-east-1.pooler.supabase.com`). É isto que faz a plataforma ficar mais lenta quanto mais o cliente a usa: não é a sessão que degrada, é a conta.
3. **O `proxy.ts` cobra ~83 ms de toda requisição.** `getUser()` (ida à rede ao Supabase Auth) roda **antes** do desvio para `/api`, `/_next` e estáticos. Medido: 9 ms fora do matcher, 92 ms dentro. Deslogado o custo é zero, o que explica por que não aparecia em teste rápido.
4. **Requisição não é cancelada.** `AbortController` aparece 3× em 141 arquivos, nenhuma para navegação. Sair do Dashboard deixa o `/api/dashboard/lean` rodando 1,4–2,5 s disputando conexão com a tela que entra.

**Hipótese descartada com medição:** não há vazamento de memória. 36 navegações mantiveram os nós DOM constantes em 462 e o heap oscilando entre 39,8 e 48,2 MB, com queda no fim.

### 2.3 Manutenibilidade — por que cada iteração custa mais

Medido em 23/08/2026, antes da Seção 1. É um retrato datado — a contagem de
arquivos do frontend mudou desde então (141 → 144, ver `docs/dev/arquitetura.md`);
as duas linhas marcadas com nota foram revistas depois e permanecem válidas,
as demais refletem só o momento da medição.

| Medida | Valor |
|---|---|
| Cliente de API compartilhado | **não existe** |
| `createClient()` espalhados | 62 |
| `getSession()` espalhados | 56 |
| Headers `Authorization` montados à mão | 67 (70 após a Seção 1)¹ |
| Arquivos repetindo o mesmo boilerplate | 37 |
| `CLAUDE.md` / convenções escritas | **nenhum** |
| Estruturas de rota coexistindo no backend | 3 (`api/`, `api/endpoints/`, `api/routers/`) |
| `next/dynamic` / `React.lazy` | **0 em 141 arquivos** |
| Cores literais | **510** classes de paleta Tailwind em 39 arquivos + 11 `bg-[#hex]`² |
| Testes | 83, todos contra `MagicMock` — nenhum capaz de detectar vazamento entre contas |
| CI | **nenhum** além de dois workflows de keep-alive |

¹ Atualizado nesta revisão (24/08/2026) para incluir o efeito da Seção 1 —
única linha desta tabela recalculada após a medição original.
² Reconferido em 24/08/2026 (`docs/dev/convencoes.md`): o número permanece
o mesmo hoje.

Cada tela nova custa mais que a anterior porque cada tela nova copia a anterior, junto com o boilerplate.

---

## 3. Decisão

**Caminho escolhido: fundação primeiro, telas migram uma a uma (strangler), dentro do repositório atual.**

Alternativas consideradas e rejeitadas:

- **Aplicação nova em paralelo, corte no fim.** Rejeitada: o corte é big-bang, 57 dos 70 endpoints estão corretos e seriam descartados, e — principalmente — um greenfield sem camada base repete exatamente o que trouxe a plataforma até aqui.
- **Só otimização cirúrgica.** Rejeitada como destino: resolve a lentidão de hoje e não toca no motor do peso. Em 10 telas, o mesmo lugar com 47 arquivos de boilerplate em vez de 37. É o primeiro pedaço do caminho escolhido, não uma alternativa a ele.

---

## 4. Princípios que governam todo o trabalho

1. **A regra que não é verificada por ferramenta não existe.** Toda convenção deste documento vira lint, teste ou verificação de CI. Acordo verbal não sobrevive a duas pessoas mais IA.
2. **Cercar o caminho antigo é parte de abrir o novo.** Padrão antigo que continua possível é padrão que será copiado.
3. **Completar antes de proibir.** As 510 cores literais existem porque faltavam tokens de `success` e `warning`. Proibir sem oferecer alternativa cria o próximo desvio.
4. **Uma coisa por vez, medida.** Migração e funcionalidade nova nunca no mesmo passo — misturar destrói o único teste objetivo que a migração tem.
5. **Prova antes de afirmar.** Nenhuma tarefa é marcada como feita sem o comando ou a medição que demonstra.

---

## 5. As nove seções

Numeradas na ordem de execução.

### Seção 1 — Correções P0 de segurança

Os 13 endpoints, com patch mínimo e um teste de regressão cada. Não espera a refatoração: a Seção 4 tornará o erro impossível de escrever, mas as falhas estão no ar agora.

- 6 endpoints de orçamento: filtro por `account_id` via join com `Project`
- 5 ações do portal: `verify_portal_token` obrigatório, igual ao `GET`
- `GET /api/products/seed-captured`: removido
- `POST /api/products/normalize`: autenticação obrigatória + rate limit
- `POST /verify-password`: rate limit contra força bruta

### Seção 2 — Estrutura do repositório e documentação

**Princípio:** uma pasta, um propósito, um lugar óbvio para cada coisa. O teste é: pedir "adiciona um endpoint de contatos" deve ter exatamente um lugar onde ele cabe.

```
arq-smart/
├── CLAUDE.md                    ← regras do repo; primeira leitura de qualquer agente
├── PROGRESS.md                  ← contador calculado (ver Seção 8)
├── README.md
├── .github/workflows/ci.yml
│
├── api/                                     (renomeado na Seção 9)
│   ├── CLAUDE.md
│   ├── app/
│   │   ├── main.py              só monta a aplicação
│   │   ├── core/                config · security (RequestContext) · logging · mail
│   │   ├── db/                  session · base · repository (ScopedRepository)
│   │   ├── models/              um arquivo por agregado
│   │   ├── schemas/
│   │   ├── services/            regra de negócio, pura
│   │   └── api/v1/routes/       ÚNICA pasta de rotas
│   ├── alembic/versions/
│   ├── tests/                   fora de app/; conftest · isolation/ · api/ · services/
│   └── tools/                   scripts sobreviventes da triagem
│
├── web/                                     (renomeado na Seção 9)
│   ├── CLAUDE.md
│   ├── src/
│   │   ├── app/                 rotas, finas
│   │   ├── features/            por domínio: api.ts · hooks.ts · components/ · types.ts
│   │   ├── components/ui/       design system
│   │   ├── lib/api/             cliente único
│   │   └── lib/query/           chaves e invalidação
│   ├── e2e/ · tests/
│
├── extension/CLAUDE.md
├── spec-kit/                    (era spec-kit-2)
└── docs/
    ├── dev/     ambiente · arquitetura · convencoes · modelo-de-dados · deploy · decisoes/ · modulos/
    └── user/
```

Mudanças estruturais que importam:

- **`features/` no front.** O código de orçamento hoje está em três lugares. Reunir domínio inteiro num diretório permite que a feature caiba num contexto só — decisivo para edição confiável por IA e para leitura por quem chega.
- **`api/v1/routes/` mata as três estruturas** e resolve o versionamento (Art. 5) de uma vez.
- **`tests/` sai de `app/`** — deixa explícito que a suíte atual será descartada, não remendada.

**Documentação — os três mecanismos que impedem que apodreça:**

1. `CLAUDE.md` em quatro níveis (raiz, api, web, extension), ~80 linhas cada, imperativos, com ponteiro para `docs/`. Cada um abre com bloco de estado: o alvo, onde estamos, e a instrução de nunca migrar uma área "de passagem".
2. ADR em `docs/dev/decisoes/` para toda decisão não-óbvia: o que se decidiu, o que se rejeitou, e **como saberemos se foi certo**.
3. CI falha se módulo novo em `api/app/services/` ou `web/src/features/` não tiver arquivo correspondente em `docs/dev/modulos/`.

**Descartes decididos:** `Spec-1/` (relatórios antigos). Dos 20 scripts na raiz da API: `seed_*` viram um `ArchSmart-api/tools/seed.py` parametrizado; `reset_db.py` e `init_db.py` vão para `ArchSmart-api/tools/`; `debug_*`, `trace_*`, `fix_*`, `check_users`, `add_column`, `test_jwt`, `test_login`, `test_filters`, `test_pagination`, `revert_storage` são apagados. Também `login.json` e `mock_database.db`, hoje rastreados no git.

### Seção 3 — Esteira, ambientes e branches

**Branches — três, com fluxo em sentido único:**

```
feature/xyz ──PR──► develop ──► staging (ambiente online) ──► main (produção)
```

`develop` justifica-se por haver duas pessoas e beta-testers em staging: é onde o trabalho se encontra sem publicar nada. Regras: nunca mergear para trás exceto hotfix; hotfix em `main` volta para `develop` no mesmo dia, com o CI acusando se `main` tiver commit ausente em `develop`; as três protegidas, PR e CI verde obrigatórios.

**Ambientes:**

| Peça | Como fica |
|---|---|
| Front | preview automático da Vercel por PR (já disponível, não usado hoje) |
| API de staging | segundo serviço no Render, apontando para `staging` |
| Banco de staging | projeto Supabase separado, criado pela mesma receita de migrações |
| Dado de staging | `ArchSmart-api/tools/seed.py`: 5 projetos, 25 ambientes, 300 itens de biblioteca, 500 itens de projeto |
| Migração | automática no deploy de staging; produção só depois de passar lá |

O volume realista é o item crítico: **é contra staging que o orçamento de performance de cada tela é medido.** Medir com três produtos na biblioteca foi o que deixou a lentidão passar despercebida.

**O que o CI barra, em todo PR:** lint · tipos · testes contra Postgres em Docker · teste de isolamento entre contas · varredura de literais proibidos · validador de contraste · verificação de doc de módulo · consistência do `PROGRESS.md`.

**Ambiente local (Docker):**

O formato do banco passa a ser descrito num só lugar — as migrações do Alembic. Qualquer banco vazio que receba a receita vira o banco certo, esteja no Docker, no Supabase ou na AWS.

| Onde | O que é |
|---|---|
| Máquina do dev | stack Supabase local via CLI (Postgres + Auth + Storage + Studio), em Docker |
| Testes | `postgres:16` isolado, descartável, mesmo arquivo local e no CI |
| Produção | projeto Supabase **novo**, criado do zero pela mesma receita |

Supabase local em vez de Postgres puro porque a aplicação depende de Auth (`users.supabase_id`) e Storage (`secure-files`) — Postgres puro deixaria login e upload ainda batendo na nuvem.

**A CLI do Supabase tem migração própria e não será usada.** Supabase local = infraestrutura; Alembic = schema. Uma ferramenta, um histórico.

**O banco atual é descartado.** Confirmado: nada a preservar. Isso dispensa reconciliar a divergência entre schema e migrações que o `add_column.py` (um `ALTER TABLE` rodado à mão) evidenciou.

**Portabilidade para AWS** — objetivo declarado. O que é fácil: Postgres é Postgres, e a API já estará em contêiner. Regra para manter assim: **nada de recurso exclusivo do Supabase dentro do schema** — sem RLS como única proteção, sem funções do Supabase, sem FK para as tabelas internas de autenticação deles. A proteção real fica na aplicação (`ScopedRepository`). O que não é automático: Auth e Storage. Mitigação: dois pontos de contato únicos (`lib/api/auth.ts` e um adaptador de storage), de modo que a troca seja dois arquivos e não 62.

### Seção 4 — Camada de dados do backend

**O problema:** 125 `db.query()` diretos, cada endpoint decidindo sozinho se filtra por conta, 13 esqueceram. Enquanto for possível esquecer, alguém esquece.

**`RequestContext`** (`app/core/security.py`) — identidade resolvida no servidor, uma vez: `user_id`, `account_id`, `email`, `entitlements`. Nenhum endpoint recebe `current_user` cru nem lê `account_id` do payload; o que vem do cliente é ignorado sempre.

**`ScopedRepository`** (`app/db/repository.py`) — `query(model)` filtra por `account_id` sempre; model sem `account_id` levanta `TypeError` com mensagem citando o Art. 1. `create()` injeta `account_id` e `created_by`. Escotilha `unscoped_query()` permitida só em `app/tools/` e `alembic/`, com lint acusando em outro lugar.

**`account_id` e `created_by` em toda tabela de dado.** Faltam em **10**: `environments`, `environment_dnas`, `budgets`, `budget_items`, `item_options`, `presentations`, `presentation_environments`, `presentation_acceptances`, `presentation_comments`, `project_slots`. É desnormalização deliberada: o repositório só é universal se toda tabela responder à mesma pergunta, e o índice só funciona se a coluna existir.

⚠️ Corrigido em 24/08/2026: a versão anterior listava 13, incluindo `product_states`, `product_origins` e `documents`. Os dois primeiros são **catálogo global** — verificado que nunca são filtrados por conta em nenhum ponto do código. O `documents` (tabela de embeddings com `Vector(1536)`) não tem chave estrangeira para nada e não tem consumidor real em `app/`; decidir o escopo dele fica para quando tiver uso. `plans` também é catálogo global e nunca esteve na lista. Ver `docs/dev/modelo-de-dados.md` para a classificação tabela a tabela.

**Índices**, derivados das queries reais: `(account_id)` em todas; compostos onde há filtro somado a ordenação — `(account_id, created_at)`, `(account_id, state_id)`, `(budget_id)`, `(environment_id)`, `(project_id)`.

**Fim do N+1 no orçamento.** Hoje `calculate_budget_item_quantity(db, item)` faz até 3 queries por item — ~300 para 100 itens. Passa a: uma query com `selectinload` trazendo a árvore, uma query trazendo os `EnvironmentDNA` em dicionário, e a função vira **pura** (`calculate_quantity(item, dna)`), sem I/O e testável isoladamente. De ~300 queries para 2.

**Suíte de testes** — a atual é descartada inteira. A nova roda contra Postgres real, cada teste em transação com rollback:

- `tests/services/` — funções puras, sem banco
- `tests/api/` — endpoint contra banco real com dado semeado
- `tests/isolation/` — teste genérico que percorre **todas as rotas registradas**, autentica como conta A, tenta alcançar recurso da conta B e falha se algo diferente de 404 voltar. Rota nova sem isolamento quebra o build no dia em que é escrita.

**Tratamento de erro** — os 14 `detail=str(e)` e 58 `print()` saem. Exceções de domínio (`NotFound`, `Forbidden`, `QuotaExceeded`) traduzidas por handler único, mensagem em pt-BR na resposta e rastro completo no log estruturado.

**`GET /api/v1/me`** com `user`, `account` e `entitlements` — o limite de plano passa a vir da API (Art. 3).

### Seção 5 — Camada de dados do frontend

**`lib/api/client.ts`** — um cliente. Resolve a sessão, monta o header, trata erro, propaga `AbortSignal`, tipa a resposta. Tela nunca chama `fetch`. Elimina os 67 headers manuais e os 56 `getSession()`.

**`lib/api/auth.ts`** — o único arquivo que sabe que Supabase existe. Ponto de troca para Cognito no futuro.

**`lib/query/keys.ts`** — chaves padronizadas (`queryKeys.budget(projectId)`) e política de cache por natureza do dado: referência vive muito, transacional vive pouco, nada é rebuscado por troca de aba. Sem padrão, duas pessoas inventam duas convenções e a invalidação erra de formas difíceis de achar.

**`features/<dominio>/hooks.ts`** — `useBudget()`, `useProjects()`, `useCreateProject()`. Loading, erro, cache e cancelamento vêm iguais em todas as telas.

**Prefetch no servidor com hidratação** — o Server Component busca antes de mandar a página; o React Query recebe hidratado. Ataca a causa raiz: a tela deixa de ser casca vazia que sai correndo atrás de dado depois de aparecer.

**`proxy.ts` corrigido** — o desvio para `/api`, `/_next` e estáticos passa a ocorrer **antes** do `getUser()`; matcher exclui `/assets`; saem os 3 `console.log` por requisição. O `getUser()` permanece onde há rota protegida — é a verificação real do token, e removê-la seria trocar segurança por velocidade.

**Cancelamento automático** via `AbortSignal` do React Query.

**Lint que impede a volta:** `fetch(` proibido fora de `lib/api/`; `createClient()` proibido fora de `lib/api/auth.ts`; `useEffect` com busca de dado proibido.

**Validação antes de escalar:** migrar **uma** feature inteira (Biblioteca — já usa React Query e é a mais lenta) e medir. Só com o ganho confirmado ligam-se os lints e migra-se o resto. Não migramos 33 telas apostando numa previsão.

### Seção 6 — Camada de UI

**Tokens primeiro, proibição depois.** Acrescentar `--success`, `--warning`, `--info` (e `-foreground`), escala tipográfica, espaçamento e raio. A base semântica existente está correta e permanece. Só então: lint contra cor literal e **validador de contraste no CI** percorrendo todos os pares (fundo, texto) nos dois temas, falhando abaixo de 4.5:1.

Isso também prepara a identidade visual nova: quando sair, muda um arquivo.

**Os 5 estados como estrutura, não lembrete.** `QueryBoundary` recebe skeleton, empty e error como parâmetros **obrigatórios**. O caminho feliz sozinho deixa de compilar.

**Componentes que carregam decisão de produto:** `FormField` (rótulo por `htmlFor`, erro inline, `data-private` quando sensível) · `CurrencyInput` · `EmptyState` · `Skeleton` · `AlertDialog` com foco preso · `DropdownMenu` visível em toque · `DataTable` com ordenação e paginação · `ErrorBoundary` que emite telemetria. Os 30 shadcn existentes permanecem.

**Acessibilidade por ferramenta:** lint contra `tabIndex={-1}` (5 hoje) e `opacity-0 group-hover` sem `focus-within` (9 hoje); axe na galeria no CI com zero violação.

**Galeria `/dev/componentes`** — protegida, não indexável, com os 5 estados de cada componente. É a referência que qualquer agente lê antes de construir uma tela, e o que impede reinventar o que já existe.

**Code splitting** — 0 `next/dynamic` hoje. Entram Agenda, construtor de apresentação, impressão e modais pesados. Saem quatro dependências instaladas e nunca importadas (`react-icons` 83 MB, `embla-carousel-react`, `react-easy-crop`, `vaul`); `@types/react-big-calendar` vai para `devDependencies`.

**Imagens** padronizadas em `next/image` com `sizes` (14 `<img>` hoje; a Biblioteca tem 300 produtos).

**Arquivos grandes quebrados** para ~250 linhas: `MainBudgetArea` (642), `AppShell` (574), `dashboard/page` (557), `ProjectWizard` (553). Motivo prático: edição por IA é confiável no que cabe em contexto.

### Seção 7 — Telemetria

Esqueleto, não a spec 003 inteira. Sem session replay, sem funil, sem escolher ferramenta ainda. Executa **antes** da migração das telas porque instrumentar tela pronta é o dobro do trabalho — cada tela migrada nasce medida.

- tabela `product_events` e serviço `track(ctx, evento, propriedades)` no servidor; falha de envio externo não derruba a requisição
- tabela `ai_usage_logs` gravando `account_id`, `model_name`, `token_count`, `cost_usd`, `latency_ms`, `feature` **na mesma transação da resposta** (Art. 9). Hoje nenhuma chamada de IA registra nada — não há como saber quanto um usuário custa, o que é o principal risco de margem num produto com IA e assinatura única
- `useTrack()` e `screen_viewed` automático no shell, com `screen`, `load_ms`, `is_empty`, sem a tela precisar lembrar
- `POST /api/v1/events` com `account_id`/`user_id` do contexto, nunca do payload

### Seção 8 — Migração das telas

Ordem por dor medida e valor de prova, não pela do playbook (que assumia reescrita do zero; aqui a sessão já está resolvida pelas Seções 4 e 5, então as telas de login viram casca fina e esperam):

| # | Tela | Baseline | Por quê nesta posição |
|---|---|---|---|
| 1 | Biblioteca | 3,6 s · API 1.220 ms | piloto da Seção 5 — valida a previsão antes de escalar |
| 2 | Dashboard | API 881 ms | define shell, navegação e padrão de carregamento |
| 3 | Projetos (lista + detalhe) | 3,0 s | núcleo do modelo |
| 4 | Orçamento | ~300 queries | Ação de Valor e pior defeito de performance |
| 5 | Financeiro | 4,3 s | pior número medido |
| 6 | Apresentações + Portal | — | onde estão 5 dos 13 P0 |
| 7 | Agenda | API 677 ms | primeira beneficiária do code splitting |
| 8 | Auth, Perfil, Configurações, Billing | — | casca fina |
| 9 | Landing e páginas legais | — | só tokens e acessibilidade |

Uma por vez, mergeada e medida antes da próxima.

**Antes de migrar cada tela, uma pergunta:** algo aqui vai ser cortado? Se vai, corta antes — migrar código que será apagado é desperdício. O roadmap já registra um caso (`GIO-8`, escopo de Apresentações).

**Definição de tela pronta** — nove itens, todos verificáveis por outra pessoa:

- [ ] Paridade: nada que funcionava parou de funcionar
- [ ] Consome `features/<dominio>/hooks.ts`; zero `fetch` na tela
- [ ] Os 5 estados via `QueryBoundary`
- [ ] Teste de isolamento passando para os endpoints que usa
- [ ] Orçamento de performance atingido contra staging com dado realista
- [ ] axe sem violação · contraste AA nos dois temas · navegável só por teclado
- [ ] Nenhuma cor, URL, ID ou limite literal
- [ ] Testada em 390px e 1440px
- [ ] `docs/dev/modulos/<modulo>.md` escrita, com o número medido

**Orçamento de performance:**

| Métrica | Hoje | Alvo |
|---|---|---|
| Clique → dados na tela | 3,0–4,3 s | < 1,5 s |
| Resposta da API (P95) | 510–1.220 ms | < 400 ms |
| Queries por carregamento | até ~300 | < 8 |
| LCP em 4G throttled (P75) | não medido | < 2,0 s |
| JS da rota | não medido | < 200 KB gzip |

**O contador — `PROGRESS.md` na raiz.** Calculado, não digitado: `tools/progresso.py` lê as caixas marcadas e recomputa as porcentagens; o CI falha se o número divergir da lista. Cada tarefa carrega a **prova** que a fecha — sem prova, não marca. Tarefas com medição registram o número: `Financeiro 4,3 s → 1,1 s`. É o que responde, no fim, se valeu.

### Seção 9 — Rename final

Executado **por último**, depois de toda a implementação, porque quebra as configurações de *Root Directory* na Vercel e no Render — que Thiago reconecta em seguida.

- `ArchSmart-api` → `api`
- `ArchSmart-web` → `web`
- `spec-kit-2` → `spec-kit`
- pasta mãe `01-Arch-Smart` → `arqsmart`
- varredura final das 60 ocorrências de `ArchSmart` em código, copy e metadados (Art. 8)

⚠️ A renomeação da pasta mãe muda o diretório de trabalho de qualquer sessão aberta.

---

## 6. Como saberemos se valeu

Critérios objetivos, verificáveis por terceiro:

1. **Isolamento:** teste genérico percorre todas as rotas e nenhuma vaza dado entre contas.
2. **Velocidade:** as três telas medidas saem de 3,0–4,3 s para menos de 1,5 s até dados na tela, em staging com dado realista.
3. **Escala:** o tempo de carregamento **não cresce** com o volume de dados da conta — o teste é o seed de staging contra um seed 10×.
4. **Custo de iteração:** criar uma tela nova não exige escrever nenhuma linha de autenticação, tratamento de erro ou estado de carregamento.
5. **Onboarding:** a segunda pessoa sobe o projeto inteiro seguindo só `docs/dev/ambiente.md`, sem perguntar nada. Se travar, a doc está errada — corrige e repete.

---

## 7. Fora de escopo

- **Funcionalidades novas** (specs 014–020). Decidido: não entram junto com a migração, porque destroem o teste de paridade e trazem decisões de negócio que travariam a tela. Aceita-se uma segunda migração de banco depois — a plataforma não está lançada, o custo é baixo.
- **Compliance e LGPD (spec 012) e Onboarding (spec 013)** — Onda 3, depois deste trabalho.
- **Session replay, funil de 11 etapas e escolha de ferramenta de analytics** — spec 003 completa, depois do esqueleto da Seção 7.
- **Migração para AWS** — este trabalho a torna viável, não a executa.
- **Identidade visual nova** — tokens ficam prontos para recebê-la; o desenho é responsabilidade de Thiago.
- **Correção dos documentos jurídicos** (Art. 8) — dependência externa, responsabilidade de Brenno.

---

## 8. Decisões registradas

| # | Decisão | Razão |
|---|---|---|
| 1 | Não reescrever a plataforma inteira | Stack atual, modelo de dados 60% pronto, e os defeitos são de processo — reescrita os reproduziria |
| 2 | Strangler dentro do repo atual | 57 de 70 endpoints estão corretos; corte big-bang é risco sem ganho |
| 3 | Descartar o banco atual, criar novo | Nada lançado, nada a preservar; dispensa reconciliar drift de schema |
| 4 | Docker local com stack Supabase completa | App depende de Auth e Storage, não só de Postgres |
| 5 | Alembic como fonte única do schema | Duas ferramentas versionando o mesmo schema é como se perde o controle dele |
| 6 | Três branches (`develop`, `staging`, `main`) | Duas pessoas mais beta-testers em staging: `develop` é onde o trabalho se encontra sem publicar |
| 7 | Telemetria antes da migração das telas | Instrumentar tela pronta é o dobro do trabalho |
| 8 | Sem funcionalidade nova durante a migração | Destrói o teste de paridade e trava a tela em decisão de negócio |
| 9 | Banco só com o que o produto usa hoje | Nada lançado torna a segunda migração barata |
| 10 | Rename das pastas por último | Quebra Vercel e Render; melhor fazer uma vez, no fim |

Cada uma vira ADR em `docs/dev/decisoes/`.
