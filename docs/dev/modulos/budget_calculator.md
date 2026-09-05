# Cálculo de quantidade do orçamento

## O que faz e para quem

`app/services/budget_calculator.py` calcula, para cada item de orçamento
(`BudgetItem`), quantas unidades do produto selecionado o arquiteto precisa
comprar — a partir da regra do item (piso, parede, teto ou unidade), da área
do ambiente (`EnvironmentDNA`) e do rendimento do produto (`Product.yield_factor`).
É o número que aparece na tela de orçamento como "quantidade calculada" e que
entra no total financeiro do projeto.

Até a Tarefa 8 da Seção 4, `calculate_budget_item_quantity(db, item)` recebia
uma `Session` e fazia até 3 queries por item (`ItemOption`, `Product`,
`EnvironmentDNA`) — ~300 queries para um orçamento de 100 itens, porque a
função ia buscar seus próprios dados dentro de um laço por item nos
chamadores. A Tarefa 8 partiu isso em duas peças:

- `calculate_quantity(item, dna, produto) -> Quantidade` — pura, sem
  `Session`, sem I/O, sem leitura de atributo lazy. Testada inteiramente em
  memória em `tests/services/test_calculo_de_quantidade.py`.
- `carregar_orcamento(itens: Query) -> tuple[list[BudgetItem], dict[UUID, EnvironmentDNA]]`
  — as duas únicas queries que o orçamento inteiro precisa, chamadas uma vez
  por request, não uma vez por item. Medido por
  `tests/api/test_orcamento_sem_n_mais_um.py`, que conta as queries de verdade
  em vez de estimá-las.
- `popular_relacionamento_de_itens(orcamento, itens)` — fecha um N+1
  **separado**, descoberto ao medir o *round trip* HTTP completo (não só
  `carregar_orcamento` isolada) para revisar esta tarefa: ver "O N+1 que
  sobrava depois de `carregar_orcamento`" abaixo.

## Contrato

```python
@dataclass(frozen=True)
class Quantidade:
    base_area: float
    calculated_quantity: int
    has_yield_alert: bool

def calculate_quantity(
    item: BudgetItem,
    dna: EnvironmentDNA | None,
    produto: Product | None,
) -> Quantidade

def carregar_orcamento(itens: Query) -> tuple[list[BudgetItem], dict[UUID, EnvironmentDNA]]

def produto_selecionado(item: BudgetItem) -> Product | None

def popular_relacionamento_de_itens(orcamento: Budget, itens: list[BudgetItem]) -> None
```

`calculate_quantity` não busca nada sozinha: `dna` e `produto` (a opção
`is_selected` do item, já resolvida) chegam prontos de quem chamou. Quem
resolve o produto a partir de um item já carregado por `carregar_orcamento`
é `produto_selecionado` — chamá-la fora de um item carregado por lá dispara
lazy load e reabre o N+1 pela porta dos fundos.

`carregar_orcamento` aceita qualquer `Query` de `BudgetItem` **já filtrada
por conta (ou por token de portal) por quem chamou** — ela não sabe nada
sobre `account_id` nem sobre autorização; só carrega a árvore
(`environment`, `options` e `options.product`, num único `JOIN`) e os
`EnvironmentDNA` dos ambientes envolvidos, em dicionário por
`environment_id`.

`popular_relacionamento_de_itens` só importa para quem devolve
`BudgetResponse` (hoje, só `GET /projects/{id}/budget`): ela põe os itens que
`carregar_orcamento` já carregou direto em `Budget.items`, para a
serialização não refazer essa consulta por conta própria. Quem devolve um
item único (`BudgetItemResponse`) ou um dicionário simples
(`get_budget_summary`, `public.py`) não precisa dela.

`calculate_budget_item_quantity`, a função antiga que recebia `db`, não
existe mais. Nenhum código em `app/` chama esse nome
(`grep -rn "calculate_budget_item_quantity" app --include=*.py` sai vazio,
fora de `app/tests/`, a suíte antiga que a Seção 4 vai apagar e que não roda
no CI).

## Tabelas que toca

Leitura, via `carregar_orcamento`: `budget_items`, `environments`,
`item_options`, `products` (um `JOIN` só) e `environment_dnas` (`IN` pelos
`environment_id` dos itens carregados). Não escreve nada — quem persiste
`calculated_quantity`,
`base_area` e `has_yield_alert` de volta no `BudgetItem` é o chamador
(`budgets_router.py`, `public.py`), porque essas três colunas são atributos
transitórios do modelo (não colunas de banco): existem só para carregar o
resultado do cálculo até a serialização da resposta.

## Decisões não óbvias

- **`joinedload` em `environment`, `options` e `options.product`, não
  `selectinload` encadeado para a árvore.** A tentativa inicial usava
  `selectinload` para `options`/`options.product` porque parecia mais direto
  e evita multiplicar linhas — mas
  `test_montar_o_orcamento_nao_cresce_com_o_numero_de_itens` mediu **3**
  SELECTs para essa etapa (itens, depois opções, depois produtos: cada nível
  de `selectinload` é um round-trip próprio), não 1. Com `joinedload` a
  árvore inteira sai num único `JOIN`; a `Query` legada do SQLAlchemy (não o
  `select()` 2.0) já agrupa as linhas duplicadas de volta em objetos
  `BudgetItem` únicos pela identity map, então `len(itens)` não duplica
  mesmo com um item tendo várias opções. `environment` entrou na mesma
  chamada depois — ver "O N+1 que sobrava depois de `carregar_orcamento`"
  abaixo — e por ser many-to-one (um só por item) não multiplica linha
  nenhuma além do que `options` já multiplica.
- **Ambiente sem `EnvironmentDNA` devolve área e quantidade zeradas, mas
  preserva o alerta de rendimento se o produto já tinha um `yield_factor`
  inválido.** As duas ausências são independentes: falta de DNA é sobre o
  ambiente, alerta de rendimento é sobre o cadastro do produto — uma não
  apaga a outra. Isto **não é uma escolha de design desta reescrita**: é o
  comportamento da função anterior (`calculate_budget_item_quantity`), que a
  primeira versão de `calculate_quantity` zerava por engano (o alerta
  silenciava exatamente quando as duas coisas erradas aconteciam juntas, o
  caso que nenhum teste cobria). Corrigido e coberto por
  `test_sem_dna_e_rendimento_invalido_alerta_mesmo_assim` e
  `test_sem_dna_e_sem_produto_alerta_mesmo_assim`.
- **`round(x, 4)` antes do `math.ceil`.** Sem ele, ruído de ponto flutuante
  (`8.999999999999998`) arredondaria para cima incorretamente. Existia na
  função antiga e o comportamento foi preservado — ver
  `test_arredonda_para_cima_mas_nao_por_ruido_de_float`.
- **Quantidade manual sempre apaga o alerta de rendimento**, mesmo quando o
  rendimento era inválido: se o arquiteto sobrescreveu a quantidade, o
  rendimento deixou de ser usado, e um alerta sobre um cálculo que não rodou
  confundiria mais do que ajudaria.

## O N+1 que sobrava depois de `carregar_orcamento`

"O orçamento inteiro em duas queries" é verdade de `carregar_orcamento` +
`calculate_quantity` isoladas — não era verdade do *round trip* HTTP de
`GET /projects/{id}/budget`, e nada media o *round trip* até uma revisão
desta tarefa medir de propósito.

O motivo: `BudgetResponse.items` faz o Pydantic ler `Budget.items` na
serialização — um relationship lazy comum
(`app/models/all_models.py:317`) que `carregar_orcamento` nunca populava,
porque ela consulta `BudgetItem` diretamente (`db.query(BudgetItem).filter(...)`),
nunca através de `budget.items`. E cada `BudgetItemResponse` também lê
`item.environment`, que `carregar_orcamento` — antes desta correção — não
tinha carregado junto.

**Medido antes do fix** (`test_endpoint_get_project_budget_nao_cresce_com_o_numero_de_itens`,
antes de `environment` entrar no `joinedload` e antes de
`popular_relacionamento_de_itens` existir): 5 itens custavam **18**
queries; 30 itens custavam **68**. Não O(1) — um N+1 de verdade, e maior do
que "mais uma query": `budget.items` refeita do zero (1 SELECT) MAIS
`item.environment` lazy por item (1 SELECT por item, já que os únicos
`joinedload` de `carregar_orcamento` até então eram `options`/`options.product`).

Corrigido em duas peças, as duas em `budget_calculator.py`:

1. `carregar_orcamento` ganhou `joinedload(BudgetItem.environment)` na mesma
   chamada — mesma query, mais um `JOIN`, sem multiplicar linha.
2. `popular_relacionamento_de_itens(orcamento, itens)` usa
   `sqlalchemy.orm.attributes.set_committed_value(orcamento, "items", itens)`
   para pôr os itens que `carregar_orcamento` já carregou direto em
   `Budget.items`, sem uma query nova e sem marcar a coleção como suja.
   **Nunca** `orcamento.items = itens`: isso passa pelo atributo
   instrumentado, marca a coleção "dirty" e arrisca reordenar escritas no
   próximo `commit()`.

**Medido depois do fix:** 5 itens e 30 itens custam **4** queries cada —
Project (1) + Budget (1) + as 2 de `carregar_orcamento`. Genuinamente O(1),
não só "menor". `GET /budgets/{id}/summary` e os endpoints de item único
(`add_item_to_budget`, `update_budget_item`) não precisavam de
`popular_relacionamento_de_itens` — eles não devolvem `Budget.items` — mas
ganharam o `joinedload(environment)` de graça, pela mesma chamada de
`carregar_orcamento`.

## O que quebra se você mexer aqui

`calculate_quantity` é chamada em **5** pontos — medido com
`grep -c "calculate_quantity(" app/api/routers/budgets_router.py app/api/endpoints/public.py`
(4 + 1) — não 6: `budgets_router.py`, no laço de `GET /projects/{id}/budget`,
em `add_item_to_budget`, em `update_budget_item` e no laço de
`GET /budgets/{id}/summary`; `public.py`, no laço do portal público. Mudar a
fórmula muda o número que o arquiteto vê em cinco lugares de uma vez, não um.
Reintroduzir uma leitura de `Session`,
de `item.options` sem pré-carregar, ou de qualquer atributo lazy dentro de
`calculate_quantity` reabre o N+1 que esta função existe para fechar, e
`tests/services/` (que roda sem banco) passaria a exigir Postgres sem que
nada nos testes avisasse — a suíte inteira precisaria de `docker compose`
para um cálculo que deveria rodar em memória.
