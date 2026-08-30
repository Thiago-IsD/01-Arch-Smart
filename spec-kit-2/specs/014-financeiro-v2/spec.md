# Spec 014 — Financeiro v2

| Campo | Valor |
|---|---|
| **Onda** | 4 |
| **Prioridade** | 4 |
| **Esforço** | M (1 semana) |
| **Cobre** | `MOD-2`, `MOD-3`, `SUG-1`, `SUG-2` |
| **Depende de** | spec 010 (reescrita do Wallet) |

---

## 1. Problema

A reescrita (spec 010) deixou o financeiro rápido, acessível e com máscara de dinheiro. Mas ele ainda não responde à pergunta que diferencia o Arq Smart de uma planilha: **"esse projeto deu lucro?"**

E ainda obriga o arquiteto a digitar a categoria do zero toda vez. A Giovanna pediu as duas coisas em 27/07.

## 2. Escopo

**Dentro:**
- Categorias pré-definidas de receita e despesa + personalizadas (`MOD-2`, `MOD-3`).
- Vínculo de transação a projeto → margem por trabalho (`SUG-1`).
- Gráficos com resumo trimestral, semestral e anual (`SUG-2`).

**Fora:**
- Metas financeiras (`SUG-3`) — Onda 7.
- Conciliação bancária, Open Finance, NF.
- Fluxo de caixa projetado.
- Aprovação de despesa lançada por equipe — spec 020.

## 3. Categorias

| Receitas | Despesas |
|---|---|
| Projeto arquitetônico | Softwares e assinaturas |
| Projeto de interiores | Marketing |
| Consultoria de Interiores | Impostos |
| Consultoria Imobiliária | Equipe e terceirizados |
| Assessoria de execução | Deslocamento |
| Honorários | Material de escritório |
| Comissão | Impressão e plotagem |
| Outros | Outros |

Alinhadas com a lista de serviços de `GIO-7` — a categoria financeira deve espelhar o que o arquiteto vende.

```
Dado o seletor de categoria
Então o usuário vê as do sistema mais as personalizadas dele
E tem "+ Nova categoria", que cria sem sair do diálogo
E a personalizada fica só na conta dele (Art. 1)
```

## 4. Margem por projeto

```
Dado que o usuário lança uma despesa
Quando escolhe "Vincular a um projeto"
Então seleciona entre os projetos ativos

Dado um projeto com transações vinculadas
Quando abre a aba Financeiro do projeto
Então vê receitas, despesas, margem em R$ e em %
```

`[DECISÃO PENDENTE]` A margem considera o custo do material especificado (que está em `project_items`) ou só as transações lançadas?

São coisas diferentes: material especificado é custo **do cliente**; despesa lançada é custo **do escritório**. Misturar produz um número que não significa nada.

**Recomendação: separar visualmente** — "Custo do projeto para o cliente" vs. "Resultado do escritório neste projeto". Ratificar com a Giovanna antes de implementar; é decisão de negócio, não de código.

## 5. Dados

```sql
CREATE TABLE transaction_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id),   -- NULL = categoria do sistema
    name TEXT NOT NULL,
    type TEXT NOT NULL,                        -- INCOME | EXPENSE
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN category_id UUID REFERENCES transaction_categories(id);
```

⚠️ Migrar o campo texto `category` existente para `category_id` sem perder dado: criar categoria personalizada para cada valor distinto já usado, **por conta**.

## 6. API

| Método | Rota |
|---|---|
| `GET` `POST` | `/api/v1/transaction-categories` |
| `GET` | `/api/v1/projects/{id}/financials` |
| `GET` | `/api/v1/transactions/summary?period=quarter\|semester\|year` |

## 7. Telemetria

| Evento | Propriedades |
|---|---|
| `transaction_created` | `type`, `category`, `linked_to_project`, `value_range` |
| `category_custom_created` | `type` |
| `project_financials_viewed` | — |
| `financial_summary_viewed` | `period` |

`linked_to_project` responde diretamente se `SUG-1` valeu o esforço. Se ninguém vincular, a margem por projeto é uma feature que ninguém pediu de verdade.

## 8. Critérios de aceite

- [ ] Categorias do sistema nos dois tipos; personalizada criável e isolada por conta.
- [ ] Migração de `category` → `category_id` sem perda, conferida por contagem.
- [ ] Transação vinculável a projeto (opcional).
- [ ] Aba Financeiro do projeto com receitas, despesas e margem.
- [ ] Decisão de §4 aplicada, com rótulos inequívocos na tela.
- [ ] Gráficos trimestral / semestral / anual, com cores por token e legíveis nos dois temas.
- [ ] Valores em faixas na telemetria, nunca exatos.
- [ ] Gráficos acessíveis em 390px.
- [ ] Doc de dev atualizada + artigo "Acompanhando o resultado de um projeto".
