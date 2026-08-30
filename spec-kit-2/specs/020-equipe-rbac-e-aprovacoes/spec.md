# Spec 020 — Equipe: permissões e aprovações

| Campo | Valor |
|---|---|
| **Onda** | 7 (pós-lançamento) |
| **Prioridade** | 3 |
| **Esforço** | G (3 semanas) |
| **Cobre** | `SUG-4`, `SUG-9` |

---

## 1. Problema

O dono do escritório quer que a equipe execute sem ver o financeiro nem as demandas estratégicas dele. Palavras da Giovanna, em 27/07:

> *"Inserir a possibilidade de ter tudo compartilhado com a equipe (sendo que a equipe vê o que eles têm pra fazer mas não conseguem ver o financeiro nem as demandas do dono do negócio) — **atualização pós lançamento**."*

E, no plano superior, aprovação do que a equipe cria (`SUG-9`).

O "pós lançamento" é dela. Esta spec existe para que, quando chegar a hora, o trabalho já esteja pensado — e, principalmente, para que a **fundação já tenha sido construída certo**.

## 2. A parte que importa agora

Multi-usuário muda a natureza do produto: `account_id` (tenant), `user_id` (quem está logado) e `created_by` (quem criou) deixam de ser a mesma coisa. Isso toca **toda consulta do sistema**.

Feito depois, sobre uma base com clientes pagando, exige migração delicada e um período em que os dois modelos convivem.

✅ **Por isso o Art. 2 da constitution e a spec 001 já separam os três conceitos desde o dia 1.** Quando esta spec chegar, a parte cara já estará feita — resta o motor de permissões e as telas.

Esta é a razão pela qual uma spec de Onda 7 aparece no kit hoje: a decisão que ela impõe ao presente já foi tomada.

## 3. Escopo

**Dentro:** múltiplos membros por conta · convite por e-mail · papéis `OWNER`, `MANAGER`, `MEMBER`, `VIEWER` · matriz de permissões · aprovação de despesas, apresentações e tarefas criadas por `MEMBER` · filtro "minhas tarefas".

**Fora:** papéis customizados · SSO/SAML · múltiplos escritórios por usuário.

## 4. Matriz de permissões

| Recurso | OWNER | MANAGER | MEMBER | VIEWER |
|---|---|---|---|---|
| Projetos — ver | todos | todos | atribuídos | todos |
| Projetos — criar/editar | ✅ | ✅ | atribuídos | ❌ |
| **Financeiro — ver** | ✅ | ✅ | ❌ | ❌ |
| Financeiro — lançar | ✅ | ✅ | com aprovação | ❌ |
| Biblioteca — ver | ✅ | ✅ | ✅ | ✅ |
| Biblioteca — editar | ✅ | ✅ | ✅ | ❌ |
| Precificação | ✅ | ✅ | ❌ | ❌ |
| Comercial / leads | ✅ | ✅ | ❌ | ❌ |
| Equipe e cobrança | ✅ | ❌ | ❌ | ❌ |
| Aprovar pendências | ✅ | ✅ | ❌ | ❌ |

**O `MEMBER` não vê financeiro em lugar nenhum** — nem em gráfico, nem em total de projeto, nem em export, nem em resposta de API. Meia implementação aqui é pior que nenhuma: o dono confiou que o dado estava escondido.

## 5. Dados

```sql
CREATE TABLE account_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    role TEXT NOT NULL,             -- OWNER, MANAGER, MEMBER, VIEWER
    invited_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (account_id, user_id)
);

CREATE TABLE project_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    UNIQUE (project_id, user_id)
);

CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    resource_type TEXT NOT NULL,    -- TRANSACTION, PRESENTATION, TASK
    resource_id UUID NOT NULL,
    requested_by UUID REFERENCES users(id),
    status TEXT DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Como a spec 001 já criou `accounts` e separou `account_id` de `user_id`, **não há migração de dados aqui** — só tabelas novas. Era este o ganho de fazer certo na fundação.

## 6. Motor de permissões

Função pura em `app/services/permissions.py`:

```python
def can(member: AccountMember, action: str, resource: Resource) -> bool: ...
```

A matriz da §4 mora em **um único lugar**. Espalhar regra de permissão por endpoint é como se perde o controle sobre quem vê o quê.

Aplicada em toda rota, com varredura no CI: rota sem verificação de permissão quebra o build — mesma mecânica das specs 001 e 018.

## 7. Disponibilidade por plano

`[DECISÃO PENDENTE]` A Giovanna sugeriu "plano mais caro". Proposta, a decidir junto com a diferenciação de planos (que só acontece depois do lançamento com plano único):

| Plano | Membros | Aprovações |
|---|---|---|
| Básico | 1 | ❌ |
| Intermediário | até 3 | ❌ |
| Superior | até 10 | ✅ |

## 8. Telemetria

| Evento | Propriedades |
|---|---|
| `member_invited` / `member_accepted` | `role` |
| `member_removed` | `role`, `days_active` |
| `project_assigned` | — |
| `approval_requested` / `_decided` | `resource_type`, `decision`, `hours_pending` |

## 9. Critérios de aceite

- [ ] Convite por e-mail com aceite; expira em 7 dias.
- [ ] Limite de membros vindo dos entitlements (Art. 3).
- [ ] `MEMBER` não acessa nenhum dado financeiro — **verificado endpoint por endpoint**, não só na interface.
- [ ] `MEMBER` vê só projetos atribuídos.
- [ ] Recurso criado por `MEMBER` nasce pendente e não conta em relatório até ser aprovado.
- [ ] Aprovar ou rejeitar notifica quem criou.
- [ ] **Teste automatizado da matriz completa**: cada papel × cada recurso × ver/criar/editar/excluir.
- [ ] Varredura no CI de rota sem verificação de permissão.
- [ ] Doc de dev + artigos de usuário.

## 10. Riscos

- **Risco:** vazar financeiro para `MEMBER` por um endpoint esquecido. → Motor único + teste da matriz completa + varredura no CI. Os três juntos, porque um só não basta.
- **Risco:** a Giovanna pediu isso e o beta pode revelar que ninguém mais quer. → É Onda 7 justamente por isso. Antes de executar, perguntar aos usuários quantos têm equipe.
