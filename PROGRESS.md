# Progresso — Reestruturação da Plataforma Arq Smart

> O número abaixo é **calculado, não digitado**: `tools/progresso.py` lê as caixas
> marcadas neste arquivo e recomputa as porcentagens. Depois de marcar ou
> desmarcar uma tarefa, rode `python tools/progresso.py --write` para
> regenerar. Para conferir que este arquivo não divergiu das caixas — o que a
> Seção 3 liga no CI — rode `python tools/progresso.py --check`; ele sai com
> código 1 e imprime a diferença se algo estiver errado.

**Progresso geral: 45/64 (70%)**
`██████████████░░░░░░`

_Última atualização: 2026-09-10_

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
> do SQLAlchemy. **Os tetos que ele exige são `<= 3` e `<= 5`, não `== 2`** —
> e o próprio teste argumenta contra o número fixo: um teto exato transforma
> "alguém trocou a estratégia de carregamento deliberadamente" em falha de
> isolamento, e a propriedade que importa é a outra, `n_queries_pequeno ==
> n_queries_grande` (5 itens e 30 itens custando o mesmo). `<= 3` guarda
> `carregar_orcamento` isolado (2 hoje); `<= 5` guarda o round trip HTTP de
> `GET /projects/{id}/budget` (5 hoje).
>
> **A suíte.** A antiga (`app/tests/`, 83 testes sobre `MagicMock`) foi
> apagada — o diretório hoje só contém `__pycache__`. A nova tem **308**
> testes coletados contra Postgres real (`pytest --collect-only -q`; a
> execução real é **307 passam, 1 skip deliberado** — `pytest -q`). O grosso
> mora em `tests/services/` (16, função pura), `tests/api/` (70, endpoint
> com dado semeado) e `tests/isolation/` (77, vazamento entre contas); os
> 145 restantes são 8 arquivos de teste de arquitetura, schema e migração na
> raiz de `tests/` (`test_arquitetura.py`, `test_colunas_de_escopo.py`,
> `test_guarda_banco.py`, `test_indices.py` e outros quatro). Os 5 testes
> acrescentados pela onda final da revisão são `test_join_entre_contas.py`
> (3, isolamento) e `test_ordem_deterministica.py` (2, API).
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
> **O contrato de erro mudou em ~10 caminhos, e o registro anterior dizia
> só "duas mensagens de erro mudaram de idioma".** `ValidacaoDeDominio`
> (`app/core/errors.py`) tem `status = 422`, e a Tarefa 5 trocou por ela
> exceções que respondiam 400 ou 500. A lista foi conferida contra
> `git show 1bcc0f3:<arquivo>`, casando cada `raise` novo com a função que o
> continha antes:
>
> | Onde (hoje) | Função | Antes | Agora |
> |---|---|---|---|
> | `app/api/auth.py:30` | `register_request` | 400 | 422 |
> | `app/api/auth.py:41` | `recover_request` | 400 | 422 |
> | `app/api/auth.py:125` | `complete_register` | 400 | 422 |
> | `app/api/auth.py:207` | `signup` | 400 | 422 |
> | `app/api/auth.py:242` | `change_password` | 500 | 422 |
> | `app/api/account.py:80` | `update_account_branding` | 500 | 422 |
> | `app/api/endpoints/presentations.py:262` | `upload_presentation_cover` | 500 | 422 |
> | `app/api/endpoints/presentations.py:367` | `upload_environment_image` | 500 | 422 |
> | `app/api/endpoints/presentations.py:388` | `delete_presentation` | 500 | 422 |
> | `app/api/routers/product_router.py:351` | `clipper_capture` | 500 | 422 |
>
> São 10, e são todas
> (`grep -rn "raise ValidacaoDeDominio" app --include=*.py`).
>
> **Por que isso vai no registro e não só no código.** A Seção 5 constrói o
> cliente contra esta API. Um front que ramifique em 400-vs-422 vai errar
> aqui — e os dois 422 não têm a mesma forma: o do Pydantic traz uma
> **lista** em `detail`, o de `DomainError` traz uma **string**. Medido em
> 05/09/2026: `POST /api/products/` com `json={}` devolve
> `{"detail": [{"type": "missing", "loc": ["body", "name"], ...}]}`, contra o
> `{"detail": "Não foi possível enviar a imagem."}` que
> `registrar_handlers` produz.
>
> **A taxonomia continua em aberto — decisão de Thiago, não desta seção.** A
> maioria desses caminhos é falha de **infraestrutura** (storage fora do ar,
> Supabase sem responder), e 422 significa "entendi o pedido, mas o conteúdo
> não é processável", o que descreve mal um serviço indisponível; 5xx
> descrevia melhor, e era o que eles eram. O que a Tarefa 5 decidiu foi o
> **mecanismo** — nenhuma exceção crua no `detail` —, e o 422 veio junto por
> ser o status da classe escolhida. Mudar o status de qualquer uma dessas
> rotas é mudança de contrato, e não foi feita aqui.

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
**8/8 (100%)** `████████████████████`

- [x] `lib/api/client.ts` (cliente único)
- [x] `lib/api/auth.ts` (único ponto que sabe do Supabase — para autenticação; ver nota abaixo sobre Storage)
- [x] `lib/query/keys.ts` (chaves padronizadas e política de cache)
- [x] Hooks por domínio em `features/<dominio>/hooks.ts`
- [x] Prefetch no servidor com hidratação
- [x] `proxy.ts` corrigido (desvio antes do `getUser()`, matcher sem `/assets`, sem `console.log`)
- [x] Cancelamento automático via `AbortSignal`
- [x] Lint que impede a volta — `no-restricted-syntax` (`fetch` fora de `lib/api/`, `createClient()`/`createServerClient()` fora de `lib/api/`, `useEffect` com busca de dado) é **erro** em `src/features/**`, `src/lib/**` e na rota da Biblioteca (o território que esta seção migrou, medido em zero ocorrências); nas ~30 telas ainda não migradas continua **aviso**, e a catraca (`fetch_fora_de_lib_api`, `supabase_fora_de_lib_api`) é o que impede esse resto de crescer até a Seção 8 migrar cada uma.

> ## ✅ O PORTÃO DA SEÇÃO FOI FECHADO em 10/09/2026 — Tarefa 1 da Seção 6
>
> **A Seção 5 fechou as 8 caixas acima, mas a medição que a spec exige como
> confirmação de "ganho" não tinha sido feita.** A spec é explícita: *"Só com
> o ganho confirmado ligam-se os lints e migra-se o resto."* Essa comparação
> de tempo não pôde rodar enquanto não existia credencial de um usuário real
> (`E2E_EMAIL`/`E2E_PASSWORD`). A Tarefa 1 da Seção 6 criou esse usuário
> (`ana.arquiteta@seed.arqsmart.local`, em staging — ver
> [`docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md`](docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md))
> e rodou a medição:
>
> ```
> cd ArchSmart-web
> E2E_EMAIL=ana.arquiteta@seed.arqsmart.local E2E_PASSWORD=<não versionada> \
>   npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line
> # → AMOSTRAS=1434,1445,1454,1469,1948 · MEDIANA_MS=1454 · 1 passed
> ```
>
> Detalhe completo, inclusive uma tentativa anterior que deu timeout por
> causa do `next dev` compilando rotas pela primeira vez (não um defeito da
> Seção 5), em
> [`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`](docs/dev/medicoes/2026-09-06-biblioteca-depois.md),
> seção "✅ PORTÃO FECHADO". O "antes" (baseline) **continua não medido** — o
> código de antes da Seção 5 não existe mais em nenhuma branch viva; a
> comparação que existe é contra a referência de agosto de 2026 da spec
> (3,6 s), rotulada como referência externa, não como baseline medido aqui —
> ver [`docs/dev/medicoes/2026-09-06-biblioteca-baseline.md`](docs/dev/medicoes/2026-09-06-biblioteca-baseline.md).
>
> **A checagem viva de hidratação (item 9 abaixo) rodou e confirmou que a
> lista principal da Biblioteca hidrata de fato.** Uma primeira versão do
> teste falhava sem discriminar (qualquer `/api/products`, incluindo o badge
> do inbox, derrubava a asserção) — corrigido em rodada de revisão para
> filtrar por `state=NORMALIZED`, a chave da lista, e passou. O badge do
> inbox continua fora do prefetch — pendência aberta da Seção 5, não
> corrigida nesta tarefa; ver item 9.

> **A Seção 5 fechou em 06/09/2026 e foi mergeada até `staging` em 07/09/2026**
> (merge `6e94d63` em `develop`, PR #6 `develop` → `staging` com merge `ce1012e`,
> os três jobs de CI verdes). O que ficou de pé, comparado com
> `develop`, todo medido nesta tarefa e reproduzido em
> [`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`](docs/dev/medicoes/2026-09-06-biblioteca-depois.md):
>
> | Medida | `develop` | esta branch | Comando |
> |---|---|---|---|
> | `createClient(`/`createBrowserClient(`/`createServerClient(` reais | 62 | **0** | `grep -rn "createClient(" ArchSmart-web/src --include=*.ts --include=*.tsx` (a única linha restante é comentário em `auth.ts:18`) |
> | `getSession()` reais | 56 | **2**, ambas em `lib/api/` | `grep -rn "getSession()" ArchSmart-web/src --include=*.ts --include=*.tsx` |
> | `Authorization` montado à mão em telas/componentes | 73 | **63** | ver metodologia (seção 3) do documento de medição — o total bruto sobe para 74 porque `lib/api/` e `__tests__/` (11 ocorrências, que não existiam em `develop`) entram na contagem |
> | `fetch(` com fronteira de palavra | 87 | **76** | `grep -rnoP '\bfetch\s*\(' ArchSmart-web/src --include=*.ts --include=*.tsx \| wc -l` — idêntico ao `fetch_fora_de_lib_api` da catraca |
> | Testes de frontend | 7, 4 arquivos | **62**, 10 arquivos | `cd ArchSmart-web && npm test` |
> | Catraca | — | `eslint_erros` 85 (era 93), `cores_literais` 521 (igual), `fetch_fora_de_lib_api` 76, `supabase_fora_de_lib_api` 0, `modulos_sem_doc` 2 (igual) | `python tools/catraca.py --eslint-json ArchSmart-web/eslint.json` |
>
> **`tools/catraca.py` precisou de `--atualizar --aceitar-piora`** para
> registrar `fetch_fora_de_lib_api` e `supabase_fora_de_lib_api` — as duas
> medidas nasceram nesta seção, e uma chave sem baseline é tratada como
> regressão por padrão (design do script, para ninguém gravar um número novo
> sem passar pelo olho de quem revisa). Nenhuma medida **existente** piorou;
> o flag foi por causa das duas chaves novas, não de uma regressão real —
> registrado aqui para o PR poder citar o motivo.
>
> **O que ficou aberto, além do portão de tempo acima:**
>
> 1. **~30 telas fora do piloto (Biblioteca) continuam no padrão manual**
>    (`getSession()`, `createClient()`, header à mão, `useEffect` + `fetch`).
>    Migrá-las é a **Seção 8**; `fetch_fora_de_lib_api` e
>    `supabase_fora_de_lib_api=0` são a régua que mede esse trabalho a partir
>    de agora — o segundo já está no piso, o primeiro só pode descer.
>    *Correção da revisão final desta seção:* a tabela acima mediu 76 na
>    Tarefa 12, mas 1 dessas ocorrências era um falso positivo — um `fetch(`
>    literal dentro de um comentário
>    (`src/__tests__/library-hooks.test.tsx:108`), não uma chamada real. O
>    comentário foi reescrito e o número vigente, gravado no baseline com a
>    própria ferramenta, é **75** — ver a nota em
>    `docs/dev/medicoes/2026-09-06-biblioteca-depois.md`.
> 2. **`plan_limit` (em `/api/projects`) e `entitlements.project_limit` (em
>    `/api/users/me`) continuam dois nomes para o mesmo conceito no
>    backend.** O front lê só o segundo (`useMe()` em
>    `ArchSmart-web/src/features/account/hooks.ts`) — a violação do Art. 3 que
>    dependia do primeiro foi corrigida nesta seção. Unificar o nome de fio no
>    backend é trabalho de outra seção.
> 3. **Os arquivos grandes do domínio Biblioteca não foram quebrados — Seção
>    6.** *Correção a um número que veio do planejamento desta tarefa:* o
>    plano descrevia "os quatro arquivos de 450–473 linhas"; medido agora
>    (`wc -l ArchSmart-web/src/components/library/{ProductFormSheet,NormalizationSheet,BatchNormalizeModal,ProductCard,MoveToProjectModal,ClipperOnboarding}.tsx`),
>    são **três** arquivos nessa faixa, não quatro: `ProductFormSheet.tsx`
>    (453), `NormalizationSheet.tsx` (437) e `BatchNormalizeModal.tsx` (434).
>    Os outros três componentes que a Tarefa 7 migrou encolheram bem abaixo
>    dessa faixa ao perder o código de busca de dado (`ProductCard.tsx` 211,
>    `MoveToProjectModal.tsx` 161, `ClipperOnboarding.tsx` 143). O fato que
>    sobrevive — três arquivos de 434 a 453 linhas continuam grandes e quebrar
>    é Seção 6 — está correto; só o "quatro" e o "450–473" como intervalo
>    exato não bateram na medição.
> 4. **`MoveToProjectModal` usa hooks de `features/library`, mas fala de
>    projetos e orçamento.** `useProjetosParaMover`, `useAmbientesDoProjeto` e
>    `useMoveToProject` (`features/library/hooks.ts`) resolvem um domínio que
>    não é biblioteca — ficaram lá porque `features/projects/` ainda não
>    existe. Quando a Seção 8 criar essa pasta, os três hooks mudam de casa.
> 5. **`LibraryContent` descarta `error` dos hooks de dado**
>    (`const { data, isLoading } = useProducts(...)`, sem `error`) — uma falha
>    de rede hoje é indistinguível de "sem produtos" para quem usa a tela: o
>    texto mostrado é o mesmo "Nenhum produto encontrado" dos dois casos.
>    Comportamento pré-existente que a migração preservou, não uma regressão
>    desta seção; o conserto de verdade é o `QueryBoundary` da Seção 6, que
>    obriga tratar os 5 estados (incluindo erro) em vez de deixar opcional.
> 6. **Sem teste no nível de componente para `MoveToProjectModal` nem
>    `BatchNormalizeModal`** (`ArchSmart-web/src/__tests__/` cobre hooks e
>    cliente, não esses dois componentes) — duas regressões corrigidas
>    durante esta seção (invalidação de cache em duas chaves, paginação do
>    inbox) não estão pinadas por teste nenhum; uma futura mudança pode
>    reintroduzi-las sem que a suíte acuse.
> 7. **Mudança de comportamento, deliberada:** `listarProjetos`
>    (`features/library/api.ts:113`) manda `size: 100`, contra o `size`
>    default de 20 do backend em `/api/projects` — o dropdown "mover para
>    projeto" agora lista até 100 projetos, não 20. Ninguém tinha notado que
>    o dropdown estava truncado em 20 antes desta seção.
> 8. ~~**Art. 8 violado em 43 ocorrências, 27 arquivos, e não corrigido de
>    propósito.**~~ **Corrigido em 09/09/2026, no commit `b4fae10`** — commit
>    próprio e mecânico, antes de a Seção 6 começar, como estava previsto. A
>    mesma varredura hoje sai **0**. O parágrafo abaixo fica como registro do
>    que foi medido na Seção 5 e por que ela não corrigiu:
>
> 8b. **Art. 8 violado em 43 ocorrências, 27 arquivos, e não corrigido de
>    propósito.** `grep -rn 'Arch Smart' ArchSmart-web/src --include=*.tsx --include=*.ts | wc -l`
>    → **43**. A marca aparece sem o Q em copy de usuário final: landing,
>    login, cadastro, recuperação de senha, reset de senha, preços, portal do
>    cliente e `layout.tsx`. **Deliberadamente não corrigido nesta seção**:
>    27 arquivos de copy dentro de um diff de camada de dados seriam
>    exatamente o "migrar de passagem" que o `CLAUDE.md` da raiz proíbe, e
>    misturariam duas mudanças que não têm nada a ver uma com a outra. Fica
>    para um commit mecânico próprio — decisão de Thiago, não desta seção.
> 9. **A checagem viva de hidratação confirmou, em 10/09/2026 na Tarefa 1 da
>    Seção 6, que a lista principal da Biblioteca hidrata de fato — e que o
>    badge de contagem do inbox continua fora do prefetch, pendência já
>    conhecida e ainda em aberto.**
>    `ArchSmart-web/e2e/hidratacao-biblioteca.spec.ts` rodou contra staging,
>    com sessão real. Uma primeira versão da asserção (revisada e corrigida
>    na mesma tarefa) não discriminava por `state`, então falhava para
>    **qualquer** `/api/products` — incluindo o badge do inbox, que já se
>    sabia fora do prefetch. Essa primeira execução deu:
>
>    ```
>    Error: o navegador pediu /api/products: http://localhost:8000/api/products?page=1&size=1&state=CAPTURED,
>    http://localhost:8000/api/products/?page=1&size=1&state=CAPTURED
>    ```
>
>    As duas ocorrências são a **mesma chamada** (uma é o redirect 307 de
>    barra final da própria API), e as duas são `state=CAPTURED` — a
>    contagem do inbox (`useInboxCount()`, `features/library/hooks.ts`), não
>    a lista principal (`state=NORMALIZED`). **Nenhuma requisição a
>    `state=NORMALIZED` apareceu**, já naquela execução — sinal de que a
>    lista hidratava; a asserção sem filtro só não sabia distinguir isso de
>    uma falha real, e um teste que ficaria vermelho para sempre pelo mesmo
>    motivo já conhecido é o anti-padrão "é esperado que falhe" que a Seção 3
>    já removeu deste repositório. Corrigido: a asserção passou a filtrar por
>    `state=NORMALIZED` (a chave que o servidor prefetcha), e **rodou de novo
>    e passou**:
>
>    ```
>    1 passed (26.5s)
>    ```
>
>    Isso é a confirmação ao vivo, pela primeira vez, de algo que só existia
>    como leitura de código desde a Tarefa 12 da Seção 5: o prefetch da lista
>    principal hidrata de verdade em tempo de execução. **O que continua em
>    aberto, sem mudança:** o badge do inbox é uma chamada separada
>    (`state=CAPTURED`), **nunca prefetchada pelo servidor** — já documentado
>    por leitura de código na Tarefa 12 da Seção 5
>    (`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`, tabela da seção
>    1: *"`useInboxCount()` → chave diferente (…) e nunca prefetchada pelo
>    servidor. Este fetch acontece no browser sempre"*), e o teste corrigido
>    deliberadamente não cobre essa chamada, para não recriar o mesmo
>    anti-padrão. Consertar isso (prefetchar `inboxCount` também, ou mover o
>    badge para dentro do mesmo `HydrationBoundary`) é camada de dados —
>    trabalho de outra seção, não desta. Detalhe completo, com os dois
>    comandos e as duas saídas, em
>    `docs/dev/medicoes/2026-09-06-biblioteca-depois.md`, seção "Verificação
>    viva da hidratação".

## Seção 6 · Camada de UI
**9/9 (100%)** `████████████████████`

> **A Seção 6 fechou em 10/09/2026 e foi mergeada até `staging` no mesmo dia**
> (merge `0ac71d9` em `develop`, PR #7 `develop` → `staging` com merge `5dbd13f`).
> As nove tarefas passaram por revisão independente e rodada de correção, mais
> uma revisão da branch inteira antes do merge. O que ela entregou, para quem
> vai **usar**, está em [`docs/dev/componentes.md`](docs/dev/componentes.md).
>
> **Não verificado, e registrado como tal:** ninguém abriu as telas. Não há teste
> visual neste repositório, e três mudanças de aparência entraram de propósito —
> `min-h-11` no `DropdownMenuItem` (34 itens em 6 telas), a cor do botão de
> fechar do toast destrutivo, e `aria-hidden` no `Skeleton`. Todas conferidas por
> CSS compilado e por diff, nenhuma por olho humano. É a pauta 1 da Seção 7 no
> [`CLAUDE.md`](CLAUDE.md).
>
> **O que esta seção provou que não sabia:** três medidas da catraca diziam verde
> sem olhar. Medida do tipo lista sem baseline passava em silêncio;
> `hover_sem_focus` não via `group-hover/<nome>:` e media 5 onde eram 8; e chave
> que existe no baseline e some da medição nunca era visitada — apagar uma linha
> de `medir()` desligava a medida sem aviso. As três têm teste agora, e a lição
> virou regra no `CLAUDE.md`: medida nova entra com o teste dela no mesmo commit.

> Plano de execução:
> [`docs/superpowers/plans/2026-09-09-secao-6-camada-de-ui.md`](docs/superpowers/plans/2026-09-09-secao-6-camada-de-ui.md).
> A ordem das caixas acima é a do plano, que inverte duas em relação ao
> desenho: o **validador de contraste vem antes dos tokens** (senão os tokens
> nascem sem guarda e o baseline é escrito depois do fato), e a **galeria vem
> antes da acessibilidade** (o axe roda sobre a galeria).
>
> Desenho aprovado em 09/09/2026:
> [`docs/superpowers/specs/2026-09-09-secao-6-camada-de-ui-design.md`](docs/superpowers/specs/2026-09-09-secao-6-camada-de-ui-design.md).
> Duas caixas mudaram de dono em relação à spec de 23/08: **imagens** saiu daqui
> para a Seção 8 (é mudança linha a linha dentro da tela, mesma natureza das
> cores), e no lugar entrou o **usuário de teste** que fecha o portão de
> validação da Seção 5. O total de 63 tarefas não muda.

- [x] Usuário de teste E2E e fechamento do portão da Seção 5 (medição de tempo + verificação viva da hidratação)
- [x] Validador de contraste (catraca com os 4 pares reprovados hoje; token novo que nasça reprovado não está no baseline e reprova)
- [x] Tokens completos (`--success`, `--warning`, `--info` e `-foreground`, escala tipográfica, espaçamento, raio)
- [x] `QueryBoundary` com skeleton, empty e error obrigatórios (três dos 5 estados; hover/foco é do lint de a11y e da galeria)
- [x] Componentes que carregam decisão de produto (novos: `EmptyState`, `CurrencyInput`, `ErrorBoundary`, `DataTable`, `FormField`; endurecidos: `AlertDialog`, `DropdownMenu`, `Skeleton`)
- [x] Galeria `/dev/componentes`
- [x] Acessibilidade por ferramenta (catracas `tabindex_negativo` em 5 e `hover_sem_focus` em 8 + axe na galeria, zero violação)
- [x] Code splitting (`next/dynamic` nas telas pesadas; remoção das 4 dependências não usadas; `@types/react-big-calendar` para `devDependencies`)
- [x] Quebra dos arquivos grandes (`MainBudgetArea` 634, `dashboard/page` 593, `AppShell` 569, `ProjectWizard` 551 — alvo ~250, nenhum acima de 400)

> Nota da Tarefa 5 (10/09/2026, **reescrita na revisão final da seção** — ver a
> correção ao final): os cinco componentes novos (`EmptyState`,
> `CurrencyInput`, `FormField`, `ErrorBoundary`, `DataTable`) e os três
> endurecimentos saíram como o brief previa. Dois cenários de teste expuseram
> comportamento de biblioteca que ninguém conhecia, e a investigação dos dois
> terminou concluindo que **o defeito estava no teste, não no componente**:
>
> 1. **`Intl` formata moeda em pt-BR com espaço não-quebrável (U+00A0), não
>    com espaço comum.** `Intl.NumberFormat("pt-BR", { style: "currency",
>    currency: "BRL" })` separa `R$` do número com ` `, então `"R$ 123,45"`
>    escrito com espaço comum **nunca** bate com o formatado, apesar de os dois
>    serem idênticos na tela. Isso é o formato tipograficamente correto — evita
>    que símbolo e valor quebrem em linhas diferentes —, e
>    `dashboard/components/format.ts` já exibe o mesmo caractere hoje via
>    `toLocaleString` (a Tarefa 9 desta mesma seção moveu o formatador para lá;
>    `dashboard/page.tsx` hoje tem zero ocorrências —
>    `grep -c toLocaleString ArchSmart-web/src/app/\(dashboard\)/dashboard/page.tsx`
>    sai `0`). **`currency-input.tsx`
>    não normaliza nada**: o `Intl` é a fonte de verdade, e quem compara a
>    string exibida compara com o U+00A0 de fato emitido (o teste usa um escape
>    `\u00A0` explícito, com o porquê em comentário). O JSDoc do componente diz
>    isso em voz alta, para o próximo não "consertar" de novo.
> 2. **`AlertDialogContent` sem `AlertDialogCancel` não foca nada.** O default
>    do Radix (`@radix-ui/react-alert-dialog@1.1.15`) previne o autofoco do
>    `FocusScope` e tenta focar a ref interna do `Cancel` — sem um
>    `AlertDialogCancel` na árvore essa ref é `null`, e como o
>    `preventDefault()` já rodou, o fallback do próprio `FocusScope` (focar o
>    primeiro elemento focável) nunca dispara. **Nenhuma linha de
>    `alert-dialog.tsx` mudou nesta seção** (`git diff 24f4eb5..dafe1b3 --
>    ArchSmart-web/src/components/ui/alert-dialog.tsx` sai vazio): os 10 usos
>    reais de `AlertDialogContent` em `src/` têm `Cancel` — a galeria era a
>    única exceção, corrigida na revisão que fechou esta seção
>    (`grep -rl "AlertDialogContent" ArchSmart-web/src --include=*.tsx | grep -v
>    "components/ui/alert-dialog.tsx" | grep -v "__tests__" | xargs grep -L
>    "AlertDialogCancel"` sai vazio, ou seja, nenhum dos 10 fica sem `Cancel`)
>    —, então o cenário não ocorre em produção, e o fixture do teste passou a
>    refletir o uso real. O
>    achado do Radix ficou preservado em comentário no teste.
>
> Os outros dois hardenings (`min-h-11` no `DropdownMenuItem`,
> `aria-hidden="true"` no `Skeleton`) foram só o que o brief já previa.
> `cores_literais` continua em **518** (`python tools/catraca.py`).
>
> > **Correção da revisão final (10/09/2026): esta nota descrevia código que
> > não existe.** A primeira versão dela afirmava que o U+00A0 fora "corrigido
> > normalizando para espaço comum dentro do próprio componente" e que houvera
> > uma "correção em `alert-dialog.tsx`". As duas coisas chegaram a existir na
> > Rodada 1 da Tarefa 5 e foram **revertidas** no mesmo dia, no commit
> > `ad94040` ("revert maquiagem de teste na Tarefa 5"), porque nenhuma das
> > duas era conserto de defeito real: eram produção alterada para satisfazer
> > teste que descrevia cenário irreal (moeda comparada com espaço comum;
> > diálogo sem `Cancel`). O revert não tocou o `PROGRESS.md`, e a nota
> > sobreviveu descrevendo o mundo anterior a ele por 29 commits. Fica aqui
> > como erro visível e corrigido, não apagado — é o modo de falha que este
> > repositório mais repete: **texto que descreve a intenção, não a medição**,
> > e que só cai quando alguém tenta usar o que ele afirma.

> Nota da Tarefa 7 (10/09/2026): a primeira medição de `hover_sem_focus` saiu
> **5**, não 8 como a spec/brief previa. `RE_GROUP_HOVER = r"\bgroup-hover:"`
> só casava o grupo "anônimo" do Tailwind, não o grupo nomeado
> (`group-hover/nome:`), e três das oito linhas do grep de substring do brief
> usam grupo nomeado (`MainBudgetArea.tsx:363,408,502` — `group-hover/opt:`,
> `group-hover/prod:`, `group-hover/edit:`). Registrado como medido (5), não
> forçado para 8, e trazido para revisão em vez de decidido sozinho.
>
> **Rodada 1 de correção (10/09/2026): a régua foi ampliada, e o baseline
> passou de 5 para 8.** Gravar 5 seria gravar uma régua cega — as três linhas
> que escapavam são o mesmo defeito de acessibilidade das outras cinco, e
> ficariam invisíveis para sempre, além de uma violação nova escrita com grupo
> nomeado não ser pega. `RE_GROUP_HOVER` passou a aceitar `group-hover/<nome>:`
> e, por simetria, `RE_FOCUS` passou a aceitar as formas nomeadas do escape de
> foco (`group-focus/<nome>:`, `focus-within/<nome>:` etc.) — sem isso, o
> conserto de uma linha usando grupo nomeado viraria falso positivo, o mesmo
> problema que `toast.tsx:80` já tinha ensinado. Nenhuma forma nomeada de foco
> existe hoje no código (`grep -rnE "(group|peer)-focus(-within)?/[A-Za-z0-9_-]+:"
> ArchSmart-web/src --include=*.tsx` sai vazio) — a régua só previne o
> problema antes de existir. **O `hover_sem_focus` subiu de 5 para 8 porque a
> régua passou a enxergar mais, não porque o código piorou** — registrado com
> `--aceitar-piora`, com o aviso impresso na saída do comando; não é
> regressão. Detalhe e comandos em
> `.superpowers/sdd/2026-09-09-secao-6-camada-de-ui/task-7-report.md`.
>
> O axe rodou sobre a `Galeria` e **nasceu com zero violações** — nenhum
> conserto de componente foi necessário; a única regra desligada foi `region`,
> exatamente como o brief já prescrevia (fragmento, não documento), e a sanity
> check confirmou que o axe reporta violação de verdade quando existe (`<img>`
> sem `alt` no mesmo ambiente jsdom).

> Nota da Tarefa 8 (10/09/2026): `react-icons`, `embla-carousel-react`,
> `react-easy-crop` e `vaul` saíram de `package.json` — 0 imports em
> `src/**/*.{ts,tsx}` (grep medido) para as quatro, e nenhum `drawer.tsx`/
> `carousel.tsx` do shadcn que dependesse delas. `@types/react-big-calendar`
> foi para `devDependencies`. `next/dynamic` entrou em três arquivos
> (calendário, construtor de apresentação e os dois modais pesados da
> Biblioteca) — `grep -rn "next/dynamic" src --include=*.tsx | wc -l` sai 3.
> **O calendário não precisou de `ssr: false`**: o brief previa como
> candidato mais provável, mas `npm run build` prerenderizou `/calendar`
> como estático (`○`) sem erro tanto com quanto sem essa opção — sem um erro
> real para justificar, a opção ficou de fora, e o ganho de code splitting já
> aparece: o CSS de `react-big-calendar` (antes embutido na rota) saiu num
> chunk assíncrono próprio, carregado só quando o componente monta. Detalhe
> completo em
> `.superpowers/sdd/2026-09-09-secao-6-camada-de-ui/task-8-report.md`.
> `cores_literais` continua em **518** (`python tools/catraca.py`).

> Nota da Tarefa 9 (10/09/2026): os quatro maiores arquivos do front foram
> quebrados em 29 arquivos novos, e nenhum dos quatro passa de 273 linhas:
> `MainBudgetArea` 634 → **45**, `dashboard/page` 593 → **142**, `AppShell`
> 569 → **128**, `ProjectWizard` 551 → **273**. A catraca ganhou a medida
> `arquivos_acima_de_400` — **lista**, não contagem, para dizer *qual* arquivo
> cresceu — registrada em 12 e fechada em **8**. Os oito que restam são de
> propósito: `BuilderClient` (529) e `PortalBudget` (517) estão fora do escopo
> desta seção, e os outros seis (464 a 434) nunca estiveram nela.
>
> **A regra desta tarefa foi mover, nunca reescrever, e a defesa foi
> caracterizar antes.** Cada um dos quatro ganhou um teste de caracterização
> escrito *antes* da quebra, que precisava passar na primeira execução, e que
> passou de novo depois **sem edição de assertiva**: 10 (AppShell), 13
> (dashboard), 12 (ProjectWizard) e 15 (MainBudgetArea) casos — a suíte foi de
> **93 testes em 15 arquivos** para **143 em 19**.
>
> > Correção da Rodada 1 (10/09/2026): a primeira versão desta nota dizia "de
> > 103 em 16", que é o estado **depois** do primeiro commit desta tarefa, não
> > o ponto de partida. Número afirmado sem medição. Os dois medidos:
> > `git ls-tree -r --name-only c8d2ae2 -- ArchSmart-web/src | grep -E "\.(test|spec)\.(ts|tsx)$" | wc -l`
> > → 15 arquivos, e a suíte rodada sem os quatro arquivos de caracterização
> > desta tarefa (`npx vitest run --exclude` para cada um) → `Test Files 15
> > passed (15)`, `Tests 93 passed (93)`.
>
> Para provar que a quebra foi mesmo só
> mudança de endereço, cada arquivo teve a comparação linha a linha entre o
> antigo e os novos: `AppShell`, `dashboard/page` e `ProjectWizard` **não
> perderam nenhuma linha**; `MainBudgetArea` perdeu exatamente duas —
> `{item.options.length > 1 && (() => {` e `})()}` —, a IIFE que virou
> `<BudgetItemOptionToggles />` com a mesma guarda.
>
> **As três medidas-detector ficaram onde estavam**, que era o combinado:
> `hover_sem_focus` **8** (as três linhas de `group-hover/<nome>:` de
> `MainBudgetArea` foram para três arquivos diferentes, intactas),
> `cores_literais` **518** e `eslint_erros` **85**. O eslint chegou a subir para
> 86 numa versão intermediária, porque a prop nova `product` de
> `BudgetItemProductCell` tinha sido anotada `any`; passou a reusar
> `ItemOption["product"]` do `BudgetProvider` e voltou a 85 — a catraca pegou
> antes do commit.
>
> Dois achados que **não** foram corrigidos de passagem, por serem mudança de
> comportamento: `BudgetItemsList` pega o roteador com
> `require("next/navigation")` em vez de import (o teste precisa entregar o
> roteador pelo `AppRouterContext`, porque `require` não passa por `vi.mock`), e
> as três etapas do `ProjectWizard` ficam **todas** no DOM o tempo todo — o que
> muda por etapa é a classe `hidden`. Os dois são da Seção 8. Detalhe completo
> em `.superpowers/sdd/2026-09-09-secao-6-camada-de-ui/task-9-report.md`.

> **Revisão final da branch (10/09/2026) — onda única de correção, antes do
> merge.** Não é tarefa nova: é o que a revisão por tarefa não podia ver,
> porque só aparece olhando a branch inteira. O que mudou:
>
> - **`PROGRESS.md` descrevia código revertido.** A nota da Tarefa 5 acima
>   afirmava uma normalização do U+00A0 e uma correção em `alert-dialog.tsx`
>   que o commit `ad94040` tinha revertido no mesmo dia. Reescrita, com a
>   reversão registrada como reversão.
> - **O `empty` do `QueryBoundary` era letra morta para o formato deste
>   repositório.** O critério padrão só reconhecia array; a camada de dados da
>   Seção 5 devolve `{items, total, page, size, pages}`. Toda tela paginada da
>   Seção 8 que esquecesse o `isEmpty` (opcional) renderizaria a lista vazia em
>   vez do estado vazio, sem erro de tipo, sem lint e sem teste.
> - **A única mudança visual não intencional da branch.** `LibraryContent`
>   renderiza o `BatchNormalizeModal` incondicionalmente, e a Tarefa 8 o tornou
>   `dynamic()` com `loading: () => <Skeleton className="h-64 w-full" />` — um
>   bloco cinza de 256px no fluxo da página, com o modal fechado. O `loading`
>   de modal e de sheet passou a ser `() => null`.
> - **A terceira cegueira da catraca, na mesma função das duas anteriores.**
>   `comparar()` percorre `medido`: uma chave que existisse no baseline e
>   sumisse da medição nunca era visitada — portão verde e **mudo**. Agora
>   reprova, e `eslint_erros` sem `--eslint-json` aparece como `PULADA`, com o
>   motivo, em vez de sumir da saída.
> - **A seção não tinha deixado documentação.** `git diff --name-only
>   24f4eb5..dafe1b3 -- docs/` devolvia só os três arquivos de medição. Nasceu
>   [`docs/dev/componentes.md`](docs/dev/componentes.md), escrito para quem vai
>   **usar** a biblioteca — incluindo o ponto cego de cada catraca de UI.
> - Menores: `FormField` passou a injetar o `id` no campo (rótulo órfão em
>   silêncio era o modo de falha); `DataTable` volta à primeira página quando a
>   lista ou a ordem mudam, e ganhou acento em "Página"/"Próxima"; o teste de
>   `arquivos_acima_de_400` deixou de afirmar `len(...) == 8`, que reprovaria
>   por **melhoria**; e a asserção de marca em `app-shell.test.tsx` passou a
>   montar a grafia errada em vez de escrevê-la — era a última ocorrência dela
>   no repositório, e fazia o comando documentado no `CLAUDE.md` devolver 1.
>
> **Uma instrução da revisão não se confirmou, e foi medida em vez de
> repetida:** ela dizia que o teste do `DataTable` usa `/proxima/i` e
> "continua passando" com a copy acentuada. Não continua — regex compara
> codepoint a codepoint, e `i` ignora caixa, não diacrítico. Visto vermelho,
> a regex ganhou o acento e o que o teste verifica não mudou.
>
> As 9 medidas da catraca ficaram **iguais ao baseline** (nenhuma piorou,
> nenhuma melhorou). Relatório completo em
> `.superpowers/sdd/2026-09-09-secao-6-camada-de-ui/final-fix-report.md`.


## Seção 7 · Telemetria
**0/5 (0%)** `░░░░░░░░░░░░░░░░░░░░`

> **Desenho aprovado em 10/09/2026**, antes de existir plano de execução:
> [`docs/superpowers/specs/2026-09-10-secao-7-telemetria-design.md`](docs/superpowers/specs/2026-09-10-secao-7-telemetria-design.md).
> Ele corrige três pontos da spec de 23/08 que não sobrevivem ao código de hoje
> — a rota, as colunas de token e a suposição de que o `screen_viewed`
> automático cobriria alguma tela — e a spec original foi corrigida no mesmo
> commit, com o texto antigo preservado e a correção logo abaixo dele.
>
> **A caixa da rota mudou de nome, e o motivo já estava escrito aqui.** Ela
> dizia `POST /api/v1/events`, copiado da spec. A nota da Seção 4, mais acima,
> avisava que a Seção 7 carregava a mesma suposição de um prefixo `/api/v1` que
> não existe, e que o [ADR 0008](docs/dev/decisoes/0008-me-em-api-users-me.md)
> já tinha decidido isso para a reestruturação inteira. O que faltava decidir
> era só o resto do nome: `telemetry`, porque `/api/events` já é a Agenda.
>
> **As duas pendências herdadas da Seção 6 foram decididas por Thiago em
> 10/09/2026**, como o [`CLAUDE.md`](CLAUDE.md) exige de quem escreve este
> plano — uma virou tarefa, a outra virou decisão registrada:
>
> - **As três mudanças visuais que ninguém viu** entram como a Tarefa 1. Depois
>   que a Seção 8 reescrever essas telas por cima, fica impossível saber o que
>   causou o quê.
> - **A credencial do usuário E2E** (`ana.arquiteta@seed.arqsmart.local`) **não
>   será rotacionada — risco aceito por escrito.** É conta de seed em staging,
>   sem dado de cliente, e
>   [`docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md`](docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md)
>   ensina a recriar o usuário do zero se um dia for preciso.

- [ ] Verificação visual do que a Seção 6 mudou e ninguém olhou
- [ ] Tabela `product_events` e serviço `track(ctx, evento, propriedades)`
- [ ] Tabela `ai_usage_logs` (`account_id`, `model_name`, `input_tokens`/`output_tokens`/`token_count`, `cost_usd`, `latency_ms`, `feature`)
- [ ] `POST /api/telemetry/events` com `account_id`/`user_id` do contexto
- [ ] `useTrack()` e `screen_viewed` automático no shell

## Seção 8 · Migração das telas
**0/9 (0%)** `░░░░░░░░░░░░░░░░░░░░`

> Cada tela migrada aqui converte também as **cores literais** e as **imagens**
> dela — decidido em 09/09/2026, no desenho da Seção 6: é uma passada por tela,
> não duas. São 521 cores em 39 arquivos e 25 `<img>` (medido em 09/09/2026).
> Não são caixas próprias; são parte da migração de cada tela.

> **Pendência de Art. 8 que a Tarefa 9 da Seção 6 encontrou e não corrigiu de
> passagem (10/09/2026):** o Orçamento usa um evento de janela com a marca
> grafada errada, `archsmart:budget_updated`. Não é copy que o usuário lê, mas é
> `archsmart` em código, o que o Art. 8 proíbe. Ficou de fora da Tarefa 9 porque
> nome de evento é **contrato entre emissor e ouvinte**: renomear exige mexer nos
> dois lados no mesmo commit, e a tarefa era mover, não reescrever. Quem migrar o
> Orçamento renomeia — e mede antes, em vez de confiar numa lista fixa aqui, que
> envelhece:
>
> ```
> grep -rn "archsmart:" ArchSmart-web/src
> ```
>
> Em 10/09/2026 isso saía **4 ocorrências em 3 arquivos** (o ouvinte em
> `BudgetSummaryFooter`, e dois emissores — `BudgetItemsList` e
> `ProductPickerModal`). Renomear só os emissores quebra o rodapé de totais em
> silêncio: ele para de recalcular e ninguém vê erro nenhum.

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
