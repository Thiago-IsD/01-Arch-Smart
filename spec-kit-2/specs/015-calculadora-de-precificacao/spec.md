# Spec 015 — Calculadora de Precificação (Padrão Milar)

| Campo | Valor |
|---|---|
| **Onda** | 4 |
| **Prioridade** | 4 |
| **Esforço** | G (2 semanas) |
| **Responsável** | Thiago · validação: Giovanna |
| **Cobre** | `EPIC-CALC` |

---

## 1. Problema

O Arq Smart calcula o custo do **material** que o arquiteto especifica. Não calcula o preço do **serviço** que o arquiteto vende.

Essa é a dor mais silenciosa e mais cara da profissão: o arquiteto brasileiro precifica por comparação com o colega, por chute ou por m² sem base de custo. O resultado é projeto vendido abaixo do custo, descoberto três meses depois.

A Giovanna trouxe a planilha "Padrão Milar" — o método que ela usa de verdade no escritório dela, com valor-hora derivado do salário-alvo, horas por tipo de ambiente, fatores condicionantes, custos diretos e parcelamento.

**Insight da análise da planilha:** todos os valores unitários são derivados. `Quarto = R$ 290,91` não é arbitrário — é `(8.000 ÷ 176 h) × 6,4 h`. A planilha inteira é uma função do **salário-alvo**. Ou seja, a calculadora pode ser personalizada por arquiteto mudando **um campo**, em vez de reconfigurar 30 valores.

## 2. Escopo

**Dentro:** premissas por conta (salário-alvo, horas mensais, markup) · catálogo de serviços e ambientes em horas, editável · 11 fatores condicionantes · custos diretos · parcelamento com juros · memória de cálculo exportável · vínculo opcional com projeto.

**Fora:** precificação por m² ou tabela CAU/IAB · emissão de contrato · comparação com preço praticado por outros usuários (interessante, mas envolve privacidade e volume que não existem ainda — Onda 7, e só agregado).

## 3. Modelo de cálculo

### Valor-hora

```
valor_hora = salario_alvo / horas_mensais       # padrão: 8.000 / 176 = R$ 45,45
```

### Horas por item

| Serviço | Horas | R$ padrão | | Ambiente | Horas | R$ padrão |
|---|---|---|---|---|---|---|
| Análise de Restrições | 6,4 | 290,91 | | Quarto | 6,4 | 290,91 |
| Estudo de Legislação | 3,2 | 145,45 | | Banheiro | 9,6 | 436,36 |
| Briefing | 11,2 | 509,09 | | Lavabo | 9,6 | 436,36 |
| Visita em Loja | 2,4 | 109,09 | | Cozinha | 12,8 | 581,82 |
| Assessoria Técnica Online | 0,4 | 18,18 | | Sala | 6,4 | 290,91 |
| Assessoria Técnica Presencial | 2,4 | 109,09 | | Varanda | 6,4 | 290,91 |
| | | | | Área de Serviço | 6,4 | 290,91 |
| | | | | Despensa | 3,2 | 145,45 |
| | | | | Área Externa | 8,0 | 363,64 |
| | | | | Corredor | 3,2 | 145,45 |
| | | | | Escritório | 6,4 | 290,91 |
| | | | | Closet | 3,2 | 145,45 |
| | | | | Garagem | 3,2 | 145,45 |

**Armazenar horas, não valores.** Mudar o salário-alvo recalcula tudo sozinho.

### Fatores condicionantes

| Fator | Opções |
|---|---|
| Grau de dificuldade | Muito baixo 1,0 · Baixo 1,1 · Médio 1,2 · Alto 1,3 · Muito alto 1,5 |
| Nível de exigência do cliente | Nulo 0,0 · Muito baixo 0,05 · Baixo 0,1 · Médio 0,5 · Alto 1,0 · Muito alto 4,0 |
| Construção ou reforma | Reforma de interiores 0,0 · Reforma arquitetônica 0,5 · Construção 1,0 |
| Levantamento de medidas | Contém 0,07 · Não contém 0,105 |
| Renderização | Fazer 0,5 · Não 0,0 |
| Estimativa de custo | Fazer 0,5 · Não 0,0 |
| Ajuste de proposta | 0,1 por ajuste |
| Projeto executivo / compatibilização | Fazer 2,0 · Não 0,0 |
| Lista de materiais | Fazer 0,03 · Não 0,0 |
| Detalhamento interno de marcenaria | Fazer 0,27 · Não 0,0 |
| Paisagismo | Fazer 0,55 · Não 0,0 |

`[DECISÃO PENDENTE — BLOQUEIA A IMPLEMENTAÇÃO]` **Como os fatores se combinam.** A planilha lista os fatores, mas a fórmula de composição não é auto-evidente:

- **Multiplicativa** `∏(1 + fator)` → com tudo ativo passa de 20×. Improvável.
- **Aditiva** `(1 + Σ fatores)` → ~10×. Alto, mas coerente com projeto que inclui executivo, marcenaria e paisagismo.
- **Híbrida** → dificuldade é multiplicador (1,0–1,5) e o resto é somado. Explica por que só a dificuldade usa escala começando em 1,0 enquanto todos os outros começam em 0,0.

**Recomendação: híbrida.**

```
valor_hora        = salario_alvo / horas_mensais
subtotal_servicos = Σ (horas × qtd × valor_hora)
subtotal_ajustado = subtotal_servicos × dificuldade × (1 + Σ demais_fatores)
com_markup        = subtotal_ajustado × (1 + markup)
TOTAL             = com_markup + Σ custos_diretos
```

⚠️ **Não implementar sem 30 minutos com a Giovanna e a planilha aberta**, rodando 3 projetos reais dela. Calculadora de precificação que erra é pior que nenhuma: o arquiteto perde dinheiro confiando nela.

### Custos diretos

Somados no fim, **sem markup e sem fatores** (são reembolso de custo, não serviço): relatório de obra 177,78 · RRT 125,40 · brinde 29,90 · impressão 200,00 · fotos antes/depois · reuniões com cliente 44,44 · terceirização de 3D/executivo/levantamento 200,00 · relatório de melhorias · visitas · alimentação em campo 50,00. Todos configuráveis.

### Parcelamento

```
i = (1 + taxa_ano) ** (1/12) - 1                     # padrão: SELIC 15% a.a.
parcela = TOTAL × [ i × (1+i)^n ] / [ (1+i)^n - 1 ]  # Price, n de 1 a 6
```

`[DECISÃO PENDENTE]` SELIC pura ou SELIC + spread? Cobrar SELIC pura significa financiar o cliente a custo zero de spread. Decisão de negócio.

## 4. Arquitetura do motor

Função **pura** em `app/services/pricing/engine.py`: sem I/O, sem ORM, testável sem banco. `Decimal` em tudo — **nunca `float` para dinheiro**. Arredondamento `ROUND_HALF_UP` em 2 casas, aplicado só ao total e às parcelas; intermediários mantêm precisão.

O motor Python é **autoritativo**. O front faz um cálculo otimista para o total na lateral atualizar sem espera, e confirma com `POST /pricing/calculate` (debounce 400 ms). O valor salvo é sempre o do backend.

Para impedir divergência silenciosa entre as duas implementações: `tests/fixtures/pricing_cases.json` roda contra as duas no CI; divergência acima de R$ 0,01 quebra o build.

## 5. Dados

```sql
CREATE TABLE pricing_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) UNIQUE,
    target_salary NUMERIC(12,2) DEFAULT 8000.00,
    monthly_hours NUMERIC(6,2) DEFAULT 176.00,
    markup NUMERIC(5,4) DEFAULT 0.25,
    interest_rate_year NUMERIC(5,4) DEFAULT 0.15
);

CREATE TABLE pricing_service_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id),   -- NULL = padrão do sistema
    name TEXT NOT NULL,
    kind TEXT NOT NULL,                        -- SERVICE | ROOM | DIRECT_COST
    hours NUMERIC(6,2),
    fixed_cost NUMERIC(10,2),
    is_system BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE pricing_quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    project_id UUID REFERENCES projects(id),
    client_name TEXT,
    inputs JSONB NOT NULL,
    breakdown JSONB NOT NULL,     -- memória de cálculo congelada
    total_value NUMERIC(12,2) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

`breakdown` congelado é essencial: se o usuário mudar o salário-alvo depois, **o orçamento já enviado ao cliente não pode mudar de valor**.

Item de sistema editado gera **cópia** na conta do usuário (*copy-on-write*), com opção de restaurar padrão.

## 6. UI

Assistente em 4 passos, com o total sempre visível na lateral, atualizando a cada mudança:

1. **Premissas** — salário-alvo, horas, markup (pré-preenchido; a maioria só confirma)
2. **Escopo** — serviços e ambientes, com quantidade
3. **Características** — os 11 fatores, cada um com uma linha explicando o efeito
4. **Fechamento** — custos diretos, parcelamento, resultado

A tela de resultado abre a **memória de cálculo**: quanto de serviço, de fator, de markup, de custo direto. Ver o "porquê" do número é o que dá ao arquiteto coragem de defender o preço na frente do cliente — e é o que diferencia isto de uma calculadora qualquer.

## 7. Telemetria

| Evento | Propriedades |
|---|---|
| `pricing_settings_updated` | `target_salary_changed`, `markup_changed` |
| `pricing_calculated` | `total_value_range`, `rooms_count`, `factors_used[]` |
| `pricing_quote_saved` | `linked_to_project` |
| `pricing_quote_exported` | `format` |

## 8. Critérios de aceite

- [ ] Fórmula ratificada pela Giovanna e documentada em ADR **antes do código**.
- [ ] 3 projetos reais dela batendo com a planilha (diferença <1%).
- [ ] Mudar o salário-alvo recalcula tudo automaticamente.
- [ ] Usuário edita horas e cria itens próprios; copy-on-write com restaurar padrão.
- [ ] Memória de cálculo exibida e exportável em PDF.
- [ ] Parcelamento de 1 a 6 com juros corretos; `n=1` sem juros.
- [ ] Orçamento salvo imune a mudança posterior de premissas.
- [ ] `Decimal` em todo cálculo; zero `float`.
- [ ] Teste de paridade Python ↔ TS no CI.
- [ ] Isolamento por conta em catálogos e orçamentos.
- [ ] Usável em celular — o arquiteto vai usar na frente do cliente.
- [ ] Doc de dev + artigo "Precificando um projeto".

## 9. Rollout

Feature flag `pricing_calculator`, ligada primeiro só para a Giovanna. Depois de validar os 3 projetos, liberar aos beta-testers com banner: *"Calculadora em validação — confira o resultado antes de enviar ao cliente."* Retirar o banner após 10 orçamentos sem correção reportada.

## 10. Riscos

- **Risco:** implementar a fórmula errada. → Bloqueado por §3. Não começar antes.
- **Risco:** virar formulário de 40 campos que ninguém preenche. → Passo 1 pré-preenchido, padrão razoável em tudo, o usuário só mexe no que importa.
- **Risco:** o método servir só para a Giovanna. → Perguntar a 5 beta-testers como precificam hoje. Se ≥3 reconhecerem o método, a hipótese se sustenta; senão, revisar antes de investir mais.
