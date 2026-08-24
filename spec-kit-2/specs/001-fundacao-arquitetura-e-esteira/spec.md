# Spec 001 — Fundação: arquitetura, multi-tenancy e esteira

| Campo | Valor |
|---|---|
| **Onda** | 1 |
| **Prioridade** | 5 |
| **Esforço** | M (4–5 dias) |
| **Responsável** | Thiago |
| **Cobre** | `EPIC-ARCH`, `EPIC-ENT`, `EPIC-CI` · previne `UX-03`, `UX-04`, `UX-07` |

---

## 1. Problema

A reescrita vai produzir sete telas. Se cada uma inventar seu próprio jeito de resolver a conta do usuário, de ler o limite do plano ou de chegar ao banco, teremos sete jeitos diferentes — e pelo menos um deles vai estar errado. Foi exatamente assim que nasceu o `accountId` fixo do código antigo.

Esta spec constrói o chão. Nenhuma tela começa antes dela.

## 2. Resultado esperado

Um dev cria um endpoint novo e ele já nasce isolado por conta, com entitlements corretos, migração versionada e teste de isolamento rodando — sem precisar decidir nada.

## 3. Escopo

**Dentro:**
- Modelo de identidade: `accounts`, `account_id` / `user_id` / `created_by`.
- Resolução de conta no servidor, como dependência injetável.
- Entitlements por conta em `GET /api/v1/me`.
- Camada de acesso a dados que **obriga** o filtro por conta.
- Teste de isolamento genérico, rodando no CI.
- Esteira: lint, tipos, testes, migração e deploy automático.
- Estrutura de pastas do backend e do frontend.

**Fora:**
- Telas (Onda 2).
- Multi-usuário por conta (spec 020) — mas o **modelo** já suporta.
- Migração para AWS (Art. 14).

## 4. Modelo de identidade

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_user_id UUID,
    subscription_status TEXT NOT NULL DEFAULT 'BETA',  -- BETA | ACTIVE | READ_ONLY
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN account_id UUID REFERENCES accounts(id);

-- Toda tabela de dado do cliente:
--   account_id UUID NOT NULL REFERENCES accounts(id)
--   created_by UUID REFERENCES users(id)
```

Hoje toda conta tem um usuário só, e `account_id = users.account_id` sempre. Isso vai deixar de ser verdade na spec 020, e o modelo já está pronto (Art. 2).

`subscription_status` usa os três valores do Termo de Uso publicado: `BETA`, `ACTIVE`, `READ_ONLY` (Art. 3).

## 5. Resolução de conta

```python
# app/core/security.py

async def get_current_context(token: str = Depends(oauth2)) -> RequestContext:
    """Resolve usuário e conta a partir do token. Única fonte de verdade."""
    ...

@dataclass(frozen=True)
class RequestContext:
    user_id: UUID
    account_id: UUID
    role: str
    entitlements: Entitlements
```

Regras absolutas:
- `account_id` **nunca** vem do corpo, da query string ou de header do cliente. Se vier, é ignorado.
- Nenhum endpoint recebe `account_id` como parâmetro.
- Toda query passa pelo repositório, que exige o `RequestContext`.

### Acesso a dados que obriga o filtro

O jeito mais confiável de garantir isolamento não é lembrar de filtrar — é tornar impossível esquecer:

```python
# app/db/repository.py
class ScopedRepository:
    def __init__(self, session, ctx: RequestContext):
        self._session, self._ctx = session, ctx

    def query(self, model):
        if not hasattr(model, "account_id"):
            raise TypeError(f"{model.__name__} não é escopado por conta")
        return self._session.query(model).filter(model.account_id == self._ctx.account_id)
```

Se alguém usar `session.query()` direto num model escopado, o lint personalizado acusa. Isso transforma uma regra de disciplina em erro de build.

## 6. Entitlements

```
GET /api/v1/me
{
  "user":    { "id", "email", "full_name", "office_name", "role" },
  "account": { "id", "name", "subscription_status" },
  "entitlements": {
    "max_projects": 2,
    "max_ai_tokens_month": 100000,
    "features": ["clipper", "export_pdf", "export_excel"]
  }
}
```

Alterar `max_projects` no banco muda o comportamento da interface **sem deploy** (Art. 3). No lançamento existe um plano só, mas a estrutura já é a definitiva.

## 7. Esteira de desenvolvimento

Pedido na ata de 11/08. Mínimo viável, sem cerimônia:

| Etapa | Ferramenta | Bloqueia merge? |
|---|---|---|
| Lint + formatação | ruff (Python), eslint + prettier (TS) | ✅ |
| Tipos | mypy, `tsc --noEmit` | ✅ |
| Testes unitários | pytest, vitest | ✅ |
| **Teste de isolamento entre contas** | pytest | ✅ |
| Varredura de literais proibidos | script próprio | ✅ |
| Migração aplicada em staging | alembic | ✅ |
| Deploy | Vercel (auto) + Render (auto) | — |

**Varredura de literais proibidos** — um script simples que quebra o build se encontrar:
- UUID literal em código de aplicação
- `localhost`, `127.0.0.1`, URL absoluta de ambiente
- cor hex ou classe de cor bruta (`bg-[#`, `bg-emerald-`, `text-amber-`)
- `ArchSmart`, `Ark Smart`, `Ecowe`
- `tabIndex={-1}` em elemento interativo

São cinco `grep`. Custam meia hora e impedem que os cinco erros mais caros do código antigo voltem — o que nenhuma boa intenção garante.

## 8. Estrutura de pastas

```
/backend
├── app/
│   ├── api/v1/endpoints/     # um arquivo por módulo
│   ├── core/                 # config, security, RequestContext
│   ├── models/               # SQLAlchemy
│   ├── schemas/              # Pydantic
│   ├── services/             # LÓGICA DE NEGÓCIO — puro e testável
│   └── db/                   # session, base, ScopedRepository
├── alembic/
├── tests/
└── main.py

/frontend
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   └── api/
├── components/{ui,forms,shared,smart-core}/
├── hooks/
├── lib/                      # api client, analytics, utils, zod
└── types/

/docs/{dev,user}/             # spec 004
```

## 9. Telemetria

| Evento | Propriedades |
|---|---|
| `account_created` | `source` |
| `session_started` | `is_first_session` |
| `quota_limit_hit` | `limit_type`, `plan_type`, `current`, `max` |

## 10. Critérios de aceite

- [ ] `accounts` criada; toda tabela de dado do cliente tem `account_id NOT NULL` e `created_by`.
- [ ] `get_current_context` é a única forma de resolver conta e usuário.
- [ ] `ScopedRepository` impede query sem filtro; usar `session.query()` direto num model escopado quebra o lint.
- [ ] `GET /api/v1/me` devolve entitlements; alterar `max_projects` no banco muda a UI sem deploy.
- [ ] Teste de isolamento genérico rodando no CI: cria dado como conta A, autentica como B, falha se qualquer endpoint retornar.
- [ ] Varredura de literais proibidos quebrando o build nos 5 casos.
- [ ] Push na branch principal faz deploy sozinho.
- [ ] Migração Alembic aplicada automaticamente em staging.
- [ ] `docs/dev/arquitetura.md` escrita (spec 004).

## 11. Riscos

- **Risco:** virar um projeto de arquitetura de duas semanas. → Timebox de 5 dias. O objetivo é impedir os erros conhecidos, não construir framework.
- **Risco:** `ScopedRepository` engessar consultas legítimas. → Fornecer escotilha explícita (`unscoped_query`) com nome feio de propósito, usável só em código de admin e migração.
