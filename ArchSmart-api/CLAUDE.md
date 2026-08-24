# ArchSmart-api — regras do backend

Este arquivo descreve o alvo da **Seção 4** para a API. Leia primeiro `../CLAUDE.md` para o estado geral da reestruturação.

## Onde as coisas moram hoje

- `app/api/` — três estruturas coexistindo: arquivos soltos (`account.py`, `auth.py`, `leads.py`, `users.py`), `api/endpoints/` (`dashboard.py`, `events.py`, `financial.py`, `notifications.py`, `presentations.py`, `projects.py`, `public.py`) e `api/routers/` (`budgets_router.py`, `environments_router.py`, `product_router.py`). Endpoint novo entra na estrutura do endpoint mais parecido que já existe hoje.
- `app/core/` — configuração (`config.py`) e utilitários transversais.
- `app/db/` — sessão e conexão com o banco.
- `app/models/all_models.py` — todos os modelos SQLAlchemy num arquivo único de 467 linhas.
- `app/schemas/` — schemas Pydantic.
- `app/services/` — lógica de negócio (`ai_service.py`, `auth_service.py`, `budget_calculator.py`, `financial_service.py`).
- `tests/` — suíte ativa.
- `tools/` — scripts operacionais (seed, reset). Nunca importados por `app/` — ver `tools/README.md`.

## Onde vão morar

`app/api/v1/routes/` será a pasta única de rotas, com `ScopedRepository` e `RequestContext` tornando o filtro por conta automático em vez de manual — **Seção 4**. (Existe hoje um `app/api/v1/endpoints/` vazio, com só um `.gitkeep` — é sobra do commit inicial do projeto, não uma preparação para a Seção 4; não conte com ele.) **Não mova nada agora**: migração parcial mistura mudança estrutural com mudança de comportamento e impede saber o que causou uma regressão.

## Regra de ouro

Lógica de negócio em `services/`; o endpoint só orquestra — recebe o request, chama o serviço, devolve o schema. Se um endpoint tem `if` de regra de negócio, essa regra está no lugar errado.

## Escopo por conta

Hoje cada endpoint filtra por conta manualmente — não existe ainda uma camada que torne o erro impossível (isso é o que a Seção 4 entrega com `ScopedRepository`). Até lá:

- Toda query nova filtra por `account_id` explicitamente.
- Todo endpoint novo ganha um teste em `tests/isolation/` que autentica como conta A e prova que o dado da conta B não retorna (Art. 1).

## De onde vem a identidade

`Depends(get_current_user)` (definido em `app/api/users.py`) resolve `user_id`/`account_id` a partir do token da sessão — é o único jeito certo de obter a identidade num endpoint novo. **Nunca** receba `account_id` como parâmetro de rota, query ou body: o cliente pode mandar qualquer valor ali, e usá-lo é a violação exata do Art. 1.

## Registrar a rota e migrar o schema

Router novo não entra sozinho: precisa de um `app.include_router(...)` em `app/main.py` (hoje 14 chamadas, uma por router — sem a linha, o endpoint existe no código e nunca é alcançado). Mudança de schema precisa de uma migração em `alembic/versions/`; sem ela, o banco diverge do modelo e quebra para a próxima pessoa que rodar a suíte.

## Testes

```
docker compose -f docker-compose.test.yml up -d --wait
pytest
```

A suíte roda contra Postgres real em Docker. `app/tests/` é a suíte antiga baseada em `MagicMock` como sessão de banco — está fora do `testpaths` do `pytest.ini` e será apagada na Seção 4. **Não escreva nada nela.**

## Erros

Mensagem em pt-BR para o usuário; detalhe técnico só no log. Nunca `detail=str(e)` — hoje existem 5 ocorrências no código, todas pendentes de correção, nenhuma para imitar.

## Convenções

Tabelas `snake_case` plural, PK sempre `id UUID`, schemas Pydantic com sufixo (`ProjectCreate`, `ProjectRead`) — Art. 5 da constitution. Detalhe e exemplos: `docs/dev/convencoes.md` (Task 6 desta seção).
