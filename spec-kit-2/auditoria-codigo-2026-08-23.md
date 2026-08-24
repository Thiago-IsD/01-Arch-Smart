# Auditoria de Código — Arq Smart

**Data:** 23/08/2026 · **Base auditada:** `main` @ `4f5046c` · **Escopo:** `ArchSmart-api`, `ArchSmart-web`, `extension`

> Esta auditoria responde a uma pergunta específica: **é preciso reescrever a plataforma inteira antes de executar o spec-kit-2?**
> Tudo aqui é verificável — cada achado aponta arquivo e linha.

---

## Veredito

**Não reescreva a plataforma inteira. Reescreva o front-end tela a tela e endureça o back-end no lugar.**

A conclusão vem de três fatos medidos:

1. **A stack não é o problema.** Next 16 / React 19 / FastAPI 0.128 / SQLAlchemy 2.0 / Pydantic 2 — tudo atual. Não há nada a ganhar trocando. A própria constitution (Art. 14) e o playbook proíbem trocar de stack.
2. **O modelo de dados já está 60% no lugar.** `accounts` existe, `account_id` já está em 8 das 21 tabelas de dado, incluindo as principais (`projects`, `products`, `clients`, `financial_entries`). Jogar isso fora e refazer é destruir trabalho que está correto.
3. **Os defeitos reais não são consertados por reescrita.** Vazamento entre contas, teste que não testa, ausência de CI e N+1 são falhas de *processo*, não de código legado. Reescrever com o mesmo processo reproduz os mesmos defeitos — o playbook já diz isso na página 1.

**O que de fato justifica reescrita:** o front-end. 64% dos componentes são `"use client"`, 79 `useEffect` buscando dados em cascata, 88 chamadas `fetch/axios` diretas contra 4 arquivos usando TanStack Query, regra de negócio decidida no navegador. Isso é a Onda 2 do spec-kit — e ela já está especificada corretamente.

**O que precisa acontecer antes de qualquer coisa:** há 13 endpoints em produção com falha de autorização. Isso não espera onda nenhuma.

---

## A base em números

| | |
|---|---|
| Back-end (`app/`) | 7.490 linhas Python · 70 endpoints · 26 migrações Alembic |
| Front-end (`src/`) | 20.676 linhas TS/TSX · 141 arquivos · 33 rotas |
| Extensão | 281 linhas JS/HTML |
| Testes | 83 testes — **todos contra `MagicMock`, nenhum contra banco** |
| CI | **Nenhum.** Só 2 workflows de keep-alive |
| Histórico | 76 commits, 22 nos últimos 60 dias, 1 desenvolvedor |

Vinte e oito mil linhas é uma base **pequena**. Reescrita completa é viável em tamanho — o argumento contra ela não é esforço, é que ela não resolve o que está quebrado.

---

## P0 — Falhas de autorização em produção

Estas violam o Art. 1 da constitution ("violação deste artigo é P0 e bloqueia release, sem exceção"). Todas estão no ar agora.

### P0-1 · Seis endpoints de orçamento sem filtro de conta (IDOR)

> ✅ **Corrigido pela Seção 1 do plano de reestruturação.** Regressão coberta em `ArchSmart-api/tests/isolation/`.

`app/api/routers/budgets_router.py`

| Linha | Endpoint | O que falta |
|---|---|---|
| 122 | `PATCH /api/budgets/items/{item_id}` | nenhuma checagem — há um `# TODO: Verify project constraints vs current_user` na linha 136 |
| 157 | `DELETE /api/budgets/items/{item_id}` | nenhuma checagem |
| 178 | `POST /api/budgets/items/{item_id}/options` | não valida nem o item nem o `product_id` — dá para anexar produto de outra conta |
| 205 | `PATCH /api/budgets/options/{option_id}/select` | nenhuma checagem |
| 230 | `DELETE /api/budgets/options/{option_id}` | nenhuma checagem |
| 266 | `GET /api/budgets/{budget_id}/summary` | `# TODO: Auth check against budget.project.account_id` na linha 280 |

**Impacto:** qualquer usuário autenticado que conheça um UUID altera, apaga e lê o orçamento de qualquer outro escritório. O `GET /projects/{id}/budget` (linha 19) filtra corretamente — a falha está exatamente nas operações de escrita.

### P0-2 · Cinco ações do portal público sem verificar o token de acesso

> ✅ **Corrigido pela Seção 1 do plano de reestruturação.** Regressão coberta em `ArchSmart-api/tests/isolation/`.

`app/api/endpoints/public.py`

O `GET` da apresentação (linha 105) exige senha e valida o token (`verify_portal_token`). **Nenhuma das ações seguintes valida:**

| Linha | Endpoint |
|---|---|
| 310 | `POST .../options/{option_id}/select` |
| 349 | `POST .../options/{option_id}/approve` |
| 390 | `POST .../options/{option_id}/reject` |
| 432 | `POST .../accept` |
| 493 | `GET .../comments` |

**Impacto:** a senha do portal protege a leitura e nada mais. Quem tiver o UUID aprova, rejeita e aceita orçamento sem senha — e aceite de apresentação tem efeito comercial. `POST /verify-password` (linha 282) também não tem rate limit: a senha é força-brutável.

### P0-3 · Dois endpoints sem autenticação alguma

> ✅ **Corrigido pela Seção 1 do plano de reestruturação.** Regressão coberta em `ArchSmart-api/tests/isolation/`.

| Arquivo:linha | Endpoint | Problema |
|---|---|---|
| `product_router.py:16` | `GET /api/products/seed-captured` | **escreve no banco sem autenticação.** Pega `db.query(Account).first()` e insere produtos de seed nessa conta. Chamável em loop por qualquer um |
| `product_router.py:175` | `POST /api/products/normalize` | **chama o Gemini sem autenticação, sem cota e sem registro de custo.** Qualquer pessoa na internet gasta o orçamento de IA do produto |

O P0-3 é também violação direta do Art. 9 — nenhuma chamada de LLM registra `token_count`, `cost_usd` ou `latency_ms` em lugar nenhum do código.

---

## P1 — O que faz a reescrita repetir os erros

### P1-1 · Os 83 testes não testam nada verificável

`app/tests/conftest.py` injeta um `MagicMock` como sessão de banco. Todo teste configura o retorno do mock e depois verifica que o mock retornou aquilo:

```python
db_session_mock.query.return_value.filter.return_value.first.side_effect = [mock_project, mock_budget]
```

Um `MagicMock` devolve o mesmo objeto **independentemente do filtro aplicado**. Consequência direta: nenhum dos 6 IDORs do P0-1 seria detectado por esta suíte, nem em cobertura de 100%. A suíte dá confiança sem entregar garantia — é pior do que não ter testes, porque parece que tem.

### P1-2 · Nenhuma camada obriga o escopo por conta

Não existe `app/core/security.py` nem `app/db/repository.py`. A identidade é resolvida dentro de `app/api/users.py:16` e cada endpoint decide sozinho se filtra por `account_id` — 125 `db.query()` diretos espalhados. É por isso que 6 endpoints esqueceram: **nada impede esquecer**. Esta é exatamente a T-001.4/T-001.5 da spec 001.

### P1-3 · N+1 na tela que é a Ação de Valor

`GET /api/projects/{id}/budget` (`budgets_router.py:19`) itera `budget.items` com lazy load e, para cada item, chama `calculate_budget_item_quantity`, que executa até 3 queries próprias (`EnvironmentDNA`, `ItemOption`, `Product` — `budget_calculator.py:41,46,56`). Um orçamento de 100 itens dispara ~300 queries. `selectinload`/`joinedload` aparecem em apenas 2 dos 15 arquivos de endpoint.

O orçamento é a tela onde o valor sai do produto. É onde a lentidão custa mais.

### P1-4 · O guarda de rota custa ~83 ms em toda requisição

> **Correção:** a primeira versão desta auditoria afirmava que não havia proteção de rota no servidor. Estava errado — o Next 16 renomeou `middleware.ts` para `proxy.ts`, e `src/proxy.ts` existe e protege as rotas corretamente.

O problema real é de custo. O `proxy.ts` chama `supabase.auth.getUser()` — uma ida à rede ao Supabase Auth — **antes** de verificar se o caminho é `/_next`, `/api` ou um arquivo estático. Medido com sessão ativa, em localhost:

| Rota | Passa pelo matcher | Mediana |
|---|---|---|
| `/_next/static/*` | não | 9 ms |
| `/assets/brand/icone.png` | sim | 92 ms |

Mesmo servidor, mesmo tipo de arquivo: **+83 ms por requisição**. Deslogado o custo é zero (não há token a validar), o que explica por que não aparece em teste rápido. Há ainda 3 `console.log` por requisição em produção.

### P1-5 · Regra de negócio no front-end (Art. 3)

`ArchSmart-web/src/app/(dashboard)/projects/page.tsx:44` — `const planLimit: number = data.plan_limit ?? 2`. O limite do plano tem fallback literal no navegador, e a linha 60 escreve **"Plano Solo"** fixo — um plano que a decisão de 18/08 eliminou. Não existe `GET /api/v1/me` com entitlements; `app/api/v1/` contém só um `.gitkeep`.

### P1-7 · Nenhum índice em `account_id`, e o banco é remoto

O modelo tem **4 `index=True` no arquivo inteiro** (`users.email`, `users.supabase_id`, `financial_entries.group_id`, `documents.id`) e as 26 migrações somam **7 `create_index`, nenhum em `account_id`**. Toda listagem filtrada por conta faz varredura sequencial.

Somado ao fato de o banco estar em `aws-1-sa-east-1.pooler.supabase.com` — cada query é uma ida à internet — isso produz o efeito que o time percebe como "a plataforma fica mais pesada com o uso": **não é a sessão que degrada, é a conta.** Quanto mais projetos e produtos o cliente acumula, mais linhas a varredura percorre. O produto pune o usuário fiel.

Medido em localhost, com sessão real: `/api/products` 1.220 ms · `/api/dashboard/lean` 881 ms · `/api/presentations` 868 ms · `/api/financial` 510 ms.

### P1-8 · Nada é cacheado entre navegações, e nada é cancelado

Em 6 ciclos de navegação (36 trocas de tela), `/api/presentations`, `/api/events` e `/api/financial` foram chamados 12 vezes cada; `/api/dashboard/lean`, 10 vezes. Já `/api/products` foi chamado 4 vezes — **porque a Biblioteca é a única tela que usa TanStack Query.** O padrão correto já existe no código, aplicado em 1 de 33 telas.

`AbortController` aparece 3 vezes em 141 arquivos, nenhuma para cancelar requisição ao trocar de tela: sair do Dashboard deixa o `/api/dashboard/lean` rodando por mais 1,4 a 2,5 s, disputando conexão com a tela que está entrando.

Tempo de navegação medido ponta a ponta, do clique até os dados na tela, **em localhost**: Projetos 3,0 s · Biblioteca 3,6 s · Financeiro 4,3 s.

### P1-9 · Não há vazamento de memória — verificado

Registrado para fechar a hipótese: 36 navegações reais entre as seis telas principais mantiveram os nós DOM constantes em 462 e o heap oscilando entre 39,8 e 48,2 MB, com queda no fim. Não há listener acumulando nem componente desmontado retido. Corrigir o `TOAST_REMOVE_DELAY` de 16,6 min e o `customLabels` que só cresce no `BreadcrumbContext` continua sendo higiene correta, mas **não moveria o ponteiro** da lentidão percebida.

### P1-6 · Zero instrumentação

Não existem `product_events` nem `ai_usage_logs`. A tabela `events` do modelo é agenda/calendário, não telemetria. Arts. 9 e 10 estão inteiramente por implementar — e o Art. 10 é a razão de a spec 003 vir antes da primeira tela.

---

## P2 — Dívida que encarece tudo

| Achado | Medida |
|---|---|
| API sem versionamento (Art. 5) | 70 endpoints em `/api/...`; `app/api/v1/` vazio. Três padrões coexistem: `api/`, `api/endpoints/`, `api/routers/` |
| Cores literais (Art. 7) | **510** classes de paleta Tailwind (`bg-slate-100`, `bg-emerald-600`…) em 39 arquivos + 11 `bg-[#hex]` |
| Marca errada (Art. 8) | 60 arquivos com `ArchSmart`; a extensão se chama "Arch Smart Clipper"; os diretórios do repo são `ArchSmart-*` |
| Ambiente literal (Art. 4) | `extension/manifest.json` publica `http://localhost:3000/*` e `http://127.0.0.1:8000/*` em `host_permissions`, junto de `<all_urls>` |
| Acessibilidade (Art. 6) | 5 `tabIndex={-1}` · 9 `opacity-0 group-hover` sem `focus-within` · 15 `aria-label` para 141 arquivos |
| Ruído de produção | 58 `print()` no back-end · 8 `console.log` no front · 14 `detail=str(e)` vazando erro interno ao cliente |
| Tipagem frouxa | 68 `any` / `as any` / `@ts-ignore` |
| Lixo versionado | 20 scripts soltos na raiz da API (`debug_*.py`, `fix_*.py`, `trace_*.py`, `reset_db.py`); `login.json` e `mock_database.db` rastreados no git |

---

## O que está certo e não deve ser jogado fora

Uma auditoria que só lista defeito leva à decisão errada. Isto aqui está bom:

- **Stack atual e coerente** — nada obsoleto, nada a migrar.
- **Modelo de dados multi-tenant já começado** — `accounts` existe, com `account_id` nas tabelas principais.
- **`portal_security.py`** — bcrypt correto, JWT com escopo e expiração, verificação amarrada à apresentação. Bem escrito. O problema não é este arquivo, é que 5 endpoints não o chamam.
- **26 migrações Alembic versionadas** — o histórico de schema está preservado.
- **`budget_calculator.py`** — serviço puro, testável, com a regra de negócio no lugar certo (Art. 5). É o modelo do que o resto deveria ser.
- **Design tokens semânticos** — `--primary`, `--destructive`, `--muted` já existem nos dois temas com shadcn. As 510 cores literais são desvios de um sistema que existe, não ausência de sistema.
- **`lang="pt-BR"`**, Zod validando env, `@supabase/ssr` corretamente separado cliente/servidor.

---

## Reescrever ou endurecer, camada por camada

| Camada | Estado | Decisão | Por quê |
|---|---|---|---|
| Modelo de dados | 60% pronto | **Completar** | Faltam `account_id` em 13 tabelas e `created_by` em todas. É migração, não reescrita |
| Camada de acesso a dados | Inexistente | **Construir** | `ScopedRepository` novo — não há o que reescrever |
| Endpoints | 70, ~10 com defeito | **Corrigir + versionar** | 60 estão corretos. Reescrever os 60 é destruir valor |
| Serviços | 4 arquivos, bem separados | **Manter** | `budget_calculator` é referência de qualidade |
| Testes | 83 inúteis | **Descartar e refazer** | Mock de banco não tem conserto incremental |
| Front-end — telas | Client-heavy, waterfalls | **Reescrever tela a tela** | É a Onda 2, já especificada |
| Front-end — design system | Tokens ok, uso desviado | **Endurecer** | Validador de contraste + varredura de cor literal no CI |
| Extensão | 281 linhas | **Reescrever** | É pequena e tem URL de dev publicada |
| Esteira | Inexistente | **Construir** | Spec 001, T-001.11 a T-001.13 |

---

## Ordem recomendada

**Antes de qualquer onda — correção de segurança (1 a 2 dias).**
Os 13 endpoints do P0. Não é refatoração e não espera fundação: são falhas ativas em produção, com dado de cliente final dentro (somos Operadores — Art. 12). O Art. 15 prevê exatamente isso: `P0` é a única exceção ao "spec antes de código".

**Depois, a Onda 1 como está escrita.** A spec 001 ataca o P1-1, o P1-2 e o P1-5 na ordem certa. O único ajuste que sugiro no `tasks.md`:

- **T-001.13** — a varredura de literais quebra o build hoje pelo nome dos próprios diretórios (`ArchSmart-api`, `ArchSmart-web`). Decidir se o scanner ignora caminho de arquivo ou se o rename dos diretórios entra junto.
- **Falta uma tarefa:** descartar `app/tests/conftest.py` e reconstruir a suíte contra banco real (Postgres em container ou SQLite por transação). Sem isso, a T-001.12 (teste de isolamento genérico) não tem como funcionar — ela precisa de um banco que respeite `WHERE`.

**Só então a Onda 2.** Aí sim, tela a tela, uma mergeada e medida antes da próxima.

---

## Resposta direta à pergunta

Reescrever a plataforma inteira levaria as 28 mil linhas a serem refeitas por uma pessoa, e entregaria — na melhor das hipóteses — o mesmo produto, com bugs novos, sem nada que impeça os mesmos 6 endpoints de esquecerem o filtro de novo.

O que muda o resultado é o que a Onda 1 já propõe: uma camada que **não deixa** esquecer o `account_id`, testes que rodam contra um banco de verdade, e um CI que barra o merge. Com isso de pé, reescrever cada tela vale a pena — e sem isso, não vale, reescrevendo ou não.
