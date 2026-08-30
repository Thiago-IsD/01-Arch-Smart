# Spec 018 — Admin Master

| Campo | Valor |
|---|---|
| **Onda** | 5 |
| **Prioridade** | 5 |
| **Esforço** | G (3 semanas) |
| **Cobre** | `ADM-1` a `ADM-4` |

---

## 1. Problema

Hoje, investigar a conta de um usuário significa abrir o Postgres. Funciona com 4 pessoas e 0 pagantes. Com 15 beta-testers já é desconfortável; com clientes pagando é risco operacional — e, dependendo do que se consulta, exposição desnecessária de dado pessoal sob LGPD.

Há também um risco de margem hoje invisível: **um usuário pesado de IA pode custar mais do que a assinatura dele**. Sem cota e sem visibilidade de custo por conta, isso só aparece na fatura do provedor, no fim do mês, quando já aconteceu.

## 2. Ordem de entrega

**Módulo 1 → 2 → 4 → 3.** O módulo 1 sozinho já elimina o acesso direto ao banco. Entregue e coloque em uso antes de começar o 2 — três semanas de admin entregues de uma vez é o tipo de coisa que atrasa e não serve a ninguém no meio do caminho.

## 3. Os 4 módulos

### Módulo 1 — Contas e Projetos
Lista com busca e filtros · detalhe (assinatura, uso, projetos, último acesso) · ações (suspender, ajustar limites, conceder slot, resetar senha) · **impersonation** (§5).

### Módulo 2 — Tokens de IA e Custos
Consumo por conta, período e feature · custo em USD e BRL com câmbio configurável · **cotas com soft limit (avisa em 80%) e hard limit (bloqueia)** · unit economics (custo de IA ÷ receita) · alerta quando uma conta passa de X% do ticket.

### Módulo 4 — Planos e Pagamentos
Construtor de planos: nome, preço, `max_projects`, cota de IA, features — **sem deploy** (Art. 3) · cupons e trials · inadimplência via gateway (spec 019) · dashboard de MRR, churn, LTV, ARPU.

> Simplificado pela decisão de 18/08: **um plano no lançamento**. A estrutura já é a definitiva; só o conteúdo é menor.

### Módulo 3 — Uso e Telemetria
Funil de ativação (reaproveita a spec 003) · **saúde do Web Clipper**: capturas/dia, taxa de erro **por domínio**, últimas falhas · engajamento (DAU/WAU/MAU, retenção por coorte) · **audit log** imutável · acesso ao session replay por conta.

A saúde do Clipper é o painel mais estratégico dos quatro: é o funil de entrada do moat. Se ele quebra num fornecedor popular, o produto perde dado sem ninguém notar.

## 4. Segurança

Maior superfície de risco do produto.

- Só `role = ADMIN`. Verificação **no backend, em toda rota** — nunca por esconder o link no menu.
- Rotas sob `/api/v1/admin/*`, com dependência de autorização própria e varredura automatizada no CI.
- Toda ação em `admin_audit_logs`: quem, o quê, quando, IP, antes/depois.
- Dados sensíveis mascarados por padrão; revelar gera registro em log.
- `[DECISÃO PENDENTE]` 2FA para contas ADMIN. **Recomendação: sim, antes do primeiro cliente pagante.**

## 5. Impersonation

Poderosa e perigosa:

- Motivo escrito **obrigatório** antes de iniciar.
- Banner permanente e inescapável: *"Você está vendo como Fulana — Sair"*.
- Sessão expira em 30 minutos.
- **Somente leitura por padrão**; escrita exige confirmação adicional.
- Tudo registrado no audit log, marcado como impersonation.
- `[DECISÃO PENDENTE]` Notificar o usuário por e-mail quando a conta dele for acessada. **Recomendação: sim** — custa pouco e é o tipo de transparência que constrói confiança num produto novo, além de favorecida pela LGPD.

## 6. Dados

```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price_month NUMERIC(10,2),
    max_projects INTEGER,
    max_ai_tokens_month INTEGER,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    reason TEXT,
    payload_before JSONB,
    payload_after JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ai_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    period_start DATE NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    soft_limit_notified_at TIMESTAMP WITH TIME ZONE,
    hard_limit_hit_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (account_id, period_start)
);
```

`admin_audit_logs` sem endpoint de `UPDATE` ou `DELETE`. Log auditável que pode ser editado não é log.

## 7. Comportamento de cota

```
Dado uma conta com cota de 100.000 tokens/mês
Quando atinge 80.000
Então recebe aviso no app e por e-mail, com o caminho de upgrade

Quando atinge 100.000
Então as features de IA são bloqueadas com mensagem clara e botão de upgrade
E o restante do produto continua funcionando normalmente
```

**Cota estourada nunca bloqueia o produto inteiro.** Bloqueia só a IA. O arquiteto ainda precisa acessar os projetos dele — um bloqueio total no meio de uma reunião com cliente é motivo de cancelamento imediato.

## 8. Telemetria

| Evento | Propriedades |
|---|---|
| `admin_action_performed` | `action`, `target_type` |
| `impersonation_started` / `_ended` | `target_account_id`, `duration_seconds`, `reason` |
| `ai_quota_soft_limit_reached` | `plan_type`, `percent_used` |
| `ai_quota_hard_limit_reached` | `plan_type` |
| `plan_updated_by_admin` | `plan_code`, `field_changed` |

## 9. Critérios de aceite

- [ ] Os 4 módulos acessíveis só a `ADMIN`, verificado no backend em toda rota.
- [ ] Varredura no CI: rota admin sem verificação quebra o build.
- [ ] Investigar uma conta completa **sem abrir o banco**.
- [ ] Alterar plano, `max_projects` e cota pela interface, sem deploy.
- [ ] Cota com soft e hard limit funcionando; IA bloqueada e produto funcionando.
- [ ] Custo de IA por conta, por mês, em USD e BRL.
- [ ] Impersonation com motivo, banner, expiração de 30 min, somente leitura e log.
- [ ] Audit log imutável registrando toda ação.
- [ ] Saúde do Web Clipper com taxa de erro **por domínio**.
- [ ] MRR, churn e ARPU conferidos contra o gateway (spec 019).
- [ ] Dados sensíveis mascarados por padrão.
- [ ] Doc de dev do módulo.

## 10. Riscos

- **Risco:** virar projeto de dois meses. → Entregar por módulo, na ordem 1 → 2 → 4 → 3.
- **Risco:** superfície de ataque. → §4 e §5. 2FA antes do primeiro pagante.
- **Risco:** impersonation usada por conveniência. → Motivo obrigatório + log + notificação ao usuário.
