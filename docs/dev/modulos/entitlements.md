# Entitlements da conta

## O que faz e para quem

`app/services/entitlements.py` calcula o que a conta autenticada tem direito
a fazer — hoje, `project_limit`, `can_use_ai` e `can_use_portal`. Não é uma
tela: é o serviço que `get_context` (`app/core/security.py`) chama em toda
requisição autenticada para preencher `RequestContext.entitlements`, o campo
que a Seção 5 vai usar para o front parar de fixar `data?.plan_limit ?? 2`
(Art. 3 — limite de plano é decisão do servidor, o front só renderiza o que a
API devolve).

Este arquivo satisfaz a verificação mecânica do CI descrita em
[`docs/dev/modulos/README.md`](README.md) — todo arquivo novo em
`app/services/` precisa de um `.md` de mesmo nome aqui — e não a definição de
"módulo de produto" da Seção 8, que é sobre telas.

## Contrato

```python
def entitlements_da_conta(db: Session, account_id: UUID) -> dict[str, Any]
```

Não é um endpoint HTTP. Recebe uma `Session` já aberta e o `account_id` já
resolvido pelo servidor (nunca um valor vindo do cliente — Art. 1). Devolve
sempre um `dict` completo — nunca lança para os casos abaixo, porque quem
chama é todo request autenticado, e uma exceção aqui derrubaria a API
inteira por causa de um dado de plano mal formado.

## Tabelas que toca

Leitura, com `outerjoin`, de `subscriptions` (`status`, `account_id`,
`plan_id`) e `plans` (`limits`, um JSON livre). Não escreve nada.

## Decisões não óbvias

- **`CANCELED` não concede os limites do plano** — a conta cai no `PADRAO`
  (hoje `project_limit=2`). `BETA`, `ACTIVE` e `READ_ONLY` concedem. Isso é
  deliberado: `READ_ONLY` é um eixo de permissão de escrita (a conta só lê,
  não grava), não um eixo de cota — tratá-lo como "sem direito a limite"
  seria confundir os dois eixos.
- **`order_by(Subscription.id)`** existe só para tornar o `.first()`
  determinístico: não há unique constraint em `subscriptions.account_id`, e
  sem uma ordenação explícita o Postgres pode devolver uma linha diferente a
  cada execução quando há mais de uma assinatura para a mesma conta.
- **`Plan.limits` que não é um `dict`** (lista, string, `null`) cai no
  `PADRAO` em vez de propagar o formato inesperado — a coluna é JSON livre e
  já existiu no banco com todos esses formatos.
- **`PADRAO`** cobre três outros casos, além do `CANCELED`: conta sem
  nenhuma assinatura, assinatura sem plano (`plan_id` nulo ou apagado), e
  `limits` sem a chave perguntada — o `{**PADRAO, **limites}` garante que uma
  chave ausente no JSON do plano não vira `None` para quem consome.

## O que quebra se você mexer aqui

`get_context` roda esta função em **toda** requisição autenticada (via
`run_in_threadpool`, para não travar o event loop) — uma mudança que agrave
o custo da query, ou que passe a lançar exceção em vez de cair no `PADRAO`,
derruba a autenticação inteira, não só uma tela. Mudar os valores de
`PADRAO` muda o que toda conta sem plano específico pode fazer, sem
precisar de migração — é literalmente a fonte de verdade que a Seção 5 vai
apontar.
