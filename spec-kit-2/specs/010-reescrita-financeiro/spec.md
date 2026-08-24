# Spec 010 — Reescrita: Financeiro (Wallet)

| Campo | Valor |
|---|---|
| **Onda** | 2 · tela 6 de 7 |
| **Prioridade** | 4 |
| **Esforço** | M (5 dias) |
| **Cobre** | `RW-06`, `MOD-1` · guardas de regressão: `UX-09`, `UX-10`, `A11y-02` |
| **Playbook** | `memory/playbook-reescrita.md` |

---

## 1. Escopo desta tela

**Reescrita é paridade + qualidade.** Funcionalidade nova do financeiro (categorias, vínculo com projeto, gráficos) é a **spec 014**, na Onda 4.

O que entra aqui: lançar receita e despesa, listar, editar, excluir, ver totais do período — tudo isso com a qualidade do playbook.

Três classes de defeito que a auditoria já pegou uma vez ficam **impossíveis** de reintroduzir, pelo design system:
- `UX-09` — validação inline com Zod, em vez de toast genérico depois do submit.
- `UX-10` — máscara monetária pelo `CurrencyInput`.
- `A11y-02` — `htmlFor`/`id` pelo `FormField`.

Isso é o argumento inteiro a favor de fazer o design system antes das telas: três defeitos que já custaram uma auditoria não voltam, e ninguém precisou lembrar deles.

## 2. Correção de nomenclatura

A Giovanna registrou em 27/07: *"Uma nova receita não deveria ser entrada?"*

Na interface, **"Receita"** e **"Despesa"**. Nunca "entrada"/"saída". No banco os valores continuam `INCOME`/`EXPENSE`.

E `MOD-1` também some aqui, porque é reescrita: **receita não tem campo de validade** (não faz sentido) e passa a ter **data de inserção**, com padrão hoje.

## 3. Comportamento

```
Dado o usuário lançando uma receita
Quando digita 150000 no valor
Então o campo mostra R$ 1.500,00 durante a digitação
E a API recebe 1500.00

Quando deixa a descrição em branco e tenta salvar
Então a mensagem aparece em vermelho abaixo do campo — não em toast no canto
E o foco vai ao primeiro campo inválido
E o que já foi digitado não se perde
```

**Meta cronometrada: lançar uma receita completa em menos de 20 segundos.**

## 4. Dados

```sql
ALTER TABLE transactions
  ADD COLUMN account_id UUID NOT NULL REFERENCES accounts(id),
  ADD COLUMN created_by UUID REFERENCES users(id),
  ADD COLUMN inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE transactions ALTER COLUMN project_id DROP NOT NULL;

CREATE INDEX idx_transactions_account_date ON transactions (account_id, due_date DESC);
```

`project_id` opcional prepara a spec 014 sem antecipá-la — nem toda transação pertence a um projeto.

## 5. Requisitos específicos

**Dinheiro** — `Decimal` no backend, `NUMERIC(12,2)` no banco. Nunca `float`. Centavo errado num relatório financeiro destrói a confiança no produto inteiro.

**Replay** — todos os valores monetários mascarados. É a tela mais sensível do produto (Art. 12).

**Estado vazio** — "Registre sua primeira receita para acompanhar o resultado do escritório", com ação primária. Não "nenhuma transação encontrada".

**Cor** — receita e despesa por `--success` e `--destructive`, nunca `bg-emerald-600`/`bg-red-600` (Art. 7).

## 6. Telemetria

| Evento | Origem | Propriedades |
|---|---|---|
| `transaction_created` | servidor | `type`, `category`, `value_range`, `linked_to_project` |
| `transaction_deleted` | servidor | `type` |
| `screen_viewed` | cliente | `screen`, `load_ms`, `is_empty` |
| `form_abandoned` | cliente | `form`, `last_field` |

⚠️ `value_range` em faixas (`0-500`, `500-2000`, …), **nunca o valor exato**. Valor financeiro exato não vai para ferramenta de analytics de terceiro (Art. 12).

## 7. Critérios de aceite

- [ ] Playbook cumprido integralmente.
- [ ] Zero ocorrência de "entrada" como sinônimo de receita na interface.
- [ ] Receita sem campo de validade; com data de inserção padrão hoje.
- [ ] `CurrencyInput` formatando em tempo real — testado com centavos, milhares e colagem de texto.
- [ ] Validação inline abaixo do campo, sem toast genérico; nada digitado se perde.
- [ ] Lançar uma receita completa em <20 s, cronometrado com a Giovanna.
- [ ] `Decimal` em todo cálculo; zero `float`.
- [ ] Valores mascarados no replay — conferido.
- [ ] Cores por token.
- [ ] Estado vazio com ação primária.
- [ ] `docs/dev/modulos/financeiro.md` + artigo "Lançando receitas e despesas".

## 8. Risco

- **Risco:** aproveitar a reescrita para "já fazer as categorias e o vínculo com projeto". → É a regra nº 3 do roadmap: **funcionalidade nova não entra na Onda 2**. Está tudo escrito na spec 014, esperando. Deixar entrar aqui é o começo de uma reescrita que não termina.
