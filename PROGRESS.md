# Progresso — Reestruturação da Plataforma Arq Smart

> O número abaixo é **calculado, não digitado**: `tools/progresso.py` lê as caixas
> marcadas neste arquivo e recomputa as porcentagens. Depois de marcar ou
> desmarcar uma tarefa, rode `python tools/progresso.py --write` para
> regenerar. Para conferir que este arquivo não divergiu das caixas — o que a
> Seção 3 liga no CI — rode `python tools/progresso.py --check`; ele sai com
> código 1 e imprime a diferença se algo estiver errado.

**Progresso geral: 18/63 (29%)**
`██████░░░░░░░░░░░░░░`

_Última atualização: 2026-08-30_

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
**4/5 (80%)** `████████████████░░░░`

- [x] CI que reprova em todo PR (lint, tipos, testes contra Postgres em Docker, cores literais, doc de módulo, consistência do PROGRESS.md, sincronia `main`↔`develop`)
- [ ] Branch `staging` e ambiente online (API de staging no Render + preview automático da Vercel)
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
> **A caixa que continua aberta é só a metade Vercel da primeira.** A API de
> staging está no ar e servindo o código novo
> (`https://arqsmart-staging.onrender.com`, 57 rotas, `/health` e `/health/db`
> verdes). O que falta é o **preview automático**: até 30/08 a Vercel recusava
> todo deploy com *"Git author must have access to the project"*, e o
> repositório foi tornado público para destravar. Os deploys passaram a
> concluir, mas `www.arqsmart.com.br` ainda responde `404 NOT_FOUND` — o
> domínio não está servindo o deployment. Falta confirmar as duas coisas: um
> preview gerado a partir de PR contra `staging`, e o domínio de produção
> atendendo. Roteiro em
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
**0/9 (0%)** `░░░░░░░░░░░░░░░░░░░░`

- [ ] `RequestContext` em `app/core/security.py`
- [ ] `ScopedRepository` em `app/db/repository.py`
- [ ] `account_id` e `created_by` nas 10 tabelas que faltam
- [ ] Índices derivados das queries reais
- [ ] Fim do N+1 no orçamento (`calculate_quantity` pura, de ~300 para 2 queries)
- [ ] Suíte de testes contra banco real (`tests/services/`, `tests/api/`, `tests/isolation/`) substituindo `app/tests/`
- [ ] Tratamento de erro único (exceções de domínio; sem `detail=str(e)` nem `print()`)
- [ ] `GET /api/v1/me` com `user`, `account` e `entitlements`
- [ ] Fim do auto-link por e-mail em `app/api/users.py` (ver [arquitetura.md](docs/dev/arquitetura.md), "pendência de segurança conhecida")

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
