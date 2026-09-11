# Extração de dados de produto por IA

## O que faz e para quem

`app/services/ai_service.py` extrai dados estruturados de um produto (nome,
categoria, preço, rendimento, dimensões) a partir de texto bruto e/ou da URL
da loja onde o arquiteto encontrou o item. É o motor por trás de "Normalizar
produto": o arquiteto cola um texto ou uma URL do Web Clipper, e o módulo
devolve os campos já preenchidos para revisão, em vez de o arquiteto digitar
tudo à mão.

Este arquivo satisfaz a verificação mecânica do CI descrita em
[`docs/dev/modulos/README.md`](README.md) — todo arquivo em `app/services/`
precisa de um `.md` de mesmo nome nesta pasta — e não a definição de "módulo
de produto" da Seção 8, que é sobre telas.

## Contrato

```python
async def extract_product_data(
    raw_text: str, source_url: str | None = None
) -> Tuple[Dict[str, Any], UsoIA | None]
```

Não é um endpoint HTTP. Chamado por `POST /api/products/normalize`
(`normalize_product`, em `app/api/routers/product_router.py`), no único ponto
de chamada do repositório — medido com
`grep -rn "extract_product_data(" app/`. Levanta uma subclasse de
`AIServiceError` em caso de falha; o endpoint traduz cada uma para um status e
uma mensagem via o dicionário `AI_ERROR_RESPONSES`.

Devolve uma **tupla** desde a Tarefa 3 da Seção 7, não só o dicionário de
dados: o segundo elemento é `UsoIA(model_name, input_tokens, output_tokens,
latency_ms)`, o que a chamada de IA consumiu — ou `None`, quando nenhuma
chamada de IA aconteceu. Todo `return` da função devolve os dois valores; um
`return` que devolvesse só o dicionário quebraria o desempacotamento no
chamador em produção, não no tipo
estático (o retorno é `Dict[str, Any]` num literal, não checado linha a
linha pelo `mypy`/`tsc` deste repositório).

## Dois caminhos de geração

`_generate(prompt, use_url_context)` fala com o Gemini de duas formas,
dependendo de como o texto do produto foi obtido:

1. **Scraping direto (`use_url_context=False`).** `_scrape_page` baixa a
   página da loja com `httpx`, extrai o JSON-LD e o texto visível, e o
   resultado vai no prompt. Esse caminho usa **JSON mode**
   (`response_mime_type="application/json"`): mais barato e mais confiável
   de parsear.
2. **`url_context` do Gemini (`use_url_context=True`).** Quando a loja
   bloqueia scraping de IP de datacenter (comum em provedores como Render —
   `_scrape_page` devolve `None` nesse caso) e existe `source_url`, o próprio
   Google busca a página. Esse caminho **não pode** usar JSON mode: combinar
   `tools=[...]` com `response_mime_type` só funciona em modelos Gemini 3,
   todos em preview hoje. O formato é pedido por instrução no prompt
   (`JSON_ONLY_SUFFIX`), e `_extract_json_object` varre o texto de trás para
   frente à procura do objeto JSON, porque o modelo costuma narrar o
   raciocínio antes de emitir o JSON nesse modo.

Quando nem o scraping nem o `url_context` conseguem ler a página
(`_url_retrieval_failed`), o resultado vem só do nome/texto que o usuário
colou, e a função marca `result["source_blocked"] = True` — não é erro, é
extração parcial que pede revisão manual.

## Erros

`AIServiceError` é a base; `_classify` traduz exceções do SDK do Gemini para
quatro subclasses:

| Exceção | Causa | Status HTTP no endpoint |
|---|---|---|
| `AIConfigError` | `GEMINI_API_KEY` ausente, ou 401/403/400 "api key not valid" | 503 |
| `AIQuotaError` | 429, ou qualquer 5xx (tratado como transitório) | 429 |
| `AITimeoutError` | 504, ou timeout de `httpx`/`asyncio` | 504 |
| `AIResponseError` | resposta em formato inesperado, ou nenhum objeto JSON encontrado | 502 |

O dicionário `AI_ERROR_RESPONSES` (em `product_router.py`) é o que substituiu
um `except` genérico que devolvia "Erro de conexão com IA" para tudo,
inclusive erro de validação — por isso o `try/except` do endpoint embrulha
**só** a chamada de `extract_product_data`, nunca a gravação do log de custo
que vem depois: um erro de banco na gravação não deve virar mensagem de erro
de IA.

## O `@retry`

Só re-tenta o que é transitório: `AIQuotaError` e `AITimeoutError`
(`retry_if_exception_type`), até 3 tentativas, com espera exponencial com
jitter. Erro de parse (`AIResponseError`) ou de credencial
(`AIConfigError`) não melhora com retry, e insistir num 429 em lote só
amplifica o problema — por isso essas duas ficam de fora da lista.

## `UsoIA`: o que o módulo mede e não grava

`UsoIA(model_name, input_tokens, output_tokens, latency_ms)` é o que uma
chamada consumiu, lido de `response.usage_metadata` por `_uso_de`. A
latência medida é a **tentativa que respondeu**: `_generate` cronometra só em
volta da chamada ao SDK, dentro do `try`, então uma tentativa que falhou e
foi re-tentada pelo `@retry` não entra na conta — ela não foi cobrada, então
contá-la infla o número sem corresponder a custo nenhum.

`_uso_de` é tolerante de propósito: o caminho com `url_context` usa `tools`
em vez de JSON mode e às vezes volta sem `usage_metadata`; nesse caso os
tokens são contados como zero em vez de a função estourar ou o registro ser
descartado. Isso é diferente de **não ter chamado o Gemini**: quando
`extract_product_data` recebe corpo vazio (sem texto e sem URL — o default
de `NormalizeRequest`), nenhuma chamada acontece, e o segundo valor da
tupla é `None`, não um `UsoIA` com tokens zerados. A distinção importa
porque `UsoIA(0, 0, 0)` seria indistinguível de uma chamada real do Gemini
que por acaso devolveu zero tokens — e o endpoint usa esse `None` para
**pular a gravação** em vez de criar uma linha fantasma em
`ai_usage_logs` (0 tokens, `cost_usd=0`, `latency_ms=0`) para uma
requisição que nunca chegou ao provedor.

**Este módulo não grava `UsoIA` em lugar nenhum.** Ele não tem `Session` nem
`ScopedRepository` — não fala com o banco, ponto (é chamado antes de existir
qualquer contexto de requisição autenticada relevante para o serviço em si).
Quem grava é `normalize_product`, o único chamador, que tem o `repo`
(`ScopedRepository`, via `Depends(get_repo)`) e portanto a identidade da
conta (Art. 1). O log (`AiUsageLog`, tabela `ai_usage_logs`) é criado com
`repo.create(...)` e commitado **na mesma transação** da resposta, sem
savepoint e sem engolir exceção — se a gravação do custo falhar, a
requisição falha (Art. 9). É o oposto de propósito do `track()` de
`telemetry_service.py` (ver [`telemetry_service.md`](telemetry_service.md)),
que existe para *não* derrubar a requisição quando a telemetria falha; aqui
o dado é custo real em dinheiro, não instrumentação best-effort.

`cost_usd` é calculado por `custo_usd` (`app/core/precos_ia.py`) a partir da
tabela `PRECOS`, e é `Numeric(10,6)` **nullable**: um `model_name` fora da
tabela grava a linha com os tokens e `cost_usd=None`, nunca inventa um
preço nem descarta a linha — perder a contagem de tokens é pior do que não
saber o custo daquela linha específica.

## Tabelas que toca

Nenhuma, diretamente — `ai_service.py` não importa `ScopedRepository` nem
`Session`. Quem grava em `ai_usage_logs` é o endpoint (`product_router.py`),
não este módulo.

## O que quebra se você mexer aqui

- Mudar a assinatura de `extract_product_data` de novo (a tupla, ou a ordem
  dos dois elementos) exige atualizar o único chamador
  (`product_router.py::normalize_product`) e qualquer teste que a exercite
  diretamente.
- Mudar `GEMINI_MODEL` sem atualizar `PRECOS` em `app/core/precos_ia.py` faz
  todo log de custo daquele modelo novo gravar `cost_usd=NULL` — silencioso,
  porque é o comportamento correto para modelo desconhecido, não um erro.
- O `try/except` de `normalize_product` embrulha só a chamada de IA, nunca a
  gravação do log — mover a gravação para dentro do `try` faria um erro de
  banco (ex.: constraint, conexão) aparecer para o usuário como "Erro de
  conexão com IA".
