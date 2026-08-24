# Progresso — Reestruturação da Plataforma Arq Smart

> O número abaixo é **calculado, não digitado**: `tools/progresso.py` lê as caixas
> marcadas neste arquivo e recomputa as porcentagens. Depois de marcar ou
> desmarcar uma tarefa, rode `python tools/progresso.py --write` para
> regenerar. Para conferir que este arquivo não divergiu das caixas — o que a
> Seção 3 liga no CI — rode `python tools/progresso.py --check`; ele sai com
> código 1 e imprime a diferença se algo estiver errado.

**Progresso geral: 14/62 (23%)**
`█████░░░░░░░░░░░░░░░`

_Última atualização: 2026-08-24_

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
**0/5 (0%)** `░░░░░░░░░░░░░░░░░░░░`

- [ ] CI que barra merge (lint, tipos, testes contra Postgres em Docker, isolamento entre contas, literais proibidos, validador de contraste, doc de módulo, consistência do PROGRESS.md)
- [ ] Branch `staging` e ambiente online (API de staging no Render + preview automático da Vercel)
- [ ] Postgres local em Docker com a stack Supabase completa (Auth + Storage + Studio)
- [ ] Banco de produção novo, criado do zero pela receita de migrações
- [ ] Seed com volume realista (`tools/seed.py`: 5 projetos, 25 ambientes, 300 itens de biblioteca, 500 itens de projeto)

## Seção 4 · Camada de dados do backend
**0/8 (0%)** `░░░░░░░░░░░░░░░░░░░░`

- [ ] `RequestContext` em `app/core/security.py`
- [ ] `ScopedRepository` em `app/db/repository.py`
- [ ] `account_id` e `created_by` nas 13 tabelas que faltam
- [ ] Índices derivados das queries reais
- [ ] Fim do N+1 no orçamento (`calculate_quantity` pura, de ~300 para 2 queries)
- [ ] Suíte de testes contra banco real (`tests/services/`, `tests/api/`, `tests/isolation/`) substituindo `app/tests/`
- [ ] Tratamento de erro único (exceções de domínio; sem `detail=str(e)` nem `print()`)
- [ ] `GET /api/v1/me` com `user`, `account` e `entitlements`

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
