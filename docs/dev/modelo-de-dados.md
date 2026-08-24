# Modelo de dados

Como as 26 tabelas de `ArchSmart-api/app/models/all_models.py` (467 linhas,
um arquivo único) se relacionam e por quê, para quem vai planejar ou revisar
mudança de schema. Não é um dump de `\d+` — o Postgres já sabe as colunas; o
que este documento registra é a razão de cada relação e o que quebra se ela
mudar.

**Consumidor direto: a Seção 4**, que usa a classificação de `account_id` e
os caminhos até a conta (final deste documento) para planejar a migração de
`account_id`/`created_by`/índices. Se um caminho aqui estiver errado, o
backfill que a Seção 4 escrever a partir dele erra junto.

Descreve o **estado atual**, 24/08/2026. `ScopedRepository`, `created_by` e
índice em `account_id` **não existem** hoje — são entregues pela Seção 4;
onde aparecem abaixo é para dizer que faltam, nunca como se já estivessem no
código.

## 1. Conta e identidade

### `accounts`

O tenant. Toda tabela "com dado de cliente" no restante do documento quer
dizer, precisamente, "tem uma linha de `accounts` dona dela, direta ou por
cadeia de FK". `is_active` é soft delete — não há hoje nenhum job que apague
fisicamente uma conta.

### `users`

Um usuário sempre pertence a exatamente uma conta (`account_id` `NOT NULL`).
Não existe usuário multi-conta hoje — trocar de escritório significa outro
usuário, outro login. `supabase_id` é o elo com o Supabase Auth (a senha não
mora aqui, ver `docs/dev/arquitetura.md#como-a-identidade-é-resolvida`);
`email` e `supabase_id` são as duas únicas colunas com `unique=True` que
também têm índice — não por acaso, são as duas usadas para resolver
identidade em toda requisição (`get_current_user`, `app/api/users.py`).

### `subscriptions` e `plans`

`Subscription` é 1:1 com `Account` (`uselist=False` no lado de `Account`,
embora nada no banco impeça duas linhas — a garantia é só de aplicação, como
em `budgets` abaixo). Ela aponta para um `Plan`, que é **catálogo global**:
`Plan.limits` (JSON) define cotas por plano ("Solo", etc.), e o mesmo `Plan`
é reaproveitado por todas as contas que estão naquele plano — não há
`account_id` em `plans` porque um plano não pertence a conta nenhuma, é
oferecido a todas. Confirmado pelo uso real: `app/api/users.py` e
`app/api/endpoints/projects.py` buscam `Plan` por `id` a partir de
`subscription.plan_id`, nunca filtrando por `account_id`.

**O que quebra se mexer:** hoje o *front-end*, não a API, decide o limite de
projetos quando a API não devolve o campo esperado
(`const planLimit = data?.plan_limit ?? 2`) — pendência já registrada em
`convencoes.md`, não deste documento. `Subscription.status` é um `Enum`
Postgres de verdade (`SubscriptionStatus`); mudar os valores do enum Python
sem migração de banco quebra a leitura de linhas existentes com o valor
antigo.

## 2. Projeto

### `projects`

Núcleo do produto: `account_id` `NOT NULL` e `client_id` `NOT NULL` — todo
projeto exige um cliente já cadastrado antes de existir, não há projeto
"sem cliente ainda". `status`, `payment_method` e `service_type` são
`String` livre, não `Enum` de banco — ao contrário de `Subscription.status`
ou `PresentationStatus`, um valor inválido nessas colunas não é barrado pelo
Postgres, só pelo código que escreve nelas.

### `clients`

Cliente final do escritório (a pessoa/empresa para quem o projeto é feito) —
não confundir com "conta" (o escritório) nem com o portador do JWT. Tem
`account_id` próprio porque a carteira de clientes é o ativo do escritório: o
mesmo cliente pode ter vários projetos (`Client.projects`), mas nunca
atravessa conta.

### `environments`

Um cômodo/ambiente de um projeto (`project_id` `NOT NULL`; sem `account_id`
próprio — ver seção de caminhos até a conta). `type` (ex.: "Interna/Seca") é
`String` livre. `environments_count`, usado pelo dashboard, é uma
`@property` do Python sobre `Project.environments`, não uma coluna — não
existe cache dessa contagem no banco.

### `environment_dnas`

Existe **separada** de `Environment` em vez de ser um conjunto de colunas na
própria tabela porque é opcional e tem ciclo de vida próprio: um ambiente
pode existir sem que suas áreas (piso/parede/teto) tenham sido medidas ainda
— `is_complete` marca isso. `environment_id` é `unique=True` (garante 1:1 de
verdade, ao contrário do par `Budget`/`Project` abaixo) e a FK tem
`ondelete="CASCADE"`: apagar o ambiente apaga o DNA junto, sem passo manual.
`app/services/budget_calculator.py` lê `floor_area`/`wall_area`/`ceiling_area`
daqui para calcular quantidade de itens de orçamento do tipo `FLOOR`/`WALL`/
`CEILING` — se não houver DNA, o cálculo assume área zero em vez de falhar
(linha 56-63 do serviço).

## 3. Biblioteca de produtos

### `products`

Produto capturado de loja (Web Clipper), do Shopping Hub, ou cadastrado à
mão — `account_id` `NOT NULL`: a biblioteca é do escritório, nunca
compartilhada entre contas. `origin_id` e `state_id` apontam para as duas
tabelas de catálogo abaixo.

### `product_origins` e `product_states`

Catálogos **globais**, não dado de conta. Cada um tem só uma dúzia de linhas
possíveis (uma por valor do enum Python correspondente —
`ProductOriginType`: `WEB_CLIPPER`/`SHOPPING_HUB`/`MANUAL`/`CATALOG`;
`ProductStateStatus`: `CAPTURED`/`NORMALIZED`/`INACTIVE`/`ACTIVE`/`ARCHIVED`/
`DELETED`) e existem como tabela — em vez de o enum morar direto em
`products.origin` — porque o modelo original queria um `name` de exibição
independente do valor do enum. Na prática, o código nunca filtra essas
tabelas por conta: `app/api/routers/product_router.py` e `tools/seed_products.py`
sempre buscam por `type`/`status` (`db.query(ProductOrigin).filter(ProductOrigin.type == ...)`)
e **criam a linha se não existir** — é o padrão "singleton global por valor
de enum", não um catálogo por escritório. Não precisam de `account_id`.

**O que quebra se mexer:** como a busca é sempre por `type`/`status` e nunca
por `id` fixo, criar uma segunda linha com o mesmo `type` (dois clipper
"origin" diferentes, por exemplo) faz `.first()` escolher uma das duas de
forma não determinística — o código não tem proteção contra isso hoje além
de "só cria se não achar nenhuma".

## 4. Orçamento

### `budgets`

Um orçamento por projeto (`project_id` `NOT NULL`). A relação 1:1 com
`Project` é **só de aplicação** — não há `unique=True` em `budgets.project_id`
nem no banco; o padrão "get or create" em `app/api/routers/budgets_router.py`
(`db.query(Budget).filter(Budget.project_id == project_id).first()`, cria se
não achar) é o único motivo de nunca existirem duas linhas hoje. Nada no
schema impede uma segunda inserção direta. `total_value` **não é fonte de
verdade persistida**: é recalculado e sobrescrito a cada `GET` do orçamento,
somando `preço × quantidade` só das opções com `is_selected=True` — ler essa
coluna fora desse endpoint pode pegar um valor desatualizado.

### `budget_items`

Uma linha de orçamento (ex.: "piso da sala"), presa a um `Budget`
(`budget_id` `NOT NULL`, `ondelete="CASCADE"`) e **opcionalmente** a um
`Environment` (`environment_id` nulável). A opcionalidade existe porque
`rule_type` tem dois regimes de cálculo diferentes
(`app/services/budget_calculator.py`): itens `FLOOR`/`WALL`/`CEILING`
precisam do `EnvironmentDNA` do ambiente para saber a área base; itens `UNIT`
usam `manual_quantity` direto, sem depender de área de ambiente nenhum — daí
o item não *precisar*, estruturalmente, de um ambiente. Na prática, hoje o
único endpoint de criação (`POST /budgets/items`,
`app/schemas/budget_schema.py::BudgetItemCreate`) exige `environment_id`
obrigatório no payload — a coluna é mais permissiva no banco do que a API
permite hoje; é o serviço de cálculo, não o endpoint de criação, que trata o
caso nulo.

### `item_options`

Existe em vez de `Product` pendurar direto em `BudgetItem` porque um item de
orçamento pode ter **mais de uma opção de produto concorrendo** — o comentário
do próprio código chama isso de "Variant A/B"
(`app/api/routers/budgets_router.py`, função de exclusão de opção). Cada
opção carrega seu próprio fluxo de aprovação pelo cliente
(`is_selected`, `approval_status`, `rejection_reason` — usados em
`app/api/endpoints/public.py` quando o cliente aprova ou rejeita uma opção no
portal). `product_id` é nulável porque a opção pode ser criada antes de um
produto ser escolhido para ela (`item_options` sobrevive como placeholder de
variante enquanto o produto é decidido). `ondelete="CASCADE"` a partir de
`budget_items`: apagar o item apaga as opções junto.

**Caminho até a conta, confirmado no próprio código** — a função
`buscar_item_da_conta` (`app/api/routers/budgets_router.py:19-23`) já
documenta isso em comentário: *"O caminho ate a conta e: BudgetItem ->
Budget -> Project -> account_id"*; a função seguinte no mesmo arquivo,
`buscar_opcao_da_conta` (linhas 38-45), faz o mesmo `JOIN` com mais um salto
para `item_options`.

## 5. Apresentação ao cliente

### `presentations`

Uma apresentação é um recorte do projeto para mostrar ao cliente final —
`project_id` `NOT NULL`, `name` `NOT NULL`. Tem vida própria e independente
do projeto: `status` (`DRAFT`/`PUBLISHED`/`ACCEPTED`/`REVISION_REQUESTED`,
`Enum` de banco) controla um fluxo de revisão, e `access_password_hash`
(hash bcrypt) protege o acesso do portal público (`/portal/[uuid]` no
front), que não usa o mesmo login do arquiteto — é a rota de acesso do
**cliente final**, sem sessão Supabase.

### `presentation_environments`

Por que não simplesmente reaproveitar `environments`? Porque uma apresentação
mostra um **subconjunto curado** dos ambientes do projeto, cada um com
conteúdo próprio para o cliente (`title`, `subtitle`, `description`,
`image_urls`) que não existe em `Environment` — o ambiente interno pode se
chamar "Suíte 2" e a apresentação mostrar "Seu novo quarto principal", com
fotos escolhidas para aquele envio. `is_visible` permite esconder um ambiente
da apresentação sem apagar a linha. Criada ao espelhar os ambientes do
projeto no momento em que a apresentação é gerada
(`app/api/endpoints/presentations.py`, linha 97).

### `presentation_acceptances`

Registro de aceite do cliente — 1:1 com `Presentation`
(`cascade="all, delete-orphan"` no lado de `Presentation`), com `client_ip` e
`selected_options_snapshot` (JSON): uma cópia congelada do que foi aceito no
momento do aceite, para não depender de `item_options` mudarem depois e
alterarem retroativamente o que o cliente assinou.

### `presentation_comments`

Canal de comentário entre cliente e arquiteto dentro de uma apresentação
(`author_type`: `'CLIENT'` ou `'ARCHITECT'`, `String` livre — não `Enum`).
Existe separado de `presentation_acceptances` porque um comentário não é um
aceite/rejeição formal — é conversa solta durante a revisão, sem efeito no
`status` da apresentação por si só.

**O que quebra no agregado inteiro:** todas as quatro tabelas acima só têm
`presentation_id`/`environment_id`, nunca `account_id` — o isolamento por
conta em `app/api/endpoints/presentations.py` é feito, em toda rota, com
`.join(Project, Presentation.project_id == Project.id).filter(Project.account_id == current_user.account_id)`,
repetido linha a linha (a comparação `Project.account_id == current_user.account_id`
aparece 12 vezes no arquivo). Um
`JOIN` esquecido em uma rota nova deste agregado é, hoje, a única coisa que
impede vazamento entre contas aqui — é exatamente o problema que a Seção 4
resolve com `ScopedRepository`.

## 6. Financeiro

### `financial_entries`

Lançamento financeiro (receita/despesa) da conta. `account_id` `NOT NULL`;
`project_id` **nulável** — nem todo lançamento é de um projeto (despesa de
escritório, por exemplo). `group_id` (indexado — uma das 4 colunas com
índice do modelo inteiro) e `installment_number` agrupam parcelas/lançamentos
recorrentes que nascem juntos e precisam ser editados/consultados como
conjunto. `updated_at` é a única coluna do modelo inteiro com `onupdate`.

## 7. Operacional

### `events`

Compromisso de agenda (`app/api/endpoints/events.py`). `account_id`
`NOT NULL`, `project_id` nulável — evento pode ou não estar ligado a um
projeto. `google_event_id` é campo morto hoje: comentário no próprio modelo
diz "Preparação para Google Calendar OAuth" — não existe integração com
Google Calendar no código atual, só a coluna reservada para quando existir.

### `notifications`

Notificação in-app da conta (`account_id` `NOT NULL`). Usada por
`app/api/endpoints/public.py` para avisar o escritório quando o cliente faz
algo no portal (comenta, aceita, rejeita uma opção) — é o único consumidor
confirmado hoje.

### `admin_logs`

Log de auditoria (`account_id` + `user_id`, ambos `NOT NULL`) — mas **sem
nenhum consumidor no código hoje**: só é declarada em `all_models.py`;
nenhuma rota ou serviço em `app/api`/`app/services` cria uma linha de
`AdminLog`. É tabela de schema pronta para um recurso de auditoria que ainda
não foi ligado a nenhum evento real.

### `documents`

Tabela de RAG/knowledge base com `embedding Vector(1536)` (pgvector) — ver
seção dedicada abaixo. **Sem `project_id` nem `account_id`, e sem nenhum
consumidor em `app/`**: nem `app/api` nem `app/services` importam ou
consultam `Document` — as únicas referências no repositório são a própria
declaração do modelo, `tools/reset_db.py` (que garante a extensão `vector` no
banco) e a suíte de testes. A migração que a criou
(`alembic/versions/9f8a3b2c1d4e_add_documents_table.py`) também cria uma
função SQL `match_documents(...)` para busca por similaridade — um artefato
típico de template inicial de RAG com Supabase, não uma feature em uso pelo
produto hoje. Sem FK para nada, não há como determinar um "caminho até a
conta" — se esta tabela ganhar um dono (conta ou projeto) é decisão de
produto, não uma inferência que este documento possa fazer a partir do
código.

### `leads`

Captura de lead do site institucional, **antes** de existir uma conta —
`account_id` é nulável de propósito: `app/api/leads.py` cria o lead
explicitamente com `account_id=None  # Pre-registration`. Não é uma tabela
"esquecida sem account_id", é uma tabela cujo dado por natureza começa sem
conta.

### `legal_acceptances`

Aceite de termos legais, ligado a um `Lead` (`lead_id` nulável) ou a uma
conta já criada (`account_id` nulável, mesmo raciocínio de `leads`: aceite
pode acontecer antes do cadastro virar conta). **Sem nenhum consumidor no
código hoje** — declarada no modelo, nunca instanciada em `app/api` ou
`app/services`. Provavelmente destinada ao fluxo de compliance/LGPD ainda não
implementado.

### `project_slots`

Reserva de "vaga" de projeto dentro do limite do plano da assinatura
(`subscription_id` `NOT NULL`, `project_id` nulável — uma vaga pode existir
reservada antes de ter projeto atribuído). **Sem nenhum consumidor no código
hoje**: só existe na migração inicial (`5de7aae8c076_create_mvp_schema.py`) e
no modelo — nenhuma rota cria, lê ou libera uma vaga. A validação de limite
de projeto por plano que existe hoje (`app/api/users.py`,
`app/api/endpoints/projects.py`) é feita contando `Project` diretamente, sem
passar por `project_slots`.

## Tabelas sem `account_id` — classificação e caminho até a conta

Das 26 tabelas, 11 têm `account_id` direto: `admin_logs`, `clients`,
`events`, `financial_entries`, `leads`, `legal_acceptances`, `notifications`,
`products`, `projects`, `subscriptions`, `users`. As 15 restantes:

| Tabela | Classificação | Por quê | Caminho até a conta |
|---|---|---|---|
| `accounts` | É o tenant | N/A — é a própria conta | — |
| `plans` | Catálogo global | Reaproveitado por todas as contas de um mesmo plano; consultado por `id`/nome de plano, nunca por conta (`app/api/users.py`) | N/A |
| `product_origins` | Catálogo global | Uma linha por valor de `ProductOriginType`, criada sob demanda e buscada por `type`, nunca por conta (`product_router.py`, `seed_products.py`) | N/A |
| `product_states` | Catálogo global | Mesmo padrão de `product_origins`, por `ProductStateStatus` | N/A |
| `documents` | Não classificável hoje | Sem FK para `projects` ou `accounts`, sem consumidor em `app/` — scaffolding de RAG não ligado ao produto | Não existe caminho hoje |
| `project_slots` | Precisa de `account_id` | Vaga de projeto é dado da conta dona da assinatura, mesmo sem consumidor no código hoje | `ProjectSlot → Subscription → account_id` (via `subscription_id`, `NOT NULL`; **não** via `project_id`, que é nulável) |
| `environments` | Precisa de `account_id` | Ambiente é dado do projeto da conta | `Environment → Project → account_id` |
| `environment_dnas` | Precisa de `account_id` | Medidas do ambiente | `EnvironmentDNA → Environment → Project → account_id` |
| `budgets` | Precisa de `account_id` | Orçamento é do projeto | `Budget → Project → account_id` |
| `budget_items` | Precisa de `account_id` | Linha de orçamento do projeto (via `budget_id`, sempre presente; **não** via `environment_id`, nulável) | `BudgetItem → Budget → Project → account_id` |
| `item_options` | Precisa de `account_id` | Opção de produto de uma linha de orçamento do projeto | `ItemOption → BudgetItem → Budget → Project → account_id` |
| `presentations` | Precisa de `account_id` | Apresentação é do projeto | `Presentation → Project → account_id` |
| `presentation_environments` | Precisa de `account_id` | Ambiente curado dentro de uma apresentação do projeto | `PresentationEnvironment → Presentation → Project → account_id` |
| `presentation_acceptances` | Precisa de `account_id` | Aceite de uma apresentação do projeto | `PresentationAcceptance → Presentation → Project → account_id` |
| `presentation_comments` | Precisa de `account_id` | Comentário em uma apresentação do projeto | `PresentationComment → Presentation → Project → account_id` |

**Resultado: 10 tabelas guardam dado de conta e não têm `account_id`**
(`project_slots`, `environments`, `environment_dnas`, `budgets`,
`budget_items`, `item_options`, `presentations`, `presentation_environments`,
`presentation_acceptances`, `presentation_comments`); 3 são catálogo global
por natureza (`plans`, `product_origins`, `product_states`); 1
(`documents`) não tem hoje nenhuma relação que permita classificá-la; e
`accounts` é o próprio tenant.

Todos os caminhos de mais de um salto acima (`budget_items`, `item_options`,
`presentation_environments`, `presentation_acceptances`,
`presentation_comments`) foram confirmados contra o `JOIN` que o próprio
código já faz para isolar por conta hoje (`app/api/routers/budgets_router.py`,
`app/api/endpoints/presentations.py`), não deduzidos só a partir do desenho
do schema.

## `created_by`: não existe em nenhuma tabela

Nenhuma das 26 tabelas de `all_models.py` tem coluna `created_by`. Não há
hoje como saber, a partir do banco, qual usuário criou uma linha — só a
conta dona (quando a tabela tem `account_id` ou um caminho até ele). Isso é
alvo da Seção 4.

## Índices: 4 no modelo inteiro, nenhum em `account_id`

Todo o arquivo tem só 4 colunas com `index=True`: `users.email`,
`users.supabase_id`, `financial_entries.group_id` e `documents.id`. Nenhuma
das 11 colunas `account_id` tem índice — e é a coluna mais filtrada em
praticamente toda query do sistema (`filter(Model.account_id == ...)` em
todo endpoint). Nas migrações de `alembic/versions/`, `op.create_index`
aparece 7 vezes ao todo, e nenhuma delas cria índice em `account_id`.
Índice em `account_id` (e nas colunas por onde a Seção 4 fizer o filtro
automático) é alvo da própria Seção 4.

## `Document.embedding`: `Vector(1536)`, exige a extensão `vector`

`Document.embedding` é `Vector(1536)` do `pgvector` (`pgvector==0.4.2` em
`requirements.txt`). Isso exige a extensão `vector` habilitada no Postgres —
`tools/reset_db.py` executa `CREATE EXTENSION IF NOT EXISTS vector` antes de
criar as tabelas, e a migração `9f8a3b2c1d4e_add_documents_table.py` faz o
mesmo. O `try/except ImportError` em `all_models.py`, que cairia para `Text`
se `pgvector` não estivesse instalado, **não entra em jogo** em produção nem
em desenvolvimento normal — só protegeria um ambiente que rodasse Alembic
sem a dependência instalada (comentário no próprio código: "pgvector não
está disponível no ambiente local... O servidor de produção/desenvolvimento
tem o pacote instalado"). Subir um Postgres novo sem a extensão `vector`
quebra a criação desta tabela.

## Onde ler mais

- [`arquitetura.md`](arquitetura.md) — como a identidade e o filtro por
  conta funcionam hoje, e o que a Seção 4 muda.
- [`convencoes.md`](convencoes.md) — regras de nomenclatura de tabela/coluna
  e a proibição de `account_id` recebido do cliente.
- [`../../ArchSmart-api/CLAUDE.md`](../../ArchSmart-api/CLAUDE.md) — onde os
  módulos que leem estas tabelas moram hoje.
