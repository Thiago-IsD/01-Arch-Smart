# Progresso — Reestruturação da Plataforma Arq Smart

> O número abaixo é **calculado, não digitado**: `tools/progresso.py` lê as caixas
> marcadas neste arquivo e recomputa as porcentagens. Depois de marcar ou
> desmarcar uma tarefa, rode `python tools/progresso.py --write` para
> regenerar. Para conferir que este arquivo não divergiu das caixas — o que a
> Seção 3 liga no CI — rode `python tools/progresso.py --check`; ele sai com
> código 1 e imprime a diferença se algo estiver errado.

**Progresso geral: 36/63 (57%)**
`███████████░░░░░░░░░`

_Última atualização: 2026-09-06_

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

> ## 🚧 O PORTÃO DA SEÇÃO ESTÁ ABERTO — leia isto antes de começar a Seção 6
>
> **A Seção 5 fechou as 8 caixas acima, mas a medição que a spec exige como
> confirmação de "ganho" não foi feita.** A spec é explícita: *"Só com o
> ganho confirmado ligam-se os lints e migra-se o resto."* Essa comparação de
> tempo — a única coisa que provaria "mais rápido" — não pôde rodar neste
> ambiente: faltam credenciais de um usuário real (`E2E_EMAIL`/`E2E_PASSWORD`,
> vazias) para o teste de Playwright e para a checagem de hidratação ao vivo
> no navegador. Confirmado, com o comando:
>
> ```
> cd ArchSmart-web
> npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line
> # → 1 failed: "E2E_EMAIL e/ou E2E_PASSWORD não estão definidos no ambiente."
> ```
>
> Isto **não é** "o ganho não apareceu" (medição rodou, número não desceu) —
> é "a medição não rodou". O que existe em
> [`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`](docs/dev/medicoes/2026-09-06-biblioteca-depois.md)
> é evidência **estrutural** (leitura de código, contagens estáticas — a
> arquitetura mudou na direção certa, por construção), nunca medição de
> tempo. Aquele documento também tem o comando exato que fecha o portão,
> assim que a credencial existir.
>
> **A Seção 6 não deveria começar apoiada nesta seção até esse número
> existir.** Decisão de Thiago, não de quem executa a Seção 6.

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
> 8. **Art. 8 violado em 43 ocorrências, 27 arquivos, e não corrigido de
>    propósito.** `grep -rn 'Arch Smart' ArchSmart-web/src --include=*.tsx --include=*.ts | wc -l`
>    → **43**. A marca aparece sem o Q em copy de usuário final: landing,
>    login, cadastro, recuperação de senha, reset de senha, preços, portal do
>    cliente e `layout.tsx`. **Deliberadamente não corrigido nesta seção**:
>    27 arquivos de copy dentro de um diff de camada de dados seriam
>    exatamente o "migrar de passagem" que o `CLAUDE.md` da raiz proíbe, e
>    misturariam duas mudanças que não têm nada a ver uma com a outra. Fica
>    para um commit mecânico próprio — decisão de Thiago, não desta seção.

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
