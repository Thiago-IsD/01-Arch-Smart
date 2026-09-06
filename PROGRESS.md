# Progresso — Reestruturação da Plataforma Arq Smart

> O número abaixo é **calculado, não digitado**: `tools/progresso.py` lê as caixas
> marcadas neste arquivo e recomputa as porcentagens. Depois de marcar ou
> desmarcar uma tarefa, rode `python tools/progresso.py --write` para
> regenerar. Para conferir que este arquivo não divergiu das caixas — o que a
> Seção 3 liga no CI — rode `python tools/progresso.py --check`; ele sai com
> código 1 e imprime a diferença se algo estiver errado.

**Progresso geral: 28/63 (44%)**
`█████████░░░░░░░░░░░`

_Última atualização: 2026-09-05_

---

## Seção 1 · Correções P0 de segurança
**6/6 (100%)** `████████████████████`

- [x] Harness de teste contra Postgres real em Docker
- [x] Escopo por conta nos 3 endpoints de item de orçamento
- [x] Escopo por conta nos 3 endpoints de opção e resumo
- [x] Token obrigatório nas 5 ações do portal
- [x] Fechamento dos 2 endpoints sem autenticação, com rate limit
- [x] Documentação da Seção 1

## Seção 2 · Estrutura do repositório e documentação
**8/8 (100%)** `████████████████████`

- [x] Limpeza do repositório (Task 1)
- [x] README da raiz e esqueleto de `docs/` (Task 2)
- [x] `CLAUDE.md` nos quatro níveis — raiz, api, web, extension (Task 3)
- [x] `PROGRESS.md` e o script que o calcula (Task 4)
- [x] `docs/dev/ambiente.md` (Task 5)
- [x] Convenções e arquitetura — `docs/dev/convencoes.md` e `docs/dev/arquitetura.md` (Task 6)
- [x] Modelo de dados — `docs/dev/modelo-de-dados.md` (Task 7)
- [x] Deploy, ADRs em `docs/dev/decisoes/` e template de PR (Task 8)

## Seção 3 · Esteira, ambientes e branches
**5/5 (100%)** `████████████████████`

- [x] CI que reprova em todo PR (lint, tipos, testes contra Postgres em Docker, cores literais, doc de módulo, consistência do PROGRESS.md, sincronia `main`↔`develop`)
- [x] Branch `staging` e ambiente online (API de staging no Render + preview automático da Vercel)
- [x] Postgres local em Docker com a stack Supabase completa (Auth + Storage + Studio)
- [x] Banco de produção novo, criado do zero pela receita de migrações
- [x] Seed com volume realista (`ArchSmart-api/tools/seed.py`: 5 projetos, 25 ambientes, 300 itens de biblioteca, 500 itens de projeto)

> **O banco de produção fechou em 30/08/2026, e foi medido.** O projeto
> Supabase novo estava virgem (`0` tabelas, sem `alembic_version`); o deploy do
> código novo em `main` rodou a receita sozinho, pelo `CMD` do contêiner
> ([ADR 0007](docs/dev/decisoes/0007-migracao-no-start-do-container.md)), e o
> resultado foi `alembic_version=b77a9b5656c2`, 27 tabelas, extensão `vector`
> habilitada — **sem nenhum passo manual fora do Alembic**, que é exatamente o
> critério de sucesso da
> [ADR 0003](docs/dev/decisoes/0003-descartar-banco-atual-criar-novo.md).
> Staging passou pela mesma receita antes, com o mesmo resultado.
>
> *`b77a9b5656c2` era o head do repositório em 30/08/2026. A Seção 4
> acrescentou migrações desde então — ver o bloco de estado no `CLAUDE.md`
> para o head de hoje e o que já está implantado em cada ambiente; os dois
> números não são intercambiáveis.*
>
> **A metade Vercel fechou em 30/08/2026, com as duas pontas medidas.** A API
> de staging está no ar servindo o código novo
> (`https://arqsmart-staging.onrender.com`, 57 rotas, `/health` e `/health/db`
> verdes), o domínio de produção atende (`www.arqsmart.com.br` → `200` com o
> app Next.js) e **todo push gera preview**:
>
> ```
> staging  https://arqsmart-git-staging-arqsmart.vercel.app
> develop  https://arqsmart-git-develop-arqsmart.vercel.app
> ```
>
> Os previews respondem `302` para `vercel.com/sso-api` — Deployment Protection
> ligada, que exige login. É esperado; o que prova que o deployment existe é
> justamente esse `302` do SSO em contraste com `DEPLOYMENT_NOT_FOUND`.
>
> A Vercel custou duas rodadas. Primeiro ela recusava todo deploy (*"Git author
> must have access to the project"*), o que levou a tornar o repositório
> público. Depois os deploys passaram a concluir mas **entregavam zero
> arquivos** — builds de 2–3 s contra os 41–45 s de um build real —, e a saída
> foi **recriar o projeto**. O diagnóstico completo, e o atalho para reconhecer
> o padrão em minutos em vez de horas, está em
> [docs/dev/ambientes-online.md](docs/dev/ambientes-online.md), seção 2.
>
> **A primeira caixa foi renomeada, e o motivo importa.** Ela dizia "CI que
> barra merge". O `ci.yml` existe, roda em todo PR e reprova corretamente — mas
> **não barra**: branch protection não está disponível num repositório privado
> em plano Free. Medido em 25/08/2026: `404` em `/branches/*/protection`, `403
> "Upgrade to GitHub Pro or make this repository public"` em `/rulesets`, e o
> PR fica `mergeable: MERGEABLE / mergeStateStatus: UNSTABLE` — há check
> não-verde **e o merge continua permitido**.
>
> **Decisão de Thiago, 26/08/2026: fica assim.** Sem GitHub Pro, sem tornar o
> repositório público. A esteira é um **conselheiro**: ela mostra o X vermelho,
> e quem mergeia decide. O custo assumido é que um PR vermelho pode entrar por
> distração — e é por isso que a caixa não promete bloqueio.
>
> ⚠️ **A premissa dessa decisão mudou em 30/08/2026, por outro motivo.** O
> repositório **foi tornado público** — não para ligar branch protection, mas
> porque a Vercel recusava todo deploy enquanto ele era privado (*"Git author
> must have access to the project"*). Confirmado: `gh repo view --json
> visibility` → `PUBLIC`. Como efeito colateral, **branch protection passou a
> estar disponível de graça**, e a metade "sem tornar público" da decisão
> acima não descreve mais a realidade.
>
> A decisão de ligar ou não o bloqueio **continua em aberto** — ela não foi
> tomada junto com a mudança de visibilidade. O roteiro está em
> [ambientes-online.md](docs/dev/ambientes-online.md), seção 5.
>
> Do texto original da caixa saiu o **validador de contraste**, que depende dos
> tokens `--success`/`--warning` da Seção 6 — não existe ainda o que ele
> verificaria. O **teste de isolamento entre contas** também saiu do texto, mas
> pelo motivo oposto: ele **já existe**. São 27 testes em
> `ArchSmart-api/tests/isolation/`, vindos da Seção 1, que rodam em todo PR. O
> que a Seção 4 acrescenta é a versão genérica, que percorre todas as rotas
> registradas em vez de uma lista escrita à mão.

## Seção 4 · Camada de dados do backend
**9/9 (100%)** `████████████████████`

- [x] `RequestContext` em `app/core/security.py`
- [x] `ScopedRepository` em `app/db/repository.py`
- [x] `account_id` e `created_by` nas 10 tabelas que faltam
- [x] Índices derivados das queries reais
- [x] Fim do N+1 no orçamento (`calculate_quantity` pura, de ~300 para 2 queries)
- [x] Suíte de testes contra banco real (`tests/services/`, `tests/api/`, `tests/isolation/`) substituindo `app/tests/`
- [x] Tratamento de erro único (exceções de domínio; sem `detail=str(e)` nem `print()`)
- [x] `GET /api/users/me` com `user`, `account` e `entitlements`
- [x] Fim do auto-link por e-mail em `app/api/users.py` (ver [arquitetura.md](docs/dev/arquitetura.md), "Resolvido em 05/09/2026: o auto-link por e-mail em `app/api/users.py`")

> **A Seção 4 fechou em 05/09/2026, e foi medida.** `grep -rn "db\.query("
> app --include=*.py | wc -l` sai **30** hoje; **29 são chamadas reais** — a
> trigésima é a própria docstring de `repository.py` citando o número antigo
> (117) da auditoria pré-Seção-4. Das 29: **11 estão em `public.py`**
> (portal público, sem conta na sessão — justificadas pelo **docstring do
> módulo**, não por comentário linha a linha, ao contrário do que uma versão
> anterior deste texto dizia); **3 têm o comentário literal
> `# pre-sessao: sem account_id ainda`** (2 em `auth.py`, 1 em `leads.py` —
> a contagem é travada por
> `test_marca_de_pre_sessao_nao_cresce_sem_querer`); **11 são sobre modelo
> sem `account_id` nenhum** — catálogo global ou a própria conta (7 em
> `product_router.py`, sobre `ProductState`/`ProductOrigin`; 4 em
> `users.py`, sobre `Account`/`Plan` — cada uma com comentário dizendo por
> quê, logo acima da linha); **1 em `security.py`** resolve identidade a
> partir do token antes de existir sessão; **2 em `repository.py`** são a
> própria definição do `ScopedRepository` (`.query()` e
> `unscoped_query()`); e **1 em `entitlements.py`** faz um `outerjoin` de
> duas colunas que `repo.query(model)` não sabe expressar, documentado no
> docstring da função.
>
> **O que agora é impossível de escrever.** `ScopedRepository.query(model)`
> filtra por `account_id` sozinho e levanta `EscopoImpossivel` num model que
> não tem a coluna. `create()` injeta `account_id` e `created_by` e
> **descarta** o que vier do cliente nessas duas chaves. E
> `tests/isolation/test_todas_as_rotas.py` percorre as rotas registradas: uma
> rota nova com id na URL e sem entrada em `RECURSOS` **falha**, em vez de
> passar despercebida.
>
> **O limite exato dessa garantia, e o que o fecha.** `RECURSOS` é indexado
> por **nome de parâmetro**. Um nome *novo* falha alto — ninguém disse que
> recurso aquele id endereça. Um nome **já registrado, reusado para
> endereçar outro model**, não: a fábrica devolve o objeto errado, o id
> nunca casa, a rota devolve 404 para *toda* conta e o caso passa sem ter
> exercitado filtro nenhum. Foi o defeito de `env_id` que esta seção
> encontrou e corrigiu para duas rotas — mas corrigir duas rotas não
> corrige a classe. Medido em 05/09/2026 com uma rota
> `GET /api/vazamento/{project_id}` acrescentada a `app/main.py`, que
> consulta `Product` sem filtro de conta e vaza `cost_price` e `markup` de
> todas: com o arquivo na versão anterior, `47 passed, 1 skipped`.
>
> O que fecha a classe é o **controle positivo**, acrescentado agora: antes
> de exigir 404 da conta A, o teste exige que a conta **B alcance o próprio
> recurso** por aquela mesma rota. Se B também levar 404, o caso não prova
> nada e falha com essa mensagem ("CASO VACUO"). Com ele, a mesma rota de
> vazamento dá `1 failed, 46 passed, 1 skipped`. A asserção é `!= 404` de
> propósito, e não 2xx: o corpo mínimo atravessa o portão de conta, não
> toda regra de negócio do handler — exigir 2xx transformaria "regra mudou"
> em "isolamento quebrou".
>
> Duas correções vieram junto, ambas de harness. `client_a` e `client_b`
> gravavam a **mesma** chave em `app.dependency_overrides`, então pedir as
> duas fixtures no mesmo teste fazia a última vencer as duas — medido:
> `client_a` autenticado como B devolvia 200 para um projeto de B.
> `_ClienteDeConta` (em `tests/conftest.py`) re-arma o override a cada
> chamada. E `criar_lancamento` fabricava um `FinancialEntry` sem `type`,
> `status` nem `due_date`, os três obrigatórios em
> `FinancialEntryResponse`: um lançamento que o `POST /api/financial` nunca
> cria, e que fazia `PUT /api/financial/{entry_id}` estourar 500 na
> validação da resposta assim que o controle positivo percorreu o caminho
> de sucesso.
>
> **O schema.** As 21 tabelas de dado ganharam `created_by`; as mesmas 21
> têm hoje `account_id` (11 já tinham antes da Seção 4, 10 ganharam agora),
> com backfill pelo caminho de FK e fechamento em `NOT NULL` na mesma
> migração. Os 4 índices do schema viraram **29** (contados do metadata do
> SQLAlchemy, script no Passo 6 do brief desta tarefa): um `ix_*_account_id`
> em cada uma das 21 tabelas — 16 simples e 5 compostos, como
> `events(account_id, start_time)` —, mais 4 índices novos por padrão de
> query real (`budget_items.budget_id`, `budget_items.environment_id`,
> `environments.project_id`, `presentation_comments(presentation_id,
> created_at)`); os 4 originais (`users.email`, `users.supabase_id`,
> `financial_entries.group_id`, `documents.id`) continuam.
>
> **O N+1 do orçamento.** `calculate_budget_item_quantity(db, item)` fazia até
> 3 queries por item — ~300 num orçamento de 100. Ela virou
> `calculate_quantity(item, dna, produto)`, **pura**, e o carregamento virou 2
> queries. O número é contado, não estimado:
> `tests/api/test_orcamento_sem_n_mais_um.py` registra as queries num listener
> do SQLAlchemy e falha se passarem de 2.
>
> **A suíte.** A antiga (`app/tests/`, 83 testes sobre `MagicMock`) foi
> apagada — o diretório hoje só contém `__pycache__`. A nova tem **303**
> testes coletados contra Postgres real (`pytest --collect-only -q`; a
> execução real é **302 passam, 1 skip deliberado** — `pytest -q`). O grosso
> mora em `tests/services/` (16, função pura), `tests/api/` (68, endpoint
> com dado semeado) e `tests/isolation/` (74, vazamento entre contas); os
> 145 restantes são 8 arquivos de teste de arquitetura, schema e migração na
> raiz de `tests/` (`test_arquitetura.py`, `test_colunas_de_escopo.py`,
> `test_guarda_banco.py`, `test_indices.py` e outros quatro).
>
> **Duas coisas mudaram em relação à spec, e as duas estão registradas.** O
> `/me` ficou em `GET /api/users/me` e não em `/api/v1/me` — não existe
> prefixo `/api/v1` no app, e criar um para uma rota só seria versionamento
> que ninguém mais segue
> ([ADR 0008](docs/dev/decisoes/0008-me-em-api-users-me.md)). E o
> `created_by` foi para as 21 tabelas de dado, não só para as 10 que
> ganharam `account_id`, para que `create()` não tenha exceção a lembrar.
>
> **A oitava caixa foi renomeada, e o motivo importa** — mesmo espírito da
> renomeação da primeira caixa da Seção 3. Ela dizia `GET /api/v1/me`,
> copiado da spec original; a spec pedia um prefixo de versionamento que
> este app nunca teve, e criar `/api/v1` só para uma rota seria
> versionamento que ninguém mais segue. O [ADR 0008](docs/dev/decisoes/0008-me-em-api-users-me.md)
> registra essa decisão, e a caixa agora descreve o que de fato subiu:
> `GET /api/users/me`. A nona caixa também foi corrigida: linkava para a
> seção "pendência de segurança conhecida" de `arquitetura.md`, um título
> que não existe mais desde que a Tarefa 2 fechou a pendência — o título
> hoje é "Resolvido em 05/09/2026: o auto-link por e-mail em
> `app/api/users.py`", e é para lá que o link aponta agora.
>
> **O ADR 0008 vale para a reestruturação inteira, não só para esta caixa.**
> A Seção 7 (`POST /api/v1/events`, mais abaixo) carrega a mesma suposição
> de um prefixo `/api/v1` que não existe — quem for fechar aquela seção vai
> bater no mesmo ponto e não precisa redescobrir do zero: a decisão já está
> tomada e registrada no ADR. Não mexi na caixa da Seção 7 — não é desta
> tarefa.
>
> **Achado extra, corrigido durante a seção:** a marca escrita errada
> (`"Arch Smart"`, `"ArchSmart"`, `"Ark Smart"`, `"Ecowe"`) em `app/` está
> hoje em **zero** ocorrências
> (`grep -rn "Arch Smart\|ArchSmart\|Ark Smart\|Ecowe" app --include=*.py`),
> travada por `tests/test_arquitetura.py::test_a_marca_e_arq_smart` — Art. 8.
>
> **Duas pendências abertas, registradas por esta tarefa, não fechadas por
> ela — decisão de Thiago, não de uma rodada de conversão.** Primeiro: o
> auto-link por e-mail sobrevive em `POST /api/auth/complete-register`
> (`app/api/auth.py`, função `complete_register`, linhas 73-92). A Tarefa 2
> removeu o padrão do resolvedor de identidade que cobre toda requisição
> autenticada (`app/core/security.py`), mas este caminho legado de
> migração ainda resolve usuário por e-mail e sobrescreve `supabase_id` e
> `full_name` — protegido só pelo toggle "Confirm email" do painel do
> Supabase. Segundo: 4 migrações mais antigas têm `downgrade()` não vazio
> que **estoura em runtime**
> (`grep -rln "drop_constraint(None" alembic/versions/*.py`, hoje
> `299f1faf8dd8_add_budget_models_and_ruletype_enum.py`,
> `368eb3cacbeb_refactor_client_and_project_schemas.py`,
> `d2509ab61a6f_add_auth_v2_tables.py`,
> `ea296ec7dc5e_add_environment_and_dna.py`) — chamam
> `op.drop_constraint(None, ...)`, que exige um `naming_convention` que
> `app/db/base.py` não define. "`downgrade()` não vazio" nunca quis dizer
> "`downgrade()` funciona".

## Seção 5 · Camada de dados do frontend
**0/8 (0%)** `░░░░░░░░░░░░░░░░░░░░`

- [ ] `lib/api/client.ts` (cliente único)
- [ ] `lib/api/auth.ts` (único ponto que sabe que o Supabase existe)
- [ ] `lib/query/keys.ts` (chaves padronizadas e política de cache)
- [ ] Hooks por domínio em `features/<dominio>/hooks.ts`
- [ ] Prefetch no servidor com hidratação
- [ ] `proxy.ts` corrigido (desvio antes do `getUser()`, matcher sem `/assets`, sem `console.log`)
- [ ] Cancelamento automático via `AbortSignal`
- [ ] Lint que impede a volta (`fetch` fora de `lib/api/`, `createClient()` fora de `lib/api/auth.ts`, `useEffect` com busca de dado)

## Seção 6 · Camada de UI
**0/9 (0%)** `░░░░░░░░░░░░░░░░░░░░`

- [ ] Tokens completos (`--success`, `--warning`, `--info` e `-foreground`, escala tipográfica, espaçamento, raio)
- [ ] Validador de contraste no CI (4.5:1 nos dois temas)
- [ ] `QueryBoundary` com os 5 estados como parâmetros obrigatórios
- [ ] Componentes que carregam decisão de produto (`FormField`, `CurrencyInput`, `EmptyState`, `Skeleton`, `AlertDialog`, `DropdownMenu`, `DataTable`, `ErrorBoundary`)
- [ ] Acessibilidade por ferramenta (lint de `tabIndex`/`focus-within` + axe na galeria, zero violação)
- [ ] Galeria `/dev/componentes`
- [ ] Code splitting (`next/dynamic` nas telas pesadas; remoção das dependências não usadas)
- [ ] Imagens padronizadas em `next/image` com `sizes`
- [ ] Quebra dos arquivos grandes (`MainBudgetArea`, `AppShell`, `dashboard/page`, `ProjectWizard`)

## Seção 7 · Telemetria
**0/4 (0%)** `░░░░░░░░░░░░░░░░░░░░`

- [ ] Tabela `product_events` e serviço `track(ctx, evento, propriedades)`
- [ ] Tabela `ai_usage_logs` (`account_id`, `model_name`, `token_count`, `cost_usd`, `latency_ms`, `feature`)
- [ ] `useTrack()` e `screen_viewed` automático no shell
- [ ] `POST /api/v1/events` com `account_id`/`user_id` do contexto

## Seção 8 · Migração das telas
**0/9 (0%)** `░░░░░░░░░░░░░░░░░░░░`

- [ ] Biblioteca
- [ ] Dashboard
- [ ] Projetos (lista + detalhe)
- [ ] Orçamento
- [ ] Financeiro
- [ ] Apresentações e Portal
- [ ] Agenda
- [ ] Auth, Perfil, Configurações e Billing
- [ ] Landing e páginas legais

## Seção 9 · Rename final
**0/5 (0%)** `░░░░░░░░░░░░░░░░░░░░`

- [ ] `ArchSmart-api` → `api`
- [ ] `ArchSmart-web` → `web`
- [ ] `spec-kit-2` → `spec-kit`
- [ ] Pasta mãe → `arqsmart`
- [ ] Varredura final das ocorrências de `ArchSmart` em código, copy e metadados
