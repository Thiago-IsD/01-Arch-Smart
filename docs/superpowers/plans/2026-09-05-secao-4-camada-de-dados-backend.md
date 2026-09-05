# Seção 4 — Camada de dados do backend · Plano de implementação

> **Para quem executa com agente:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixas (`- [ ]`) para acompanhamento.

**Objetivo:** tornar impossível escrever um endpoint que vaze dado entre contas —
identidade resolvida uma vez no servidor, todo acesso a banco passando por um
repositório que filtra por conta sozinho, e um teste que percorre todas as rotas
registradas e reprova a que não isola.

**Arquitetura:** três peças novas em `ArchSmart-api/app/`. `RequestContext`
(`core/security.py`) resolve identidade a partir do JWT e nunca lê nada do
payload do cliente. `ScopedRepository` (`db/repository.py`) recebe esse contexto
e filtra por `account_id` em toda query, levantando `TypeError` se o model não
tiver a coluna. Exceções de domínio (`core/errors.py`) traduzidas por um handler
único no `main.py`. As 21 tabelas de dado ganham `account_id` e `created_by` para
que o repositório seja universal — sem exceção que alguém precise lembrar.

**Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x (ORM clássico, `Session`),
Alembic, PostgreSQL 17 + pgvector, pytest contra Postgres real (sem mock).

**Spec:** [`docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md`](../specs/2026-08-23-reestruturacao-arq-smart-design.md),
seção "Seção 4 — Camada de dados do backend".

---

## Onde a spec e o código divergem — medido em 05/09/2026

A spec é de 23/08/2026 e o código andou desde então. **Os números deste plano
são os medidos; os da spec estão desatualizados e não devem ser republicados.**

| Spec diz | Medido em `develop` (05/09/2026) | Comando |
|---|---|---|
| 125 `db.query()` diretos | **117** | `grep -rn "db\.query(" app --include=*.py \| grep -v "^app/tests/" \| wc -l` |
| 14 `detail=str(e)` | **12** | `grep -rn "detail=.*str(e" app --include=*.py \| grep -v "^app/tests/"` |
| 58 `print()` | **54** | `grep -rn "print(" app --include=*.py \| grep -v "^app/tests/" \| wc -l` |
| 10 tabelas sem `account_id` | **10** — confere | ver classificação abaixo |
| "`account_id` e `created_by` em toda tabela de dado" | `created_by` **não existe em nenhuma tabela** | `grep -rn "created_by" app --include=*.py \| wc -l` → `0` |
| escotilha permitida em `app/tools/` | **`app/tools/` não existe**; o diretório é `ArchSmart-api/tools/` | `ls app` |
| `GET /api/v1/me` | **não existe prefixo `/api/v1`**; hoje é `GET /api/users/me` | `grep -n "include_router" app/main.py` |

### Decisões tomadas por Thiago em 05/09/2026

1. **A rota continua sendo `GET /api/users/me`**, ganhando o bloco
   `entitlements`. Não se cria `/api/v1`: nenhuma das 62 rotas de `/api` segue
   esse esquema, e o front já chama `/api/users/me` em três lugares
   (`billing/page.tsx`, `profile/page.tsx`, `hooks/use-user-profile.ts`). O
   desvio da spec fica registrado na ADR 0008 (Tarefa 10).
2. **`created_by` vai nas 21 tabelas de dado**, não só nas 10 que ganham
   `account_id`. O `ScopedRepository.create()` fica universal de fato, sem
   exceção a lembrar.
3. **O Postgres de teste sobe para 17** antes de qualquer migração nova, para
   que as migrações desta seção nasçam testadas na versão em que vão rodar em
   staging e produção (17.6). Isso fecha a divergência marcada como decisão em
   aberto no `CLAUDE.md`.

### Classificação das 26 tabelas — medida, não copiada

Comando que a produz (da raiz de `ArchSmart-api/`; as variáveis são de fachada,
nada conecta em banco):

```bash
./venv/Scripts/python.exe -c "
import os
for k,v in {'DATABASE_URL':'postgresql://a:a@localhost:55432/arqsmart_test','SUPABASE_URL':'https://x.invalido.supabase.co','SUPABASE_KEY':'x','SUPABASE_SERVICE_ROLE_KEY':'x','GEMINI_API_KEY':'x'}.items(): os.environ.setdefault(k,v)
from app.db.base_class import Base
import app.models.all_models
for t in sorted(Base.metadata.tables):
    c = set(Base.metadata.tables[t].columns.keys())
    print(t, 'account_id' in c, 'created_by' in c)
"
```

**Fora do escopo — 5 tabelas.** Nunca recebem `account_id` nem `created_by`:

| Tabela | Por quê |
|---|---|
| `accounts` | é a própria conta; `account_id` seria auto-referência |
| `plans` | catálogo global de planos |
| `product_origins` | catálogo global |
| `product_states` | catálogo global |
| `documents` | embeddings `Vector(1536)`, sem FK para nada e sem consumidor em `app/`; escopo fica para quando tiver uso (decisão registrada na spec em 24/08/2026) |

**No escopo — 21 tabelas de dado.** Dez ganham as duas colunas; onze ganham só
`created_by`:

| Ganha `account_id` + `created_by` (10) | Ganha só `created_by` (11) |
|---|---|
| `project_slots` | `users` |
| `environments` | `leads` |
| `environment_dnas` | `legal_acceptances` |
| `budgets` | `subscriptions` |
| `budget_items` | `products` |
| `item_options` | `projects` |
| `presentations` | `clients` |
| `presentation_environments` | `financial_entries` |
| `presentation_acceptances` | `events` |
| `presentation_comments` | `admin_logs` |
| | `notifications` |

### Estado medido do backend em 05/09/2026

- **117 `db.query()`** fora de `app/tests/`, distribuídos assim:
  `endpoints/presentations.py` 21, `routers/budgets_router.py` 14,
  `routers/product_router.py` 13, `endpoints/public.py` 11,
  `endpoints/financial.py` 11, `endpoints/projects.py` 9, `api/users.py` 8,
  `endpoints/events.py` 7, `routers/environments_router.py` 6,
  `endpoints/dashboard.py` 6, `services/budget_calculator.py` 3,
  `endpoints/notifications.py` 2, `api/auth.py` 2, `api/account.py` 2,
  `services/financial_service.py` 1, `api/leads.py` 1.
- **76 rotas registradas**: 62 em `/api`, 7 em `/public`, o resto de
  infraestrutura (`/`, `/health`, `/health/db`, `/docs`, `/redoc`,
  `/openapi.json`). 42 têm parâmetro de caminho.
- **11 nomes distintos de parâmetro de caminho**: `product_id` (4 rotas),
  `project_id` (8), `presentation_id` (9), `env_id` (4), `item_id` (3),
  `option_id` (5), `budget_id` (1), `presentation_uuid` (7),
  `notification_id` (1), `entry_id` (3), `event_id` (2).
- **Só 4 índices** existem no schema inteiro: `ix_documents_id`,
  `ix_financial_entries_group_id`, `ix_users_email`, `ix_users_supabase_id`.
- **Suíte nova (`tests/`): 81 testes**, 27 deles em `tests/isolation/`.
  **Suíte antiga (`app/tests/`): 83 testes**, já fora do `testpaths` do
  `pytest.ini`, a ser apagada na Tarefa 17.
- 27 arquivos em `alembic/versions/`; `alembic_version = b77a9b5656c2`.
- Próxima ADR livre: **0008**.

---

## Restrições globais

Valem para **todas** as tarefas. Vêm do `CLAUDE.md` da raiz, do
`ArchSmart-api/CLAUDE.md` e da constitution.

- **Nenhum `account_id` literal no código.** Toda leitura e escrita filtra pela
  identidade da sessão resolvida no servidor (Art. 1).
- **Nada que venha do cliente decide escopo.** `account_id` em corpo, query
  string ou header é ignorado — sempre.
- **Nenhuma URL, chave ou host fixo.** Backend lê de `app/core/config.py`;
  segredo vive no `.env`, nunca versionado (Art. 4).
- **A marca é "Arq Smart"** — duas palavras, com Q. Zero `ArchSmart`,
  `Ark Smart` ou `Ecowe` em código, copy ou comentário. `ArchSmart-api` é nome
  de diretório, não grafia da marca (Art. 8).
- **Nada de recurso exclusivo do Supabase no schema** — sem RLS como única
  proteção, sem funções do Supabase, sem FK para as tabelas internas de auth
  deles. A proteção real é o `ScopedRepository`. Já existe teste que verifica:
  `tests/test_receita_migracoes.py::test_schema_nao_depende_de_recurso_exclusivo_do_supabase`.
- **Alembic é a fonte única do schema** (ADR 0004). Toda mudança de coluna é uma
  migração. **Nunca rode `alembic upgrade head` à mão contra staging ou
  produção** — a migração roda no `CMD` do `Dockerfile` (ADR 0007).
- **Toda migração precisa de `downgrade()` não vazio.**
- **Mensagem de erro ao usuário em pt-BR.** Rastro técnico vai para o log, nunca
  para a resposta.
- **Número afirmado sem medição é número errado.** Ao relatar qualquer contagem
  no PR ou na documentação, cole o comando que a produziu.
- **Antes de rodar qualquer script contra banco:** confira para qual bloco o
  `ArchSmart-api/.env` aponta. Ele tem staging e produção, com produção
  comentada.
- **Commits em português, no imperativo**, seguindo o padrão do repositório
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- **Branch da seção:** `secao-4-camada-de-dados-backend`, saindo de `develop`.

### Comandos de verificação (da raiz de `ArchSmart-api/`)

```powershell
.\venv\Scripts\Activate.ps1
docker compose -f docker-compose.test.yml up -d --wait
pytest -q
```

E, da raiz do repositório:

```bash
python tools/progresso.py --check
python tools/checa_links.py
cd tools; python -m unittest discover -p "test_*.py"
```

> ⚠️ Docker Desktop precisa estar rodando. Em 05/09/2026 ele estava parado —
> `docker ps` respondia `failed to connect to the docker API`. Sem ele, `pytest`
> só coleta, não roda.

---

## Estrutura de arquivos

**Arquivos novos:**

| Arquivo | Responsabilidade |
|---|---|
| `app/core/security.py` | `RequestContext` e a resolução de identidade a partir do JWT. Único lugar que sabe decodificar token. |
| `app/core/errors.py` | Exceções de domínio e o handler que as traduz para HTTP. |
| `app/db/repository.py` | `ScopedRepository` — a única porta para o banco em código de endpoint. |
| `app/services/entitlements.py` | Lê `Plan.limits` e devolve os `entitlements` da conta. |
| `tests/test_arquitetura.py` | Lints de arquitetura como teste: escotilha fora de lugar, `db.query()` em endpoint, `print()` em `app/`. |
| `tests/services/` | Testes de função pura, sem banco. |
| `tests/api/` | Testes de endpoint contra Postgres real com dado semeado. |
| `tests/isolation/test_todas_as_rotas.py` | Teste genérico que percorre as rotas registradas. |
| `alembic/versions/<hash>_created_by_nas_tabelas_de_dado.py` | Migração 1. |
| `alembic/versions/<hash>_account_id_nas_dez_tabelas.py` | Migração 2. |
| `alembic/versions/<hash>_indices_derivados_das_queries.py` | Migração 3. |
| `docs/dev/decisoes/0008-me-em-api-users-me.md` | ADR do desvio da spec quanto ao `/api/v1`. |

**Apagado:** `app/tests/` inteiro (16 arquivos, 83 testes) — Tarefa 17.

**Ordem das tarefas e por quê:**

```
 1. Postgres 17 no teste e no CI      <- antes de qualquer migracao nova
 2. RequestContext + fim do auto-link  <- identidade primeiro
 3. created_by nas 21 tabelas
 4. account_id nas 10 tabelas          <- schema pronto
 5. Excecoes de dominio + handler      <- o repositorio levanta NotFound
 6. ScopedRepository + lint            <- so e universal com o schema pronto
 7. Indices
 8. calculate_quantity pura (fim do N+1)
 9. Fim dos print()
10. /api/users/me com entitlements
11..15. Conversao dos 117 call sites, por area
16. Teste generico de isolamento       <- so fica verde depois da conversao
17. Apagar app/tests/
18. Documentacao e fechamento
```

---
## Tarefa 1: Postgres 17 no teste e no CI

Prerequisito de tudo que vem depois. Não é caixa do `PROGRESS.md` — é o
fechamento da divergência "16 no teste, 17.6 online" que o `CLAUDE.md` marca
como decisão em aberto, decidida por Thiago em 05/09/2026.

**Arquivos:**
- Modificar: `ArchSmart-api/docker-compose.test.yml:2`
- Modificar: `.github/workflows/ci.yml:20` (`services.postgres.image`)
- Modificar: `CLAUDE.md` (retirar da lista de decisões em aberto)

**Interfaces:**
- Consome: nada.
- Produz: banco de teste em Postgres 17 com pgvector, na porta 55432, com
  usuário/senha/banco `arqsmart`/`arqsmart`/`arqsmart_test`. Todas as tarefas
  seguintes rodam contra ele.

- [ ] **Passo 1: Derrubar o contêiner antigo, se estiver de pé**

O volume é `tmpfs`, então não há dado a preservar — mas o contêiner com a
imagem 16 precisa sair antes de a 17 subir na mesma porta.

```bash
cd ArchSmart-api
docker compose -f docker-compose.test.yml down
```

- [ ] **Passo 2: Trocar a imagem no compose de teste**

Em `ArchSmart-api/docker-compose.test.yml`:

```yaml
services:
  postgres-test:
    image: pgvector/pgvector:pg17
```

- [ ] **Passo 3: Trocar a imagem no CI**

Em `.github/workflows/ci.yml`, no job `backend`:

```yaml
    services:
      postgres:
        image: pgvector/pgvector:pg17
```

- [ ] **Passo 4: Subir e conferir a versão de verdade**

```bash
docker compose -f docker-compose.test.yml up -d --wait
docker compose -f docker-compose.test.yml exec -T postgres-test psql -U arqsmart -d arqsmart_test -c "select version();"
```

Esperado: uma linha começando com `PostgreSQL 17.` — **leia o número**. Se sair
`PostgreSQL 16.`, o contêiner antigo não foi derrubado no Passo 1; repita o
`down` e o `up`.

- [ ] **Passo 5: Rodar a suíte inteira contra o 17**

```bash
.\venv\Scripts\Activate.ps1
pytest -q
```

Esperado: **81 passed**. Nenhum teste deve quebrar — se algum quebrar, é uma
diferença real entre 16 e 17 e precisa ser entendida antes de seguir, não
contornada.

- [ ] **Passo 6: Tirar a divergência da lista de decisões em aberto**

Em `CLAUDE.md`, na seção "Onde estamos", o parágrafo que hoje diz:

> Duas decisões seguem **em aberto**, e nenhuma delas é para um agente tomar
> sozinho: ligar ou não branch protection (virou possível quando o repositório
> foi tornado público em 30/08), e alinhar o `docker-compose.test.yml`, hoje em
> Postgres 16 enquanto os ambientes online são 17.6.

passa a:

> Uma decisão segue **em aberto**, e não é para um agente tomar sozinho: ligar
> ou não branch protection (virou possível quando o repositório foi tornado
> público em 30/08). O `docker-compose.test.yml` e o CI foram alinhados para
> Postgres 17 em 05/09/2026, na Tarefa 1 da Seção 4 — a divergência com os
> 17.6 de staging e produção era o risco de uma migração passar no CI e
> derrubar o contêiner no deploy (ADR 0007).

- [ ] **Passo 7: Commit**

```bash
git checkout -b secao-4-camada-de-dados-backend
git add ArchSmart-api/docker-compose.test.yml .github/workflows/ci.yml CLAUDE.md
git commit -m "chore: alinha o Postgres de teste e de CI em 17, como staging e producao"
```

---

## Tarefa 2: `RequestContext` e o fim do auto-link por e-mail

Fecha **duas** caixas do `PROGRESS.md` de uma vez: `RequestContext` em
`app/core/security.py` e "Fim do auto-link por e-mail em `app/api/users.py`".
Elas andam juntas porque o auto-link mora exatamente dentro da função que
resolve identidade — separar significaria escrever a resolução nova já com o
defeito dentro.

**O defeito, com linha exata.** Hoje, em `app/api/users.py:88-96`,
`get_current_user` procura usuário pelo **e-mail** do token e, se achar, grava o
`supabase_id` do portador naquela linha — entregando a conta a quem tiver um
token do Supabase com aquele e-mail no payload. Logo abaixo
(`app/api/users.py:98-121`) ele ainda **cria** conta e usuário novos quando nada
bate. A extensão do risco foi medida e está documentada em
[`docs/dev/arquitetura.md`](../../dev/arquitetura.md), seção "Advertência:
pendência de segurança conhecida": a opção *Confirm email* do Supabase está
ligada desde 24/08/2026, o que torna o caminho não explorável **hoje** — por uma
configuração de painel, fora do controle de versão. Isso muda a urgência, não o
achado.

**Provisionamento legítimo não se perde.** `POST /api/auth/signup`
(`app/api/auth.py:139`) e `POST /api/auth/complete-register`
(`app/api/auth.py:37`) criam `Account` e `User` explicitamente. A remoção do
auto-create tira um caminho implícito, não o único caminho.

**Arquivos:**
- Criar: `ArchSmart-api/app/core/security.py`
- Criar: `ArchSmart-api/app/services/entitlements.py`
- Modificar: `ArchSmart-api/app/core/config.py` (declarar `SUPABASE_JWT_SECRET`)
- Modificar: `ArchSmart-api/app/api/users.py:16-122` (`get_current_user` vira
  casca fina sobre a resolução nova)
- Modificar: `ArchSmart-api/tests/conftest.py` (fixtures que sobrepõem
  `get_context` além de `get_current_user`)
- Testar: `ArchSmart-api/tests/api/test_identidade.py` (novo)

**Interfaces:**
- Consome: `app.models.all_models.{User, Account, Subscription, Plan}`,
  `app.db.session.get_db`, `app.core.config.settings`.
- Produz, e as Tarefas 5 e 11–16 dependem destes nomes exatos:
  - `RequestContext` — dataclass congelada com
    `user_id: UUID`, `account_id: UUID`, `email: str`,
    `entitlements: Mapping[str, Any]`.
  - `async def get_context(authorization: str = Header(...), db: Session = Depends(get_db)) -> RequestContext`
    — a dependência que todo endpoint autenticado passa a usar.
  - `def resolve_identity(token: str, db: Session) -> User` — resolução crua,
    sem FastAPI, usada pelos dois caminhos e testável direto.
  - `def entitlements_da_conta(db: Session, account_id: UUID) -> dict[str, Any]`
    em `app/services/entitlements.py`.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `ArchSmart-api/tests/api/__init__.py` (vazio) e
`ArchSmart-api/tests/api/test_identidade.py`:

```python
"""
Identidade da requisicao: o que o servidor resolve e o que ele ignora.

Os dois primeiros testes sao a regressao da pendencia de seguranca registrada
em docs/dev/arquitetura.md — o auto-link por e-mail e o auto-create. Eles
falham enquanto app/api/users.py resolver identidade por e-mail.
"""
import dataclasses
import uuid

import pytest
from sqlalchemy.orm import Session

from app.core.security import RequestContext, resolve_identity_por_claims
from app.models.all_models import Account, User


def _usuario(db: Session, email: str, supabase_id: str) -> User:
    conta = Account(name=f"Conta de {email}")
    db.add(conta)
    db.flush()
    usuario = User(
        account_id=conta.id,
        email=email,
        full_name="Fulano",
        supabase_id=supabase_id,
    )
    db.add(usuario)
    db.flush()
    return usuario


def test_nao_vincula_conta_alheia_por_email(db: Session):
    """
    Um token cujo `sub` nao esta em nenhuma linha NAO pode ser vinculado a um
    usuario existente so porque o e-mail bate. Era o auto-link.
    """
    vitima = _usuario(db, "vitima@teste.local", str(uuid.uuid4()))
    supabase_id_do_atacante = str(uuid.uuid4())

    with pytest.raises(LookupError):
        resolve_identity_por_claims(
            db, supabase_id=supabase_id_do_atacante, email="vitima@teste.local"
        )

    db.refresh(vitima)
    assert vitima.supabase_id != supabase_id_do_atacante


def test_nao_cria_conta_sozinho(db: Session):
    """
    Token de alguem que nao existe no banco nao provisiona conta nova. O
    provisionamento tem rota propria: POST /api/auth/signup.
    """
    contas_antes = db.query(Account).count()

    with pytest.raises(LookupError):
        resolve_identity_por_claims(
            db, supabase_id=str(uuid.uuid4()), email="novo@teste.local"
        )

    assert db.query(Account).count() == contas_antes


def test_resolve_por_supabase_id(db: Session):
    supabase_id = str(uuid.uuid4())
    usuario = _usuario(db, "certo@teste.local", supabase_id)

    achado = resolve_identity_por_claims(db, supabase_id=supabase_id, email=None)

    assert achado.id == usuario.id
    assert achado.account_id == usuario.account_id


def test_contexto_ignora_account_id_do_cliente(client_a, conta_a):
    """
    Art. 1: o que vem do cliente e ignorado. Mandar account_id de outra conta
    no corpo nao muda o escopo da resposta.
    """
    resposta = client_a.get(
        "/api/users/me", params={"account_id": str(uuid.uuid4())}
    )
    assert resposta.status_code == 200
    assert resposta.json()["account"]["id"] == str(conta_a[0].id)


def test_contexto_e_imutavel():
    ctx = RequestContext(
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        email="a@b.local",
        entitlements={},
    )
    # FrozenInstanceError, nao Exception: com `Exception` este teste passaria
    # ate por um TypeError de construtor, sem provar que o objeto e imutavel.
    with pytest.raises(dataclasses.FrozenInstanceError):
        ctx.account_id = uuid.uuid4()
```

Note o nome `resolve_identity_por_claims` usado nos testes: é a metade da
resolução que **não** decodifica token, e é o que dá para testar sem forjar um
JWT. O import no topo do arquivo de teste é exatamente este — `resolve_identity`
**não** entra, porque nenhum teste deste arquivo a chama (ela é `async` e exige
token de verdade):

```python
import dataclasses
import uuid

import pytest
from sqlalchemy.orm import Session

from app.core.security import RequestContext, resolve_identity_por_claims
from app.models.all_models import Account, User
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/api/test_identidade.py -q
```

Esperado: `ImportError` / `ModuleNotFoundError: No module named 'app.core.security'`.

- [ ] **Passo 3: Declarar `SUPABASE_JWT_SECRET` na config**

Hoje ele é lido com `os.getenv("SUPABASE_JWT_SECRET")` dentro de
`app/api/users.py` — segredo lido fora do único lugar que deveria conhecer
config (Art. 4). Em `ArchSmart-api/app/core/config.py`, junto aos outros campos
do Supabase:

```python
    SUPABASE_JWT_SECRET: Optional[str] = Field(
        None,
        description=(
            "Segredo HS256 do projeto Supabase, em base64. Opcional: sem ele a "
            "validacao cai no caminho remoto (auth_service.get_user), que "
            "funciona mas custa uma ida a rede por requisicao. O CI nao o "
            "define de proposito."
        ),
    )
```

- [ ] **Passo 4: Escrever `app/core/security.py`**

```python
"""
Identidade da requisicao, resolvida no servidor — uma vez, num lugar so.

Este e o UNICO modulo que sabe decodificar um token do Supabase. Nenhum
endpoint le `account_id` de corpo, query string ou header: o que vem do
cliente e ignorado sempre (Art. 1).

O que este modulo deliberadamente NAO faz, e por que:

- **Nao vincula usuario por e-mail.** Ate a Secao 4, quando o `sub` do token
  nao estava em nenhuma linha, o codigo procurava pelo e-mail e gravava o
  `supabase_id` do portador naquela linha — entregando a conta a quem tivesse
  um token com aquele e-mail no payload. O e-mail do token nao e identidade
  verificada deste lado.
- **Nao cria conta nem usuario.** Provisionamento tem rota propria
  (`POST /api/auth/signup`, `POST /api/auth/complete-register`). Criar de
  dentro da resolucao de identidade transformava todo endpoint autenticado
  num endpoint de cadastro.

Token que nao resolve para um usuario existente e 401, sem excecao.
"""
from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import Any, Mapping, Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from jose import jwt
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.db.session import get_db
from app.models.all_models import User
from app.services.auth_service import auth_service
from app.services.entitlements import entitlements_da_conta

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RequestContext:
    """
    Identidade da requisicao. Congelada de proposito: nenhum endpoint deve
    conseguir reescrever `account_id` no meio do caminho.
    """

    user_id: UUID
    account_id: UUID
    email: str
    entitlements: Mapping[str, Any]


class IdentidadeNaoResolvida(LookupError):
    """O token e valido, mas nao aponta para nenhum usuario deste banco."""


def _segredo_em_bytes(segredo: str) -> bytes:
    """
    O segredo do Supabase vem em base64; o HS256 assina sobre os bytes
    decodificados. Sem o padding, o b64decode estoura em segredos cujo
    comprimento nao e multiplo de 4.
    """
    limpo = segredo.strip()
    return base64.b64decode(limpo + "=" * (-len(limpo) % 4))


def claims_do_token(token: str) -> tuple[Optional[str], Optional[str]]:
    """
    Devolve (supabase_id, email) do token, validando a assinatura localmente.
    Levanta `jose.JWTError` se o token for invalido ou expirado.
    """
    if not settings.SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET ausente")
    payload = jwt.decode(
        token,
        _segredo_em_bytes(settings.SUPABASE_JWT_SECRET),
        algorithms=["HS256"],
        options={"verify_aud": False},
    )
    return payload.get("sub"), payload.get("email")


def resolve_identity_por_claims(
    db: Session, *, supabase_id: Optional[str], email: Optional[str]
) -> User:
    """
    Resolve o usuario a partir dos claims ja validados.

    So o `supabase_id` decide. O `email` entra apenas no log de diagnostico —
    ele NAO e criterio de busca, e essa e a correcao de seguranca da Secao 4.
    """
    if not supabase_id:
        raise IdentidadeNaoResolvida("token sem `sub`")

    usuario = db.query(User).filter(User.supabase_id == supabase_id).first()
    if usuario is None:
        logger.warning(
            "Token valido sem usuario correspondente. supabase_id=%s email=%s",
            supabase_id,
            email,
        )
        raise IdentidadeNaoResolvida(
            f"nenhum usuario com supabase_id={supabase_id}"
        )
    return usuario


async def resolve_identity(token: str, db: Session) -> User:
    """
    Valida o token e devolve o `User`. Tenta a validacao local (sem ida a
    rede); se o segredo nao estiver configurado ou a assinatura nao bater, cai
    no caminho remoto do `auth_service`.
    """
    try:
        supabase_id, email = claims_do_token(token)
    except Exception as erro:
        logger.info("Validacao local do JWT falhou (%s); tentando remota.", erro)
        dados = await auth_service.get_user(token)
        supabase_id, email = dados["id"], dados.get("email")

    return await run_in_threadpool(
        resolve_identity_por_claims, db, supabase_id=supabase_id, email=email
    )


async def get_context(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> RequestContext:
    """
    Dependencia de todo endpoint autenticado. Substitui `get_current_user`.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    token = authorization[len("Bearer ") :]

    try:
        usuario = await resolve_identity(token, db)
    except IdentidadeNaoResolvida:
        # 401, nao 404: para quem chama, "esse token nao vale aqui". Dizer
        # "usuario nao encontrado" confirmaria a existencia de contas.
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    except HTTPException:
        raise
    except Exception as erro:
        logger.warning("Falha ao validar token: %s", erro, exc_info=True)
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")

    entitlements = await run_in_threadpool(
        entitlements_da_conta, db, usuario.account_id
    )
    return RequestContext(
        user_id=usuario.id,
        account_id=usuario.account_id,
        email=usuario.email,
        entitlements=entitlements,
    )
```

- [ ] **Passo 5: Escrever `app/services/entitlements.py`**

```python
"""
Entitlements da conta — o que o plano dela permite.

Art. 3: limite de plano e decisao do servidor. O front renderiza o que a API
devolver e nunca fixa um numero. Enquanto o front tiver o
`data?.plan_limit ?? 2` que ainda existe em `dashboard/page.tsx` e
`projects/page.tsx`, a violacao continua registrada — a correcao dela e da
Secao 5, mas a fonte de verdade nasce aqui.

`Plan.limits` e uma coluna JSON livre. Os defaults abaixo valem quando a conta
nao tem assinatura, quando a assinatura nao tem plano, ou quando o JSON nao
traz a chave — os tres casos existem hoje no banco.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.all_models import Plan, Subscription

PADRAO: dict[str, Any] = {
    "project_limit": 2,
    "can_use_ai": True,
    "can_use_portal": True,
}


def entitlements_da_conta(db: Session, account_id: UUID) -> dict[str, Any]:
    """
    Uma query, com outer join para o plano: conta sem assinatura nao vira
    None no meio do caminho, vira os defaults.
    """
    linha = (
        db.query(Plan.limits)
        .select_from(Subscription)
        .outerjoin(Plan, Plan.id == Subscription.plan_id)
        .filter(Subscription.account_id == account_id)
        .first()
    )
    limites = (linha[0] if linha else None) or {}
    if not isinstance(limites, dict):
        # Plan.limits e JSON livre; uma lista ou string ali nao pode derrubar
        # toda requisicao autenticada.
        limites = {}
    return {**PADRAO, **limites}
```

- [ ] **Passo 6: Reescrever `get_current_user` como casca fina**

Os 149 usos de `current_user` só migram para `ctx` nas Tarefas 11–15. Até lá as
duas dependências convivem — e precisam resolver identidade **pelo mesmo
caminho**, senão a correção de segurança valeria só para metade das rotas.

Em `ArchSmart-api/app/api/users.py`, substitua o corpo inteiro de
`get_current_user` (linhas 16 a 122 hoje) por:

```python
async def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> User:
    """
    Compatibilidade: os endpoints ainda nao convertidos para `RequestContext`
    dependem desta funcao. Ela NAO tem logica propria — delega para
    `app.core.security`, de modo que auto-link e auto-create estejam mortos
    para os dois caminhos. Some quando a ultima rota migrar (Tarefa 15).
    """
    ctx = await get_context(authorization=authorization, db=db)
    usuario = db.query(User).filter(User.id == ctx.user_id).first()
    if usuario is None:  # pragma: no cover - get_context ja garantiu
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    return usuario
```

E, no topo do arquivo, troque os imports: sai `Header` usado para decodificar
token à mão, entra `from app.core.security import get_context`. Os imports de
`jose`, `base64` e `os` dentro da função saem junto — não sobra nenhum uso
deles em `users.py`.

- [ ] **Passo 7: Ensinar a conftest a sobrepor as duas dependências**

Em `ArchSmart-api/tests/conftest.py`, a função `_cliente` hoje sobrepõe só
`get_current_user`. Ela passa a sobrepor as duas, para que um endpoint já
convertido e um ainda não convertido funcionem no mesmo teste:

```python
from app.api.users import get_current_user  # noqa: E402
from app.core.security import RequestContext, get_context  # noqa: E402
from app.services.entitlements import PADRAO as ENTITLEMENTS_PADRAO  # noqa: E402


def _contexto_de(usuario: User) -> RequestContext:
    return RequestContext(
        user_id=usuario.id,
        account_id=usuario.account_id,
        email=usuario.email,
        entitlements=dict(ENTITLEMENTS_PADRAO),
    )


def _cliente(db: Session, usuario: User | None) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_db] = lambda: db
    if usuario is not None:
        app.dependency_overrides[get_current_user] = lambda: usuario
        app.dependency_overrides[get_context] = lambda: _contexto_de(usuario)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Passo 8: Rodar os testes novos**

```bash
pytest tests/api/test_identidade.py -q
```

Esperado: **5 passed**.

- [ ] **Passo 9: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **86 passed** (81 de antes + 5 novos). Os 27 testes de
`tests/isolation/` continuam verdes — eles sobrepõem `get_current_user`, que
agora delega.

- [ ] **Passo 10: Conferir que o auto-link sumiu do código**

```bash
grep -n "found by email\|Auto-Create\|Auto-link" app/api/users.py
```

Esperado: **nenhuma linha**. Saída vazia é o critério.

- [ ] **Passo 11: Commit**

```bash
git add ArchSmart-api/app/core/security.py ArchSmart-api/app/services/entitlements.py \
        ArchSmart-api/app/core/config.py ArchSmart-api/app/api/users.py \
        ArchSmart-api/tests/conftest.py ArchSmart-api/tests/api/
git commit -m "feat: resolve identidade no servidor e mata o auto-link por e-mail"
```

- [ ] **Passo 12: Atualizar a advertência da arquitetura**

`docs/dev/arquitetura.md` diz hoje que a pendência "tem caixa própria na Seção
4". Ela deixou de ser pendência. Substitua a seção "Advertência: pendência de
segurança conhecida em `app/api/users.py`" por um registro do que foi feito —
mantendo o histórico, porque quem for ler a advertência num commit antigo
precisa saber onde ela terminou:

```markdown
### Resolvido em 05/09/2026: o auto-link por e-mail em `app/api/users.py`

Ate a Secao 4, `get_current_user` procurava usuario pelo **e-mail** do token
quando o `supabase_id` nao batia com nada, e gravava o `supabase_id` do
portador naquela linha — entregando a conta a quem tivesse um token do
Supabase com aquele e-mail no payload. A mesma funcao tambem **criava** conta
e usuario novos quando nada batia.

O risco real dependia da opcao *Authentication → Providers → Email → "Confirm
email"* do painel do Supabase, verificada ligada por Thiago em 24/08/2026 — ou
seja, a protecao morava fora do repositorio.

**A Tarefa 2 da Secao 4 removeu os dois caminhos.** A resolucao de identidade
vive em `app/core/security.py` e decide **so** pelo `supabase_id`; token que
nao aponta para usuario existente e `401`. Provisionamento continua tendo rota
propria (`POST /api/auth/signup`, `POST /api/auth/complete-register`).

A regressao esta coberta por
`ArchSmart-api/tests/api/test_identidade.py::test_nao_vincula_conta_alheia_por_email`
e `::test_nao_cria_conta_sozinho`.
```

- [ ] **Passo 13: Commit da documentação**

```bash
git add docs/dev/arquitetura.md
git commit -m "docs: registra o fim do auto-link por e-mail na arquitetura"
```

---

## Tarefa 3: `created_by` nas 21 tabelas de dado

**Arquivos:**
- Modificar: `ArchSmart-api/app/models/all_models.py` (21 classes)
- Criar: `ArchSmart-api/alembic/versions/<hash>_created_by_nas_tabelas_de_dado.py`
- Testar: `ArchSmart-api/tests/test_colunas_de_escopo.py` (novo)

**Interfaces:**
- Consome: nada além dos models.
- Produz: coluna `created_by UUID NULL REFERENCES users(id)` nas 21 tabelas de
  dado. A Tarefa 5 (`ScopedRepository.create()`) preenche essa coluna.

**Por que nullable.** Três das 21 recebem linha escrita por quem não tem sessão:
`presentation_acceptances` e `presentation_comments` (o cliente final, pelo
portal público, autenticado por token de portal e não por usuário) e `leads`
(formulário público). Uma coluna `NOT NULL` ali obrigaria a inventar um usuário
sintético. `created_by` responde "qual usuário desta conta criou isto", e a
resposta honesta às vezes é "nenhum".

**Por que FK para `users` e não para `accounts`.** `account_id` já responde a
conta. `created_by` só agrega informação se apontar para a pessoa.

- [ ] **Passo 1: Escrever o teste que falha**

Crie `ArchSmart-api/tests/test_colunas_de_escopo.py`:

```python
"""
As colunas de escopo existem em toda tabela de dado — e so nelas.

Este teste e a rede que impede uma tabela nova de nascer sem `account_id` ou
`created_by`. Ele le o metadata do SQLAlchemy, entao uma tabela adicionada em
all_models.py aparece aqui sem ninguem lembrar de atualizar lista nenhuma: ou
ela entra em CATALOGO_GLOBAL com justificativa, ou tem as colunas.
"""
import pytest

from app.db.base_class import Base
import app.models.all_models  # noqa: F401  (popula o metadata)

# Tabelas que NAO tem dono. Cada entrada precisa de motivo — a lista so cresce
# com decisao registrada, nunca por conveniencia de fazer um teste passar.
CATALOGO_GLOBAL = {
    "accounts": "e a propria conta; account_id seria auto-referencia",
    "plans": "catalogo global de planos",
    "product_origins": "catalogo global",
    "product_states": "catalogo global",
    "documents": "embeddings sem FK e sem consumidor em app/; escopo adiado",
    "alembic_version": "controle do Alembic, nao e dado da aplicacao",
}


def tabelas_de_dado() -> list[str]:
    return sorted(t for t in Base.metadata.tables if t not in CATALOGO_GLOBAL)


def test_sao_vinte_e_uma_tabelas_de_dado():
    """
    Trava a contagem. Se este teste falhar, uma tabela foi adicionada ou
    removida — atualize o numero DEPOIS de decidir o escopo dela, nunca antes.
    """
    assert len(tabelas_de_dado()) == 21


@pytest.mark.parametrize("tabela", tabelas_de_dado())
def test_toda_tabela_de_dado_tem_created_by(tabela: str):
    colunas = Base.metadata.tables[tabela].columns
    assert "created_by" in colunas, (
        f"{tabela} nao tem created_by. Se ela nao tem dono, declare em "
        "CATALOGO_GLOBAL com o motivo."
    )
    assert colunas["created_by"].nullable, (
        f"{tabela}.created_by precisa ser nullable: o portal publico e o "
        "formulario de leads gravam sem sessao de usuario."
    )
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/test_colunas_de_escopo.py -q
```

Esperado: `test_sao_vinte_e_uma_tabelas_de_dado` passa (já são 21) e os 21
`test_toda_tabela_de_dado_tem_created_by` falham com "nao tem created_by".

- [ ] **Passo 3: Adicionar a coluna nos 21 models**

Em `ArchSmart-api/app/models/all_models.py`, acrescente esta linha em cada uma
das 21 classes de dado, logo depois da linha do `id`:

```python
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
```

As 21 classes, na ordem em que aparecem no arquivo: `User`, `Lead`,
`LegalAcceptance`, `Subscription`, `ProjectSlot`, `Product`, `Project`,
`Client`, `Environment`, `EnvironmentDNA`, `Budget`, `BudgetItem`,
`ItemOption`, `Presentation`, `PresentationEnvironment`,
`PresentationAcceptance`, `PresentationComment`, `FinancialEntry`, `Event`,
`AdminLog`, `Notification`.

> ⚠️ `User.created_by` é FK para a própria tabela. O SQLAlchemy resolve
> auto-referência sem `remote_side` **enquanto não houver `relationship()`** —
> e aqui não há. Se alguém acrescentar um `relationship("User")` depois, vai
> precisar de `remote_side=[id]`.

- [ ] **Passo 4: Gerar a migração**

```bash
alembic revision --autogenerate -m "created_by nas tabelas de dado"
```

- [ ] **Passo 5: Revisar a migração gerada, à mão**

O autogenerate acerta as 21 `add_column`, mas **confira três coisas** antes de
seguir — ele já errou nas duas direções neste repositório:

1. Que só há `add_column` de `created_by` e nada mais. Qualquer `alter_column`
   ou `drop_index` que apareça é divergência entre model e banco que veio de
   antes, e não é desta migração resolver — tire da migração e abra uma caixa.
2. Que o `downgrade()` tem os 21 `op.drop_column` correspondentes e **não está
   vazio** (restrição global do repositório).
3. Que `down_revision` aponta para `b77a9b5656c2` (o head atual).

- [ ] **Passo 6: Aplicar no banco de teste e rodar os testes**

A suíte usa `Base.metadata.create_all`, não a migração — então este passo
verifica a **migração**, que é o que roda em produção:

```bash
pytest tests/test_receita_migracoes.py -q
pytest tests/test_colunas_de_escopo.py -q
```

Esperado: `test_receita_reproduz_os_models` passa (a migração e os models
concordam) e os 21 testes de `created_by` passam.

- [ ] **Passo 7: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **108 passed** (86 da Tarefa 2 + 22 novos: 21 parametrizados + a
contagem).

- [ ] **Passo 8: Commit**

```bash
git add ArchSmart-api/app/models/all_models.py ArchSmart-api/alembic/versions/ \
        ArchSmart-api/tests/test_colunas_de_escopo.py
git commit -m "feat(db): adiciona created_by nas 21 tabelas de dado"
```

---

## Tarefa 4: `account_id` nas 10 tabelas que faltam

Fecha a caixa "`account_id` e `created_by` nas 10 tabelas que faltam".

**Arquivos:**
- Modificar: `ArchSmart-api/app/models/all_models.py` (10 classes)
- Criar: `ArchSmart-api/alembic/versions/<hash>_account_id_nas_dez_tabelas.py`
- Modificar: `ArchSmart-api/tests/test_colunas_de_escopo.py` (acrescenta o
  teste de `account_id`)

**Interfaces:**
- Consome: a coluna `created_by` da Tarefa 3 (mesmas classes).
- Produz: `account_id UUID NOT NULL REFERENCES accounts(id)` nas 10 tabelas.
  A Tarefa 5 depende disso para o `ScopedRepository` ser universal, e a Tarefa
  6 para os índices existirem.

**Desnormalização deliberada.** `environments.account_id` é derivável por
`environments → projects → account_id`. A coluna existe assim mesmo porque o
repositório só é universal se **toda** tabela responder à mesma pergunta com o
mesmo `WHERE`, e porque um índice em `(account_id, ...)` precisa da coluna na
própria tabela para servir.

**Caminho de backfill de cada uma** — medido nos FKs do model:

| Tabela | Caminho até `account_id` |
|---|---|
| `project_slots` | `subscriptions.account_id` via `subscription_id` (NOT NULL) |
| `environments` | `projects.account_id` via `project_id` (NOT NULL) |
| `environment_dnas` | `environments → projects` via `environment_id` (NOT NULL) |
| `budgets` | `projects.account_id` via `project_id` (NOT NULL) |
| `budget_items` | `budgets → projects` via `budget_id` (NOT NULL) |
| `item_options` | `budget_items → budgets → projects` via `budget_item_id` (NOT NULL) |
| `presentations` | `projects.account_id` via `project_id` (NOT NULL) |
| `presentation_environments` | `presentations → projects` via `presentation_id` (NOT NULL) |
| `presentation_acceptances` | `presentations → projects` via `presentation_id` (NOT NULL) |
| `presentation_comments` | `presentations → projects` via `presentation_id` (NOT NULL) |

Todos os FKs do caminho são `NOT NULL`, então nenhum `UPDATE` deixa linha órfã
— o que permite fechar em `NOT NULL` no fim da mesma migração. **A ordem
importa:** `item_options` depende de `budget_items` já preenchido, que depende
de `budgets`.

- [ ] **Passo 1: Escrever o teste que falha**

Acrescente a `ArchSmart-api/tests/test_colunas_de_escopo.py`:

```python
# As 10 que ganharam account_id na Secao 4, Tarefa 4. A lista existe para o
# teste de NOT NULL: nas outras 11 a coluna e mais antiga e ha linha legada.
GANHARAM_ACCOUNT_ID = [
    "budget_items",
    "budgets",
    "environment_dnas",
    "environments",
    "item_options",
    "presentation_acceptances",
    "presentation_comments",
    "presentation_environments",
    "presentations",
    "project_slots",
]


@pytest.mark.parametrize("tabela", tabelas_de_dado())
def test_toda_tabela_de_dado_tem_account_id(tabela: str):
    colunas = Base.metadata.tables[tabela].columns
    assert "account_id" in colunas, (
        f"{tabela} nao tem account_id. Sem ela o ScopedRepository levanta "
        "TypeError e nenhum endpoint consegue ler a tabela."
    )


@pytest.mark.parametrize("tabela", GANHARAM_ACCOUNT_ID)
def test_account_id_e_obrigatorio_nas_dez(tabela: str):
    coluna = Base.metadata.tables[tabela].columns["account_id"]
    assert not coluna.nullable, (
        f"{tabela}.account_id precisa ser NOT NULL: uma linha sem conta e "
        "invisivel para o ScopedRepository e vira dado orfao."
    )
    assert coluna.foreign_keys, f"{tabela}.account_id precisa de FK para accounts"
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/test_colunas_de_escopo.py -q
```

Esperado: 10 falhas em `test_toda_tabela_de_dado_tem_account_id` e 10 erros em
`test_account_id_e_obrigatorio_nas_dez` (`KeyError: 'account_id'`).

- [ ] **Passo 3: Adicionar a coluna nos 10 models**

Em cada uma das 10 classes, logo depois do `id`:

```python
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
```

- [ ] **Passo 4: Escrever a migração à mão**

`alembic revision --autogenerate` **não serve aqui**: ele geraria
`add_column(nullable=False)` numa tabela com linhas, o que falha em qualquer
banco não vazio — e produção já tem 27 tabelas criadas pela receita. Gere o
esqueleto e escreva o corpo:

```bash
alembic revision -m "account_id nas dez tabelas que faltavam"
```

E o corpo, no arquivo gerado:

```python
"""account_id nas dez tabelas que faltavam

Adiciona a coluna como nullable, preenche pelo caminho de FK de cada tabela e
so entao fecha em NOT NULL. Fazer em tres tempos e o que permite a migracao
rodar num banco com dado — e ela roda no CMD do container (ADR 0007), contra
producao, sem passo manual.

A ordem dos UPDATE importa: item_options le budget_items, que le budgets.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "<hash gerado>"
down_revision = "<hash da Tarefa 3>"
branch_labels = None
depends_on = None

# (tabela, SQL do UPDATE que preenche account_id), em ordem de dependencia.
BACKFILL = [
    (
        "project_slots",
        """
        UPDATE project_slots AS t
           SET account_id = s.account_id
          FROM subscriptions AS s
         WHERE s.id = t.subscription_id
        """,
    ),
    (
        "environments",
        """
        UPDATE environments AS t
           SET account_id = p.account_id
          FROM projects AS p
         WHERE p.id = t.project_id
        """,
    ),
    (
        "environment_dnas",
        """
        UPDATE environment_dnas AS t
           SET account_id = e.account_id
          FROM environments AS e
         WHERE e.id = t.environment_id
        """,
    ),
    (
        "budgets",
        """
        UPDATE budgets AS t
           SET account_id = p.account_id
          FROM projects AS p
         WHERE p.id = t.project_id
        """,
    ),
    (
        "budget_items",
        """
        UPDATE budget_items AS t
           SET account_id = b.account_id
          FROM budgets AS b
         WHERE b.id = t.budget_id
        """,
    ),
    (
        "item_options",
        """
        UPDATE item_options AS t
           SET account_id = bi.account_id
          FROM budget_items AS bi
         WHERE bi.id = t.budget_item_id
        """,
    ),
    (
        "presentations",
        """
        UPDATE presentations AS t
           SET account_id = p.account_id
          FROM projects AS p
         WHERE p.id = t.project_id
        """,
    ),
    (
        "presentation_environments",
        """
        UPDATE presentation_environments AS t
           SET account_id = pr.account_id
          FROM presentations AS pr
         WHERE pr.id = t.presentation_id
        """,
    ),
    (
        "presentation_acceptances",
        """
        UPDATE presentation_acceptances AS t
           SET account_id = pr.account_id
          FROM presentations AS pr
         WHERE pr.id = t.presentation_id
        """,
    ),
    (
        "presentation_comments",
        """
        UPDATE presentation_comments AS t
           SET account_id = pr.account_id
          FROM presentations AS pr
         WHERE pr.id = t.presentation_id
        """,
    ),
]

TABELAS = [tabela for tabela, _ in BACKFILL]


def upgrade() -> None:
    for tabela in TABELAS:
        op.add_column(
            tabela,
            sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=True),
        )

    for tabela, sql in BACKFILL:
        op.execute(sa.text(sql))

    for tabela in TABELAS:
        # Uma linha orfa aqui significa FK quebrada vinda de antes. Falhar alto
        # e o comportamento certo: a ADR 0007 derruba o deploy de proposito.
        op.alter_column(tabela, "account_id", nullable=False)
        op.create_foreign_key(
            f"fk_{tabela}_account_id_accounts",
            tabela,
            "accounts",
            ["account_id"],
            ["id"],
        )


def downgrade() -> None:
    for tabela in reversed(TABELAS):
        op.drop_constraint(
            f"fk_{tabela}_account_id_accounts", tabela, type_="foreignkey"
        )
        op.drop_column(tabela, "account_id")
```

- [ ] **Passo 5: Provar que a migração roda num banco COM dado**

Este é o passo que separa "a migração aplica" de "a migração aplica em
produção". Crie `ArchSmart-api/tests/test_backfill_account_id.py`:

```python
"""
A migracao de account_id roda num banco que JA TEM linhas.

Por que este teste nao usa a fixture `db`: o schema dela vem de
`Base.metadata.create_all`, entao as linhas nasceriam com `account_id` ja
preenchido pelo ORM e a assercao conferiria o que o proprio teste garantiu —
um teste que nao testa nada. Aqui a sequencia e outra e e a de producao:

  1. `alembic upgrade <revisao PAI>`  -> schema SEM account_id nas dez
  2. INSERT por SQL cru               -> linhas legadas, como as que existem
  3. `alembic upgrade head`           -> a migracao desta tarefa roda
  4. so entao a conferencia

Se o backfill errar um nivel da arvore, o passo 3 falha no `SET NOT NULL` (e
a ADR 0007 derrubaria o deploy) ou o passo 4 acusa a divergencia.
"""
import os
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from app.core import config as app_config

RAIZ = Path(__file__).resolve().parents[1]
# conftest.py exporta a URL do banco de teste em DATABASE_URL quando e
# importado, antes de qualquer teste rodar — e e la que mora a guarda que
# recusa banco que nao seja local e terminado em `_test`.
URL_BASE = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
BANCO_BACKFILL = "arqsmart_backfill_test"
URL_ADMIN = f"{URL_BASE}/postgres"
URL_BACKFILL = f"{URL_BASE}/{BANCO_BACKFILL}"

# A revisao PAI desta migracao: a de created_by, da Tarefa 3. Leia o
# `down_revision` do arquivo que voce escreveu no Passo 4 e cole aqui — nao
# adivinhe, e nao use "head-1", que nao existe no Alembic.
REVISAO_PAI = "<down_revision da migracao desta tarefa>"


@pytest.fixture
def banco_no_estado_anterior(monkeypatch):
    """
    Banco PROPRIO, descartavel — mesmo padrao de
    tests/test_receita_migracoes.py::banco_da_receita, e pelo mesmo motivo:
    a fixture `db` da conftest e de sessao e ja subiu o schema inteiro com
    create_all. Mexer naquele schema no meio da suite derrubaria as fixtures
    de todos os testes seguintes.
    """
    admin = create_engine(URL_ADMIN, isolation_level="AUTOCOMMIT")
    with admin.connect() as conexao:
        conexao.execute(text(f"DROP DATABASE IF EXISTS {BANCO_BACKFILL}"))
        conexao.execute(text(f"CREATE DATABASE {BANCO_BACKFILL}"))
    admin.dispose()

    engine = create_engine(URL_BACKFILL)
    with engine.begin() as conexao:
        conexao.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    # alembic/env.py le settings.DATABASE_URL em tempo de execucao, entao
    # trocar o atributo redireciona a receita para o banco descartavel.
    monkeypatch.setattr(app_config.settings, "DATABASE_URL", URL_BACKFILL)
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    command.upgrade(cfg, REVISAO_PAI)

    yield engine, cfg
    engine.dispose()


def test_backfill_preenche_a_arvore_inteira(banco_no_estado_anterior):
    engine, cfg = banco_no_estado_anterior
    conta = uuid.uuid4()
    cliente = uuid.uuid4()
    projeto = uuid.uuid4()
    ambiente = uuid.uuid4()
    orcamento = uuid.uuid4()
    item = uuid.uuid4()
    opcao = uuid.uuid4()
    apresentacao = uuid.uuid4()

    # INSERT cru, no schema ANTIGO: nenhuma destas tabelas filhas tem
    # account_id ainda. E exatamente a forma das linhas que ja existem.
    with engine.begin() as c:
        c.execute(
            text("INSERT INTO accounts (id, name) VALUES (:i, 'Conta legada')"),
            {"i": conta},
        )
        c.execute(
            text(
                "INSERT INTO clients (id, account_id, name) "
                "VALUES (:i, :a, 'Cliente')"
            ),
            {"i": cliente, "a": conta},
        )
        c.execute(
            text(
                "INSERT INTO projects (id, account_id, client_id, name) "
                "VALUES (:i, :a, :c, 'Projeto')"
            ),
            {"i": projeto, "a": conta, "c": cliente},
        )
        c.execute(
            text(
                "INSERT INTO environments (id, project_id, name) "
                "VALUES (:i, :p, 'Sala')"
            ),
            {"i": ambiente, "p": projeto},
        )
        c.execute(
            text("INSERT INTO budgets (id, project_id) VALUES (:i, :p)"),
            {"i": orcamento, "p": projeto},
        )
        c.execute(
            text(
                "INSERT INTO budget_items (id, budget_id, environment_id, rule_type) "
                "VALUES (:i, :b, :e, 'FLOOR')"
            ),
            {"i": item, "b": orcamento, "e": ambiente},
        )
        c.execute(
            text(
                "INSERT INTO item_options (id, budget_item_id) VALUES (:i, :b)"
            ),
            {"i": opcao, "b": item},
        )
        c.execute(
            text(
                "INSERT INTO presentations (id, project_id, name, status) "
                "VALUES (:i, :p, 'Proposta', 'DRAFT')"
            ),
            {"i": apresentacao, "p": projeto},
        )

    # A migracao desta tarefa roda AGORA, sobre as linhas acima.
    command.upgrade(cfg, "head")

    with engine.begin() as c:
        # 1. Toda linha tem conta, e e a conta certa.
        for tabela, fk, pai in [
            ("environments", "project_id", "projects"),
            ("budgets", "project_id", "projects"),
            ("budget_items", "budget_id", "budgets"),
            ("item_options", "budget_item_id", "budget_items"),
            ("presentations", "project_id", "projects"),
        ]:
            divergentes = c.execute(
                text(
                    f"SELECT count(*) FROM {tabela} t "
                    f"JOIN {pai} p ON p.id = t.{fk} "
                    "WHERE t.account_id IS DISTINCT FROM p.account_id"
                )
            ).scalar()
            assert divergentes == 0, (
                f"{tabela}.account_id divergiu de {pai} depois do backfill"
            )

        # 2. A coluna fechou em NOT NULL de verdade — o `SET NOT NULL` da
        #    migracao e o que impede linha orfa nascer depois.
        obrigatorias = c.execute(
            text(
                "SELECT table_name FROM information_schema.columns "
                "WHERE column_name = 'account_id' AND is_nullable = 'NO' "
                "AND table_name IN ('environments','environment_dnas','budgets',"
                "'budget_items','item_options','presentations',"
                "'presentation_environments','presentation_acceptances',"
                "'presentation_comments','project_slots')"
            )
        ).scalars().all()
        assert len(obrigatorias) == 10, (
            "esperava as 10 tabelas com account_id NOT NULL, achei "
            f"{sorted(obrigatorias)}"
        )
```

> ⚠️ **Este teste cria e derruba um banco (`arqsmart_backfill_test`), não um
> schema.** É o mesmo padrão que `tests/test_receita_migracoes.py` já usa, e
> pelo mesmo motivo: a fixture `db` da conftest é de sessão e já subiu o schema
> com `create_all`; mexer nele no meio da suíte derrubaria as fixtures de todos
> os testes seguintes.
>
> ⚠️ `URL_BASE` sai de `os.environ["DATABASE_URL"]`, que a `tests/conftest.py`
> escreve **na importação**, depois de a guarda de `tools/guarda_banco.py`
> recusar qualquer destino que não seja local e terminado em `_test`. Isso é o
> que torna o `DROP DATABASE` seguro. **Não troque por `os.getenv` com valor
> padrão** — seria contornar a guarda, que é exatamente o furo que a Seção 3
> fechou.

- [ ] **Passo 6: Rodar os testes**

```bash
pytest tests/test_colunas_de_escopo.py tests/test_backfill_account_id.py tests/test_receita_migracoes.py -q
```

Esperado: tudo verde. `test_receita_reproduz_os_models` é o que prova que a
migração escrita à mão bate com os models.

- [ ] **Passo 7: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **140 passed** (108 da Tarefa 3 + 21 `account_id` + 10 `NOT NULL` +
1 de backfill).

> Se o número não bater, **conte antes de seguir**:
> `pytest --collect-only -q | tail -1`. Um teste que sumiu da coleta é um
> arquivo que deixou de ser importável, não um teste que passou.

- [ ] **Passo 8: Commit**

```bash
git add ArchSmart-api/app/models/all_models.py ArchSmart-api/alembic/versions/ \
        ArchSmart-api/tests/test_colunas_de_escopo.py \
        ArchSmart-api/tests/test_backfill_account_id.py
git commit -m "feat(db): adiciona account_id nas dez tabelas que faltavam, com backfill"
```

---
## Tarefa 5: Exceções de domínio e handler único

Primeira metade da caixa "Tratamento de erro único". A segunda (os `print()`) é
a Tarefa 9. Esta vem antes do `ScopedRepository` porque ele levanta `NotFound`.

**O problema, medido:** 12 `detail=str(e)` mandam a exceção crua para o cliente
— nomes de coluna, trechos de SQL, mensagens do Supabase. Um deles
(`app/main.py:80`) responde `DB unreachable: <string de conexão do driver>`.

Os 12, com arquivo e linha (05/09/2026):

```
app/api/account.py:79                  app/api/routers/product_router.py:361
app/api/auth.py:25                     app/api/users.py:121
app/api/auth.py:35                     app/main.py:80
app/api/auth.py:105                    app/api/endpoints/presentations.py:291
app/api/auth.py:184                    app/api/endpoints/presentations.py:414
app/api/auth.py:218                    app/api/endpoints/presentations.py:440
```

`app/api/users.py:121` já sai na Tarefa 2. Sobram 11 para esta.

**Arquivos:**
- Criar: `ArchSmart-api/app/core/errors.py`
- Modificar: `ArchSmart-api/app/main.py` (registrar o handler; corrigir o
  `/health/db`; corrigir a grafia da marca no `title`)
- Modificar: os 5 arquivos com `detail=str(e)` restantes
- Testar: `ArchSmart-api/tests/api/test_erros.py` (novo)

**Interfaces:**
- Consome: `app.core.logging` (já configurado no `main.py`).
- Produz, e as Tarefas 6 e 11–15 dependem destes nomes:
  - `DomainError(Exception)` — base, com `.mensagem: str` e `.status: int`.
  - `NotFound(DomainError)` — `status = 404`, mensagem padrão
    `"Recurso nao encontrado."`
  - `Forbidden(DomainError)` — `status = 403`.
  - `QuotaExceeded(DomainError)` — `status = 402`.
  - `ValidacaoDeDominio(DomainError)` — `status = 422`.
  - `def registrar_handlers(app: FastAPI) -> None`.

**Por que 404 e não 403 para recurso de outra conta.** Um `403` confirma que o
recurso existe. O teste genérico da Tarefa 16 exige `404` justamente por isso, e
os 27 testes de `tests/isolation/` que vieram da Seção 1 já afirmam `404`.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `ArchSmart-api/tests/api/test_erros.py`:

```python
"""
Erro do dominio vira resposta HTTP em pt-BR, e o rastro tecnico fica no log.

O teste do vazamento e o mais importante: ele reproduz o padrao
`detail=str(e)`, que mandava mensagem de driver e nome de coluna para o
cliente.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import (
    DomainError,
    Forbidden,
    NotFound,
    QuotaExceeded,
    ValidacaoDeDominio,
    registrar_handlers,
)


@pytest.fixture
def app_de_erro() -> TestClient:
    app = FastAPI()
    registrar_handlers(app)

    @app.get("/nao-encontrado")
    def _nao_encontrado():
        raise NotFound()

    @app.get("/proibido")
    def _proibido():
        raise Forbidden()

    @app.get("/cota")
    def _cota():
        raise QuotaExceeded("Seu plano permite 2 projetos.")

    @app.get("/invalido")
    def _invalido():
        raise ValidacaoDeDominio("A area do ambiente precisa ser positiva.")

    @app.get("/explode")
    def _explode():
        raise RuntimeError(
            "connection to server at 'db.exemplo.supabase.co' failed: senha=hunter2"
        )

    return TestClient(app, raise_server_exceptions=False)


def test_not_found_vira_404_em_portugues(app_de_erro):
    r = app_de_erro.get("/nao-encontrado")
    assert r.status_code == 404
    assert r.json()["detail"] == "Recurso nao encontrado."


def test_forbidden_vira_403(app_de_erro):
    assert app_de_erro.get("/proibido").status_code == 403


def test_quota_vira_402_com_a_mensagem_dada(app_de_erro):
    r = app_de_erro.get("/cota")
    assert r.status_code == 402
    assert r.json()["detail"] == "Seu plano permite 2 projetos."


def test_validacao_vira_422(app_de_erro):
    r = app_de_erro.get("/invalido")
    assert r.status_code == 422
    assert r.json()["detail"] == "A area do ambiente precisa ser positiva."


def test_excecao_inesperada_nao_vaza_detalhe(app_de_erro):
    """
    Era o `detail=str(e)`: host, senha e mensagem de driver na resposta.
    """
    r = app_de_erro.get("/explode")
    assert r.status_code == 500
    corpo = r.text
    assert "supabase.co" not in corpo
    assert "hunter2" not in corpo
    assert "connection to server" not in corpo
    assert r.json()["detail"] == "Erro interno. Tente novamente."


def test_excecao_inesperada_vai_para_o_log(app_de_erro, caplog):
    """
    O rastro nao some — ele muda de lugar. Sem isto, o handler viraria uma
    forma elegante de esconder defeito.
    """
    with caplog.at_level("ERROR"):
        app_de_erro.get("/explode")
    assert any("hunter2" in r.getMessage() or r.exc_info for r in caplog.records)


def test_domain_error_e_a_base_de_todas():
    for classe in (NotFound, Forbidden, QuotaExceeded, ValidacaoDeDominio):
        assert issubclass(classe, DomainError)
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/api/test_erros.py -q
```

Esperado: `ModuleNotFoundError: No module named 'app.core.errors'`.

- [ ] **Passo 3: Escrever `app/core/errors.py`**

```python
"""
Erros de dominio e a traducao deles para HTTP.

Regra: a resposta carrega uma frase em pt-BR que o usuario pode ler; o rastro
tecnico vai inteiro para o log. Ate a Secao 4 o codigo fazia o contrario —
`detail=str(e)` em 12 lugares mandava mensagem de driver, nome de coluna e
host do banco para quem chamou, e nao registrava nada.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

MENSAGEM_GENERICA = "Erro interno. Tente novamente."


class DomainError(Exception):
    """
    Base de tudo que a aplicacao sabe explicar ao usuario.

    `status` e `mensagem` sao atributos de classe para que
    `raise NotFound()` — sem argumento — ja produza uma resposta completa.
    """

    status: int = 400
    mensagem: str = "Requisicao invalida."

    def __init__(self, mensagem: str | None = None) -> None:
        if mensagem is not None:
            self.mensagem = mensagem
        super().__init__(self.mensagem)


class NotFound(DomainError):
    status = 404
    # Deliberadamente vaga: distinguir "nao existe" de "existe e nao e sua"
    # confirmaria a existencia do recurso alheio. Ver tests/isolation/.
    mensagem = "Recurso nao encontrado."


class Forbidden(DomainError):
    status = 403
    mensagem = "Voce nao tem permissao para esta acao."


class QuotaExceeded(DomainError):
    status = 402
    mensagem = "Seu plano nao permite esta acao."


class ValidacaoDeDominio(DomainError):
    status = 422
    mensagem = "Dados invalidos."


def registrar_handlers(app: FastAPI) -> None:
    """Liga os dois handlers na aplicacao. Chamado uma vez, no main.py."""

    @app.exception_handler(DomainError)
    async def _dominio(_: Request, erro: DomainError) -> JSONResponse:
        # info, nao error: erro de dominio e fluxo previsto, nao defeito.
        logger.info("%s: %s", type(erro).__name__, erro.mensagem)
        return JSONResponse(
            status_code=erro.status, content={"detail": erro.mensagem}
        )

    @app.exception_handler(Exception)
    async def _inesperado(request: Request, erro: Exception) -> JSONResponse:
        logger.error(
            "Erro nao tratado em %s %s",
            request.method,
            request.url.path,
            exc_info=erro,
        )
        return JSONResponse(
            status_code=500, content={"detail": MENSAGEM_GENERICA}
        )
```

- [ ] **Passo 4: Ligar no `main.py`, corrigir o `/health/db` e a marca**

Em `ArchSmart-api/app/main.py`:

```python
from app.core.errors import registrar_handlers

# A marca e "Arq Smart" — duas palavras, com Q (Art. 8). Estava "Arch Smart",
# que e a grafia do nome do diretorio, nao da marca.
app = FastAPI(title="Arq Smart API", version="1.0.0")

registrar_handlers(app)
```

E o `/health/db` (linha 80 hoje) para de expor a mensagem do driver:

```python
    except Exception as erro:
        logger.error("Health check do banco falhou", exc_info=erro)
        raise HTTPException(status_code=503, detail="Banco indisponivel.")
```

E o `read_root`:

```python
@app.get("/")
def read_root():
    return {"message": "API Arq Smart"}
```

> ⚠️ **Ordem importa.** `registrar_handlers(app)` precisa vir **depois** do
> `app.add_exception_handler(RateLimitExceeded, ...)` do slowapi que já existe
> nas linhas 11–17. Um handler para `Exception` registrado antes captura o
> `RateLimitExceeded` e devolve 500 no lugar do 429 — e os 4 testes de
> `tests/isolation/test_public_endpoints.py` afirmam 429.

- [ ] **Passo 5: Rodar os testes de erro**

```bash
pytest tests/api/test_erros.py -q
```

Esperado: **7 passed**.

- [ ] **Passo 6: Trocar os 11 `detail=str(e)` restantes**

Em cada um dos 5 arquivos, o padrão é o mesmo: a exceção crua sai da resposta e
entra no log. Um exemplo real, `app/api/account.py:79`:

```python
    except Exception as erro:
        logger.error("Falha ao subir o logo da conta", exc_info=erro)
        raise ValidacaoDeDominio("Nao foi possivel enviar o arquivo.")
```

Os outros dez, com a mensagem em pt-BR de cada um:

| Arquivo:linha | Mensagem que passa a sair |
|---|---|
| `api/auth.py:25` | `"Nao foi possivel iniciar o cadastro."` |
| `api/auth.py:35` | `"Nao foi possivel iniciar a recuperacao de senha."` |
| `api/auth.py:105` | `"Nao foi possivel concluir o cadastro."` |
| `api/auth.py:184` | `"Nao foi possivel entrar. Verifique e-mail e senha."` |
| `api/auth.py:218` | `"Nao foi possivel alterar a senha."` |
| `endpoints/presentations.py:291` | `"Nao foi possivel enviar a imagem."` |
| `endpoints/presentations.py:414` | `"Nao foi possivel enviar a imagem."` |
| `endpoints/presentations.py:440` | `"Nao foi possivel remover a imagem."` |
| `routers/product_router.py:361` | `"Nao foi possivel processar o produto."` |
| `main.py:80` | `"Banco indisponivel."` (Passo 4) |

Cada arquivo ganha, no topo:

```python
import logging

from app.core.errors import ValidacaoDeDominio

logger = logging.getLogger(__name__)
```

- [ ] **Passo 7: Conferir que não sobrou nenhum**

```bash
grep -rn "detail=.*str(e" app --include=*.py | grep -v "^app/tests/"
```

Esperado: **saída vazia**. Cole essa saída (vazia) no PR — é o critério da caixa.

- [ ] **Passo 8: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **147 passed** (140 da Tarefa 4 + 7). Atenção especial aos 4 testes
de `tests/isolation/test_public_endpoints.py`: se algum virou 500, o handler de
`Exception` foi registrado na ordem errada (Passo 4).

- [ ] **Passo 9: Commit**

```bash
git add ArchSmart-api/app/core/errors.py ArchSmart-api/app/main.py \
        ArchSmart-api/app/api/ ArchSmart-api/tests/api/test_erros.py
git commit -m "feat: excecoes de dominio com handler unico, sem vazar rastro tecnico"
```

---

## Tarefa 6: `ScopedRepository` e o lint da escotilha

A peça central da seção. Fecha a caixa "`ScopedRepository` em
`app/db/repository.py`".

**Arquivos:**
- Criar: `ArchSmart-api/app/db/repository.py`
- Criar: `ArchSmart-api/tests/api/test_repositorio.py`
- Criar: `ArchSmart-api/tests/test_arquitetura.py`

**Interfaces:**
- Consome: `app.core.security.RequestContext`, `app.core.errors.NotFound`.
- Produz, e as Tarefas 11–15 dependem destes nomes exatos:
  - `class EscopoImpossivel(TypeError)`.
  - `class ScopedRepository:` com
    `__init__(self, db: Session, ctx: RequestContext)`,
    `query(self, model) -> Query`,
    `get(self, model, id_) -> Any | None`,
    `obter(self, model, id_) -> Any` (levanta `NotFound`),
    `create(self, model, **campos) -> Any`,
    `remover(self, obj) -> None`,
    e o estático `unscoped_query(db: Session, model) -> Query`.
  - `def get_repo(db: Session = Depends(get_db), ctx: RequestContext = Depends(get_context)) -> ScopedRepository`
    — a dependência que os endpoints declaram.

**A escotilha.** A spec diz que `unscoped_query()` é permitida em `app/tools/`
e `alembic/`. **`app/tools/` não existe** — o diretório de scripts que falam com
o banco é `ArchSmart-api/tools/` (ver `ArchSmart-api/tools/README.md`). O lint
usa os caminhos reais: `ArchSmart-api/tools/` e `ArchSmart-api/alembic/`.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `ArchSmart-api/tests/api/test_repositorio.py`:

```python
"""
O repositorio filtra por conta sozinho — e recusa o que nao consegue filtrar.

Cada teste aqui corresponde a uma forma de esquecer o filtro que ja aconteceu
neste codigo. A Secao 1 corrigiu 13 endpoints; esta classe existe para que a
14a vez nao seja possivel de escrever.
"""
import uuid

import pytest
from sqlalchemy.orm import Session

from app.core.errors import NotFound
from app.core.security import RequestContext
from app.db.repository import EscopoImpossivel, ScopedRepository
from app.models.all_models import Account, Client, Plan, Project, User


def _contexto(conta: Account, usuario: User) -> RequestContext:
    return RequestContext(
        user_id=usuario.id,
        account_id=conta.id,
        email=usuario.email,
        entitlements={},
    )


@pytest.fixture
def repo_a(db: Session, conta_a) -> ScopedRepository:
    return ScopedRepository(db, _contexto(*conta_a))


def _projeto(db: Session, conta: Account, nome: str) -> Project:
    cliente = Client(account_id=conta.id, name=f"Cliente de {nome}")
    db.add(cliente)
    db.flush()
    projeto = Project(account_id=conta.id, client_id=cliente.id, name=nome)
    db.add(projeto)
    db.flush()
    return projeto


def test_query_nao_devolve_linha_de_outra_conta(db, repo_a, conta_a, conta_b):
    _projeto(db, conta_a[0], "Meu")
    _projeto(db, conta_b[0], "Alheio")

    nomes = [p.name for p in repo_a.query(Project).all()]

    assert nomes == ["Meu"]


def test_get_de_recurso_alheio_devolve_none(db, repo_a, conta_b):
    alheio = _projeto(db, conta_b[0], "Alheio")

    assert repo_a.get(Project, alheio.id) is None


def test_obter_de_recurso_alheio_levanta_not_found(db, repo_a, conta_b):
    """
    NotFound, nao Forbidden: 403 confirmaria que o recurso existe.
    """
    alheio = _projeto(db, conta_b[0], "Alheio")

    with pytest.raises(NotFound):
        repo_a.obter(Project, alheio.id)


def test_obter_de_id_inexistente_levanta_not_found(repo_a):
    with pytest.raises(NotFound):
        repo_a.obter(Project, uuid.uuid4())


def test_model_sem_account_id_e_recusado(repo_a):
    """
    `Plan` e catalogo global. Nao da para filtrar por conta, e o repositorio
    prefere recusar a devolver tudo em silencio.
    """
    with pytest.raises(EscopoImpossivel) as erro:
        repo_a.query(Plan)

    assert "Art. 1" in str(erro.value)
    assert "unscoped_query" in str(erro.value)


def test_create_injeta_account_id_e_created_by(db, repo_a, conta_a):
    cliente = repo_a.create(Client, name="Cliente novo")
    db.flush()

    assert cliente.account_id == conta_a[0].id
    assert cliente.created_by == conta_a[1].id


def test_create_ignora_account_id_vindo_do_cliente(db, repo_a, conta_a, conta_b):
    """
    Art. 1: o que vem do cliente e ignorado. Passar account_id alheio nao
    move o recurso de conta — nem levanta erro que revele a outra conta.
    """
    cliente = repo_a.create(
        Client, name="Tentativa", account_id=conta_b[0].id
    )
    db.flush()

    assert cliente.account_id == conta_a[0].id


def test_remover_recusa_recurso_alheio(db, repo_a, conta_b):
    alheio = _projeto(db, conta_b[0], "Alheio")

    with pytest.raises(NotFound):
        repo_a.remover(alheio)

    assert db.query(Project).filter(Project.id == alheio.id).first() is not None


def test_unscoped_query_atravessa_o_escopo(db, conta_a, conta_b):
    """
    A escotilha funciona — e por isso ela tem um lint proprio
    (tests/test_arquitetura.py).
    """
    _projeto(db, conta_a[0], "Meu")
    _projeto(db, conta_b[0], "Alheio")

    assert ScopedRepository.unscoped_query(db, Project).count() == 2
```

E crie `ArchSmart-api/tests/test_arquitetura.py`:

```python
"""
Lints de arquitetura, escritos como teste porque o CI ja roda pytest.

Cada regra aqui existe porque a violacao dela ja custou alguma coisa neste
repositorio. Elas falham com o arquivo e a linha, nao com "algo esta errado".
"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
APP = RAIZ / "app"

# A escotilha e legitima em script que fala com o banco e em migracao. Note
# que a spec dizia `app/tools/`, que NAO existe: o diretorio real e
# ArchSmart-api/tools/ (ver ArchSmart-api/tools/README.md).
ONDE_A_ESCOTILHA_E_PERMITIDA = (RAIZ / "tools", RAIZ / "alembic", RAIZ / "tests")


# Diretorios de codigo, explicitos. NAO use RAIZ.rglob("*.py"): ele enumera os
# 4024 arquivos .py do venv/ antes de filtrar, e cada lint deste arquivo pagaria
# isso de novo.
DIRETORIOS_DE_CODIGO = ("app", "tools", "alembic", "tests")


def _arquivos_python(raiz: Path) -> list[Path]:
    if raiz.is_dir() and raiz != RAIZ:
        origens = [raiz]
    else:
        origens = [RAIZ / d for d in DIRETORIOS_DE_CODIGO if (RAIZ / d).is_dir()]
    return [
        p
        for origem in origens
        for p in origem.rglob("*.py")
        if "venv" not in p.parts and "node_modules" not in p.parts
    ]


def _ocorrencias(raiz: Path, agulha: str) -> list[str]:
    achados = []
    for arquivo in _arquivos_python(raiz):
        for numero, linha in enumerate(
            arquivo.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if agulha in linha:
                achados.append(f"{arquivo.relative_to(RAIZ)}:{numero}: {linha.strip()}")
    return achados


def test_escotilha_so_em_tools_alembic_e_testes():
    fora = [
        achado
        for achado in _ocorrencias(RAIZ, "unscoped_query")
        if not any(
            (RAIZ / achado.split(":")[0]).is_relative_to(permitido)
            for permitido in ONDE_A_ESCOTILHA_E_PERMITIDA
        )
        and "app/db/repository.py" not in achado.replace("\\", "/")
    ]
    assert not fora, (
        "unscoped_query() atravessa o filtro por conta e so pode aparecer em "
        "tools/, alembic/ e tests/. Fora de la:\n" + "\n".join(fora)
    )
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/api/test_repositorio.py tests/test_arquitetura.py -q
```

Esperado: `ModuleNotFoundError: No module named 'app.db.repository'` nos dez
primeiros; `test_escotilha_so_em_tools_alembic_e_testes` já passa (não há
nenhuma ocorrência ainda).

- [ ] **Passo 3: Escrever `app/db/repository.py`**

```python
"""
A unica porta para o banco em codigo de endpoint.

Antes da Secao 4 havia 117 `db.query()` diretos, e cada endpoint decidia
sozinho se filtrava por conta. Treze esqueceram — foi a Secao 1 inteira.
Enquanto for possivel esquecer, alguem esquece; entao o filtro deixa de ser
decisao de quem escreve o endpoint.
"""
from __future__ import annotations

from typing import Any, TypeVar
from uuid import UUID

from fastapi import Depends
from sqlalchemy.orm import Query, Session

from app.core.errors import NotFound
from app.core.security import RequestContext, get_context
from app.db.session import get_db

M = TypeVar("M")


class EscopoImpossivel(TypeError):
    """
    Model sem `account_id`. Subclasse de TypeError de proposito: e erro de
    programacao, nao condicao de runtime — nao existe entrada de usuario que
    o provoque, e nenhum `except` de endpoint deve captura-lo.
    """


class ScopedRepository:
    """
    Toda query nasce filtrada por `ctx.account_id`.

    Nao ha construtor que aceite `account_id` avulso: a unica origem e o
    `RequestContext`, que so o servidor monta (Art. 1).
    """

    def __init__(self, db: Session, ctx: RequestContext) -> None:
        self.db = db
        self.ctx = ctx

    # -- leitura ---------------------------------------------------------

    def _exigir_coluna_de_conta(self, model: type[M]) -> Any:
        coluna = getattr(model, "account_id", None)
        if coluna is None:
            raise EscopoImpossivel(
                f"{model.__name__} nao tem account_id, entao nao da para "
                "filtrar por conta (Art. 1: toda leitura e escrita e filtrada "
                "pela identidade da sessao). Se for catalogo global, use "
                "ScopedRepository.unscoped_query(db, model) — permitida so em "
                "tools/ e alembic/."
            )
        return coluna

    def query(self, model: type[M]) -> Query:
        coluna = self._exigir_coluna_de_conta(model)
        return self.db.query(model).filter(coluna == self.ctx.account_id)

    def get(self, model: type[M], id_: UUID | str) -> M | None:
        return self.query(model).filter(model.id == id_).first()

    def obter(self, model: type[M], id_: UUID | str) -> M:
        """
        Como `get`, mas levanta `NotFound` — que o handler da Tarefa 5 traduz
        para 404. Nunca 403: um 403 confirmaria que o recurso existe na conta
        de outra pessoa.
        """
        achado = self.get(model, id_)
        if achado is None:
            raise NotFound()
        return achado

    # -- escrita ---------------------------------------------------------

    def create(self, model: type[M], **campos: Any) -> M:
        """
        Injeta `account_id` e `created_by`. Qualquer `account_id` ou
        `created_by` passado em `campos` e DESCARTADO em silencio: o unico
        caminho ate essas colunas e o contexto.
        """
        campos.pop("account_id", None)
        campos.pop("created_by", None)
        objeto = model(
            account_id=self.ctx.account_id,
            created_by=self.ctx.user_id,
            **campos,
        )
        self.db.add(objeto)
        return objeto

    def remover(self, objeto: Any) -> None:
        """
        Recusa objeto de outra conta. Sem isto, um endpoint poderia carregar
        pela escotilha e apagar o que nao e dele.
        """
        if getattr(objeto, "account_id", None) != self.ctx.account_id:
            raise NotFound()
        self.db.delete(objeto)

    # -- escotilha -------------------------------------------------------

    @staticmethod
    def unscoped_query(db: Session, model: type[M]) -> Query:
        """
        Atravessa o filtro por conta. Legitima para catalogo global e para
        script de manutencao; ilegitima em endpoint. O lint que garante isso
        e `tests/test_arquitetura.py::test_escotilha_so_em_tools_alembic_e_testes`.
        """
        return db.query(model)


def get_repo(
    db: Session = Depends(get_db),
    ctx: RequestContext = Depends(get_context),
) -> ScopedRepository:
    """Dependencia que os endpoints declaram: `repo: ScopedRepository = Depends(get_repo)`."""
    return ScopedRepository(db, ctx)
```

- [ ] **Passo 4: Rodar os testes**

```bash
pytest tests/api/test_repositorio.py tests/test_arquitetura.py -q
```

Esperado: **11 passed** (10 do repositório + 1 do lint).

- [ ] **Passo 5: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **158 passed** (147 da Tarefa 5 + 11).

- [ ] **Passo 6: Commit**

```bash
git add ArchSmart-api/app/db/repository.py ArchSmart-api/tests/api/test_repositorio.py \
        ArchSmart-api/tests/test_arquitetura.py
git commit -m "feat(db): ScopedRepository filtra por conta sozinho, com lint da escotilha"
```

---

## Tarefa 7: Índices derivados das queries reais

Fecha a caixa "Índices derivados das queries reais".

**Ponto de partida medido:** o schema inteiro tem **4 índices**
(`ix_documents_id`, `ix_financial_entries_group_id`, `ix_users_email`,
`ix_users_supabase_id`). Depois da Tarefa 6, **toda** query de endpoint tem
`WHERE account_id = ?` — e nenhuma das 21 tabelas tem índice nessa coluna.

**Arquivos:**
- Modificar: `ArchSmart-api/app/models/all_models.py` (declarar os índices)
- Criar: `ArchSmart-api/alembic/versions/<hash>_indices_derivados_das_queries.py`
- Testar: `ArchSmart-api/tests/test_indices.py` (novo)

**Interfaces:**
- Consome: as colunas das Tarefas 3 e 4.
- Produz: 21 índices em `(account_id)` e 8 compostos. Nada depende deles em
  código — a Tarefa 8 depende de o `selectinload` ter índice para usar.

**Os compostos, e a query que justifica cada um.** A spec pede
"`(account_id, created_at)`, `(account_id, state_id)`, `(budget_id)`,
`(environment_id)`, `(project_id)`". Concretizado nas tabelas onde esses
filtros existem de fato:

| Índice | Query que o usa |
|---|---|
| `(account_id, created_at)` em `projects` | lista de projetos ordenada por data |
| `(account_id, created_at)` em `products` | biblioteca ordenada por data |
| `(account_id, created_at)` em `events` | agenda |
| `(account_id, created_at)` em `financial_entries` | extrato financeiro |
| `(account_id, state_id)` em `products` | filtro por estado na biblioteca |
| `(budget_id)` em `budget_items` | montagem do orçamento (Tarefa 8) |
| `(environment_id)` em `budget_items` | agrupamento por ambiente |
| `(project_id)` em `environments` | ambientes de um projeto |

- [ ] **Passo 1: Escrever o teste que falha**

Crie `ArchSmart-api/tests/test_indices.py`:

```python
"""
Toda tabela de dado tem indice em account_id.

Depois da Secao 4, TODA query de endpoint tem `WHERE account_id = ?`. Sem o
indice, cada uma delas e um sequential scan que cresce com o banco inteiro, e
nao com a conta.
"""
import pytest

from app.db.base_class import Base
import app.models.all_models  # noqa: F401
from tests.test_colunas_de_escopo import tabelas_de_dado

COMPOSTOS_ESPERADOS = {
    ("projects", ("account_id", "created_at")),
    ("products", ("account_id", "created_at")),
    ("products", ("account_id", "state_id")),
    ("events", ("account_id", "created_at")),
    ("financial_entries", ("account_id", "created_at")),
    ("budget_items", ("budget_id",)),
    ("budget_items", ("environment_id",)),
    ("environments", ("project_id",)),
}


def _colunas_dos_indices(tabela: str) -> set[tuple[str, ...]]:
    return {
        tuple(c.name for c in indice.columns)
        for indice in Base.metadata.tables[tabela].indexes
    }


@pytest.mark.parametrize("tabela", tabelas_de_dado())
def test_toda_tabela_de_dado_tem_indice_em_account_id(tabela: str):
    conjuntos = _colunas_dos_indices(tabela)
    tem = any(colunas and colunas[0] == "account_id" for colunas in conjuntos)
    assert tem, (
        f"{tabela} nao tem indice comecando em account_id. Indices desta "
        f"tabela: {sorted(conjuntos)}"
    )


@pytest.mark.parametrize("tabela,colunas", sorted(COMPOSTOS_ESPERADOS))
def test_indices_compostos_existem(tabela: str, colunas: tuple[str, ...]):
    assert colunas in _colunas_dos_indices(tabela), (
        f"falta indice {colunas} em {tabela}"
    )
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/test_indices.py -q
```

Esperado: 21 falhas de `account_id` e 8 de composto.

- [ ] **Passo 3: Declarar os índices nos models**

Duas formas, e as duas são usadas:

Para o índice simples de `account_id`, marque a coluna. Nas 21 classes de
dado, a linha do `account_id` passa a ter `index=True`:

```python
    account_id = Column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False, index=True
    )
```

> ⚠️ Em `leads` e `legal_acceptances` o `account_id` é `nullable=True` hoje —
> **não mude isso aqui**. Acrescente só o `index=True`. Tornar obrigatório é
> mudança de comportamento (lead anônimo existe) e não é desta caixa.

Para os compostos, `__table_args__` na classe. Exemplo em `Product`:

```python
class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_account_created", "account_id", "created_at"),
        Index("ix_products_account_state", "account_id", "state_id"),
    )
```

E os outros:

```python
# Project
    __table_args__ = (
        Index("ix_projects_account_created", "account_id", "created_at"),
    )
# Event
    __table_args__ = (
        Index("ix_events_account_created", "account_id", "created_at"),
    )
# FinancialEntry
    __table_args__ = (
        Index("ix_financial_entries_account_created", "account_id", "created_at"),
    )
# BudgetItem
    __table_args__ = (
        Index("ix_budget_items_budget", "budget_id"),
        Index("ix_budget_items_environment", "environment_id"),
    )
# Environment
    __table_args__ = (
        Index("ix_environments_project", "project_id"),
    )
```

`Index` precisa entrar no import do topo de `all_models.py`:

```python
from sqlalchemy import Index
```

- [ ] **Passo 4: Gerar e revisar a migração**

```bash
alembic revision --autogenerate -m "indices derivados das queries reais"
```

Confira, no arquivo gerado: só `create_index`; `downgrade()` com os
`drop_index` correspondentes e **não vazio**; `down_revision` apontando para a
migração da Tarefa 4.

> ⚠️ `op.create_index` sem `postgresql_concurrently=True` **trava escrita na
> tabela** enquanto roda. Em produção isso acontece durante o start do
> contêiner (ADR 0007), antes de o uvicorn subir — não há tráfego para
> bloquear, e as tabelas hoje são pequenas. Deixe como o autogenerate escreveu.
> Se algum dia uma tabela ficar grande, aí sim `CONCURRENTLY` — que **não** roda
> dentro de transação, e exigiria mudar o `env.py`.

- [ ] **Passo 5: Rodar os testes**

```bash
pytest tests/test_indices.py tests/test_receita_migracoes.py -q
```

Esperado: **32 passed** (21 + 8 + 3 da receita).

- [ ] **Passo 6: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **187 passed** (158 da Tarefa 6 + 29).

- [ ] **Passo 7: Commit**

```bash
git add ArchSmart-api/app/models/all_models.py ArchSmart-api/alembic/versions/ \
        ArchSmart-api/tests/test_indices.py
git commit -m "perf(db): indices em account_id e compostos derivados das queries"
```

---
## Tarefa 8: `calculate_quantity` pura e o fim do N+1 no orçamento

Fecha a caixa "Fim do N+1 no orçamento (`calculate_quantity` pura, de ~300 para
2 queries)".

**O problema, com linha.** `calculate_budget_item_quantity(db, budget_item)`
(`app/services/budget_calculator.py:6`) faz até **3 queries por item**:
`ItemOption` (linha 41), `Product` (linha 45) e `EnvironmentDNA` (linha 55).
Ela é chamada dentro de laço em `app/api/routers/budgets_router.py:92` e
`:328`, e em `app/api/endpoints/public.py:271` — 100 itens viram ~300 queries.

**Os 6 pontos de chamada** (medidos em 05/09/2026):
`budgets_router.py:92`, `:162`, `:193`, `:328`, e `public.py:271`.
Os de linha 162 e 193 são de item único (uma chamada, não laço) — ainda assim
passam pela função nova, para haver **uma** definição do cálculo.

**Arquivos:**
- Modificar: `ArchSmart-api/app/services/budget_calculator.py` (reescrita)
- Modificar: `ArchSmart-api/app/api/routers/budgets_router.py` (4 chamadas)
- Modificar: `ArchSmart-api/app/api/endpoints/public.py` (1 chamada)
- Testar: `ArchSmart-api/tests/services/test_calculo_de_quantidade.py` (novo)
- Testar: `ArchSmart-api/tests/api/test_orcamento_sem_n_mais_um.py` (novo)

**Interfaces:**
- Consome: `app.models.all_models.{BudgetItem, EnvironmentDNA, Product, RuleType}`.
- Produz:
  - `@dataclass(frozen=True) class Quantidade:` com
    `base_area: float`, `calculated_quantity: int`, `has_yield_alert: bool`.
  - `def calculate_quantity(item: BudgetItem, dna: EnvironmentDNA | None, produto: Product | None) -> Quantidade`
    — **pura**, sem `Session`, sem I/O.
  - `def carregar_orcamento(db_query) -> tuple[list[BudgetItem], dict[UUID, EnvironmentDNA]]`
    — as duas queries.
  - `calculate_budget_item_quantity` **deixa de existir**. Nenhum código novo
    deve chamá-la.

**Por que pura importa mais que rápida.** Hoje não há um único teste do cálculo
que não precise de banco, porque a função abre `Session`. Regra de negócio sem
teste barato é regra de negócio que ninguém mexe.

- [ ] **Passo 1: Escrever os testes de função pura**

Crie `ArchSmart-api/tests/services/__init__.py` (vazio) e
`ArchSmart-api/tests/services/test_calculo_de_quantidade.py`:

```python
"""
O calculo de quantidade, sem banco.

Todo caso aqui roda em memoria. Se algum precisar de `db`, a funcao deixou de
ser pura e a Tarefa 8 regrediu.
"""
import pytest

from app.models.all_models import BudgetItem, EnvironmentDNA, Product, RuleType
from app.services.budget_calculator import Quantidade, calculate_quantity


def _item(**campos) -> BudgetItem:
    padrao = {"rule_type": RuleType.FLOOR, "manual_quantity": None, "loss_factor": 10.0}
    return BudgetItem(**{**padrao, **campos})


def _dna(piso=0.0, parede=0.0, teto=0.0) -> EnvironmentDNA:
    return EnvironmentDNA(floor_area=piso, wall_area=parede, ceiling_area=teto)


def _produto(rendimento) -> Product:
    return Product(name="Porcelanato", yield_factor=rendimento)


def test_unit_usa_a_quantidade_manual():
    r = calculate_quantity(_item(rule_type=RuleType.UNIT, manual_quantity=7), None, None)
    assert r == Quantidade(base_area=0.0, calculated_quantity=7, has_yield_alert=False)


def test_unit_sem_quantidade_manual_e_um():
    r = calculate_quantity(_item(rule_type=RuleType.UNIT), None, None)
    assert r.calculated_quantity == 1


def test_piso_aplica_perda_e_rendimento():
    # 10 m2 com 10% de perda = 11; rendimento 2 m2/unidade => 5.5 => 6.
    r = calculate_quantity(_item(), _dna(piso=10.0), _produto(2.0))
    assert r.base_area == 10.0
    assert r.calculated_quantity == 6
    assert r.has_yield_alert is False


def test_parede_e_teto_leem_a_area_certa():
    assert calculate_quantity(
        _item(rule_type=RuleType.WALL), _dna(parede=30.0), _produto(1.0)
    ).base_area == 30.0
    assert calculate_quantity(
        _item(rule_type=RuleType.CEILING), _dna(teto=12.0), _produto(1.0)
    ).base_area == 12.0


@pytest.mark.parametrize("rendimento", [None, 0.0, -3.0])
def test_rendimento_invalido_vira_alerta_e_nao_divisao_por_zero(rendimento):
    r = calculate_quantity(_item(), _dna(piso=10.0), _produto(rendimento))
    assert r.has_yield_alert is True
    assert r.calculated_quantity == 11  # cai para rendimento 1.0


def test_sem_dna_a_quantidade_e_zero():
    r = calculate_quantity(_item(), None, _produto(2.0))
    assert r == Quantidade(base_area=0.0, calculated_quantity=0, has_yield_alert=False)


def test_sem_produto_e_alerta_com_rendimento_um():
    r = calculate_quantity(_item(), _dna(piso=5.0), None)
    assert r.has_yield_alert is True
    assert r.calculated_quantity == 6  # 5 * 1.10 = 5.5 -> 6


def test_quantidade_manual_sobrescreve_o_calculo_e_apaga_o_alerta():
    r = calculate_quantity(_item(manual_quantity=3), _dna(piso=100.0), None)
    assert r.calculated_quantity == 3
    assert r.has_yield_alert is False


def test_arredonda_para_cima_mas_nao_por_ruido_de_float():
    """
    2.9999999 vindo de float nao pode virar 3 unidades a mais. O
    `round(x, 4)` antes do ceil existe por isso — a versao antiga ja tinha,
    e o comportamento e preservado.
    """
    r = calculate_quantity(_item(loss_factor=0.0), _dna(piso=9.0), _produto(3.0))
    assert r.calculated_quantity == 3


def test_perda_zero_nao_infla():
    r = calculate_quantity(_item(loss_factor=0.0), _dna(piso=10.0), _produto(1.0))
    assert r.calculated_quantity == 10
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/services/test_calculo_de_quantidade.py -q
```

Esperado: `ImportError: cannot import name 'Quantidade'`.

- [ ] **Passo 3: Escrever o teste que conta queries**

Crie `ArchSmart-api/tests/api/test_orcamento_sem_n_mais_um.py`:

```python
"""
O orcamento inteiro em duas queries — contadas, nao estimadas.

"~300 para 2" e uma afirmacao de numero, e neste repositorio numero afirmado
sem medicao e numero errado. O contador abaixo E a medicao.
"""
import pytest
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.all_models import (
    Budget,
    BudgetItem,
    Client,
    Environment,
    EnvironmentDNA,
    ItemOption,
    Product,
    Project,
    RuleType,
)


class ContadorDeQueries:
    def __init__(self, conexao):
        self.conexao = conexao
        self.sqls: list[str] = []

    def __enter__(self):
        event.listen(self.conexao, "before_cursor_execute", self._registrar)
        return self

    def __exit__(self, *_):
        event.remove(self.conexao, "before_cursor_execute", self._registrar)

    def _registrar(self, conn, cursor, sql, params, context, executemany):
        self.sqls.append(sql)

    def __len__(self):
        return len(self.sqls)


@pytest.fixture
def orcamento_com_trinta_itens(db: Session, conta_a):
    conta = conta_a[0]
    cliente = Client(account_id=conta.id, name="Cliente")
    db.add(cliente)
    db.flush()
    projeto = Project(account_id=conta.id, client_id=cliente.id, name="Projeto")
    db.add(projeto)
    db.flush()
    produto = Product(account_id=conta.id, name="Porcelanato", yield_factor=2.0, price=100.0)
    orcamento = Budget(account_id=conta.id, project_id=projeto.id)
    db.add_all([produto, orcamento])
    db.flush()
    for indice in range(30):
        ambiente = Environment(
            account_id=conta.id, project_id=projeto.id, name=f"Ambiente {indice}"
        )
        db.add(ambiente)
        db.flush()
        db.add(
            EnvironmentDNA(
                account_id=conta.id, environment_id=ambiente.id, floor_area=10.0
            )
        )
        item = BudgetItem(
            account_id=conta.id,
            budget_id=orcamento.id,
            environment_id=ambiente.id,
            rule_type=RuleType.FLOOR,
        )
        db.add(item)
        db.flush()
        db.add(
            ItemOption(
                account_id=conta.id,
                budget_item_id=item.id,
                product_id=produto.id,
                is_selected=True,
            )
        )
    db.flush()
    return orcamento


def test_montar_o_orcamento_nao_cresce_com_o_numero_de_itens(
    db: Session, orcamento_com_trinta_itens
):
    from app.services.budget_calculator import carregar_orcamento

    db.expire_all()
    with ContadorDeQueries(db.connection()) as contador:
        itens, dnas = carregar_orcamento(db.query(BudgetItem).filter(
            BudgetItem.budget_id == orcamento_com_trinta_itens.id
        ))
        for item in itens:
            from app.services.budget_calculator import calculate_quantity

            selecionada = next((o for o in item.options if o.is_selected), None)
            calculate_quantity(
                item,
                dnas.get(item.environment_id),
                selecionada.product if selecionada else None,
            )

    assert len(itens) == 30
    assert len(contador) == 2, (
        "esperava 2 queries (itens com a arvore + DNAs), saiu "
        f"{len(contador)}:\n" + "\n".join(contador.sqls)
    )
```

- [ ] **Passo 4: Reescrever `app/services/budget_calculator.py`**

```python
"""
Calculo de quantidade do item de orcamento.

Ate a Secao 4 esta funcao recebia uma `Session` e fazia ate 3 queries por
item — ~300 para um orcamento de 100 itens. Agora ela e pura: recebe o item,
o DNA do ambiente e o produto selecionado, e devolve o resultado. Quem carrega
o dado e `carregar_orcamento`, em 2 queries, uma vez.

Pureza aqui nao e estetica: e o que permite testar a regra de negocio em
memoria, sem Postgres. Ver tests/services/test_calculo_de_quantidade.py.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Query, selectinload

from app.models.all_models import (
    BudgetItem,
    EnvironmentDNA,
    ItemOption,
    Product,
    RuleType,
)

PERDA_PADRAO = 10.0


@dataclass(frozen=True)
class Quantidade:
    base_area: float
    calculated_quantity: int
    has_yield_alert: bool


def _area_da_regra(regra: RuleType, dna: EnvironmentDNA) -> float:
    if regra == RuleType.FLOOR:
        return dna.floor_area or 0.0
    if regra == RuleType.WALL:
        return dna.wall_area or 0.0
    if regra == RuleType.CEILING:
        return dna.ceiling_area or 0.0
    return 0.0


def calculate_quantity(
    item: BudgetItem,
    dna: Optional[EnvironmentDNA],
    produto: Optional[Product],
) -> Quantidade:
    """
    Pura: nao toca banco, nao usa `Session`, nao le atributo lazy.

    `produto` e a opcao SELECIONADA do item, ja resolvida por quem chamou —
    a funcao nao vai atras dela.
    """
    if item.rule_type == RuleType.UNIT:
        return Quantidade(
            base_area=0.0,
            calculated_quantity=item.manual_quantity or 1,
            has_yield_alert=False,
        )

    rendimento = produto.yield_factor if produto else None
    alerta_de_rendimento = rendimento is None or rendimento <= 0
    if alerta_de_rendimento:
        rendimento = 1.0

    if dna is None:
        # Ambiente sem DNA ainda: area 0, e nao ha alerta de rendimento a dar
        # sobre um calculo que nao aconteceu.
        return Quantidade(
            base_area=0.0, calculated_quantity=0, has_yield_alert=False
        )

    base_area = _area_da_regra(item.rule_type, dna)
    perda = item.loss_factor if item.loss_factor is not None else PERDA_PADRAO
    bruto = base_area * (1 + perda / 100.0)
    # round antes do ceil: sem ele, 8.999999999 de ruido de float vira 9 em
    # vez de 9 — e 9.000000001 viraria 10.
    final = math.ceil(round(bruto / rendimento, 4))

    if item.manual_quantity is not None:
        # Quantidade manual sobrescreve o motor; o alerta de rendimento perde
        # o sentido porque o rendimento deixou de ser usado.
        return Quantidade(
            base_area=base_area,
            calculated_quantity=item.manual_quantity,
            has_yield_alert=False,
        )

    return Quantidade(
        base_area=base_area,
        calculated_quantity=final,
        has_yield_alert=alerta_de_rendimento,
    )


def carregar_orcamento(
    itens: Query,
) -> tuple[list[BudgetItem], dict[UUID, EnvironmentDNA]]:
    """
    Duas queries, sempre — independente do numero de itens.

    1. os itens com `options` e `options.product` ja carregados (selectinload,
       nao joinedload: joinedload multiplicaria as linhas do item pelo numero
       de opcoes);
    2. os `EnvironmentDNA` dos ambientes envolvidos, em dicionario.

    `itens` e uma Query JA FILTRADA por conta por quem chamou — tipicamente
    `repo.query(BudgetItem).filter(BudgetItem.budget_id == ...)`.
    """
    carregados: list[BudgetItem] = (
        itens.options(
            selectinload(BudgetItem.options).selectinload(ItemOption.product)
        ).all()
    )
    ids_de_ambiente = {i.environment_id for i in carregados if i.environment_id}
    if not ids_de_ambiente:
        return carregados, {}

    dnas = (
        itens.session.query(EnvironmentDNA)
        .filter(EnvironmentDNA.environment_id.in_(ids_de_ambiente))
        .all()
    )
    return carregados, {d.environment_id: d for d in dnas}


def produto_selecionado(item: BudgetItem) -> Optional[Product]:
    """
    A opcao marcada `is_selected` do item, ou None.

    Le `item.options`, que `carregar_orcamento` ja trouxe — chamar isto fora
    de um item carregado por la dispara lazy load e devolve o N+1 pela porta
    dos fundos.
    """
    escolhida = next((o for o in item.options if o.is_selected), None)
    return escolhida.product if escolhida else None
```

- [ ] **Passo 5: Trocar os 5 pontos de chamada**

> ⚠️ **Nesta tarefa o carregamento usa `db.query`, não `repo.query`.** O
> `ScopedRepository` só entra em `budgets_router.py` e em `public.py` nas
> Tarefas 12 e 13; aqui esses arquivos ainda recebem `db` e `current_user`.
> Use a `Session` que o endpoint já tem, **preservando o filtro por conta que o
> arquivo já faz** — `carregar_orcamento` aceita qualquer `Query`, e a Tarefa 12
> troca esta linha por `repo.query(...)` quando converter o arquivo.

Em `app/api/routers/budgets_router.py`, o laço da linha 91 (que hoje chama a
função velha por item) passa a:

```python
    from app.services.budget_calculator import (
        calculate_quantity,
        carregar_orcamento,
        produto_selecionado,
    )

    # db.query aqui e deliberado: a Tarefa 12 converte este arquivo para
    # repo.query. O filtro por conta continua sendo o que o endpoint ja fazia.
    itens, dnas = carregar_orcamento(
        db.query(BudgetItem).filter(BudgetItem.budget_id == budget.id)
    )
    real_total = 0.0
    for item in itens:
        produto = produto_selecionado(item)
        calculo = calculate_quantity(item, dnas.get(item.environment_id), produto)
        item.calculated_quantity = calculo.calculated_quantity
        item.base_area = calculo.base_area
        item.has_yield_alert = calculo.has_yield_alert

        if produto:
            preco = produto.price or 0.0
            quantidade = (
                item.manual_quantity
                if item.rule_type == RuleType.UNIT
                else item.calculated_quantity
            )
            real_total += preco * (quantidade if quantidade is not None else 1)
```

O mesmo bloco vale para `budgets_router.py:328` e para `public.py:271`.

Nas duas chamadas de item único (`budgets_router.py:162` e `:193`), onde não há
laço, o padrão é:

```python
    itens, dnas = carregar_orcamento(
        db.query(BudgetItem).filter(BudgetItem.id == budget_item.id)
    )
    item = itens[0]
    calculo = calculate_quantity(
        item, dnas.get(item.environment_id), produto_selecionado(item)
    )
    item.calculated_quantity = calculo.calculated_quantity
    item.base_area = calculo.base_area
    item.has_yield_alert = calculo.has_yield_alert
```

> ⚠️ `public.py` é o portal público — **nunca terá `RequestContext`**. Lá a
> query não vem de `repo` em tarefa nenhuma: ela é resolvida a partir da
> apresentação, cujo acesso é autorizado pelo token de portal
> (`app/core/portal_security.py`). Use
> `db.query(BudgetItem).filter(BudgetItem.budget_id == orcamento.id)`. Isso é
> permanente, não transitório como em `budgets_router.py`, e está coberto pelos
> 10 testes de `tests/isolation/test_portal_access.py`.

- [ ] **Passo 6: Conferir que a função velha morreu**

```bash
grep -rn "calculate_budget_item_quantity" app --include=*.py
```

Esperado: **saída vazia**.

- [ ] **Passo 7: Rodar os testes**

```bash
pytest tests/services/ tests/api/test_orcamento_sem_n_mais_um.py -q
```

Esperado: **13 passed** (12 puros + 1 de contagem). Se o contador acusar mais
de 2, leia os SQLs que ele imprime — quase sempre é um `item.environment` ou
`item.budget` lido depois, disparando lazy load.

- [ ] **Passo 8: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **200 passed** (187 da Tarefa 7 + 13).

- [ ] **Passo 9: Commit**

```bash
git add ArchSmart-api/app/services/budget_calculator.py \
        ArchSmart-api/app/api/routers/budgets_router.py \
        ArchSmart-api/app/api/endpoints/public.py ArchSmart-api/tests/
git commit -m "perf: calculo de quantidade puro e orcamento em duas queries"
```

---

## Tarefa 9: Fim dos `print()` e da grafia "Arch Smart"

Segunda metade da caixa "Tratamento de erro único", mais uma violação do Art. 8
encontrada durante a medição de 05/09/2026.

**Os `print()`, medidos:** 54 em `app/`, fora de `app/tests/`. Alguns imprimem
token parcial (`app/api/users.py` — já removidos na Tarefa 2) e outros só
poluem o log do Render sem timestamp nem nome de módulo.

**A grafia, medida:** 7 ocorrências de `"Arch Smart"` em `app/`, e **quatro
delas chegam ao usuário**:

```
app/main.py:9                    title da API
app/main.py:61                   corpo do GET /
app/core/mail.py:22              assunto do e-mail de confirmacao      <- usuario
app/core/mail.py:27              assunto do e-mail de recuperacao      <- usuario
app/core/mail.py:41              assinatura do corpo do e-mail         <- usuario
app/api/endpoints/public.py:77   nome de escritorio padrao no portal   <- usuario
app/api/endpoints/public.py:210  idem
```

`main.py:9` e `:61` já saem na Tarefa 5. Sobram 5.

**Arquivos:**
- Modificar: os 14 arquivos de `app/` que têm `print()`
- Modificar: `ArchSmart-api/app/core/mail.py`,
  `ArchSmart-api/app/api/endpoints/public.py`
- Modificar: `ArchSmart-api/tests/test_arquitetura.py` (dois lints novos)

**Interfaces:**
- Consome: `app.core.logging`, já configurado — `logging.getLogger(__name__)`
  herda handler e formato.
- Produz: dois lints que impedem a volta.

- [ ] **Passo 1: Escrever os lints que falham**

Acrescente a `ArchSmart-api/tests/test_arquitetura.py`:

```python
def test_nenhum_print_em_app():
    """
    54 print() em app/ (fora de app/tests/) em 05/09/2026. Eles saem sem
    timestamp e sem nome de modulo, o que tornou o log do Render inutil para
    diagnostico — e alguns imprimiam trecho de token.
    """
    achados = [
        a
        for a in _ocorrencias(APP, "print(")
        # app/tests/ tem 4 print() e morre inteiro na Tarefa 17. Esta exclusao
        # e TEMPORARIA: a Tarefa 17, Passo 4, apaga esta linha junto com o
        # diretorio. Se ela ainda estiver aqui depois da Tarefa 17, o lint
        # esta cego para um diretorio que nao existe.
        if not a.replace("\\", "/").startswith("app/tests/")
        and "# noqa: T201" not in a
    ]
    assert not achados, (
        "use logging.getLogger(__name__) em vez de print():\n"
        + "\n".join(achados)
    )


def test_a_marca_e_arq_smart():
    """
    Art. 8: a marca e "Arq Smart" — duas palavras, com Q. "Arch Smart" e a
    grafia do nome do diretorio, e chegou a sair em assunto de e-mail.
    """
    achados = []
    for grafia in ("Arch Smart", "ArchSmart", "Ark Smart", "Ecowe"):
        achados += _ocorrencias(APP, grafia)
    assert not achados, "grafia errada da marca:\n" + "\n".join(achados)
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/test_arquitetura.py -q
```

Esperado: duas falhas, listando os arquivos e as linhas.

- [ ] **Passo 3: Trocar os `print()` por `logger`**

Em cada um dos arquivos, no topo:

```python
import logging

logger = logging.getLogger(__name__)
```

E a regra de nível, que não é mecânica:

| O `print()` dizia | Vira |
|---|---|
| `[ERROR] ...`, dentro de `except` | `logger.error("...", exc_info=erro)` |
| `[WARN] ...`, caminho degradado que seguiu | `logger.warning("...")` |
| `[OK] ...`, `[DEBUG] ...`, rastro de fluxo normal | `logger.debug("...")` |
| `⚠️ ...` em falha não fatal | `logger.warning("...")` |

Use `%s` e argumentos, nunca f-string: `logger.info("Conta %s", id)`. Com
f-string a formatação acontece mesmo quando o nível está desligado, e o
`logging` perde a capacidade de agrupar mensagens iguais.

> ⚠️ **Nenhum log pode conter token, senha ou trecho deles.** Os `print()` de
> `app/api/users.py` imprimiam `token[:20]` e `authorization[:50]` — saíram na
> Tarefa 2 e não devem voltar como `logger.debug`.

- [ ] **Passo 4: Corrigir a grafia da marca**

`app/core/mail.py` — três strings que vão para a caixa de entrada do usuário:

```python
    subject = "Arq Smart - Confirmação de E-mail"
    subject = "Arq Smart - Recuperação de Senha"
        <p>Atenciosamente,<br>Equipe Arq Smart</p>
```

`app/api/endpoints/public.py:77` e `:210` — o nome de escritório padrão que o
cliente final vê no portal quando a conta não configurou o dela:

```python
    office_name: Optional[str] = "Arq Smart"
        office_name=office_name or "Arq Smart",
```

- [ ] **Passo 5: Rodar os lints**

```bash
pytest tests/test_arquitetura.py -q
```

Esperado: **3 passed** (escotilha + print + marca).

- [ ] **Passo 6: Conferir na mão também**

```bash
grep -rn "print(" app --include=*.py | grep -v "^app/tests/" | wc -l
grep -rn "Arch Smart\|ArchSmart" app --include=*.py | wc -l
```

Esperado: `0` e `0`.

- [ ] **Passo 7: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **202 passed** (200 da Tarefa 8 + 2).

- [ ] **Passo 8: Commit**

```bash
git add ArchSmart-api/app/ ArchSmart-api/tests/test_arquitetura.py
git commit -m "refactor: troca os 54 print() por logging e corrige a grafia da marca"
```

---

## Tarefa 10: `GET /api/users/me` com `entitlements`

Fecha a caixa "`GET /api/v1/me` com `user`, `account` e `entitlements`" — na
rota que o app tem, não na que a spec imaginou. Ver a decisão 1 de 05/09/2026 no
topo deste plano.

**Arquivos:**
- Modificar: `ArchSmart-api/app/schemas/user.py` (`UserProfileResponse`)
- Modificar: `ArchSmart-api/app/api/users.py` (os dois endpoints que montam a
  resposta: `GET /me` e `PUT /profile`)
- Criar: `docs/dev/decisoes/0008-me-em-api-users-me.md`
- Testar: `ArchSmart-api/tests/api/test_me.py` (novo)

**Interfaces:**
- Consome: `app.services.entitlements.entitlements_da_conta` (Tarefa 2),
  `app.core.security.get_context` (Tarefa 2).
- Produz: o contrato que a Seção 5 vai consumir —
  `{"id", "full_name", "email", "avatar_url", "role", "account", "entitlements"}`.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `ArchSmart-api/tests/api/test_me.py`:

```python
"""
GET /api/users/me devolve usuario, conta e entitlements.

Art. 3: limite de plano e decisao do servidor. Enquanto o front tiver
`data?.plan_limit ?? 2` (dashboard/page.tsx e projects/page.tsx), a violacao
continua registrada — mas a fonte de verdade passa a existir aqui, e a Secao 5
tem o que consumir.
"""
import uuid

from sqlalchemy.orm import Session

from app.models.all_models import Plan, Subscription
from app.services.entitlements import PADRAO


def test_me_devolve_usuario_conta_e_entitlements(client_a, conta_a):
    r = client_a.get("/api/users/me")

    assert r.status_code == 200
    corpo = r.json()
    assert corpo["id"] == str(conta_a[1].id)
    assert corpo["email"] == conta_a[1].email
    assert corpo["account"]["id"] == str(conta_a[0].id)
    assert "entitlements" in corpo


def test_conta_sem_assinatura_recebe_os_defaults(client_a):
    corpo = client_a.get("/api/users/me").json()

    assert corpo["entitlements"] == PADRAO


def test_limites_do_plano_sobrescrevem_os_defaults(db: Session, client_a, conta_a):
    plano = Plan(name="Estudio", limits={"project_limit": 25})
    db.add(plano)
    db.flush()
    db.add(
        Subscription(account_id=conta_a[0].id, plan_id=plano.id)
    )
    db.flush()

    corpo = client_a.get("/api/users/me").json()

    assert corpo["entitlements"]["project_limit"] == 25
    # As chaves que o plano nao menciona continuam vindo do padrao.
    assert corpo["entitlements"]["can_use_ai"] == PADRAO["can_use_ai"]


def test_plano_com_limits_invalido_nao_derruba_a_rota(db: Session, client_a, conta_a):
    """
    Plan.limits e JSON livre. Ja houve linha com lista ali. Uma resposta 500
    em /me derruba o app inteiro, porque toda tela chama esta rota.
    """
    plano = Plan(name="Quebrado", limits=["isto nao e um objeto"])
    db.add(plano)
    db.flush()
    db.add(Subscription(account_id=conta_a[0].id, plan_id=plano.id))
    db.flush()

    r = client_a.get("/api/users/me")

    assert r.status_code == 200
    assert r.json()["entitlements"] == PADRAO


def test_me_de_outra_conta_e_impossivel(client_a, conta_a, conta_b):
    """
    Nao ha parametro que escolha a conta. Tentar por query string nao muda
    nada — o escopo vem do token (Art. 1).
    """
    corpo = client_a.get(
        "/api/users/me", params={"account_id": str(conta_b[0].id)}
    ).json()

    assert corpo["account"]["id"] == str(conta_a[0].id)
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/api/test_me.py -q
```

Esperado: `KeyError: 'entitlements'` nos três primeiros.

- [ ] **Passo 3: Acrescentar o campo ao schema**

Em `ArchSmart-api/app/schemas/user.py`:

```python
from typing import Any, Dict, Optional


class UserProfileResponse(BaseModel):
    """Resposta de GET /api/users/me."""
    id: UUID
    full_name: str
    email: str
    avatar_url: Optional[str] = None
    role: str
    account: AccountInfo
    # Art. 3: o limite de plano vem daqui, nunca de um numero fixo no front.
    # Dicionario livre de proposito: um entitlement novo nao deve exigir
    # deploy coordenado de API e front.
    entitlements: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Passo 4: Preencher nos dois endpoints**

Em `ArchSmart-api/app/api/users.py`, os dois `return UserProfileResponse(...)`
(o de `GET /me` e o de `PUT /profile`) ganham a linha:

```python
        entitlements=entitlements_da_conta(db, current_user.account_id),
```

E o import no topo:

```python
from app.services.entitlements import entitlements_da_conta
```

> ⚠️ **Os dois endpoints, não só o `GET`.** `PUT /profile` devolve o mesmo
> `UserProfileResponse`, e o front usa a resposta dele para atualizar o estado
> local (`profile/page.tsx:132`). Preencher só um faz os entitlements sumirem
> depois que o usuário salva o perfil.

- [ ] **Passo 5: Rodar os testes**

```bash
pytest tests/api/test_me.py -q
```

Esperado: **5 passed**.

- [ ] **Passo 6: Escrever a ADR 0008**

Crie `docs/dev/decisoes/0008-me-em-api-users-me.md`:

```markdown
# 0008 — O `/me` fica em `/api/users/me`, sem `/api/v1`

- **Status:** aceita
- **Data:** 05/09/2026
- **Contexto da decisao:** Secao 4, Tarefa 10

## Contexto

A spec da reestruturacao (23/08/2026) pede
`GET /api/v1/me` com `user`, `account` e `entitlements`.

Medido em 05/09/2026: **nao existe prefixo `/api/v1` na aplicacao.** As 62
rotas de aplicacao estao em `/api` e 7 em `/public`
(`grep -n "include_router" ArchSmart-api/app/main.py`). O perfil ja e servido
por `GET /api/users/me`, chamado pelo front em tres lugares:
`src/app/(dashboard)/billing/page.tsx:71`,
`src/app/(dashboard)/profile/page.tsx:75` e
`src/hooks/use-user-profile.ts:43`.

## Decisao

**`entitlements` entra no contrato de `GET /api/users/me`.** Nao se cria
`/api/v1`.

## Por que

Um `/api/v1/me` isolado, com as outras 62 rotas em `/api`, seria versionamento
que so uma rota segue — a pior das tres opcoes, porque paga o custo de manter
dois contratos vivos sem entregar a coerencia que justificaria o versionamento.

Versionar as 62 de uma vez quebraria todo `fetch` do front fora de uma tarefa
dedicada a isso, o que e trabalho da Secao 5 ou 8, nao desta caixa.

## Consequencias

- A Secao 5 consome `GET /api/users/me`, e nao `/api/v1/me`. O
  `lib/api/client.ts` que ela cria aponta para la.
- `PUT /api/users/profile` devolve o mesmo `UserProfileResponse` e tambem
  carrega `entitlements` — o front usa a resposta dele para atualizar estado.
- Se um dia houver necessidade real de versionar, a decisao a tomar e sobre as
  62 rotas, de uma vez, com o front migrando junto. Esta ADR nao fecha essa
  porta; ela recusa abrir a porta para uma rota so.
- A spec continua dizendo `/api/v1/me`. Ela e o registro do que se pensou em
  23/08; este arquivo e o registro do que foi feito.
```

- [ ] **Passo 7: Conferir os links da ADR**

O `checa_links.py` roda **da raiz do repositório** — é assim que o CI o executa,
e rodar de outro diretório dá resultado diferente:

```bash
cd ../..
python tools/checa_links.py
```

Esperado: código de saída `0`.

- [ ] **Passo 8: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **207 passed** (202 da Tarefa 9 + 5).

- [ ] **Passo 9: Commit**

```bash
git add ArchSmart-api/app/schemas/user.py ArchSmart-api/app/api/users.py \
        ArchSmart-api/tests/api/test_me.py docs/dev/decisoes/0008-me-em-api-users-me.md
git commit -m "feat(api): entitlements no /api/users/me, com ADR do desvio da spec"
```

---
## Tarefas 11 a 15 — a conversão dos 117 `db.query()`

As cinco tarefas seguintes têm a mesma forma e são separadas por área para que
um revisor possa aprovar a conversão do orçamento e recusar a das apresentações
sem que uma dependa da outra.

### A catraca que atravessa as cinco

Cada tarefa acrescenta o arquivo que converteu a uma lista em
`tests/test_arquitetura.py`, e o lint reprova se um `db.query()` voltar a
aparecer ali. O número **desce** e não sobe — mesma ideia do
`tools/catraca.py`, aplicada dentro da suíte.

Na Tarefa 11, acrescente isto a `ArchSmart-api/tests/test_arquitetura.py`:

```python
# Arquivos ja convertidos para ScopedRepository. A lista SO CRESCE. Um
# db.query() que volte a um arquivo daqui e uma regressao: o filtro por conta
# volta a ser decisao de quem escreveu o endpoint, que e exatamente a classe de
# falha que custou a Secao 1 inteira.
JA_CONVERTIDOS: list[str] = [
    # Tarefa 11
    "app/api/endpoints/projects.py",
    "app/api/routers/environments_router.py",
]


def test_arquivo_convertido_nao_volta_a_usar_db_query():
    achados = []
    for caminho in JA_CONVERTIDOS:
        arquivo = RAIZ / caminho
        assert arquivo.exists(), f"{caminho} nao existe mais; atualize a lista"
        for numero, linha in enumerate(
            arquivo.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if "db.query(" in linha:
                achados.append(f"{caminho}:{numero}: {linha.strip()}")
    assert not achados, (
        "use repo.query(model) em vez de db.query(model):\n" + "\n".join(achados)
    )
```

Nas Tarefas 12 a 15, só acrescente os caminhos novos à lista.

### A receita da conversão, passo a passo

Vale para todos os endpoints autenticados. O portal público (`public.py`) tem
uma variação, descrita na Tarefa 13.

**1. Trocar a dependência.** Sai `current_user`, entra `repo`:

```python
# antes
from app.api.users import get_current_user

@router.get("/projects")
def listar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

# depois
from app.db.repository import ScopedRepository, get_repo

@router.get("/projects")
def listar(repo: ScopedRepository = Depends(get_repo)):
```

Se o endpoint ainda precisar da `Session` crua (para `commit`, `flush` ou
`execute`), ela vem do repositório: `repo.db`. Não declare `get_db` de novo —
duas sessões diferentes no mesmo endpoint é um bug difícil de ver.

**2. Trocar a query.** O filtro manual por conta **some**, não é reescrito:

```python
# antes
projeto = (
    db.query(Project)
    .filter(Project.id == project_id, Project.account_id == current_user.account_id)
    .first()
)
if not projeto:
    raise HTTPException(status_code=404, detail="Project not found")

# depois
projeto = repo.obter(Project, project_id)
```

**3. Trocar a criação.** `account_id` e `created_by` deixam de ser escritos à
mão:

```python
# antes
projeto = Project(account_id=current_user.account_id, client_id=..., name=...)
db.add(projeto)

# depois
projeto = repo.create(Project, client_id=..., name=...)
```

**4. Trocar quem usa `current_user.id`.** Vira `repo.ctx.user_id`; quem usa
`current_user.account_id` vira `repo.ctx.account_id` — e, na maioria dos casos,
some junto com o filtro manual.

**5. Trocar o erro.** `HTTPException(404, "Project not found")` vira `NotFound`
do domínio, que o handler da Tarefa 5 traduz. Mensagem em pt-BR.

### O que NÃO fazer nestas cinco tarefas

- **Não mude o contrato da rota.** Nome de campo, código de status de sucesso,
  formato do corpo: tudo igual. A Seção 5 depende do contrato de hoje, e
  misturar refatoração com mudança de contrato torna impossível saber o que
  causou uma regressão.
- **Não migre o que não é da área.** Um `import` compartilhado que dá vontade
  de arrumar fica para a tarefa dele.
- **Não use `unscoped_query` para "fazer passar".** Se um endpoint parece
  precisar dela, ou o model é catálogo global (e aí a query é legítima e direta
  com `db.query`, com comentário dizendo por quê), ou o endpoint está errado.

---

## Tarefa 11: Conversão — projetos e ambientes

**15 `db.query()`:** `app/api/endpoints/projects.py` (9),
`app/api/routers/environments_router.py` (6).

**Arquivos:**
- Modificar: `ArchSmart-api/app/api/endpoints/projects.py`
- Modificar: `ArchSmart-api/app/api/routers/environments_router.py`
- Modificar: `ArchSmart-api/tests/test_arquitetura.py` (criar `JA_CONVERTIDOS`)
- Testar: `ArchSmart-api/tests/api/test_projetos.py` (novo)
- Testar: `ArchSmart-api/tests/api/test_ambientes.py` (novo)

**Interfaces:**
- Consome: `ScopedRepository`, `get_repo`, `NotFound` (Tarefas 5 e 6).
- Produz: `projects.py` e `environments_router.py` sem nenhum `db.query()`.

- [ ] **Passo 1: Escrever os testes de comportamento e isolamento**

Crie `ArchSmart-api/tests/api/test_projetos.py`:

```python
"""
Projetos: o contrato da rota e o isolamento entre contas.

Os testes de isolamento sao pares: a conta A ve o dela, e recebe 404 no da B.
404 e nao 403 — um 403 confirmaria que o projeto existe.
"""
from sqlalchemy.orm import Session

from tests.conftest import criar_projeto


def test_lista_so_os_projetos_da_conta(db: Session, client_a, conta_a, conta_b):
    criar_projeto(db, conta_a[0], "Meu")
    criar_projeto(db, conta_b[0], "Alheio")

    corpo = client_a.get("/api/projects").json()

    assert [p["name"] for p in corpo] == ["Meu"]


def test_detalhe_de_projeto_alheio_e_404(db: Session, client_a, conta_b):
    alheio = criar_projeto(db, conta_b[0], "Alheio")

    assert client_a.get(f"/api/projects/{alheio.id}").status_code == 404


def test_criar_projeto_grava_a_conta_do_token(db: Session, client_a, conta_a):
    cliente = criar_projeto(db, conta_a[0], "Base").client_id

    r = client_a.post(
        "/api/projects", json={"name": "Novo", "client_id": str(cliente)}
    )

    assert r.status_code in (200, 201)
    from app.models.all_models import Project

    criado = db.query(Project).filter(Project.name == "Novo").first()
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id


def test_criar_projeto_ignora_account_id_do_corpo(db: Session, client_a, conta_a, conta_b):
    cliente = criar_projeto(db, conta_a[0], "Base").client_id

    client_a.post(
        "/api/projects",
        json={
            "name": "Tentativa",
            "client_id": str(cliente),
            "account_id": str(conta_b[0].id),
        },
    )

    from app.models.all_models import Project

    criado = db.query(Project).filter(Project.name == "Tentativa").first()
    assert criado is None or criado.account_id == conta_a[0].id


def test_apagar_projeto_alheio_e_404(db: Session, client_a, conta_b):
    alheio = criar_projeto(db, conta_b[0], "Alheio")

    assert client_a.delete(f"/api/projects/{alheio.id}").status_code == 404

    from app.models.all_models import Project

    assert db.query(Project).filter(Project.id == alheio.id).first() is not None
```

E `ArchSmart-api/tests/api/test_ambientes.py`:

```python
"""
Ambientes: contrato e isolamento.

`environments` ganhou account_id proprio na Tarefa 4. Antes dela, o isolamento
dependia de descer por project_id ate projects — e era o tipo de caminho que
um endpoint novo esquecia.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Environment
from tests.conftest import criar_projeto


def _ambiente(db: Session, conta, nome: str) -> Environment:
    projeto = criar_projeto(db, conta, f"Projeto de {nome}")
    ambiente = Environment(account_id=conta.id, project_id=projeto.id, name=nome)
    db.add(ambiente)
    db.flush()
    return ambiente


def test_ambiente_de_projeto_alheio_e_404(db: Session, client_a, conta_b):
    alheio = _ambiente(db, conta_b[0], "Sala alheia")

    assert client_a.get(f"/api/environments/{alheio.id}").status_code == 404


def test_lista_de_ambientes_de_projeto_alheio_e_404(db: Session, client_a, conta_b):
    projeto = criar_projeto(db, conta_b[0], "Alheio")

    r = client_a.get(f"/api/projects/{projeto.id}/environments")

    assert r.status_code == 404


def test_criar_ambiente_grava_conta_e_autor(db: Session, client_a, conta_a):
    projeto = criar_projeto(db, conta_a[0], "Meu")

    r = client_a.post(
        f"/api/projects/{projeto.id}/environments", json={"name": "Cozinha"}
    )

    assert r.status_code in (200, 201)
    criado = db.query(Environment).filter(Environment.name == "Cozinha").first()
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id


def test_criar_ambiente_em_projeto_alheio_e_404(db: Session, client_a, conta_b):
    projeto = criar_projeto(db, conta_b[0], "Alheio")

    r = client_a.post(
        f"/api/projects/{projeto.id}/environments", json={"name": "Invasao"}
    )

    assert r.status_code == 404
    assert db.query(Environment).filter(Environment.name == "Invasao").first() is None
```

> ⚠️ **Confira os paths antes de rodar.** Os caminhos acima seguem o que os
> routers registram hoje; se algum não bater, o teste dá 404 por motivo errado
> e passa sem provar nada. Liste os reais com:
> ```bash
> ./venv/Scripts/python.exe -c "
> import os
> for k,v in {'DATABASE_URL':'postgresql://a:a@localhost:55432/arqsmart_test','SUPABASE_URL':'https://x.invalido.supabase.co','SUPABASE_KEY':'x','SUPABASE_SERVICE_ROLE_KEY':'x','GEMINI_API_KEY':'x'}.items(): os.environ.setdefault(k,v)
> from app.main import app
> for r in app.routes:
>     if hasattr(r,'methods') and ('project' in r.path or 'environment' in r.path):
>         print(sorted(r.methods), r.path)
> "
> ```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/api/test_projetos.py tests/api/test_ambientes.py -q
```

Esperado: as asserções de `created_by` falham (`None`), porque nada preenche a
coluna ainda. As de isolamento podem já passar — os endpoints de projeto foram
corrigidos na Seção 1. **Um teste de isolamento que já passa continua valendo:**
ele vira a rede que impede a conversão de quebrar o que a Seção 1 consertou.

- [ ] **Passo 3: Converter `app/api/endpoints/projects.py`**

Aplique a receita das cinco etapas (acima) nas 9 ocorrências.

- [ ] **Passo 4: Converter `app/api/routers/environments_router.py`**

Aplique a receita nas 6 ocorrências.

- [ ] **Passo 5: Criar a lista `JA_CONVERTIDOS` no lint**

Acrescente a `tests/test_arquitetura.py` o bloco `JA_CONVERTIDOS` e o
`test_arquivo_convertido_nao_volta_a_usar_db_query` mostrados na abertura das
Tarefas 11–15, com os dois caminhos desta tarefa.

- [ ] **Passo 6: Medir**

```bash
grep -c "db.query(" app/api/endpoints/projects.py app/api/routers/environments_router.py
grep -rn "db\.query(" app --include=*.py | grep -v "^app/tests/" | wc -l
```

Esperado: `0` nos dois arquivos, e **99** no total (117 − 15 desta tarefa − 3 de
`budget_calculator.py`, que saíram na Tarefa 8).

- [ ] **Passo 7: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **217 passed** (207 da Tarefa 10 + 9 novos + 1 do lint).

- [ ] **Passo 8: Commit**

```bash
git add ArchSmart-api/app/api/endpoints/projects.py \
        ArchSmart-api/app/api/routers/environments_router.py \
        ArchSmart-api/tests/
git commit -m "refactor(api): projetos e ambientes pelo ScopedRepository"
```

---

## Tarefa 12: Conversão — orçamento

**14 `db.query()`:** `app/api/routers/budgets_router.py`.

Este arquivo tem uma função que a conversão **apaga**: `buscar_item_da_conta`
(`budgets_router.py:19`), que desce `BudgetItem → Budget → Project → account_id`
à mão. Depois da Tarefa 4, `budget_items` tem `account_id` próprio, e
`repo.obter(BudgetItem, item_id)` faz o mesmo em um `WHERE`.

**Arquivos:**
- Modificar: `ArchSmart-api/app/api/routers/budgets_router.py`
- Modificar: `ArchSmart-api/tests/test_arquitetura.py` (`JA_CONVERTIDOS`)
- Testar: `ArchSmart-api/tests/api/test_orcamento.py` (novo)

**Interfaces:**
- Consome: `ScopedRepository`, `get_repo`, `NotFound`, e as funções da Tarefa 8
  (`carregar_orcamento`, `calculate_quantity`, `produto_selecionado`).
- Produz: `budgets_router.py` sem `db.query()` e sem `buscar_item_da_conta`.

- [ ] **Passo 1: Escrever os testes**

Crie `ArchSmart-api/tests/api/test_orcamento.py`:

```python
"""
Orcamento: contrato e isolamento.

Os 10 testes de tests/isolation/test_budgets_isolation.py, vindos da Secao 1,
continuam valendo e nao sao repetidos aqui. Estes cobrem o que a conversao
muda: created_by, e o caminho de item que antes passava por
`buscar_item_da_conta`.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Budget, BudgetItem, Environment, RuleType
from tests.conftest import criar_projeto


def _orcamento_com_item(db: Session, conta):
    projeto = criar_projeto(db, conta, "Projeto")
    ambiente = Environment(account_id=conta.id, project_id=projeto.id, name="Sala")
    orcamento = Budget(account_id=conta.id, project_id=projeto.id)
    db.add_all([ambiente, orcamento])
    db.flush()
    item = BudgetItem(
        account_id=conta.id,
        budget_id=orcamento.id,
        environment_id=ambiente.id,
        rule_type=RuleType.FLOOR,
    )
    db.add(item)
    db.flush()
    return orcamento, item


def test_item_de_orcamento_alheio_e_404(db: Session, client_a, conta_b):
    _, item = _orcamento_com_item(db, conta_b[0])

    r = client_a.patch(
        f"/api/budgets/items/{item.id}", json={"manual_quantity": 99}
    )

    assert r.status_code == 404
    db.refresh(item)
    assert item.manual_quantity is None


def test_orcamento_alheio_e_404(db: Session, client_a, conta_b):
    orcamento, _ = _orcamento_com_item(db, conta_b[0])

    assert client_a.get(f"/api/budgets/{orcamento.id}").status_code == 404


def test_criar_item_grava_conta_e_autor(db: Session, client_a, conta_a):
    orcamento, _ = _orcamento_com_item(db, conta_a[0])
    ambiente = db.query(Environment).filter(
        Environment.account_id == conta_a[0].id
    ).first()

    r = client_a.post(
        f"/api/budgets/{orcamento.id}/items",
        json={"environment_id": str(ambiente.id), "rule_type": "FLOOR"},
    )

    assert r.status_code in (200, 201)
    criado = (
        db.query(BudgetItem)
        .filter(BudgetItem.budget_id == orcamento.id)
        .order_by(BudgetItem.id.desc())
        .first()
    )
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id


def test_o_total_do_orcamento_continua_o_mesmo_contrato(db: Session, client_a, conta_a):
    """
    A Tarefa 8 trocou o motor de calculo. O corpo da resposta nao muda: a
    Secao 5 depende deste formato.
    """
    orcamento, _ = _orcamento_com_item(db, conta_a[0])

    corpo = client_a.get(f"/api/budgets/{orcamento.id}").json()

    assert "total_value" in corpo
    assert "items" in corpo
    for item in corpo["items"]:
        assert "calculated_quantity" in item
        assert "base_area" in item
        assert "has_yield_alert" in item
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/api/test_orcamento.py -q
```

Esperado: `test_criar_item_grava_conta_e_autor` falha em `created_by is None`.

- [ ] **Passo 3: Converter as 14 ocorrências**

Aplique a receita das cinco etapas. Além dela, nesta tarefa:

**Apague `buscar_item_da_conta` (linhas 19–35).** Toda chamada vira
`repo.obter(BudgetItem, item_id)`. A docstring dela — *"Levanta 404 (nao 403)
para nao revelar a existencia do recurso"* — descreve exatamente o que
`ScopedRepository.obter` faz; a razão não se perde, muda de lugar.

- [ ] **Passo 4: Conferir que a função velha sumiu**

```bash
grep -rn "buscar_item_da_conta" app --include=*.py
```

Esperado: **saída vazia**.

- [ ] **Passo 5: Acrescentar ao lint**

Em `tests/test_arquitetura.py`, `JA_CONVERTIDOS` ganha:

```python
    # Tarefa 12
    "app/api/routers/budgets_router.py",
```

- [ ] **Passo 6: Medir**

```bash
grep -c "db.query(" app/api/routers/budgets_router.py
grep -rn "db\.query(" app --include=*.py | grep -v "^app/tests/" | wc -l
```

Esperado: `0` e **85**.

- [ ] **Passo 7: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **221 passed**. Os 10 de `tests/isolation/test_budgets_isolation.py`
precisam continuar verdes — eles são a prova de que a conversão não desfez a
Seção 1.

- [ ] **Passo 8: Commit**

```bash
git add ArchSmart-api/app/api/routers/budgets_router.py ArchSmart-api/tests/
git commit -m "refactor(api): orcamento pelo ScopedRepository, sem busca manual por conta"
```

---

## Tarefa 13: Conversão — apresentações e portal público

**32 `db.query()`:** `app/api/endpoints/presentations.py` (21),
`app/api/endpoints/public.py` (11). A maior das cinco, e a única com duas
regras de acesso diferentes no mesmo par de arquivos.

**A distinção que precisa ficar clara antes de tocar em `public.py`.**

| Arquivo | Quem chama | Como o acesso é autorizado |
|---|---|---|
| `presentations.py` | o arquiteto, logado | `RequestContext` → `ScopedRepository` |
| `public.py` | o cliente final, **sem conta** | token de portal (`app/core/portal_security.py`), emitido depois da senha da apresentação |

`public.py` **não recebe `repo`** — não há conta na sessão para filtrar. O
escopo dele é "esta apresentação, e o que pende dela", autorizado pelo
`verify_portal_token`. As queries continuam sendo `db.query(...)` ancoradas na
apresentação já autorizada, e por isso `public.py` **não entra** em
`JA_CONVERTIDOS`.

O que muda em `public.py` nesta tarefa: os `detail=str(e)` (já saíram na Tarefa
5), os `print()` (Tarefa 9), a grafia da marca (Tarefa 9) e o N+1 (Tarefa 8).
As 11 queries ficam — com um comentário no topo do arquivo explicando por quê,
para que a próxima pessoa não as "conserte".

**Arquivos:**
- Modificar: `ArchSmart-api/app/api/endpoints/presentations.py`
- Modificar: `ArchSmart-api/app/api/endpoints/public.py` (só o comentário)
- Modificar: `ArchSmart-api/tests/test_arquitetura.py`
- Testar: `ArchSmart-api/tests/api/test_apresentacoes.py` (novo)

**Interfaces:**
- Consome: `ScopedRepository`, `get_repo`, `NotFound`,
  `app.core.portal_security.verify_portal_token`.
- Produz: `presentations.py` sem `db.query()`.

- [ ] **Passo 1: Escrever os testes**

Crie `ArchSmart-api/tests/api/test_apresentacoes.py`:

```python
"""
Apresentacoes: contrato e isolamento no lado do arquiteto.

O lado do cliente final — o portal publico — ja tem 10 testes em
tests/isolation/test_portal_access.py, da Secao 1. Eles nao sao repetidos
aqui; o que esta tarefa nao pode fazer e quebra-los.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Presentation
from tests.conftest import criar_projeto


def _apresentacao(db: Session, conta, nome: str) -> Presentation:
    projeto = criar_projeto(db, conta, f"Projeto de {nome}")
    apresentacao = Presentation(
        account_id=conta.id, project_id=projeto.id, name=nome
    )
    db.add(apresentacao)
    db.flush()
    return apresentacao


def test_lista_so_as_apresentacoes_da_conta(db: Session, client_a, conta_a, conta_b):
    _apresentacao(db, conta_a[0], "Minha")
    _apresentacao(db, conta_b[0], "Alheia")

    corpo = client_a.get("/api/presentations").json()

    assert [p["name"] for p in corpo] == ["Minha"]


def test_apresentacao_alheia_e_404(db: Session, client_a, conta_b):
    alheia = _apresentacao(db, conta_b[0], "Alheia")

    assert client_a.get(f"/api/presentations/{alheia.id}").status_code == 404


def test_apagar_apresentacao_alheia_e_404(db: Session, client_a, conta_b):
    alheia = _apresentacao(db, conta_b[0], "Alheia")

    assert client_a.delete(f"/api/presentations/{alheia.id}").status_code == 404
    assert (
        db.query(Presentation).filter(Presentation.id == alheia.id).first()
        is not None
    )


def test_criar_apresentacao_grava_conta_e_autor(db: Session, client_a, conta_a):
    projeto = criar_projeto(db, conta_a[0], "Meu")

    r = client_a.post(
        "/api/presentations",
        json={"project_id": str(projeto.id), "name": "Proposta"},
    )

    assert r.status_code in (200, 201)
    criada = (
        db.query(Presentation).filter(Presentation.name == "Proposta").first()
    )
    assert criada.account_id == conta_a[0].id
    assert criada.created_by == conta_a[1].id


def test_criar_apresentacao_em_projeto_alheio_e_404(db: Session, client_a, conta_b):
    projeto = criar_projeto(db, conta_b[0], "Alheio")

    r = client_a.post(
        "/api/presentations",
        json={"project_id": str(projeto.id), "name": "Invasao"},
    )

    assert r.status_code == 404
    assert (
        db.query(Presentation).filter(Presentation.name == "Invasao").first()
        is None
    )
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/api/test_apresentacoes.py -q
```

Esperado: `test_criar_apresentacao_grava_conta_e_autor` falha em `created_by`.

- [ ] **Passo 3: Converter as 21 ocorrências de `presentations.py`**

Aplique a receita. Atenção aos `joinedload` que já existem nas linhas 33, 123,
187 e 297: eles continuam, encadeados depois de `repo.query(...)`:

```python
    apresentacao = (
        repo.query(Presentation)
        .options(
            joinedload(Presentation.project),
            joinedload(Presentation.environments).joinedload(
                PresentationEnvironment.environment
            ),
        )
        .filter(Presentation.id == presentation_id)
        .first()
    )
    if apresentacao is None:
        raise NotFound()
```

> ⚠️ `joinedload(Presentation.project).joinedload(Project.account)` (linha 123)
> continua necessário: o portal usa o branding da conta. Ele **não** vira
> `repo.query(Account)` — `accounts` é a única tabela sem `account_id`, e o
> repositório recusaria com `EscopoImpossivel`. Chegar na conta pela relação do
> projeto já filtrado é o caminho certo.

- [ ] **Passo 4: Documentar por que `public.py` não converte**

No topo de `ArchSmart-api/app/api/endpoints/public.py`, acrescente:

```python
"""
Portal publico da apresentacao — o lado do CLIENTE FINAL.

Este e o unico modulo de endpoint que NAO usa ScopedRepository, e nao e
esquecimento. Quem chama aqui nao tem conta: e o cliente do arquiteto, que
entrou com a senha da apresentacao e carrega um token de portal
(app/core/portal_security.py). Nao existe `account_id` de sessao para filtrar.

O escopo aqui e "esta apresentacao, e o que pende dela", e quem o autoriza e
`verify_portal_token(token, presentation_id)`. Toda query desce a partir da
apresentacao ja autorizada — nunca de um id que veio solto do cliente.

Os 10 testes de tests/isolation/test_portal_access.py sao a prova disso, e os
4 de tests/isolation/test_public_endpoints.py cobrem o rate limit.

**Nao "conserte" isto trocando db.query por repo.query.** Nao ha repo. A
tentativa levantaria EscopoImpossivel na primeira requisicao.
"""
```

- [ ] **Passo 5: Acrescentar ao lint**

Em `tests/test_arquitetura.py`, `JA_CONVERTIDOS` ganha:

```python
    # Tarefa 13 — public.py NAO entra: portal publico, sem conta na sessao.
    "app/api/endpoints/presentations.py",
```

- [ ] **Passo 6: Medir**

```bash
grep -c "db.query(" app/api/endpoints/presentations.py
grep -rn "db\.query(" app --include=*.py | grep -v "^app/tests/" | wc -l
```

Esperado: `0` em `presentations.py`, e **64** no total (as 11 de `public.py`
permanecem, por decisão).

- [ ] **Passo 7: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **226 passed**. Os 14 testes de portal
(`test_portal_access.py` 10 + `test_public_endpoints.py` 4) precisam continuar
verdes.

- [ ] **Passo 8: Commit**

```bash
git add ArchSmart-api/app/api/endpoints/presentations.py \
        ArchSmart-api/app/api/endpoints/public.py ArchSmart-api/tests/
git commit -m "refactor(api): apresentacoes pelo ScopedRepository; registra por que o portal nao converte"
```

---

## Tarefa 14: Conversão — financeiro, eventos, dashboard e notificações

**27 `db.query()`:** `app/api/endpoints/financial.py` (11),
`app/api/endpoints/events.py` (7), `app/api/endpoints/dashboard.py` (6),
`app/api/endpoints/notifications.py` (2),
`app/services/financial_service.py` (1).

**Arquivos:**
- Modificar: os cinco acima
- Modificar: `ArchSmart-api/tests/test_arquitetura.py`
- Testar: `ArchSmart-api/tests/api/test_financeiro_e_agenda.py` (novo)

**Interfaces:**
- Consome: `ScopedRepository`, `get_repo`, `NotFound`.
- Produz: os cinco arquivos sem `db.query()`.
  `financial_service.py` passa a receber `repo` em vez de `db` na assinatura
  da função que hoje faz a query.

**O caso do `dashboard.py`.** As 6 queries dele são agregações
(`func.count`, `func.sum`). `repo.query(Model)` devolve um `Query` normal, então
`repo.query(Event).count()` e `repo.query(FinancialEntry).with_entities(func.sum(...))`
funcionam — e passam a vir filtradas por conta, o que hoje depende de cada
agregação lembrar do `WHERE`. **Confira cada número do dashboard antes e depois:**
se algum mudar, é porque a agregação estava contando dado de outra conta.

- [ ] **Passo 1: Escrever os testes**

Crie `ArchSmart-api/tests/api/test_financeiro_e_agenda.py`:

```python
"""
Financeiro, agenda, dashboard e notificacoes: contrato e isolamento.

O teste do dashboard e o mais importante da tarefa: agregacao que conta linha
de outra conta nao levanta erro nenhum — ela so devolve um numero errado.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.all_models import Event, FinancialEntry, Notification


def _lancamento(db: Session, conta, valor: float) -> FinancialEntry:
    entrada = FinancialEntry(
        account_id=conta.id, description="Lancamento", amount=valor
    )
    db.add(entrada)
    db.flush()
    return entrada


def _evento(db: Session, conta, titulo: str) -> Event:
    evento = Event(
        account_id=conta.id, title=titulo, start_time=datetime(2026, 9, 5, 10, 0)
    )
    db.add(evento)
    db.flush()
    return evento


def test_extrato_so_traz_lancamentos_da_conta(db, client_a, conta_a, conta_b):
    _lancamento(db, conta_a[0], 100.0)
    _lancamento(db, conta_b[0], 999.0)

    corpo = client_a.get("/api/financial/entries").json()

    assert all(e["amount"] != 999.0 for e in corpo)


def test_lancamento_alheio_e_404(db, client_a, conta_b):
    alheio = _lancamento(db, conta_b[0], 999.0)

    assert client_a.get(f"/api/financial/entries/{alheio.id}").status_code == 404


def test_evento_alheio_e_404(db, client_a, conta_b):
    alheio = _evento(db, conta_b[0], "Reuniao alheia")

    assert client_a.get(f"/api/events/{alheio.id}").status_code == 404


def test_notificacao_alheia_e_404(db, client_a, conta_b):
    alheia = Notification(
        account_id=conta_b[0].id, title="Alheia", message="nao e sua"
    )
    db.add(alheia)
    db.flush()

    r = client_a.patch(f"/api/notifications/{alheia.id}")

    assert r.status_code == 404


def test_dashboard_nao_conta_dado_de_outra_conta(db, client_a, conta_a, conta_b):
    """
    Agregacao que esquece o WHERE nao da erro: da numero.
    """
    _evento(db, conta_a[0], "Meu")
    for indice in range(5):
        _evento(db, conta_b[0], f"Alheio {indice}")
    _lancamento(db, conta_a[0], 100.0)
    _lancamento(db, conta_b[0], 999999.0)

    corpo = client_a.get("/api/dashboard").json()

    assert "999999" not in str(corpo), (
        "um valor da conta B apareceu no dashboard da conta A: "
        f"{corpo}"
    )


def test_criar_lancamento_grava_conta_e_autor(db, client_a, conta_a):
    r = client_a.post(
        "/api/financial/entries",
        json={"description": "Honorarios", "amount": 5000.0},
    )

    assert r.status_code in (200, 201)
    criado = (
        db.query(FinancialEntry)
        .filter(FinancialEntry.description == "Honorarios")
        .first()
    )
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id
```

> ⚠️ Os campos de `FinancialEntry`, `Event` e `Notification` usados acima
> (`description`, `amount`, `title`, `start_time`, `message`) precisam bater com
> `app/models/all_models.py`. Confira antes de rodar — um `TypeError` de
> construtor aqui é erro do teste, não do código:
> ```bash
> ./venv/Scripts/python.exe -c "
> import os
> for k,v in {'DATABASE_URL':'postgresql://a:a@localhost:55432/arqsmart_test','SUPABASE_URL':'https://x.invalido.supabase.co','SUPABASE_KEY':'x','SUPABASE_SERVICE_ROLE_KEY':'x','GEMINI_API_KEY':'x'}.items(): os.environ.setdefault(k,v)
> from app.db.base_class import Base
> import app.models.all_models
> for t in ('financial_entries','events','notifications'):
>     print(t, sorted(Base.metadata.tables[t].columns.keys()))
> "
> ```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/api/test_financeiro_e_agenda.py -q
```

Esperado: pelo menos `created_by` e, provavelmente, o do dashboard.

- [ ] **Passo 3: Converter os quatro arquivos de endpoint**

Aplique a receita das cinco etapas em `financial.py` (11), `events.py` (7),
`dashboard.py` (6) e `notifications.py` (2).

- [ ] **Passo 4: Converter `app/services/financial_service.py`**

A única query do arquivo passa a receber o repositório:

```python
# antes
def resumo_do_periodo(db: Session, account_id: UUID, inicio, fim):
    entradas = db.query(FinancialEntry).filter(
        FinancialEntry.account_id == account_id, ...
    )

# depois
def resumo_do_periodo(repo: ScopedRepository, inicio, fim):
    entradas = repo.query(FinancialEntry).filter(...)
```

O parâmetro `account_id` **some da assinatura**. Isso é deliberado: enquanto
ele existir, alguém pode passar o valor errado.

- [ ] **Passo 5: Acrescentar ao lint**

```python
    # Tarefa 14
    "app/api/endpoints/financial.py",
    "app/api/endpoints/events.py",
    "app/api/endpoints/dashboard.py",
    "app/api/endpoints/notifications.py",
    "app/services/financial_service.py",
```

- [ ] **Passo 6: Medir**

```bash
grep -rn "db\.query(" app --include=*.py | grep -v "^app/tests/" | wc -l
```

Esperado: **37** (64 − 27).

- [ ] **Passo 7: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **232 passed**. Os 3 de
`tests/isolation/test_financial_isolation.py` continuam verdes.

- [ ] **Passo 8: Commit**

```bash
git add ArchSmart-api/app/api/endpoints/ ArchSmart-api/app/services/financial_service.py \
        ArchSmart-api/tests/
git commit -m "refactor(api): financeiro, agenda, dashboard e notificacoes pelo ScopedRepository"
```

---

## Tarefa 15: Conversão — produtos, conta, autenticação e leads

**26 `db.query()`:** `app/api/routers/product_router.py` (13),
`app/api/users.py` (8), `app/api/account.py` (2), `app/api/auth.py` (2),
`app/api/leads.py` (1).

**Os três casos que não convertem, e por quê.** Esta é a tarefa com mais
exceções legítimas — leia antes de começar, para não passar a tarde tentando
fazer o repositório caber onde ele não cabe.

| Onde | Quantas | Por que fica `db.query` |
|---|---|---|
| `product_router.py` — `ProductOrigin`, `ProductState` | 2 das 13 | catálogo global, sem `account_id`. `repo.query` levantaria `EscopoImpossivel`. |
| `auth.py` — cadastro e login | 2 | acontecem **antes** de existir sessão. Não há `RequestContext` para montar repositório. |
| `users.py` — `Account`, `Subscription`, `Plan` no `/me` | 4 das 8 | `accounts` não tem `account_id`; `plans` é catálogo. `Subscription` tem e converte. |

Cada uma dessas queries ganha comentário de uma linha dizendo qual é o caso.
Sem o comentário, a próxima pessoa não distingue exceção de esquecimento — e
foi assim que a Seção 1 aconteceu.

**Arquivos:**
- Modificar: os cinco acima
- Modificar: `ArchSmart-api/tests/test_arquitetura.py`
- Modificar: `ArchSmart-api/tests/conftest.py` (some a sobreposição de
  `get_current_user`, que deixa de existir neste passo — ver Passo 5)
- Testar: `ArchSmart-api/tests/api/test_produtos_e_conta.py` (novo)

**Interfaces:**
- Consome: `ScopedRepository`, `get_repo`, `NotFound`.
- Produz: `product_router.py`, `account.py` e `leads.py` sem `db.query()` em
  tabela de dado. `users.py` e `auth.py` **não** entram em `JA_CONVERTIDOS` —
  as exceções acima vivem lá.

- [ ] **Passo 1: Escrever os testes**

Crie `ArchSmart-api/tests/api/test_produtos_e_conta.py`:

```python
"""
Biblioteca de produtos e dados da conta: contrato e isolamento.

O produto e o caso em que o vazamento seria mais caro: a biblioteca de um
escritorio e o ativo dele, com preco de custo e markup.
"""
from sqlalchemy.orm import Session

from app.models.all_models import Product


def _produto(db: Session, conta, nome: str) -> Product:
    produto = Product(
        account_id=conta.id, name=nome, price=100.0, cost_price=60.0
    )
    db.add(produto)
    db.flush()
    return produto


def test_biblioteca_so_traz_produtos_da_conta(db, client_a, conta_a, conta_b):
    _produto(db, conta_a[0], "Meu porcelanato")
    _produto(db, conta_b[0], "Porcelanato alheio")

    corpo = client_a.get("/api/products").json()
    nomes = [p["name"] for p in (corpo if isinstance(corpo, list) else corpo["items"])]

    assert nomes == ["Meu porcelanato"]


def test_produto_alheio_e_404(db, client_a, conta_b):
    alheio = _produto(db, conta_b[0], "Alheio")

    assert client_a.get(f"/api/products/{alheio.id}").status_code == 404


def test_editar_produto_alheio_e_404(db, client_a, conta_b):
    alheio = _produto(db, conta_b[0], "Alheio")

    r = client_a.put(f"/api/products/{alheio.id}", json={"name": "Sequestrado"})

    assert r.status_code == 404
    db.refresh(alheio)
    assert alheio.name == "Alheio"


def test_criar_produto_grava_conta_e_autor(db, client_a, conta_a):
    r = client_a.post("/api/products", json={"name": "Novo", "price": 10.0})

    assert r.status_code in (200, 201)
    criado = db.query(Product).filter(Product.name == "Novo").first()
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id


def test_catalogo_global_continua_visivel_para_todos(client_a, client_b):
    """
    product_origins e product_states sao catalogo global. Filtra-los por conta
    devolveria lista vazia para todo mundo — e o comentario que marca essas
    duas queries como excecao existe por isso.
    """
    a = client_a.get("/api/products/origins")
    b = client_b.get("/api/products/origins")

    assert a.status_code == 200
    assert a.json() == b.json()
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
pytest tests/api/test_produtos_e_conta.py -q
```

Esperado: falha em `created_by`.

- [ ] **Passo 3: Converter `product_router.py` (11 das 13)**

Aplique a receita. As duas de catálogo ficam, com comentário:

```python
    # Catalogo global: product_origins nao tem account_id, entao repo.query()
    # levantaria EscopoImpossivel. Excecao deliberada, nao esquecimento.
    origens = db.query(ProductOrigin).all()
```

- [ ] **Passo 4: Converter `account.py` (2) e `leads.py` (1)**

Aplique a receita.

> ⚠️ `leads` tem `account_id` **nullable** — um lead do formulário público não
> tem conta. Se a query convertida for a do **painel** (o arquiteto vendo os
> leads dele), `repo.query(Lead)` está certo. Se for a de **criação** pelo
> formulário público, ela não tem sessão e fica como está, com comentário.
> Verifique qual é antes de converter: `grep -n "db.query" app/api/leads.py`.

- [ ] **Passo 5: Converter `users.py` e matar o `get_current_user`**

Os dois endpoints (`GET /me` e `PUT /profile`) trocam
`current_user: User = Depends(get_current_user)` por
`repo: ScopedRepository = Depends(get_repo)`, e obtêm o usuário assim:

```python
    usuario = repo.obter(User, repo.ctx.user_id)
```

`users` tem `account_id`, então o repositório serve — e o `obter` garante que
o usuário é da conta do próprio token, o que a versão anterior assumia.

`Subscription` converte (`repo.query(Subscription)`). `Account` e `Plan` ficam,
com comentário:

```python
    # `accounts` e a unica tabela sem account_id — ela E a conta. Chegar nela
    # pelo ctx.account_id do contexto e o caminho certo; repo.query(Account)
    # levantaria EscopoImpossivel.
    conta = repo.db.query(Account).filter(Account.id == repo.ctx.account_id).first()
```

Com isso, `get_current_user` não tem mais nenhum chamador. **Apague a função** —
a docstring dela, escrita na Tarefa 2, já dizia que ela sumiria quando a última
rota migrasse.

> ⚠️ **Apagar a função sozinha quebra a suíte inteira.**
> `tests/conftest.py` importa `get_current_user` e o sobrepõe em `_cliente`;
> sem o símbolo, a conftest não importa e os 27 testes de isolamento da Seção 1
> caem junto com todo o resto. Remova as duas linhas **no mesmo commit**:
>
> ```python
> # sai do topo:
> from app.api.users import get_current_user  # noqa: E402
>
> # e sai de dentro de _cliente():
>         app.dependency_overrides[get_current_user] = lambda: usuario
> ```
>
> Sobra a sobreposição de `get_context`, que a Tarefa 2 acrescentou — e que
> agora é a única identidade que os testes precisam montar.

- [ ] **Passo 6: Comentar as 2 de `auth.py`**

Elas não convertem — rodam antes de haver sessão:

```python
    # Cadastro: acontece ANTES de existir sessao, entao nao ha RequestContext
    # nem repositorio. A protecao aqui e a do Supabase Auth, nao a do escopo
    # por conta.
```

- [ ] **Passo 7: Acrescentar ao lint**

```python
    # Tarefa 15 — users.py e auth.py NAO entram: as excecoes de catalogo
    # global e de pre-sessao vivem la, documentadas com comentario.
    "app/api/routers/product_router.py",
    "app/api/account.py",
    "app/api/leads.py",
```

- [ ] **Passo 8: Medir o que sobrou, e conferir que cada sobra é justificada**

```bash
grep -rn "db\.query(" app --include=*.py | grep -v "^app/tests/"
```

Esperado: **20 linhas**, e cada uma delas com comentário de exceção logo acima
— 11 em `public.py` (portal), 2 de catálogo em `product_router.py`, 4 em
`users.py`, 2 em `auth.py`, 1 em `leads.py` (se for a do formulário público).

**Leia as 20, uma a uma.** Uma sobra sem comentário é uma conversão esquecida,
não uma exceção.

- [ ] **Passo 9: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **237 passed**.

- [ ] **Passo 10: Commit**

```bash
git add ArchSmart-api/app/api/ ArchSmart-api/tests/
git commit -m "refactor(api): produtos, conta e leads pelo ScopedRepository; documenta as excecoes"
```

---
## Tarefa 16: O teste genérico de isolamento por rota registrada

A peça que a spec descreve assim: *"teste genérico que percorre todas as rotas
registradas, autentica como conta A, tenta alcançar recurso da conta B e falha
se algo diferente de 404 voltar. Rota nova sem isolamento quebra o build no dia
em que é escrita."*

Ele vem **depois** da conversão porque só fica verde com ela pronta.

**O que ele acrescenta aos 27 testes que já existem.** `tests/isolation/` cobre
uma lista escrita à mão, feita na Seção 1. Uma rota nova não entra nela sozinha.
Este percorre `app.routes` — a rota nova aparece no dia em que é registrada, e
sem entrada no registro de recursos o teste **falha**, em vez de ignorar.

**Arquivos:**
- Criar: `ArchSmart-api/tests/isolation/test_todas_as_rotas.py`
- Modificar: `ArchSmart-api/tests/conftest.py` (fábricas de recurso)

**Interfaces:**
- Consome: `app.main.app`, as fixtures `conta_a`, `conta_b`, `client_a`, `db`.
- Produz: `RECURSOS: dict[str, Callable[[Session, Account, User], Any]]` — o
  registro que toda rota com parâmetro de id precisa ter.

**Os 11 parâmetros de caminho medidos em 05/09/2026**, e o que cada um endereça:

| Parâmetro | Rotas | Model |
|---|---|---|
| `presentation_id` | 9 | `Presentation` |
| `project_id` | 8 | `Project` |
| `presentation_uuid` | 7 | `Presentation` — **portal público, exceção** |
| `option_id` | 5 | `ItemOption` |
| `product_id` | 4 | `Product` |
| `env_id` | 4 | `Environment` |
| `item_id` | 3 | `BudgetItem` |
| `entry_id` | 3 | `FinancialEntry` |
| `event_id` | 2 | `Event` |
| `budget_id` | 1 | `Budget` |
| `notification_id` | 1 | `Notification` |

**Por que `presentation_uuid` é exceção.** As 7 rotas de `/public` são o portal
do cliente final, que **não tem conta**. Não existe "conta A tentando alcançar a
apresentação da conta B" ali: existe "portador de token de portal", e isso é o
que os 10 testes de `tests/isolation/test_portal_access.py` já cobrem. Incluir
essas rotas aqui testaria a coisa errada e daria falso verde.

**Qual asserção, e por quê não é "404 sempre".** Para `GET` e `DELETE`, que não
têm corpo, a exigência é `404` — exatamente o que a spec pede. Para `POST`,
`PUT` e `PATCH`, o teste manda `{}` como corpo, e o FastAPI pode responder `422`
por validação **antes** de o endpoint rodar. Exigir `404` ali reprovaria rota
correta. A exigência nesses casos é mais fraca e ainda útil: **nunca 2xx, e
nunca 403** — um `403` confirma que o recurso existe na conta de outra pessoa.

- [ ] **Passo 1: Acrescentar as fábricas de recurso à conftest**

Em `ArchSmart-api/tests/conftest.py`, ao lado de `criar_projeto`:

```python
def criar_ambiente(db: Session, conta: Account, usuario: User) -> Environment:
    projeto = criar_projeto(db, conta, "Projeto do ambiente")
    ambiente = Environment(
        account_id=conta.id,
        created_by=usuario.id,
        project_id=projeto.id,
        name="Sala",
    )
    db.add(ambiente)
    db.flush()
    return ambiente


def criar_orcamento(db: Session, conta: Account, usuario: User) -> Budget:
    projeto = criar_projeto(db, conta, "Projeto do orcamento")
    orcamento = Budget(
        account_id=conta.id, created_by=usuario.id, project_id=projeto.id
    )
    db.add(orcamento)
    db.flush()
    return orcamento


def criar_item_de_orcamento(db: Session, conta: Account, usuario: User) -> BudgetItem:
    ambiente = criar_ambiente(db, conta, usuario)
    orcamento = Budget(
        account_id=conta.id, created_by=usuario.id, project_id=ambiente.project_id
    )
    db.add(orcamento)
    db.flush()
    item = BudgetItem(
        account_id=conta.id,
        created_by=usuario.id,
        budget_id=orcamento.id,
        environment_id=ambiente.id,
        rule_type=RuleType.FLOOR,
    )
    db.add(item)
    db.flush()
    return item


def criar_opcao(db: Session, conta: Account, usuario: User) -> ItemOption:
    item = criar_item_de_orcamento(db, conta, usuario)
    produto = criar_produto(db, conta, usuario)
    opcao = ItemOption(
        account_id=conta.id,
        created_by=usuario.id,
        budget_item_id=item.id,
        product_id=produto.id,
        is_selected=True,
    )
    db.add(opcao)
    db.flush()
    return opcao


def criar_produto(db: Session, conta: Account, usuario: User) -> Product:
    produto = Product(
        account_id=conta.id, created_by=usuario.id, name="Porcelanato", price=100.0
    )
    db.add(produto)
    db.flush()
    return produto


def criar_apresentacao(db: Session, conta: Account, usuario: User) -> Presentation:
    projeto = criar_projeto(db, conta, "Projeto da apresentacao")
    apresentacao = Presentation(
        account_id=conta.id,
        created_by=usuario.id,
        project_id=projeto.id,
        name="Proposta",
    )
    db.add(apresentacao)
    db.flush()
    return apresentacao


def criar_lancamento(db: Session, conta: Account, usuario: User) -> FinancialEntry:
    entrada = FinancialEntry(
        account_id=conta.id,
        created_by=usuario.id,
        description="Honorarios",
        amount=1000.0,
    )
    db.add(entrada)
    db.flush()
    return entrada


def criar_evento(db: Session, conta: Account, usuario: User) -> Event:
    evento = Event(
        account_id=conta.id,
        created_by=usuario.id,
        title="Visita",
        start_time=datetime(2026, 9, 5, 10, 0),
    )
    db.add(evento)
    db.flush()
    return evento


def criar_notificacao(db: Session, conta: Account, usuario: User) -> Notification:
    notificacao = Notification(
        account_id=conta.id,
        created_by=usuario.id,
        title="Aviso",
        message="Mensagem",
    )
    db.add(notificacao)
    db.flush()
    return notificacao
```

Os imports do topo de `conftest.py` crescem:

```python
from datetime import datetime  # noqa: E402

from app.models.all_models import (  # noqa: E402
    Account,
    Budget,
    BudgetItem,
    Client,
    Environment,
    Event,
    FinancialEntry,
    ItemOption,
    Notification,
    Presentation,
    Product,
    Project,
    RuleType,
    User,
)
```

> ⚠️ `criar_projeto` hoje não preenche `created_by`. Acrescente
> `created_by=usuario.id` nele também — e note que a assinatura dele passa a
> precisar do usuário: `criar_projeto(db, conta, nome, usuario=None)`, com
> `created_by=usuario.id if usuario else None`, para não quebrar as chamadas
> que os testes das Tarefas 11–15 já fazem com três argumentos.

- [ ] **Passo 2: Escrever o teste genérico**

Crie `ArchSmart-api/tests/isolation/test_todas_as_rotas.py`:

```python
"""
Toda rota registrada isola por conta — inclusive a que ainda nao existe.

tests/isolation/ ja cobre 27 casos escritos a mao, na Secao 1. Esta lista nao
cresce sozinha: uma rota nova nao entra nela. Este arquivo percorre
`app.routes`, entao a rota nova aparece no dia em que e registrada — e se
ninguem tiver dito que recurso o id dela endereca, o teste FALHA em vez de
ignorar.

Como quebrar de proposito, para ver que funciona: apague o filtro por conta de
um endpoint qualquer e rode. Se ele continuar verde, este arquivo esta mentindo.
"""
import re
import uuid

import pytest

from app.main import app
from tests.conftest import (
    criar_ambiente,
    criar_apresentacao,
    criar_evento,
    criar_item_de_orcamento,
    criar_lancamento,
    criar_notificacao,
    criar_opcao,
    criar_orcamento,
    criar_produto,
    criar_projeto,
)

# Parametro de caminho -> como fabricar um recurso daquele tipo numa conta.
# TODA rota com id na URL precisa de entrada aqui. E de proposito que a falta
# de uma entrada seja falha, e nao pulo: rota nova sem isolamento tem que
# quebrar o build no dia em que e escrita.
RECURSOS = {
    "project_id": lambda db, conta, usuario: criar_projeto(
        db, conta, "Alheio", usuario
    ),
    "env_id": criar_ambiente,
    "budget_id": criar_orcamento,
    "item_id": criar_item_de_orcamento,
    "option_id": criar_opcao,
    "product_id": criar_produto,
    "presentation_id": criar_apresentacao,
    "entry_id": criar_lancamento,
    "event_id": criar_evento,
    "notification_id": criar_notificacao,
}

# O portal publico. Quem chama nao tem conta: e o cliente final do arquiteto,
# autorizado por token de portal (app/core/portal_security.py). "Conta A
# tentando alcancar recurso da conta B" nao descreve esse caminho, e testa-lo
# aqui daria falso verde. Coberto por tests/isolation/test_portal_access.py.
PARAMETROS_FORA_DO_ESCOPO = {"presentation_uuid"}

# Prefixos que nao sao rota de aplicacao.
CAMINHOS_DE_INFRAESTRUTURA = ("/docs", "/redoc", "/openapi.json")


def _rotas_com_recurso():
    for rota in app.routes:
        if not hasattr(rota, "methods"):
            continue
        if rota.path.startswith(CAMINHOS_DE_INFRAESTRUTURA):
            continue
        parametros = re.findall(r"{(\w+)}", rota.path)
        if not parametros:
            continue
        if any(p in PARAMETROS_FORA_DO_ESCOPO for p in parametros):
            continue
        for metodo in sorted(rota.methods - {"HEAD", "OPTIONS"}):
            yield metodo, rota.path, parametros


CASOS = sorted(set(_rotas_com_recurso()))


def test_ha_rotas_para_percorrer():
    """
    Rede contra o pior modo de falha deste arquivo: um `_rotas_com_recurso`
    que devolve lista vazia deixa a suite verde sem testar nada.
    """
    assert len(CASOS) >= 30, f"so {len(CASOS)} rotas coletadas; algo filtrou demais"


@pytest.mark.parametrize("metodo,caminho,parametros", CASOS, ids=lambda v: str(v))
def test_toda_rota_com_id_isola_por_conta(
    db, client_a, conta_b, metodo, caminho, parametros
):
    conta, usuario = conta_b
    url = caminho
    for parametro in parametros:
        fabrica = RECURSOS.get(parametro)
        assert fabrica is not None, (
            f"a rota {metodo} {caminho} tem o parametro {{{parametro}}} e "
            "ninguem disse que recurso ele endereca. Acrescente uma entrada em "
            "RECURSOS (ou, se for rota de portal publico, em "
            "PARAMETROS_FORA_DO_ESCOPO, com o motivo)."
        )
        recurso = fabrica(db, conta, usuario)
        url = url.replace("{" + parametro + "}", str(recurso.id))

    resposta = client_a.request(metodo, url, json={})

    assert resposta.status_code not in (200, 201, 202, 204), (
        f"{metodo} {caminho} devolveu {resposta.status_code} para recurso da "
        "conta B — vazamento entre contas."
    )
    assert resposta.status_code != 403, (
        f"{metodo} {caminho} devolveu 403, que CONFIRMA a existencia do "
        "recurso alheio. Use 404."
    )
    if metodo in ("GET", "DELETE"):
        # Sem corpo, nao ha validacao do Pydantic no caminho: 404 e exigivel.
        assert resposta.status_code == 404, (
            f"{metodo} {caminho} devolveu {resposta.status_code}; esperado 404."
        )
```

- [ ] **Passo 3: Rodar**

```bash
pytest tests/isolation/test_todas_as_rotas.py -q
```

Esperado: **verde**, com cerca de 40 casos parametrizados. **Se algum falhar, é
um vazamento real** — não relaxe a asserção. Volte ao endpoint.

- [ ] **Passo 4: Provar que o teste pega o que promete**

Um teste de isolamento que nunca viu um vazamento é uma decoração. Quebre de
propósito e confirme que ele acusa:

```bash
# apague temporariamente o filtro de um endpoint, por exemplo trocando
#   repo.obter(Project, project_id)
# por
#   repo.db.query(Project).filter(Project.id == project_id).first()
pytest tests/isolation/test_todas_as_rotas.py -q
```

Esperado: **falha** nas rotas de `project_id`, com a mensagem de vazamento.
Depois **desfaça a quebra** (`git checkout -- <arquivo>`) e rode de novo para
voltar ao verde.

- [ ] **Passo 5: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **278 passed** (237 da Tarefa 15 + ~40 parametrizados + 1 da rede).

> O número exato depende de quantas rotas existirem no dia. **Conte, não
> estime:** `pytest --collect-only -q | tail -1`.

- [ ] **Passo 6: Commit**

```bash
git add ArchSmart-api/tests/isolation/test_todas_as_rotas.py ArchSmart-api/tests/conftest.py
git commit -m "test: isolamento generico percorrendo todas as rotas registradas"
```

---

## Tarefa 17: Apagar `app/tests/`

Fecha a caixa "Suíte de testes contra banco real (`tests/services/`,
`tests/api/`, `tests/isolation/`) substituindo `app/tests/`".

**O que se apaga, e por quê.** 16 arquivos, 83 testes. Eles usam `MagicMock`
como sessão de banco e afirmam o **formato da cadeia de chamadas**, não o
comportamento. Um mock devolve o mesmo objeto independentemente do filtro
aplicado, então nenhum teste sobre ele consegue provar isolamento entre contas —
foi por isso que 13 endpoints com vazamento passaram por 83 testes verdes até a
auditoria de 23/08/2026. O `pytest.ini` já os tirou do `testpaths` na Seção 3,
com essa justificativa escrita no comentário.

Depois das Tarefas 11–16, a cobertura equivalente existe e é melhor: contra
Postgres real, com duas contas de verdade.

- [ ] **Passo 1: Conferir que nada fora de `app/tests/` importa de lá**

```bash
grep -rn "app\.tests\|from app import tests" --include=*.py . | grep -v "^./app/tests/" | grep -v "/venv/"
```

Esperado: **saída vazia**. Se aparecer algo, resolva antes de apagar.

- [ ] **Passo 2: Registrar a contagem antes de apagar**

O número entra no PR e na documentação. Meça agora, porque depois não dá:

```bash
./venv/Scripts/python.exe -m pytest app/tests --collect-only -q | tail -1
ls app/tests/*.py | wc -l
```

Esperado: `83 tests collected` e `16`.

- [ ] **Passo 3: Apagar**

```bash
git rm -r ArchSmart-api/app/tests
```

- [ ] **Passo 4: Limpar o `pytest.ini`**

O comentário que explica por que `app/tests/` está fora do `testpaths` deixa de
descrever a realidade — o diretório não existe mais. Em
`ArchSmart-api/pytest.ini`, o bloco:

```ini
# app/tests/ nao entra aqui: aquela suite usa MagicMock como sessao de banco e
# afirma o formato da cadeia de chamadas, nao o comportamento — entao ela quebra
# a cada mudanca de query mesmo quando nada regride, e nao detecta vazamento
# entre contas (ver auditoria 23/08/2026). A Secao 4 a substitui e apaga.
# Para rodar mesmo assim: pytest app/tests
testpaths = tests
```

passa a:

```ini
# A suite inteira vive em tests/. A antiga, em app/tests/, foi apagada na
# Secao 4: 83 testes sobre MagicMock, que afirmavam o formato da cadeia de
# chamadas e nao o comportamento — e por isso deixaram passar os 13 endpoints
# com vazamento que a Secao 1 corrigiu.
testpaths = tests
```

- [ ] **Passo 5: Tirar a exclusão temporária do lint de `print()`**

A Tarefa 9 excluiu `app/tests/` do `test_nenhum_print_em_app` porque aqueles 4
`print()` existiam e o diretório só morreria agora. Ele morreu. Em
`ArchSmart-api/tests/test_arquitetura.py`, o filtro volta a ser simples:

```python
    achados = [a for a in _ocorrencias(APP, "print(") if "# noqa: T201" not in a]
```

Um lint com exclusão para um diretório que não existe é um lint cego que
ninguém percebe.

- [ ] **Passo 6: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: **o mesmo número da Tarefa 16**. Se mudou, algo em `tests/` dependia
de `app/tests/` — provavelmente um `conftest.py` compartilhado.

- [ ] **Passo 7: Commit**

```bash
git add ArchSmart-api/pytest.ini ArchSmart-api/tests/test_arquitetura.py
git commit -m "test: apaga a suite antiga sobre MagicMock, substituida pela suite contra Postgres"
```

---

## Tarefa 18: Documentação e fechamento da seção

**Arquivos:**
- Modificar: `PROGRESS.md` (9 caixas + a nota da seção)
- Modificar: `CLAUDE.md` (bloco de estado)
- Modificar: `docs/dev/arquitetura.md` (seção "Escopo por conta hoje")
- Modificar: `docs/dev/modelo-de-dados.md` (as colunas e os índices novos)
- Modificar: `ArchSmart-api/CLAUDE.md` (a regra nova de acesso a banco)
- Rodar: `tools/progresso.py --write`, `tools/catraca.py --atualizar`

- [ ] **Passo 1: Marcar as 9 caixas no `PROGRESS.md`**

Na Seção 4, troque `- [ ]` por `- [x]` nas nove. **Não edite a porcentagem nem
a barra à mão** — o script recalcula.

- [ ] **Passo 2: Escrever a nota da seção no `PROGRESS.md`**

Logo abaixo da lista da Seção 4, no mesmo formato das notas das Seções 1–3.
Ela precisa carregar os **números medidos**, com o comando de cada um:

```markdown
> **A Seção 4 fechou em <data>, e foi medida.** Os 117 `db.query()` diretos
> viraram 20, e cada uma das 20 tem comentário dizendo qual exceção é —
> 11 no portal público (`public.py`, que não tem conta na sessão), 2 de
> catálogo global, 4 em `users.py` (a tabela `accounts` não tem `account_id`)
> e 2 em `auth.py` (rodam antes de existir sessão). Contagem:
> `grep -rn "db\.query(" app --include=*.py | wc -l`.
>
> **O que agora é impossível de escrever.** `ScopedRepository.query(model)`
> filtra por `account_id` sozinho e levanta `EscopoImpossivel` num model que
> não tem a coluna. `create()` injeta `account_id` e `created_by` e **descarta**
> o que vier do cliente nessas duas chaves. E
> `tests/isolation/test_todas_as_rotas.py` percorre as rotas registradas: uma
> rota nova com id na URL e sem entrada em `RECURSOS` **falha**, em vez de
> passar despercebida.
>
> **O schema.** As 21 tabelas de dado ganharam `created_by`; dez delas ganharam
> `account_id` também, com backfill pelo caminho de FK e fechamento em
> `NOT NULL` na mesma migração. Os 4 índices do schema viraram <N>
> (`ix_*_account_id` em todas as 21, mais 8 compostos).
>
> **O N+1 do orçamento.** `calculate_budget_item_quantity(db, item)` fazia até
> 3 queries por item — ~300 num orçamento de 100. Ela virou
> `calculate_quantity(item, dna, produto)`, **pura**, e o carregamento virou 2
> queries. O número é contado, não estimado:
> `tests/api/test_orcamento_sem_n_mais_um.py` registra as queries num listener
> do SQLAlchemy e falha se passarem de 2.
>
> **A suíte.** A antiga (`app/tests/`, 83 testes sobre `MagicMock`) foi
> apagada. A nova tem <N> testes contra Postgres real, dividida em
> `tests/services/` (função pura), `tests/api/` (endpoint com dado semeado) e
> `tests/isolation/` (vazamento entre contas).
>
> **Duas coisas mudaram em relação à spec, e as duas estão registradas.** O
> `/me` ficou em `GET /api/users/me` e não em `/api/v1/me` — não existe prefixo
> `/api/v1` no app, e criar um para uma rota só seria versionamento que ninguém
> mais segue ([ADR 0008](docs/dev/decisoes/0008-me-em-api-users-me.md)). E o
> `created_by` foi para as 21 tabelas de dado, não só para as 10 que ganharam
> `account_id`, para que `create()` não tenha exceção a lembrar.
>
> **Achado extra, corrigido junto:** 7 ocorrências de "Arch Smart" em `app/`,
> quatro delas chegando ao usuário — assunto de e-mail de confirmação e de
> recuperação de senha, assinatura do corpo, e o nome de escritório padrão do
> portal. Violação do Art. 8, agora com lint em
> `tests/test_arquitetura.py::test_a_marca_e_arq_smart`.
```

Substitua cada `<N>` e `<data>` pelo valor medido no dia — **não pelo valor que
este plano previu**.

- [ ] **Passo 3: Recalcular o progresso**

```bash
cd ../..
python tools/progresso.py --write
python tools/progresso.py --check
```

Esperado: `28/63 (44%)` e saída `0` no `--check`. **Confira o número que saiu**
contra o que você esperava; se divergir, uma caixa foi marcada errado.

- [ ] **Passo 4: Atualizar o bloco de estado do `CLAUDE.md`**

O parágrafo "Estado em 30/08/2026" passa a:

```markdown
Estado em <data>: Seção 1 concluída (correções de segurança, merge `f190a07`).
Seção 2 concluída (estrutura e documentação, merge `f167375`). Seção 3
concluída (esteira, ambientes e branches, 5/5). **Seção 4 concluída por
inteiro** — camada de dados do backend, 9/9. Seções 5 a 9 pendentes; **a
próxima é a Seção 5** (camada de dados do frontend).
```

E acrescente, à lista "Três coisas que economizam tempo", uma quarta:

```markdown
- **Endpoint não fala com o banco direto.** Toda leitura e escrita passa por
  `ScopedRepository` (`app/db/repository.py`), que filtra por `account_id`
  sozinho. As 20 exceções que restam têm comentário dizendo qual é o caso —
  portal público, catálogo global, ou código que roda antes de existir sessão.
  `tests/test_arquitetura.py` reprova um `db.query()` que volte a um arquivo já
  convertido.
```

- [ ] **Passo 5: Atualizar `ArchSmart-api/CLAUDE.md`**

Ele descreve o padrão antigo de acesso a banco. Acrescente a regra nova, com o
exemplo dos dois lados:

```markdown
## Como se lê e escreve no banco

Desde a Seção 4, endpoint não chama `db.query()`:

```python
# errado
projeto = db.query(Project).filter(
    Project.id == project_id, Project.account_id == current_user.account_id
).first()

# certo
projeto = repo.obter(Project, project_id)   # 404 se nao for da conta
```

A dependência é `repo: ScopedRepository = Depends(get_repo)`. Se precisar da
`Session` crua para `commit` ou `execute`, ela é `repo.db` — nunca declare
`get_db` de novo no mesmo endpoint.

As exceções legítimas (portal público, catálogo global, pré-sessão) estão
comentadas onde acontecem. Uma query sem comentário é esquecimento.
```

- [ ] **Passo 6: Atualizar `docs/dev/modelo-de-dados.md`**

As 21 tabelas mudaram de forma. Atualize a classificação tabela a tabela para
refletir `account_id` e `created_by`, e acrescente a lista dos índices. Meça
antes de escrever:

```bash
cd ArchSmart-api
./venv/Scripts/python.exe -c "
import os
for k,v in {'DATABASE_URL':'postgresql://a:a@localhost:55432/arqsmart_test','SUPABASE_URL':'https://x.invalido.supabase.co','SUPABASE_KEY':'x','SUPABASE_SERVICE_ROLE_KEY':'x','GEMINI_API_KEY':'x'}.items(): os.environ.setdefault(k,v)
from app.db.base_class import Base
import app.models.all_models
total = 0
for t in sorted(Base.metadata.tables):
    for i in Base.metadata.tables[t].indexes:
        total += 1
        print(t, i.name, [c.name for c in i.columns])
print('total de indices:', total)
"
```

- [ ] **Passo 7: Atualizar `docs/dev/arquitetura.md`**

A seção "Escopo por conta hoje, e o que a Seção 4 muda" descreve um futuro que
virou presente. Reescreva no passado, mantendo o **porquê** — que é a parte que
não envelhece.

- [ ] **Passo 8: Rodar a catraca e os checadores do repositório**

```bash
cd ../..
python tools/catraca.py
python tools/checa_links.py
cd tools; python -m unittest discover -p "test_*.py"
```

> ⚠️ Dois detalhes de cwd que já custaram tempo aqui:
> - `checa_links.py` roda **da raiz**, que é como o CI o executa.
> - `python -m unittest discover` roda **de dentro de `tools/`**. Da raiz, com
>   `-s tools`, ele falha em `test_checa_links.py::test_nao_acusa_link_existente`
>   — o CI escapa porque o job usa `working-directory: tools`.

Se a catraca **desceu** (esperado — o backend não é medido por ela, mas
`checa_links` e o resto sim), grave no mesmo commit:

```bash
python tools/catraca.py --atualizar
```

O script **recusa** gravar se alguma medida piorou. Se piorou, entenda por quê
antes de pensar em `--aceitar-piora`.

- [ ] **Passo 9: Rodar tudo, uma última vez, e contar**

```bash
cd ArchSmart-api
docker compose -f docker-compose.test.yml up -d --wait
pytest -q
cd ../ArchSmart-web
npm run typecheck
npm test
```

Esperado no front: `Test Files 4 passed (4)`, `Tests 7 passed (7)` — a Seção 4
não toca no frontend, então qualquer mudança aqui é sinal de que algo foi
tocado sem intenção.

**Cole a saída real de cada comando no PR.** "Verificado por grep", sem o
comando colado, já se provou falso neste repositório.

- [ ] **Passo 10: Commit e PR**

```bash
cd ..
git add PROGRESS.md CLAUDE.md docs/ ArchSmart-api/CLAUDE.md tools/catraca.json
git commit -m "docs: fecha a Secao 4 — camada de dados do backend, 9/9"
git push -u origin secao-4-camada-de-dados-backend
gh pr create --base develop --title "Secao 4 — camada de dados do backend" --body "..."
```

- [ ] **Passo 11: Olhar os três checks antes de mergear**

Branch protection continua uma decisão em aberto: a esteira **reprova, mas não
bloqueia**. Quem mergeia é o portão.

```bash
gh pr checks
```

Os três jobs — `Backend`, `Frontend`, `Repositorio` — precisam estar verdes. Um
X vermelho ali é defeito real, não ruído.

---

## Verificação final da seção

Rode tudo isto antes de considerar a Seção 4 fechada. Cada linha é uma
afirmação que o PR vai fazer, e cada uma precisa da sua saída colada.

```bash
cd ArchSmart-api

# 1. As queries diretas que sobraram, e todas comentadas
grep -rn "db\.query(" app --include=*.py | wc -l          # esperado: 20

# 2. Nenhum rastro tecnico na resposta
grep -rn "detail=.*str(e" app --include=*.py | wc -l       # esperado: 0

# 3. Nenhum print
grep -rn "print(" app --include=*.py | wc -l               # esperado: 0

# 4. A marca certa
grep -rn "Arch Smart\|ArchSmart\|Ark Smart\|Ecowe" app --include=*.py | wc -l   # esperado: 0

# 5. A funcao velha do calculo morreu
grep -rn "calculate_budget_item_quantity" app --include=*.py | wc -l  # esperado: 0

# 6. A suite antiga morreu
ls app/tests 2>&1                                          # esperado: nao existe

# 7. A suite nova, contada
pytest -q
```

E, da raiz:

```bash
python tools/progresso.py --check
python tools/checa_links.py
python tools/catraca.py
cd tools; python -m unittest discover -p "test_*.py"
```

---

## Sobre os números deste plano

As contagens de "esperado: N passed" ao fim de cada tarefa são **previsões**,
somando os testes que cada passo acrescenta. Elas servem para você notar quando
algo sumiu da coleta — não são verdade medida.

Se um número não bater, **não ajuste o plano para casar com o que saiu.** Conte:

```bash
pytest --collect-only -q | tail -1
```

Um teste que sumiu da coleta é quase sempre um arquivo que deixou de ser
importável — o que o `pytest -q` reporta como "menos testes", não como falha.
