# ArchSmart-api — regras do backend

A **Seção 4** entregou a camada de dados do backend — `ScopedRepository`, `RequestContext`, escopo por conta automático. Leia primeiro `../CLAUDE.md` para o estado geral da reestruturação.

## Onde as coisas moram hoje

- `app/api/` — três estruturas coexistindo: arquivos soltos (`account.py`, `auth.py`, `leads.py`, `users.py`), `api/endpoints/` (`dashboard.py`, `events.py`, `financial.py`, `notifications.py`, `presentations.py`, `projects.py`, `public.py`) e `api/routers/` (`budgets_router.py`, `environments_router.py`, `product_router.py`). Endpoint novo entra na estrutura do endpoint mais parecido que já existe hoje.
- `app/core/` — configuração (`config.py`) e utilitários transversais.
- `app/db/` — sessão e conexão com o banco.
- `app/models/all_models.py` — todos os modelos SQLAlchemy num arquivo único de 536 linhas (`wc -l`).
- `app/schemas/` — schemas Pydantic.
- `app/services/` — lógica de negócio (`ai_service.py`, `auth_service.py`, `budget_calculator.py`, `entitlements.py`, `financial_service.py`). São cinco: `entitlements.py` nasceu na Seção 4 e faltava neste mapa, no arquivo cujo trabalho é ser o mapa.
- `tests/` — suíte ativa.
- `tools/` — scripts operacionais (seed, reset). Nunca importados por `app/` — ver `tools/README.md`.

## Sobre `app/api/v1/`

Continua existindo só um `app/api/v1/endpoints/.gitkeep`, sobra do commit inicial do projeto — a Seção 4 **não** moveu rotas para lá e não criou prefixo `/api/v1`. A pasta única de rotas por versão que uma versão anterior deste arquivo previa não aconteceu: `ScopedRepository`/`RequestContext` entraram nos arquivos onde as rotas já viviam (`app/api/*.py`, `app/api/endpoints/`, `app/api/routers/`), sem reorganização de arquivo — inclusive `GET /api/users/me` ficou em `app/api/users.py`, não em `/api/v1/me` ([ADR 0008](../docs/dev/decisoes/0008-me-em-api-users-me.md)). Não conte com `app/api/v1/` para nada até uma tarefa dedicada decidir usá-lo.

## Regra de ouro

Lógica de negócio em `services/`; o endpoint só orquestra — recebe o request, chama o serviço, devolve o schema. Se um endpoint tem `if` de regra de negócio, essa regra está no lugar errado.

## Como se lê e escreve no banco

Desde a Seção 4, endpoint não chama `db.query()`:

```python
# errado
projeto = db.query(Project).filter(
    Project.id == project_id, Project.account_id == current_user.account_id
).first()

# certo
projeto = repo.obter(Project, project_id)   # 404 se nao for da conta
```

A dependência é `repo: ScopedRepository = Depends(get_repo)`. Se precisar da
`Session` crua para `commit` ou `execute`, ela é `repo.db` — nunca declare
`get_db` de novo no mesmo endpoint.

As exceções legítimas (portal público, catálogo global, pré-sessão) estão
comentadas onde acontecem, ou — no caso do portal público inteiro
(`app/api/endpoints/public.py`) — explicadas no docstring do módulo. O que
`tests/test_arquitetura.py::test_query_direta_so_em_model_sem_account_id`
reprova é o caso novo: um `db.query()`/`db.get()` em `app/api/` (ou
`financial_service.py`) sobre um model que **tem** `account_id`, fora de
`public.py` e sem o comentário `# pre-sessao: sem account_id ainda`. Query
sobre model sem `account_id` (catálogo global, `accounts`) passa pelo lint
sem marca nenhuma, porque `repo.query()` nele levantaria `EscopoImpossivel`
de qualquer forma — o comentário ali existe para quem lê, não para o lint.

## Escopo por conta

`ScopedRepository` (`app/db/repository.py`), obtido via `Depends(get_repo)`
(`app/db/repository.py::get_repo`), filtra por `account_id` sozinho:
`repo.query(Model)`, `repo.get(Model, id)`/`repo.obter(Model, id)` e
`repo.create(Model, **campos)` nunca deixam passar dado de outra conta, e
`repo.create()` descarta em silêncio qualquer `account_id`/`created_by` que
vier em `campos`. Chamar `repo.query()`/`repo.get()` num model sem
`account_id` levanta `EscopoImpossivel` — é a forma de descobrir, em tempo de
execução, que aquele model é catálogo global ou pré-sessão, não dado de
conta.

- Todo endpoint novo ganha um teste em `tests/isolation/` que autentica como conta A e prova que o dado da conta B não retorna (Art. 1). `tests/isolation/test_todas_as_rotas.py` percorre as rotas registradas em `app/main.py` automaticamente — uma rota nova com id na URL sem entrada em `RECURSOS` falha em vez de passar despercebida.

## De onde vem a identidade

`get_current_user` foi apagada na Tarefa 15 da Seção 4. A identidade vem de
`RequestContext` (`app/core/security.py`), via `Depends(get_repo)`
(`app/db/repository.py`) quando o endpoint acessa o banco, ou
`Depends(get_context)` direto quando não precisa — é o único jeito certo de
obter a identidade num endpoint novo. `repo.ctx` (ou o `ctx` que `get_context`
devolve) carrega `user_id`, `account_id`, `email` e `entitlements`. **Nunca**
receba `account_id` como parâmetro de rota, query ou body: o cliente pode
mandar qualquer valor ali, e usá-lo é a violação exata do Art. 1.

## Registrar a rota e migrar o schema

Router novo não entra sozinho: precisa de um `app.include_router(...)` em `app/main.py` (hoje 14 chamadas, uma por router — sem a linha, o endpoint existe no código e nunca é alcançado). Mudança de schema precisa de uma migração em `alembic/versions/`; sem ela, o banco diverge do modelo e quebra para a próxima pessoa que rodar a suíte.

## Testes

```
docker compose -f docker-compose.test.yml up -d --wait
pytest
```

A suíte roda contra Postgres real em Docker. `app/tests/` era a suíte antiga baseada em `MagicMock` como sessão de banco — foi apagada na Seção 4 (Tarefa 17). A suíte hoje mora só em `tests/` (308 testes coletados, `tests/services/`, `tests/api/`, `tests/isolation/` e um punhado de arquivos de arquitetura/schema/migração na raiz).

## Erros

Mensagem em pt-BR para o usuário; detalhe técnico só no log. Nunca coloque a exceção crua (`detail=str(e)` ou uma f-string com `{e}`) numa resposta — use `app/core/errors.py`: levante `DomainError` (ou uma das subclasses — `NotFound`, `Forbidden`, `QuotaExceeded`, `ValidacaoDeDominio`) com a mensagem em pt-BR, e registre o traço técnico com `logger.error(..., exc_info=erro)`. Esse padrão foi removido do código na Seção 4 (Tarefa 5) — não conte um número de ocorrências vivas aqui, ele fica errado assim que alguém escrever a próxima.

> ⚠️ **`ValidacaoDeDominio` responde 422, e a Tarefa 5 moveu ~10 caminhos de erro para ela — vários que antes eram 400 ou 500.** Quem escreve cliente contra esta API precisa saber disso antes de ramificar por status. A tabela completa, com o antes de cada um, está no `PROGRESS.md` (nota da Seção 4). O resumo: `auth.py` (5 caminhos), `account.py` (1), `presentations.py` (3), `product_router.py` (1).
>
> **Dois 422 diferentes chegam pelo mesmo status, e o `detail` os separa.** O 422 do Pydantic/FastAPI (corpo malformado) traz uma **lista** em `detail`; o 422 de `DomainError` traz uma **string**. Medido em 05/09/2026: `POST /api/products/` com `json={}` devolve `{"detail": [{"type": "missing", "loc": ["body", "name"], ...}]}`, e `registrar_handlers` (`app/core/errors.py`) devolve `{"detail": erro.mensagem}`. Um cliente que trate `detail` como string quebra no primeiro; um que trate como lista quebra no segundo.
>
> **A taxonomia é decisão em aberto, e não é de um agente.** A maior parte desses caminhos é falha de **infraestrutura** (upload que não subiu, Supabase que não respondeu), e 422 quer dizer "entendi o pedido, mas o conteúdo não é processável" — o que descreve mal um storage fora do ar. 5xx descreveria melhor, e foi o que eles eram. A Seção 4 **não** decidiu isso: ela unificou o mecanismo (nada de exceção crua no `detail`) e herdou o status da classe. Trocar o status de alguma dessas rotas é mudança de contrato e cabe ao dono do repositório.

## Convenções

Tabelas `snake_case` plural, PK sempre `id UUID`, schemas Pydantic com sufixo (`ProjectCreate`, `ProjectRead`) — Art. 5 da constitution. Detalhe e exemplos: `docs/dev/convencoes.md`.
