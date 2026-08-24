# Spec 008 — Reescrita: Biblioteca de produtos e Web Clipper

| Campo | Valor |
|---|---|
| **Onda** | 2 · tela 4 de 7 |
| **Prioridade** | 5 |
| **Esforço** | G (2 semanas) |
| **Cobre** | `RW-04`, `GIO-1`, `GIO-3`, `JUR-2` |
| **Playbook** | `memory/playbook-reescrita.md` |

---

## 1. O que é, e por que é o módulo mais importante

A biblioteca é o acervo de produtos do arquiteto. O Web Clipper é a extensão que captura produto direto do site do fornecedor, e a IA preenche os campos estruturados (dimensões, preço, categoria, rendimento).

**Este é o funil de entrada do moat.** Todo o resto do produto consome esse dado. Se o Clipper falha silenciosamente num fornecedor popular, o produto perde valor sem ninguém perceber.

É também o módulo com **mais restrições jurídicas** — as 4 diretrizes do Art. 11 nascem aqui — e onde estava o pior bug do código antigo: o `accountId` fixo que fazia todos os usuários gravarem na mesma conta.

## 2. Escopo

**Dentro:**
- Biblioteca: lista, busca, filtro por categoria e fornecedor, detalhe.
- Cadastro manual de produto.
- Web Clipper: extensão + endpoint de captura.
- Preenchimento por IA, com custo registrado.
- **Seleção múltipla e adição em lote** (`GIO-3`).
- As 4 diretrizes de compliance (Art. 11).

**Paridade:** tudo que o módulo faz hoje continua funcionando (playbook). O inventário do que existe sai do código, na doc do módulo — não desta spec.

**Fora:**
- Catálogo compartilhado entre contas — vetado na forma atual (Art. 11 §1).
- Enriquecimento automático em lote — proibido (Art. 11 §4).
- Integração com API de fornecedor.

## 3. As 4 diretrizes obrigatórias (Art. 11)

Não são recomendações. São a condição de legalidade da feature.

| # | Diretriz | Como se verifica |
|---|---|---|
| 1 | **Isolamento de tenant** — item visível só para o `account_id` que capturou | teste de isolamento no CI + nenhuma rota pública (spec 005) |
| 2 | **Atribuição da fonte** — `source_url` visível no card, na prancha e no orçamento exportado | inspeção visual das 3 superfícies |
| 3 | **Canal de takedown** — endereço de compliance visível e fluxo de remoção | link no rodapé + formulário (spec 012) |
| 4 | **Gatilho humano** — captura sempre por clique do usuário | nenhum job de backend que capture; revisão de código explícita |

A diretriz 2 tem consequência de design: **todo card de produto exibe a loja de origem, clicável.** Não é rodapé em letra miúda — é atribuição.

## 3b. Confidencialidade de dado comercial

Regra que vale para qualquer informação que o arquiteto não quer que o cliente final veja — margem, custo de fornecedor, desconto profissional, observação interna. O inventário do que existe hoje sai do código, na doc do módulo.

⚠️ **Confidencialidade é regra de segurança, não de interface.** Esconder o campo no front e mandar o objeto inteiro na resposta da API é o mesmo erro de classe do `UX-03`. O endpoint do portal e dos exports ao cliente devolve um schema Pydantic **diferente**, sem os campos confidenciais — não o mesmo objeto com campos ocultos na tela.

Critério verificável: inspecionar o JSON da resposta, não a tela.

## 4. Comportamento

### Captura pelo Clipper

```
Dado que o arquiteto está numa página de produto e clica na extensão
Então a extensão extrai og:image / twitter:image / img principal, título, preço e URL
E envia ao endpoint com o token de sessão dele
E o item é gravado no account_id resolvido no SERVIDOR — nunca vindo da extensão

Se a extração falhar
Então o item é salvo com o que foi possível, marcado como "revisar"
E o evento clipper_capture_attempted registra o domínio e o que faltou
```

O último ponto é o que permite ao Admin Master (spec 018) mostrar "o Clipper está quebrando na Tok&Stok" antes que o usuário reclame.

### Preenchimento por IA (`GIO-1`)

A palavra **"preencher"** é a que aparece na interface. Nunca "normalizar" — é jargão de engenharia de dados e o arquiteto não reconhece.

```
Dado um item capturado com dados brutos
Quando o usuário aciona "Preencher com IA"
Então a IA estrutura dimensões, preço, categoria e rendimento
E o usuário revisa e confirma antes de salvar
E o custo é gravado em ai_usage_logs na mesma transação (Art. 9)
```

Revisão humana antes de salvar não é só qualidade: é o que impede o dado errado de contaminar o orçamento e chegar à obra.

### Seleção múltipla (`GIO-3`)

Pedido direto da Giovanna: *"são muitos itens, adicionar um a um não é produtivo"*.

```
Dado que o usuário filtrou a biblioteca por categoria "Móveis"
Quando marca vários itens ou usa "Selecionar todos do filtro"
Então uma barra fixa mostra "N itens selecionados"
Quando escolhe "Adicionar ao ambiente"
Então todos entram numa transação, com quantidades calculadas pelo Smart Core
```

No mobile: alvo de toque ≥44px e barra de ação acima da área do polegar.

### Cadastro manual (`UX-08`)

Largura, Altura e Profundidade com **rótulos fixos acima do campo**, não placeholders de uma letra que somem ao digitar. Cada um com `aria-label`.

## 5. Dados

```sql
ALTER TABLE library_items
  ADD COLUMN account_id UUID NOT NULL REFERENCES accounts(id),
  ADD COLUMN created_by UUID REFERENCES users(id),
  ADD COLUMN purchase_url TEXT,
  ADD COLUMN needs_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN clipped_domain TEXT;

-- As colunas de preço, margem e demais campos existentes permanecem como estão.
-- Confira o schema atual antes de migrar: esta spec só acrescenta o que é novo.

CREATE INDEX idx_library_account_category ON library_items (account_id, category);
CREATE INDEX idx_library_account_created ON library_items (account_id, created_at DESC);
```

`source_url` (de onde veio, obrigatório para a diretriz 2) e `purchase_url` (link que vai ao cliente) são campos distintos — o arquiteto pode querer mandar o link do fornecedor dele, não o da captura.

## 6. Performance

A biblioteca é a maior lista do produto (300+ itens é normal) e a mais pesada em imagem.

- Paginação ou rolagem infinita — nunca carregar tudo.
- `next/image` com `sizes`, `loading="lazy"` fora da primeira dobra.
- Busca com índice no banco, debounce de 300ms no cliente.
- Grid com media query abaixo de 390px — era exatamente onde quebrava.
- **Meta: ≤3 queries** para a listagem com filtros.

## 7. Telemetria

| Evento | Origem | Propriedades |
|---|---|---|
| `library_item_created` | servidor | `source` (`manual`\|`clipper`), `category`, `has_ai_data` |
| `clipper_capture_attempted` | servidor | `domain`, `success`, `fields_extracted`, `missing_fields` |
| `ai_fill_requested` | servidor | `model_name`, `token_count`, `cost_usd`, `latency_ms`, `success` |
| `ai_fill_corrected` | servidor | `fields_corrected[]` |
| `library_items_bulk_added` | servidor | `items_count`, `used_select_all` |
| `library_searched` | cliente | `has_results`, `filters_used[]` |
| `screen_viewed` | cliente | `screen`, `load_ms`, `is_empty` |

`ai_fill_corrected` é a métrica de **qualidade da IA**: quais campos o humano sempre precisa arrumar. Sem ela, não há como melhorar o prompt com base em evidência.

## 8. Critérios de aceite

- [ ] Playbook cumprido integralmente.
- [ ] `account_id` resolvido **no servidor**; nenhum identificador vindo da extensão é aceito.
- [ ] Teste de isolamento: item da conta A não aparece em nenhuma listagem ou busca da conta B.
- [ ] `source_url` visível e clicável no card, na prancha e no orçamento exportado.
- [ ] Nenhum caminho de captura automatizada no backend.
- [ ] Link de takedown acessível a partir do módulo.
- [ ] Seleção múltipla com "selecionar todos do filtro"; **20 itens adicionados em menos de 30 segundos**, cronometrado.
- [ ] Rótulos fixos em L/A/P, com `aria-label`.
- [ ] Nenhum campo comercial confidencial no schema de resposta do portal ou dos exports ao cliente — verificado inspecionando o JSON, não a tela.
- [ ] Interface diz "Preencher", nunca "normalizar".
- [ ] Custo de IA gravado em toda chamada.
- [ ] Falha de captura registrada com domínio e campos faltantes.
- [ ] Listagem em ≤3 queries, dentro do orçamento com 300 itens.
- [ ] Grid legível em 360px.
- [ ] `docs/dev/modulos/biblioteca-clipper.md` + artigos "Capturando produtos", "Adicionando produtos manualmente", "Organizando por categoria".

## 9. Riscos

- **Risco:** o Clipper quebrar em fornecedores populares sem ninguém saber. → `clipper_capture_attempted` por domínio + painel de saúde no Admin Master.
- **Risco:** custo de IA descontrolado. → Cota por conta (spec 018) e custo registrado desde já.
- **Risco:** alguém propor um catálogo compartilhado "porque seria ótimo". → Está vetado no Art. 11 §1. Se for feito, só agregado e anonimizado (Onda 7).
- **Risco:** repetir o `UX-07`. → O `ScopedRepository` da spec 001 torna estruturalmente difícil; o teste de CI torna detectável.
