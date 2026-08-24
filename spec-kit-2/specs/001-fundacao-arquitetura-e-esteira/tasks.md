# Tasks 001 — Fundação

## Modelo de identidade

- [ ] **T-001.1** — Migração: `accounts` + `account_id`/`created_by` em toda tabela de dado
  - Aceite: `account_id NOT NULL` com FK; índice em `(account_id)` em cada tabela
- [ ] **T-001.2** — Migrar os dados existentes: um `account` por usuário
  - Aceite: contagem por tabela idêntica antes e depois; nenhum registro órfão
- [ ] **T-001.3** — Limpar os dados sob a conta de seed do código antigo
  - ⚠️ backup antes; avisar os 4 sócios (a biblioteca compartilhada de teste vai sumir)

## Contexto e acesso a dados

- [ ] **T-001.4** — `RequestContext` + `get_current_context`
  - Arquivo: `app/core/security.py`
  - Aceite: única forma de resolver conta; ignora `account_id` vindo do cliente
- [ ] **T-001.5** — `ScopedRepository`
  - Arquivo: `app/db/repository.py`
  - Aceite: `query()` filtra sempre; model sem `account_id` levanta `TypeError`
- [ ] **T-001.6** — Escotilha `unscoped_query` com nome explícito
  - Aceite: usável só em `app/admin/` e `alembic/`; lint acusa em outro lugar
- [ ] **T-001.7** — Regra de lint contra `session.query()` direto em model escopado

## Entitlements

- [ ] **T-001.8** — `GET /api/v1/me` com `user`, `account`, `entitlements`
- [ ] **T-001.9 [P]** — Hook `useEntitlements()` no front
  - Aceite: alterar `max_projects` no banco muda a UI sem deploy
- [ ] **T-001.10 [P]** — `quota_limit_hit` emitido quando o limite é atingido

## Esteira

- [ ] **T-001.11** — CI: lint + tipos + testes bloqueando merge
  - Aceite: PR com erro de lint não mergeia
- [ ] **T-001.12** — Teste de isolamento genérico entre contas
  - Arquivo: `tests/test_tenant_isolation.py`
  - Aceite: percorre todos os endpoints registrados; falha se algum vazar
- [ ] **T-001.13** — Script de varredura de literais proibidos
  - UUID literal · `localhost`/`127.0.0.1`/URL absoluta · cor bruta · `ArchSmart`/`Ecowe` · `tabIndex={-1}`
  - Aceite: quebra o build nos 5 casos, com mensagem dizendo qual artigo da constitution foi violado
- [ ] **T-001.14** — Deploy automático: Vercel (front) e Render (API)
- [ ] **T-001.15** — Alembic aplicando migração em staging automaticamente
- [ ] **T-001.16 [P]** — Ambiente de staging com dados realistas
  - Volume: 5 projetos, 25 ambientes, 300 itens de biblioteca, 500 itens de projeto
  - Aceite: é contra este ambiente que a performance de cada tela será medida

## Estrutura e documentação

- [ ] **T-001.17** — Criar a estrutura de pastas de backend e frontend
- [ ] **T-001.18** — `docs/dev/arquitetura.md`
  - Aceite: explica identidade, escopo por conta, entitlements e esteira para alguém que chegou hoje

---

## Definition of Done

- [ ] Critérios de aceite da spec §10 atendidos
- [ ] Teste de isolamento e varredura de literais rodando no CI
- [ ] Nenhuma tela iniciada antes desta spec estar fechada
- [ ] `docs/dev/arquitetura.md` escrita
