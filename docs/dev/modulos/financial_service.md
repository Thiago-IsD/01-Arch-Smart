# Sincronização financeira do projeto

## O que faz e para quem

`app/services/financial_service.py` gera e atualiza os lançamentos
(`FinancialEntry`, `status="PREDICTED"`) de receita de um projeto — a partir
do valor total do serviço (`Project.service_value`) e do número de parcelas
(`Project.payment_installments`), preservando as parcelas já pagas
(`status="REALIZED"`). É o motor que roda por trás de "Criar projeto" e
"Editar projeto": todo lançamento de receita previsto que aparece no
financeiro do arquiteto nasce ou é recalculado aqui, nunca escrito à mão em
`projects.py`.

Este arquivo satisfaz a verificação mecânica do CI descrita em
[`docs/dev/modulos/README.md`](README.md) — todo arquivo em `app/services/`
precisa de um `.md` de mesmo nome nesta pasta — e não a definição de "módulo
de produto" da Seção 8, que é sobre telas.

## Contrato

```python
def sync_project_financials(
    project: Project,
    repo: ScopedRepository,
    custom_installments: Optional[List[CustomInstallment]] = None,
) -> None
```

Não é um endpoint HTTP. Chamada por `projects.py` logo depois de criar ou
atualizar um projeto (`create_project`, `update_project`), sempre com o
`project` que o próprio endpoint já buscou via `repo.obter(Project, ...)` —
a função **confia** nisso e não confere de novo que `project.account_id ==
repo.ctx.account_id`.

Até a Tarefa 14 da Seção 4 a função recebia `db: Session` puro e filtrava as
entradas do projeto só por `project_id` — sem `account_id` nenhum, porque
`project_id` sozinho já bastava enquanto o `project` de entrada vinha de uma
busca já filtrada por conta no chamador. Isso não era uma falha de
isolamento praticável (o `project_id` só existe dentro da conta que o
criou), mas também não tinha **nada** que impedisse um chamador futuro de
passar um projeto de outra conta e sincronizar lançamentos no lugar errado.
Trocar `db` por `repo` fecha essa porta: toda leitura e escrita da função
agora nasce filtrada por `repo.ctx.account_id`, e não há mais como chamar a
função passando uma sessão crua.

O parâmetro `account_id` nunca existiu na assinatura desta função — ao
contrário do exemplo hipotético do brief da Tarefa 14, que citava uma
`resumo_do_periodo(db, account_id, ...)` que não corresponde a nenhuma
função deste arquivo. O que a Tarefa 14 mudou de fato foi o segundo
parâmetro, de `db: Session` para `repo: ScopedRepository` — o efeito prático
é o mesmo do brief (ninguém mais passa uma conta por fora do contexto da
requisição), só que chegando por uma rota ligeiramente diferente da
descrita.

## Tabelas que toca

Leitura e escrita, via `repo`, só em `financial_entries` — filtra por
`project_id` e `type == "INCOME"`, apaga as `PREDICTED` antigas do projeto
(`repo.remover`) e cria as novas parcelas (`repo.create`), sempre com
`status="PREDICTED"` e `category="Serviços de Arquitetura"`. Não lê nem
escreve `projects` — quem persiste mudanças em `Project` é o chamador.

## Decisões não óbvias

- **`repo.create` passou a preencher `created_by`.** A função antiga
  instanciava `FinancialEntry(account_id=project.account_id, ...)`
  diretamente e nunca escrevia `created_by` — toda parcela sincronizada
  ficava com `created_by IS NULL`, mesmo tendo uma requisição autenticada por
  trás. `repo.create` preenche `created_by=repo.ctx.user_id` sempre; é uma
  correção de dado, não só uma troca de sintaxe, e não muda nada visível na
  resposta HTTP (esses dois campos não aparecem em `ProjectResponse`).
- **`repo.remover` em vez de `db.delete` direto nas `PREDICTED` antigas.**
  As entradas apagadas vieram de `repo.query(FinancialEntry)`, então já são
  da conta certa — `repo.remover` é redundante aqui, não uma correção de
  bug. Ficou porque nenhuma escrita neste arquivo passa mais por `Session`
  crua.
- **`repo.db.commit()` sempre roda, mesmo sem lançamento novo.** A função
  original também comitava incondicionalmente no fim — preservado porque a
  exclusão das `PREDICTED` antigas (passo 1) precisa persistir mesmo quando
  não há saldo restante para gerar parcela nova (`total_value <= 0` retorna
  antes disso, mas `remaining_balance <= 0` com parcelas já deletadas
  precisa do commit para não deixar a exclusão pendurada numa transação que
  ninguém fecha).

## O que quebra se você mexer aqui

Chamada em exatamente **2** pontos, medido com
`grep -n "sync_project_financials(" app/api/endpoints/projects.py`:
`create_project` e `update_project`, ambos passando o `repo` do próprio
endpoint. Um chamador novo precisa ter um `ScopedRepository` à mão — não dá
para chamar esta função com uma `Session` isolada, de dentro de um script ou
worker sem contexto de requisição, sem antes montar um `RequestContext`
(ver `tools/README.md` para o padrão que os scripts de manutenção usam).
Mudar a fórmula de rateio ou a categoria fixa (`"Serviços de Arquitetura"`)
muda os lançamentos previstos de **todo** projeto na próxima vez que ele for
criado ou editado, não um caso isolado.
