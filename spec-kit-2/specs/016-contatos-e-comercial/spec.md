# Spec 016 — Contatos e Comercial (leads → clientes)

| Campo | Valor |
|---|---|
| **Onda** | 4 |
| **Prioridade** | 3 |
| **Esforço** | G (2–3 semanas) |
| **Status** | Rascunho — **validar demanda no beta antes de executar** |
| **Cobre** | `MOD-4`, `MOD-6`, `MOD-7` |

---

## 1. Problema

O arquiteto perde negócio por falta de acompanhamento, não por falta de lead. Quem pediu orçamento há três semanas e não recebeu retorno vira cliente do concorrente.

Hoje o Arq Smart começa no projeto — ou seja, **depois** de o cliente já ter fechado. Todo o momento comercial acontece fora: WhatsApp, caderno, memória.

## 2. Ressalva sobre a origem

Este item **não veio de dor observada nos usuários**. Veio de benchmark: a Giovanna assistiu ao SIARQ e ao Monsi e anotou "copiar SIARQ", "comparar com o Monsi". São jobs que *outros produtos* atendem — não necessariamente jobs que os nossos usuários provaram ter conosco.

O risco é claro: três semanas de desenvolvimento num CRM que compete com o WhatsApp — que é gratuito, já instalado, e onde o cliente já está.

**Validação obrigatória antes de executar.** Perguntar aos 15 beta-testers: *"como você acompanha quem pediu orçamento e ainda não fechou?"*

- ≥8 descrevem um processo que os incomoda → executar.
- Descrevem "mando mensagem quando lembro", sem incômodo → **adiar** e registrar no `HISTORICO.md`.

## 3. Escopo

**Dentro:** Contatos > Clientes (`MOD-6`) · Contatos > Parceiros (`MOD-7`) · pipeline de leads em kanban com taxa de conversão (`MOD-4`) · lead ganho vira cliente · projeto vinculável a cliente.

**Fora:** WhatsApp Business API (custa e exige aprovação da Meta) · e-mail marketing · Marketing & Conteúdo (`SUG-5`) · formulário público de briefing (`SUG-8`) — mas é o **complemento natural**: sem entrada automática de lead, alguém precisa digitar cada um, e é aí que CRM de PME morre.

## 4. Comportamento

Etapas padrão, customizáveis: `Novo` → `Contato feito` → `Briefing` → `Proposta enviada` → `Negociação` → `Ganho` / `Perdido`.

```
Dado um lead em "Proposta enviada"
Quando o usuário arrasta para "Ganho"
Então o sistema oferece criar um cliente a partir do lead
E oferece criar um projeto vinculado a esse cliente
```

**Lead perdido exige motivo** (lista curta: preço, prazo, escolheu concorrente, sumiu, outro). É o dado que responde "por que eu perco negócio?" — e é o mais fácil de esquecer de coletar.

## 5. Dados

```sql
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    created_by UUID REFERENCES users(id),
    kind TEXT NOT NULL,                  -- CLIENT | PARTNER
    name TEXT NOT NULL,
    email TEXT, phone TEXT, document TEXT,
    partner_type TEXT, specialty TEXT,
    source TEXT, notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    contact_id UUID REFERENCES contacts(id),
    name TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'NEW',
    estimated_value NUMERIC(12,2),
    source TEXT,
    lost_reason TEXT,
    won_at TIMESTAMP WITH TIME ZONE,
    lost_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE projects ADD COLUMN contact_id UUID REFERENCES contacts(id);
```

⚠️ `projects.client_name` (texto) existe. Migrar para `contact_id` criando um contato por nome distinto **por conta**, mantendo o texto durante a transição.

**LGPD:** `contacts` guarda dado de cliente final — somos Operadores (Art. 12). Entra no export e na exclusão da spec 012, e é mascarado no replay.

## 6. Telemetria

| Evento | Propriedades |
|---|---|
| `lead_created` | `source`, `estimated_value_range` |
| `lead_stage_changed` | `from_stage`, `to_stage`, `days_in_stage` |
| `lead_won` | `days_to_close`, `value_range` |
| `lead_lost` | `lost_reason`, `days_in_pipeline` |
| `contact_created` | `kind` |

## 7. Critérios de aceite

- [ ] **Demanda validada com ≥8 dos 15 beta-testers antes de começar.**
- [ ] Kanban com arrastar e soltar, funcional no toque **e com alternativa por teclado** (Art. 6).
- [ ] Lead ganho vira cliente e oferece criar projeto, sem duplicar contato existente.
- [ ] Lead perdido exige motivo.
- [ ] Taxa de conversão e tempo médio por etapa visíveis.
- [ ] Telefone com máscara brasileira, reutilizando o componente do design system.
- [ ] Migração de `client_name` sem perda, conferida por contagem.
- [ ] Isolamento por conta.
- [ ] Contatos incluídos no export e na exclusão de dados (spec 012).
- [ ] Dados de contato mascarados no replay.
- [ ] Doc de dev + artigos de usuário.
