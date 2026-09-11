# Seção 7 — Telemetria (desenho)

**Data:** 10/09/2026
**Estado:** aprovado por Thiago em 10/09/2026, antes de existir plano de execução.
**Relação com a spec das nove seções:** este documento **corrige e detalha** a
[Seção 7 da spec de 23/08/2026](2026-08-23-reestruturacao-arq-smart-design.md).
Onde os dois discordarem, vale este — e a spec foi corrigida no mesmo commit
para não deixar duas versões de pé.

---

## Por que este documento existe

A Seção 7 da spec foi escrita em 23/08/2026, antes das Seções 4, 5 e 6. Ela
descreve quatro entregas em quatro linhas, e três delas não sobrevivem ao
contato com o código de hoje: uma rota que colide com uma tela existente, uma
coluna que não permite calcular o que ela promete, e uma automação que hoje
cobriria zero telas.

Medir primeiro, decidir depois, é a regra da casa. O que segue é o resultado de
medir.

### O que a spec afirmava, e o que a medição de 10/09/2026 diz

| A spec (23/08) | Medido em 10/09/2026 | Comando (da raiz) |
|---|---|---|
| `POST /api/v1/events` | `/api/events` **já existe e é a Agenda** | `grep -n "include_router" ArchSmart-api/app/main.py` |
| — | 14 routers, **0** com `/v1` | `grep -c "include_router" ArchSmart-api/app/main.py` |
| `ai_usage_logs` grava `token_count` | o Gemini cobra entrada e saída a preços diferentes | `sed -n '148,185p' ArchSmart-api/app/services/ai_service.py` |
| — | **1** ponto de chamada de IA em toda a API | `grep -rn "extract_product_data" ArchSmart-api/app --include=*.py` |
| — | 1 modelo, fixo em código: `gemini-2.5-flash` | `grep -n "GEMINI_MODEL" ArchSmart-api/app/services/ai_service.py` |
| `screen_viewed` "sem a tela precisar lembrar" | `QueryBoundary`: **0** telas reais o consomem | `grep -rln "QueryBoundary" ArchSmart-web/src --include=*.tsx` |
| — | react-query: **3** arquivos, de **34** telas | `grep -rl "useQuery" ArchSmart-web/src --include=*.tsx --include=*.ts` |
| — | 26 `__tablename__` | `grep -c "__tablename__" ArchSmart-api/app/models/all_models.py` |
| — | 30 migrações no repositório | `ls ArchSmart-api/alembic/versions/*.py \| wc -l` |

Os dois `grep -rl` acima descontam `__tests__`; o de telas é
`find ArchSmart-web/src/app -name "page.tsx" | wc -l`.

### Três coisas que a spec descreve errado, e que mudam o trabalho

1. **`POST /api/v1/events` colide com a Agenda.** `app/api/endpoints/events.py`
   está montado em `/api/events` e é o calendário — a tela 7 da Seção 8. Seguir
   a spec ao pé da letra deixaria dois `events` diferentes de pé e criaria a
   única rota versionada de uma API com 14 routers sem versão.

2. **`token_count` sozinho não calcula `cost_usd`.** Entrada e saída têm preços
   diferentes. Com um total agregado, o `cost_usd` seria estimativa gravada como
   se fosse medição — exatamente o que o `CLAUDE.md` proíbe, e justamente na
   coluna que a própria spec chama de principal risco de margem.

3. **"Sem a tela precisar lembrar" hoje quer dizer "nenhuma tela".** O
   `QueryBoundary` que a Seção 6 construiu não é consumido por nenhuma das 34
   telas — só pela galeria `/dev/componentes` e por ele mesmo. Quem o adota é a
   Seção 8. Pendurar a medição só nele entregaria uma seção inteira de
   telemetria que não mede nada.

---

## A pauta herdada da Seção 6

O `CLAUDE.md` manda que quem escreve o plano da Seção 7 ponha cada uma das duas
pendências da Seção 6 como tarefa **ou registre por escrito a decisão de não
pôr**. As duas foram decididas por Thiago em 10/09/2026:

1. **As três mudanças visuais que ninguém viu** — vira a **Tarefa 1** desta
   seção. Olhar agora é barato; depois que a Seção 8 reescrever essas telas por
   cima, fica impossível saber o que causou o quê.

   > **Ao medir o tamanho dessa tarefa, o número do `CLAUDE.md` caiu.** Ele
   > dizia "34 itens em 6 telas" de `DropdownMenuItem`. São **14 itens em 6
   > arquivos** — e um dos 6 é a galeria, então **5 telas**. O 34 era contagem
   > de menções: 14 aberturas, 14 fechamentos e 6 imports. Corrigido no
   > `CLAUDE.md` no mesmo commit, com os dois comandos ao lado. É o quinto
   > número deste repositório derrubado por alguém que tentou usá-lo.
2. **A credencial do usuário E2E** (`ana.arquiteta@seed.arqsmart.local`) —
   **risco aceito por escrito, sem rotação.** É conta de seed em staging, sem
   dado de cliente, e
   [o documento de 09/09](../../dev/medicoes/2026-09-09-usuario-de-teste-e2e.md)
   ensina a recriar o usuário do zero se algum dia for preciso.

---

## Decisões de fronteira

### 1. A rota é `POST /api/telemetry/events`

**Metade desta decisão já estava tomada, e não por esta seção.** O
[ADR 0008](../../dev/decisoes/0008-me-em-api-users-me.md) descartou o prefixo
`/api/v1` na Seção 4, quando o `/me` da spec virou `GET /api/users/me`, e a nota
daquela seção no `PROGRESS.md` diz de forma explícita que o ADR vale para a
reestruturação inteira — citando a Seção 7 pelo nome como o próximo lugar que
bateria no mesmo ponto. Bateu.

O que **é** desta seção é o resto do nome: prefixo `telemetry`, porque
`/api/events` já significa Agenda. Sem ele, dois `events` diferentes conviveriam
na mesma API até a Seção 8 migrar o calendário.

A spec de 23/08 foi corrigida no mesmo commit.

### 2. O corpo é sempre um lote

`{"eventos": [...]}` desde o primeiro dia, mesmo que o `useTrack()` desta seção
mande um evento por vez. O contrato já nasce pronto para buffer quando a Seção 8
trouxer volume — e trocar de objeto para array depois significa mexer em
servidor, cliente e testes no mesmo commit.

**Não haverá buffer nesta seção.** Buffer é otimização antes de existir volume
medido, e evento perdido em aba fechada é defeito silencioso.

### 3. O custo é congelado na gravação

Preço por modelo em `app/core/precos_ia.py`, versionado, com a data e a fonte da
tabela oficial anotadas no arquivo. `cost_usd` é calculado no momento da
gravação e guardado — não recalculado depois. Quando o preço do Gemini mudar, o
custo histórico continua sendo o que de fato se pagou.

**Os preços não são inventados nem estimados.** Quem implementar busca a tabela
oficial do Google e cola a fonte; se não conseguir a fonte, para e pergunta.

### 4. `cost_usd` é nullable, de propósito

Modelo fora da tabela de preços grava tokens com custo nulo e um aviso no log.
Perder a contagem de tokens é pior que não saber o custo de uma linha, e
derrubar a resposta do usuário por causa de um preço faltando é pior que as
duas.

### 5. `load_ms` vem do `QueryClient`; `is_empty`, do `QueryBoundary`

Duas fontes, porque são duas perguntas diferentes e cada uma tem um dono
diferente:

- **`load_ms`** — a telemetria observa o cache do react-query e emite quando as
  queries da rota assentam. Isso é "dados na tela", que é a métrica do orçamento
  de performance. Funciona **hoje** na Biblioteca, a única tela com número
  medido (mediana de 1454 ms no E2E de 10/09), o que permite conferir a
  telemetria contra uma medição independente.
- **`is_empty`** — sai do `vazio` que o `QueryBoundary` já calcula
  (`query-boundary.tsx:65`). Onde não houver boundary, `is_empty` é **nulo**.
  Nulo, não `false`: "não sei" e "não está vazia" são coisas diferentes.

Tela autenticada sem query nenhuma emite depois da pintura. Para não misturar
duas medições na mesma coluna, o evento carrega
**`medido_ate: "dados" | "pintura"`** dizendo qual das duas o `load_ms` é.

> **Corrigido em 10/09/2026, na revisão final da execução.** O primeiro
> bullet desta decisão afirma que `load_ms` "funciona hoje na Biblioteca […]
> o que permite conferir a telemetria contra uma medição independente."
> **Não funciona, e o motivo é estrutural, não um bug pequeno:**
>
> - **`TelemetriaDeTela` decide no primeiro frame.** Se nada está em voo no
>   primeiro `requestAnimationFrame` depois de montar, emite
>   `medido_ate: "pintura"` e encerra. Mas `app/(dashboard)/library/page.tsx`
>   serve a Biblioteca por streaming — `<LibraryData>` dentro de
>   `<Suspense>` —, e a query da tela só monta quando o stream chega, depois
>   desse primeiro frame. Medido por experimento numa tela cujo dado levou
>   ~100 ms: `{"screen":"/library","load_ms":28,"medido_ate":"pintura",
>   "is_empty":null}`.
> - **Mesmo no caminho que chega a emitir `"dados"`, não é a lista que se
>   mede.** A lista da Biblioteca **nunca** dispara requisição do navegador —
>   `LibraryData` faz `prefetchQuery` no servidor e entrega por
>   `HydrationBoundary` (Seção 5). O que fica em voo, e o que
>   `TelemetriaDeTela` cronometra quando algo cronometra, é o
>   `useInboxCount` — a query do badge, que a Seção 5 deixou fora do
>   prefetch.
>
> A Biblioteca foi escolhida como a tela de aferição justamente por ter um
> número independente (a mediana de 1454 ms do E2E de 10/09) — e é a tela em
> que o instrumento não mede o que se propõe a medir. Definição correta do
> que `load_ms` mede em
> [`docs/dev/modulos/telemetry.md`](../../dev/modulos/telemetry.md); a nota
> da Seção 7 no `PROGRESS.md` registra que a coluna não é dado utilizável
> hoje.

> **Corrigido em 10/09/2026, ao mapear os arquivos do plano.** Uma versão
> anterior deste parágrafo dizia que landing e páginas legais emitiriam depois
> da pintura. **Não emitem, e não dá para emitirem:** o endpoint tira
> `account_id` do contexto da sessão, e essas páginas são anônimas — inventar
> uma conta para elas violaria o Art. 1. A telemetria desta seção cobre as **15
> telas autenticadas** de `app/(dashboard)/`; as outras **19** ficam de fora.
> Medido com `find ArchSmart-web/src/app/"(dashboard)" -name page.tsx | wc -l`
> e o complemento com `-not -path`.
>
> Isso encaixa com onde o `QueryProvider` já mora — `(dashboard)/layout.tsx` —,
> que é onde a telemetria se monta. Medir visitante anônimo é outro problema,
> com outro desenho (sem conta, provavelmente sem nosso banco), e não é desta
> seção.

Os dois crescem sozinhos: cada tela que a Seção 8 migrar passa a medir de
verdade sem tocar em código de telemetria. É por isso que a telemetria vem
antes da migração.

### 6. `screen` é normalizado

`/projects/[id]`, nunca `/projects/<uuid>`. Sem isso a cardinalidade explode e
id de conta vaza para dentro do nome do evento.

---

## A mecânica das duas gravações

As duas tabelas gravam com regras **opostas**, e essa é a decisão central desta
seção.

### `product_events` grava dentro de um savepoint

`track(ctx, evento, propriedades)` abre `repo.db.begin_nested()`, grava, e
engole qualquer erro num log. A spec pede que falha de telemetria não derrube a
requisição — e sem savepoint isso não se cumpre sozinho: um insert que estoura
envenena a transação inteira do SQLAlchemy, e a requisição que a telemetria
deveria só observar morre junto.

**Savepoint, não sessão nova.** `DATABASE_URL` aponta para o host pooler na 5432
justamente porque estado de sessão vaza entre clientes; abrir conexão por evento
é a última coisa que se quer ali.

### `ai_usage_logs` grava na transação da resposta

Sem savepoint e sem engolir (Art. 9). Se o registro de custo falha, a requisição
falha. É deliberado: não se serve resposta de IA sem registrar o que ela custou.

### `ctx` é o `ScopedRepository`

`account_id` e `user_id` saem da identidade resolvida no servidor, nunca do
corpo da requisição (Art. 1). O endpoint de telemetria tem teste provando que
`account_id` forjado no payload é ignorado.

### `ai_service` continua sem saber que banco existe

`extract_product_data` passa a devolver `(dados, UsoIA)` — dataclass com
`model_name`, `input_tokens`, `output_tokens` e `latency_ms`, lida de
`response.usage_metadata`. Quem grava é `product_router.normalize_product`, que
já recebe `repo` injetado.

A latência é medida em volta da geração. O `@retry` tenta até 3 vezes; contam os
tokens da tentativa que respondeu, porque as que falharam não são cobradas.

---

## Modelo de dados

Duas tabelas em `app/models/all_models.py`, junto das outras 26, numa migração
Alembic com `downgrade()` de `drop_table` — que funciona de verdade, ao
contrário das quatro migrações antigas com `op.drop_constraint(None, ...)`.

**A coluna de usuário chama `created_by`, não `user_id`.** É a convenção que a
Seção 4 estabeleceu nas 21 tabelas de dado, é o que `ScopedRepository.create()`
preenche sozinho a partir do contexto, e é o que `test_colunas_de_escopo.py`
exige de toda tabela nova — nullable, porque portal público e formulário de
leads gravam sem sessão. Ter `user_id` **e** `created_by` seriam duas colunas
com o mesmo significado. Onde a spec de 23/08 diz "`account_id`/`user_id` do
contexto", leia `account_id`/`created_by`: o que importa é a origem, e a origem
é o contexto do servidor nos dois casos.

> Esse mesmo teste **trava a contagem de tabelas de dado em 21**, de propósito,
> para que tabela nova não nasça sem escopo. Com estas duas ele passa a 23, e o
> número é atualizado no mesmo commit que cria as tabelas — depois de decidir o
> escopo delas, nunca antes.

O `arquivos_acima_de_400` da catraca só mede `ArchSmart-web`, então as 536
linhas de `all_models.py` não são portão de nada e o arquivo não precisa ser
quebrado nesta seção.

### `product_events`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | UUID pk | |
| `account_id` | UUID FK `accounts` NOT NULL | do contexto |
| `created_by` | UUID FK `users` NULL | do contexto; nulo em evento de sistema |
| `name` | String NOT NULL | `screen_viewed`, etc. |
| `properties` | JSONB NOT NULL default `{}` | |
| `created_at` | DateTime NOT NULL, `server_default=func.now()` | |

Índice `(account_id, created_at)`.

### `ai_usage_logs`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | UUID pk | |
| `account_id` | UUID FK NOT NULL | do contexto |
| `created_by` | UUID FK `users` NULL | do contexto |
| `model_name` | String NOT NULL | |
| `input_tokens` / `output_tokens` | Integer NOT NULL | o que a spec não previa |
| `token_count` | Integer NOT NULL | a soma; é a coluna que a spec pede |
| `cost_usd` | Numeric(10,6) **NULL** | ver decisão 4 |
| `latency_ms` | Integer NOT NULL | |
| `feature` | String NOT NULL | `product_normalize` hoje |
| `created_at` | DateTime NOT NULL | |

Índice `(account_id, created_at)`. `Numeric`, não `Float`: dinheiro não anda em
ponto flutuante.

---

## Frontend

Seguindo a forma que a Seção 5 deixou em `features/library/`:

- `src/lib/api/telemetry.ts` — o envio, sobre o `api` de `client.ts`.
  Fire-and-forget de verdade: **nunca** rejeita para quem chamou. Fica dentro de
  `lib/api/`, então `fetch_fora_de_lib_api` continua em 75 e não piora.
- `src/features/telemetry/{api,hooks,types}.ts` — `useTrack()` devolvendo um
  `track(nome, propriedades)` estável.
- Engate no `AppShell.tsx`, com dedupe por navegação (o duplo-efeito do
  StrictMode conta duas vezes sem isso).

O `AppShell` de hoje chama `apiUrl` + `fetch` na mão — uma das 75 ocorrências.
**Esse padrão não é copiado**; a telemetria entra por `lib/api/`. Migrar o resto
do `AppShell` é Seção 8.

---

## As cinco tarefas

| # | Tarefa | A prova que a fecha |
|---|---|---|
| 1 | Verificação visual da Seção 6 | Galeria `/dev/componentes` e as **5 telas** com `DropdownMenu` abertas e olhadas; o que se viu escrito em `docs/dev/medicoes/` |
| 2 | Tabelas, migração e `track()` | Migração sobe e desce contra o Postgres do Docker; teste do savepoint provando que insert que estoura não derruba a transação de fora |
| 3 | `ai_usage_logs` no caminho da IA | Linha gravada com tokens separados e custo; doc de `ai_service` escrita (catraca `modulos_sem_doc` de 2 para 1) |
| 4 | `POST /api/telemetry/events` | Teste de `account_id` forjado no corpo sendo ignorado |
| 5 | `useTrack()` e `screen_viewed` | Navegação real na Biblioteca gravando uma linha com `medido_ate: "dados"` |

Branch `secao-7-telemetria`, merge em `develop` no fim, como as anteriores.

### Uma armadilha da catraca, que esta seção arma sozinha se não olhar

`modulos_sem_doc` conta **arquivo em `app/services/` ou diretório em
`src/features/` sem `.md` de mesmo nome em `docs/dev/modulos/`**. Esta seção
cria os dois: `app/services/telemetry_service.py` e `src/features/telemetry/`.

Sem doc, a medida sai de 2 para **4** e a seção precisaria de
`--atualizar --aceitar-piora` para fechar. Com as três docs — `ai_service.md`,
`telemetry_service.md` e `telemetry.md` — ela **cai para 1**. São três arquivos
de documentação, não uma reforma: o custo é pequeno e o sinal é o oposto.

---

## O que esta seção não faz

- **Não escolhe ferramenta de analytics.** Sem session replay, sem funil de 11
  etapas. Isso é a spec 003 completa, depois deste esqueleto.
- **Não instrumenta as telas.** Além do `screen_viewed` automático, nenhum
  evento de negócio é emitido. Cada tela migrada na Seção 8 traz os seus.
- **Não migra o `AppShell`** nem nenhuma das 75 ocorrências de `fetch` fora de
  `lib/api/`.
- **Não mede visitante anônimo.** Landing, páginas legais, `auth/`, portal e as
  demais 19 telas fora de `app/(dashboard)/` não emitem evento: sem sessão não
  há `account_id`, e o Art. 1 não admite um inventado.
- **Não rotaciona a credencial E2E** — risco aceito por escrito, ver acima.
- **Não põe `e2e/` em portão nenhum.** Continua pendência herdada para a Seção 8.
- **Não retém nem expira evento.** `product_events` cresce sem política de
  retenção; com beta fechado o volume não justifica, e inventar particionamento
  agora é otimização sem número.

---

## Riscos

1. **O `.env` da API aponta para banco gerenciado, com produção comentada.**
   Subir a API local com telemetria ligada sem conferir qual bloco está ativo
   escreve evento de teste dentro do banco de **staging**. A Tarefa 2 confere
   isso antes da primeira linha, e a verificação roda contra o Postgres do
   `docker-compose.test.yml`.

2. **`usage_metadata` do `google-genai` pode vir vazio ou parcial**, sobretudo no
   caminho com `url_context`, que usa tool e não JSON mode. Se vier sem tokens, a
   linha é gravada com o que houver e o custo fica nulo — nunca se descarta o
   registro nem se inventa o número.

3. **O `screen_viewed` pode contar duas vezes** em remonte ou navegação
   cancelada. O dedupe por navegação é a mitigação; o teste da Tarefa 5 cobre o
   caso do StrictMode.

4. **A cobertura real de `load_ms` é pequena nesta seção** — 3 arquivos usam
   react-query, e o alvo desta seção são as 15 telas autenticadas (das 34 no
   total). É esperado e está registrado aqui para não virar surpresa: o número
   cresce tela a tela na Seção 8, sem tocar em telemetria. O que a Seção 7
   entrega é o encanamento e a primeira medição de verdade, na Biblioteca.
