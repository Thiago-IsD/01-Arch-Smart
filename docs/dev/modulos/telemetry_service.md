# Telemetria de produto

## O que faz e para quem

`app/services/telemetry_service.py` expõe `track()`, o único ponto de
entrada para gravar um evento de produto (`ProductEvent`) na conta da sessão
corrente. É a Tarefa 2 da Seção 7 — o esqueleto de telemetria que a
plataforma ainda não tinha —, e nasce pensada para ser chamada de dentro de
endpoints e de outros serviços sem que quem chama precise saber nada sobre
savepoint, log ou formato de erro: `track()` observa, nunca decide, e nunca
derruba a requisição que a chamou.

Este arquivo satisfaz a verificação mecânica do CI descrita em
[`docs/dev/modulos/README.md`](README.md) — todo arquivo em
`app/services/` precisa de um `.md` de mesmo nome nesta pasta — e não a
definição de "módulo de produto" da Seção 8, que é sobre telas.

## Contrato

```python
def track(
    ctx: ScopedRepository,
    evento: str,
    propriedades: Mapping[str, Any] | None = None,
) -> None
```

Não é um endpoint HTTP. Recebe o `ScopedRepository` de quem chama — nunca
abre sessão própria — e grava um `ProductEvent` com `name=evento` e
`properties=dict(propriedades or {})`. `account_id` e `created_by` nunca são
parâmetro: saem do `ctx.ctx` (o `RequestContext` resolvido no servidor),
exatamente como todo `repo.create(...)` no resto da API. `propriedades`
ausente vira `{}`, nunca `NULL` — a coluna é `NOT NULL` com
`server_default 'jsonb `{}``, e o valor Python espelha isso.

`track()` **nunca levanta**. Qualquer exceção — `name` nulo, tipo que o
JSONB não aceita, o que for — vira `logger.warning(..., exc_info=True)` e o
evento é descartado em silêncio. Quem chama não precisa de `try/except` ao
redor.

## Tabelas que toca

Só escreve em `product_events`, via `ctx.create(ProductEvent, ...)` —
`ctx.create` é quem preenche `account_id`/`created_by` e quem descarta,
também em silêncio, qualquer um dos dois que viesse em `campos` (não é o
caso aqui, já que `track()` nunca passa nenhum dos dois). Não lê nada: não
há caminho de consulta neste módulo.

A tabela irmã, `ai_usage_logs`, nasce na mesma migração
(`170b12223b9b_telemetria_product_events_e_ai_usage_.py`) mas **não** é
tocada por este serviço — quem grava nela é a Tarefa 3, direto por
`repo.create(AiUsageLog, ...)`, porque o custo de uma chamada de IA precisa
entrar na mesma transação da resposta (Art. 9), e um `track()` que engole
erro é o oposto disso: uma falha ao gravar custo real não pode desaparecer
num log.

## Decisões não óbvias

- **Por que o SAVEPOINT existe.** Sem ele, `ctx.create(ProductEvent, ...)`
  adiciona o objeto à mesma sessão/transação da requisição; se o INSERT
  estourar (campo obrigatório faltando, tipo incompatível), o SQLAlchemy
  invalida a transação **inteira**, e o próximo `flush()` da requisição —
  que não tem nada a ver com telemetria — morre com
  `PendingRollbackError`. Telemetria existe para **observar**, não para
  poder derrubar o que está sendo observado; `ctx.db.begin_nested()` abre um
  `SAVEPOINT` que isola o INSERT do evento: se ele falhar, só o savepoint é
  desfeito (`ROLLBACK TO SAVEPOINT`, disparado pelo `__exit__` do
  `with` ao ver a exceção), e a transação de fora continua utilizável. O
  teste que prova isso é
  `tests/services/test_telemetria.py::test_track_que_estoura_nao_derruba_a_transacao_de_fora`
  — ele força `name=None` (coluna `NOT NULL`) e depois cria e persiste um
  `Project` de verdade na mesma sessão, provando que ela não morreu.
- **Por que SAVEPOINT, e não uma sessão/conexão nova por evento.**
  `DATABASE_URL` aponta para o host **pooler** do Supabase na porta 5432
  (nunca a 6543) justamente porque estado de sessão vaza entre clientes
  nesse pooler — abrir uma conexão nova a cada evento de telemetria é o
  tipo de padrão que esse pooler pune. Um savepoint fica dentro da mesma
  conexão/transação já aberta pela requisição.
- **`JSONB`, não `JSON`.** `product_events.properties` é pensada para ser
  filtrada por propriedade (`properties->>'screen'`, por exemplo); só o
  `jsonb` do Postgres indexa. O dialeto `sqlalchemy.dialects.postgresql`
  já tem precedente neste repositório (migração `c7403ff445fa`).
- **`track()` nunca levanta, por design.** A alternativa — deixar o
  chamador decidir se engole o erro — espalharia o mesmo `try/except` em
  todo endpoint que quisesse medir alguma coisa. Centralizar aqui significa
  que perder um evento de telemetria é sempre um `WARNING` no log, nunca um
  502 para o usuário.

## O que quebra se você mexer aqui

Ainda não há chamador em produção: esta tarefa entrega só o modelo e o
serviço. A Tarefa 4 da Seção 7 é quem vai chamar
`track(repo, evento.name, evento.properties)` a partir de um ponto central
(não endpoint por endpoint) — mudar a assinatura de `track()` agora (nome
dos parâmetros, ordem, ou o fato de retornar `None`) é decisão que afeta
diretamente essa tarefa. `ProductEvent`/`AiUsageLog` em
`app.models.all_models` e `track()` em `app.services.telemetry_service` são
os dois nomes que a Seção 7 já está construindo em cima — não renomear sem
avisar quem depende deles.
