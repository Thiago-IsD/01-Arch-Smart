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
```

`calculate_quantity` não busca nada sozinha: `dna` e `produto` (a opção
`is_selected` do item, já resolvida) chegam prontos de quem chamou. Quem
resolve o produto a partir de um item já carregado por `carregar_orcamento`
é `produto_selecionado` — chamá-la fora de um item carregado por lá dispara
lazy load e reabre o N+1 pela porta dos fundos.

`carregar_orcamento` aceita qualquer `Query` de `BudgetItem` **já filtrada
por conta (ou por token de portal) por quem chamou** — ela não sabe nada
sobre `account_id` nem sobre autorização; só carrega a árvore
(`options` + `options.product`, num único `JOIN`) e os `EnvironmentDNA` dos
ambientes envolvidos, em dicionário por `environment_id`.

`calculate_budget_item_quantity`, a função antiga que recebia `db`, não
existe mais. Nenhum código em `app/` chama esse nome
(`grep -rn "calculate_budget_item_quantity" app --include=*.py` sai vazio,
fora de `app/tests/`, a suíte antiga que a Seção 4 vai apagar e que não roda
no CI).

## Tabelas que toca

Leitura, via `carregar_orcamento`: `budget_items`, `item_options`, `products`
(um `JOIN` só) e `environment_dnas` (`IN` pelos `environment_id` dos itens
carregados). Não escreve nada — quem persiste `calculated_quantity`,
`base_area` e `has_yield_alert` de volta no `BudgetItem` é o chamador
(`budgets_router.py`, `public.py`), porque essas três colunas são atributos
transitórios do modelo (não colunas de banco): existem só para carregar o
resultado do cálculo até a serialização da resposta.

## Decisões não óbvias

- **`joinedload` nos dois níveis (`options` → `options.product`), não
  `selectinload` encadeado.** A tentativa inicial usava `selectinload` porque
  parecia mais direto e evita multiplicar linhas — mas
  `test_montar_o_orcamento_nao_cresce_com_o_numero_de_itens` mediu **3**
  SELECTs para essa etapa (itens, depois opções, depois produtos: cada nível
  de `selectinload` é um round-trip próprio), não 1. Com `joinedload` nos dois
  níveis a árvore inteira sai num único `JOIN`; a `Query` legada do
  SQLAlchemy (não o `select()` 2.0) já agrupa as linhas duplicadas de volta
  em objetos `BudgetItem` únicos pela identity map, então `len(itens)` não
  duplica mesmo com um item tendo várias opções.
- **Ambiente sem `EnvironmentDNA` devolve área 0 e nenhum alerta de
  rendimento** — mesmo que o produto não tenha `yield_factor` válido. A
  função entende isso como "o cálculo ainda não aconteceu", não como "o
  cálculo aconteceu e deu zero"; avisar sobre rendimento de um cálculo que
  não rodou seria ruído.
- **`round(x, 4)` antes do `math.ceil`.** Sem ele, ruído de ponto flutuante
  (`8.999999999999998`) arredondaria para cima incorretamente. Existia na
  função antiga e o comportamento foi preservado — ver
  `test_arredonda_para_cima_mas_nao_por_ruido_de_float`.
- **Quantidade manual sempre apaga o alerta de rendimento**, mesmo quando o
  rendimento era inválido: se o arquiteto sobrescreveu a quantidade, o
  rendimento deixou de ser usado, e um alerta sobre um cálculo que não rodou
  confundiria mais do que ajudaria.

## O que quebra se você mexer aqui

`calculate_quantity` é chamada em 6 pontos (`budgets_router.py`: no laço de
`GET /projects/{id}/budget`, em `add_item_to_budget`, em
`update_budget_item` e no laço de `GET /budgets/{id}/summary`; `public.py`:
no laço do portal público) — mudar a fórmula muda o número que o arquiteto vê
em cinco lugares de uma vez, não um. Reintroduzir uma leitura de `Session`,
de `item.options` sem pré-carregar, ou de qualquer atributo lazy dentro de
`calculate_quantity` reabre o N+1 que esta função existe para fechar, e
`tests/services/` (que roda sem banco) passaria a exigir Postgres sem que
nada nos testes avisasse — a suíte inteira precisaria de `docker compose`
para um cálculo que deveria rodar em memória.
