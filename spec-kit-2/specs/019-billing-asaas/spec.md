# Spec 019 — Billing e gateway (Asaas)

| Campo | Valor |
|---|---|
| **Onda** | 6 — **última feature do roadmap** |
| **Prioridade** | 5 |
| **Esforço** | G (3 semanas) |
| **Responsável** | Thiago · premissas comerciais: João Lucas |
| **Cobre** | `BILL-1` a `BILL-5` |

---

## 1. Por que por último

Decisão do Thiago: a integração depende de **criar a conta no Asaas e obter as chaves de API** — que ainda não existem. Construir contra uma API que não se tem acesso produz código que não se testa.

Além disso, cobrar é a única coisa do roadmap que não pode ser validada no beta (que é gratuito). Todo o resto ganha em ser exposto a usuários antes.

⚠️ **Mas o cadastro e a homologação no Asaas devem começar em paralelo à Onda 4**, não quando esta spec iniciar. Homologação de PIX e boleto envolve burocracia bancária que leva semanas e não depende de nenhuma linha de código.

## 2. Gateway: Asaas — decidido

Confirmado pelo Thiago. O que sustenta a escolha, com o escopo atual:

| Critério | Asaas |
|---|---|
| PIX nativo | ✅ |
| Boleto nativo | ✅ |
| Assinatura recorrente | ✅ |
| Aceita **pessoa física** | ✅ — relevante porque o CNPJ está adiado (decisão de 11/08) |
| NFS-e integrada | ✅ — **fora do escopo agora**, mas disponível quando o CNPJ existir |

A Stripe também aceita pessoa física no Brasil, mas é fraca em boleto — e boleto e PIX são como o arquiteto autônomo brasileiro paga. Registrar como ADR 0003 (spec 004).

## 3. Escopo simplificado pelas decisões de 18/08

**Dentro:** assinatura recorrente mensal de **um único plano** · cartão, PIX e boleto · trial · transição para `READ_ONLY` · slot avulso (pay-per-project) · webhooks idempotentes · dunning · preço-base + tributo destacado (IBS/CBS).

**Fora, por decisão explícita:**
- ❌ Plano anual — adiado por complexidade de reembolso em cancelamento antecipado.
- ❌ Emissão de NFS-e — adiado; a empresa não emitirá nota inicialmente.
- ❌ Múltiplos planos no lançamento — Solo/Pro/Studio ficam para depois.
- ❌ Cobrança por uso de IA — a cota da spec 018 já protege a margem.
- ❌ Múltiplas moedas, programa de afiliados.

## 4. Estados de assinatura

Os três do Termo de Uso publicado (Art. 3): **`BETA` → `ACTIVE` → `READ_ONLY`**.

```
BETA        conta do piloto, gratuita
ACTIVE      assinatura em dia
READ_ONLY   trial expirado, inadimplente ou cancelado
```

`READ_ONLY` significa: **acessa e exporta tudo que já criou, não cria projeto novo.** Nunca bloquear o acesso ao próprio trabalho — gera reclamação pública e não converte ninguém. E o Termo de Piloto promete explicitamente que o participante pode "exportar e cancelar sua conta sem custos".

### Founder Discount

O Termo de Piloto promete condição especial de sócio-fundador ao fim do beta. Modelar como cupom permanente aplicado à conta, não como preço diferente — assim ele sobrevive a mudanças de tabela.

## 5. Comportamento

### Trial

```
Dado um cadastro novo (pós-beta)
Então recebe 14 dias de trial, sem cartão
E vê os dias restantes no produto, com avisos em D-3 e D-1

Ao fim do trial sem assinatura
Então a conta vira READ_ONLY
```

### Slot avulso

Pagamento único, sem expiração. Ao criar projeto além da cota, o produto oferece: assinar **ou** comprar um slot. Entra no `max_projects` efetivo do `GET /me`.

### Inadimplência (dunning)

D+1 e-mail · D+3 aviso no app · D+7 nova tentativa · D+10 `READ_ONLY` · D+30 aviso de exclusão em 90 dias.

### Webhooks

Assinatura verificada e **idempotência por `event_id`**. Gateway reenvia evento — processar duas vezes uma cobrança é o tipo de bug que custa a confiança do cliente para sempre.

### Tributo por fora (IBS/CBS)

A partir de janeiro, IBS e CBS substituem cinco impostos e o tributo passa a ser somado **por fora** do preço, em vez de embutido.

O modelo já prevê `price_base` + `tax_amount` + `price_total`, com `tax_amount = 0` enquanto não se aplicar. A tela mostra o que o cliente paga e o que é tributo. Construir isso depois, sobre assinaturas ativas, é migração de preço — construir agora custa uma coluna.

## 6. Dados

```sql
ALTER TABLE accounts
  ADD COLUMN gateway_provider TEXT DEFAULT 'asaas',
  ADD COLUMN gateway_customer_id TEXT,
  ADD COLUMN gateway_subscription_id TEXT,
  ADD COLUMN plan_id UUID REFERENCES plans(id),
  ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN canceled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN payment_method TEXT,
  ADD COLUMN founder_discount BOOLEAN DEFAULT FALSE;

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    gateway_payment_id TEXT UNIQUE,
    price_base NUMERIC(10,2) NOT NULL,
    tax_amount NUMERIC(10,2) DEFAULT 0,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL,          -- PENDING, PAID, FAILED, REFUNDED
    method TEXT,                   -- CREDIT_CARD, PIX, BOLETO
    due_date DATE,
    paid_at TIMESTAMP WITH TIME ZONE,
    invoice_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE subscription_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    type TEXT NOT NULL,            -- PROJECT_SLOT
    quantity INTEGER DEFAULT 1,
    payment_id UUID REFERENCES payments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT,
    payload JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (provider, event_id)      -- idempotência
);
```

Campo `gateway_provider` desde o início, mesmo com um provedor só. Trocar de gateway depois com a coluna chamada `asaas_customer_id` é a mesma dívida que o `stripe_customer_id` do código antigo criou.

## 7. Camada de abstração

```
app/services/billing/
├── gateway.py      # interface abstrata
├── asaas.py        # implementação
└── service.py      # regra de negócio, agnóstica de provedor
```

Nenhum código de negócio importa o SDK do Asaas diretamente. Trocar de provedor toca um arquivo.

## 8. API

| Método | Rota |
|---|---|
| `GET` | `/api/v1/billing/plans` |
| `GET` | `/api/v1/billing/subscription` |
| `POST` | `/api/v1/billing/checkout` |
| `POST` | `/api/v1/billing/cancel` |
| `POST` | `/api/v1/billing/addons/project-slot` |
| `GET` | `/api/v1/billing/payments` |
| `POST` | `/api/v1/webhooks/asaas` |

## 9. Telemetria

| Evento | Propriedades |
|---|---|
| `checkout_started` | `payment_method`, `from_trial` |
| `subscription_created` | `payment_method`, `founder_discount` |
| `trial_started` / `trial_ended` | `converted` |
| `subscription_canceled` | `days_active`, **`reason`** |
| `payment_failed` | `attempt_number`, `method` |
| `project_slot_purchased` | `quantity` |

**`subscription_canceled.reason` exige perguntar o motivo no cancelamento.** É a informação mais barata e mais subaproveitada em SaaS — quem está saindo não tem motivo para ser gentil, e é o que mais orienta o roadmap depois do lançamento.

## 10. Critérios de aceite

- [ ] Conta Asaas criada, homologada para PIX e boleto, com chaves em variável de ambiente.
- [ ] Preço do plano único definido e cadastrado em `plans`.
- [ ] Assinar com cartão, PIX e boleto, ponta a ponta, em produção.
- [ ] PIX mostra QR Code e copia-e-cola; boleto mostra linha digitável.
- [ ] Trial de 14 dias sem cartão, com transição para `READ_ONLY`.
- [ ] `READ_ONLY` permite acessar e **exportar** tudo; não permite criar projeto.
- [ ] Slot avulso comprável, refletido no `max_projects` efetivo.
- [ ] **Webhooks idempotentes** — reenviar o mesmo evento não duplica cobrança nem crédito, provado com reenvio manual.
- [ ] Dunning executando nos prazos de §5.
- [ ] Founder Discount aplicável como cupom permanente.
- [ ] `price_base` + `tax_amount` no modelo e na tela, mesmo com tributo zero.
- [ ] Nenhuma chave de gateway no front-end (Art. 4).
- [ ] Ciclo completo em sandbox: assinar, pagar, falhar, estornar, cancelar.
- [ ] **Teste em produção com valor baixo, cobrado e estornado.**
- [ ] MRR do Admin Master conferido contra o painel do Asaas.
- [ ] Cancelamento e `READ_ONLY` **nunca** apagam dado do usuário.
- [ ] Doc de dev + artigos "Assinando o Arq Smart" e "Formas de pagamento".

## 11. Riscos

- **Risco:** homologação de PIX/boleto demorar. → Começar em paralelo à Onda 4. É o único item desta spec cujo prazo não depende do dev.
- **Risco:** preço não definido a tempo. → João Lucas. Precisa estar pronto **antes do fim do beta**, para que a pergunta de intenção de pagar seja feita com o número real na mesa.
- **Risco:** webhook processado duas vezes. → `UNIQUE (provider, event_id)`, testado com reenvio manual.
- **Risco:** cobrar errado. → Sandbox obrigatório; produção só depois de um ciclo completo simulado, incluindo falha e estorno.
