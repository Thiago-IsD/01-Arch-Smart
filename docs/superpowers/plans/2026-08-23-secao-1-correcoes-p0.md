# Seção 1 — Correções P0 de Segurança · Plano de Implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** Fechar as 13 falhas de autorização em produção, cada uma com um teste de regressão que roda contra Postgres real e falha se a falha voltar.

**Arquitetura:** Primeiro sobe um harness de teste mínimo contra Postgres em Docker (o harness atual usa `MagicMock` e é incapaz de detectar vazamento entre contas). Depois cada grupo de endpoints ganha teste vermelho → correção → teste verde. As correções são cirúrgicas e locais: a eliminação estrutural do problema vem na Seção 4, com o `ScopedRepository`.

**Stack:** FastAPI 0.128 · SQLAlchemy 2.0 · pytest 9.1.1 · PostgreSQL 16 em Docker · slowapi (novo)

**Spec:** `docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md` (Seção 1)

## Restrições globais

- Diretório de trabalho do backend: `ArchSmart-api/` (renomeado para `api/` só na Seção 9 — **não renomeie nada aqui**).
- Nenhum identificador de conta pode ser literal no código (Art. 1). Nenhuma URL, chave ou host fixo (Art. 4).
- Toda query nova é filtrada por `account_id` resolvido no servidor. `account_id` vindo do cliente é sempre ignorado.
- Mensagens de erro ao usuário em pt-BR. Nunca devolver `str(e)` de exceção interna na resposta.
- Grafia da marca: **Arq Smart**. Não introduza `ArchSmart` em texto novo (os nomes de diretório existentes ficam como estão até a Seção 9).
- Python: `snake_case` para funções e variáveis, `PascalCase` para models.
- Commits em português, no formato `tipo: descrição`.
- Não altere os testes existentes em `app/tests/` — eles serão descartados na Seção 4. A suíte nova vive em `ArchSmart-api/tests/`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `ArchSmart-api/docker-compose.test.yml` | sobe o Postgres 16 descartável dos testes |
| `ArchSmart-api/tests/conftest.py` | engine de teste, sessão com rollback, contas A e B, clientes autenticados |
| `ArchSmart-api/tests/isolation/test_budgets_isolation.py` | regressão dos 6 IDORs de orçamento |
| `ArchSmart-api/tests/isolation/test_portal_access.py` | regressão das 5 ações do portal sem token |
| `ArchSmart-api/tests/isolation/test_public_endpoints.py` | regressão dos 2 endpoints sem autenticação |
| `ArchSmart-api/app/api/routers/budgets_router.py` | recebe o helper de escopo e as 6 correções |
| `ArchSmart-api/app/api/endpoints/public.py` | recebe a dependência de token do portal |
| `ArchSmart-api/app/api/routers/product_router.py` | remoção do seed e autenticação do normalize |
| `ArchSmart-api/app/core/rate_limit.py` | limitador compartilhado (slowapi) |
| `ArchSmart-api/pytest.ini` | passa a enxergar `tests/` |

---

### Tarefa 1: Harness de teste contra Postgres real

**Files:**
- Create: `ArchSmart-api/docker-compose.test.yml`
- Create: `ArchSmart-api/tests/__init__.py` (vazio)
- Create: `ArchSmart-api/tests/conftest.py`
- Create: `ArchSmart-api/tests/isolation/__init__.py` (vazio)
- Create: `ArchSmart-api/tests/test_harness.py`
- Modify: `ArchSmart-api/pytest.ini`
- Modify: `ArchSmart-api/requirements-dev.txt`

**Interfaces:**
- Consumes: nada (primeira tarefa)
- Produces: fixtures e helper usados por todas as tarefas seguintes —
  - `db: Session` — sessão dentro de transação com rollback ao fim do teste
  - `conta_a` e `conta_b` — cada uma devolve a tupla `(Account, User)`
  - `client_a: TestClient`, `client_b: TestClient` — autenticados como o usuário da respectiva conta
  - `client_anon: TestClient` — sem autenticação
  - `criar_projeto(db: Session, conta: Account, nome: str = "Projeto Teste") -> Project` — cria o `Client` obrigatório junto

⚠️ **Campos obrigatórios verificados nos models** (`app/models/all_models.py`) — as fixtures precisam respeitá-los:
`Project.client_id` é `NOT NULL` com FK para `clients`, então **todo projeto exige um `Client` antes**. `Presentation.name` é `NOT NULL`. `Client` exige `account_id` e `name`. `BudgetItem.environment_id` é nulável. `Product.price` é nulável.

**Nota de decisão:** o schema dos testes é criado por `Base.metadata.create_all()`, derivado dos models — não por `alembic upgrade head`. Motivo: existe divergência conhecida entre migrações e banco (o `add_column.py` rodava `ALTER TABLE` à mão), e travar a Seção 1 nesse problema atrasaria correções de segurança. A fidelidade migração↔model é reconciliada na Seção 4, que reconstrói o banco do zero.

- [ ] **Passo 1: Criar o compose do Postgres de teste**

`ArchSmart-api/docker-compose.test.yml`:

```yaml
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: arqsmart
      POSTGRES_PASSWORD: arqsmart
      POSTGRES_DB: arqsmart_test
    ports:
      - "55432:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U arqsmart -d arqsmart_test"]
      interval: 2s
      timeout: 3s
      retries: 20
```

`tmpfs` mantém os dados em memória: o banco morre com o contêiner e a suíte fica rápida.

- [ ] **Passo 2: Subir o contêiner e confirmar que responde**

Run: `docker compose -f ArchSmart-api/docker-compose.test.yml up -d --wait`
Expected: `postgres-test` com status `healthy`.

- [ ] **Passo 3: Declarar a dependência nova**

Acrescentar ao final de `ArchSmart-api/requirements-dev.txt`:

```
slowapi==0.1.9
```

Run: `pip install -r ArchSmart-api/requirements-dev.txt`

- [ ] **Passo 4: Apontar o pytest para a suíte nova**

Substituir o conteúdo de `ArchSmart-api/pytest.ini` por:

```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = function
pythonpath = .
testpaths = tests app/tests
```

`app/tests` permanece na lista até a Seção 4 descartá-la.

- [ ] **Passo 5: Escrever o conftest**

`ArchSmart-api/tests/conftest.py`:

```python
"""
Harness de teste contra Postgres real.

Por que não MagicMock: um mock devolve o mesmo objeto independentemente do
filtro aplicado, então nenhum teste sobre ele consegue provar isolamento
entre contas. Toda a Seção 1 existe porque essa classe de falha passou
despercebida por 83 testes.

Sobe com: docker compose -f docker-compose.test.yml up -d --wait
"""
import os
import uuid
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://arqsmart:arqsmart@localhost:55432/arqsmart_test",
)

# A aplicação lê settings na importação; garante que ela não tente o banco real.
os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)

from app.db.base_class import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.all_models import Account, Client, Project, User  # noqa: E402
from app.api.users import get_current_user  # noqa: E402


def criar_projeto(db: Session, conta: Account, nome: str = "Projeto Teste") -> Project:
    """
    Cria um projeto valido para a conta.

    Project.client_id e NOT NULL com FK para clients, entao todo projeto
    exige um Client antes. Esquecer isso quebra a fixture com IntegrityError.
    """
    cliente = Client(account_id=conta.id, name=f"Cliente de {nome}")
    db.add(cliente)
    db.flush()
    projeto = Project(account_id=conta.id, client_id=cliente.id, name=nome)
    db.add(projeto)
    db.flush()
    return projeto


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine) -> Generator[Session, None, None]:
    """Sessão dentro de uma transação revertida ao fim de cada teste."""
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


def _criar_conta(db: Session, nome: str) -> tuple[Account, User]:
    conta = Account(name=nome, company_name=f"Escritorio {nome}")
    db.add(conta)
    db.flush()
    usuario = User(
        account_id=conta.id,
        email=f"{nome.lower()}-{uuid.uuid4().hex[:8]}@teste.local",
        full_name=f"Usuario {nome}",
        supabase_id=str(uuid.uuid4()),
    )
    db.add(usuario)
    db.flush()
    return conta, usuario


@pytest.fixture
def conta_a(db: Session) -> tuple[Account, User]:
    return _criar_conta(db, "ContaA")


@pytest.fixture
def conta_b(db: Session) -> tuple[Account, User]:
    return _criar_conta(db, "ContaB")


def _cliente(db: Session, usuario: User | None) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_db] = lambda: db
    if usuario is not None:
        app.dependency_overrides[get_current_user] = lambda: usuario
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client_a(db: Session, conta_a) -> Generator[TestClient, None, None]:
    yield from _cliente(db, conta_a[1])


@pytest.fixture
def client_b(db: Session, conta_b) -> Generator[TestClient, None, None]:
    yield from _cliente(db, conta_b[1])


@pytest.fixture
def client_anon(db: Session) -> Generator[TestClient, None, None]:
    yield from _cliente(db, None)
```

- [ ] **Passo 6: Escrever o teste que prova que o harness funciona**

`ArchSmart-api/tests/test_harness.py`:

```python
"""Prova que o harness enxerga o que o MagicMock não enxergava."""
from app.models.all_models import Project

from tests.conftest import criar_projeto


def test_projeto_de_uma_conta_nao_aparece_para_a_outra(db, conta_a, conta_b):
    conta_a_obj, _ = conta_a
    conta_b_obj, _ = conta_b

    criar_projeto(db, conta_a_obj, "Casa do Lago")

    visiveis_para_b = (
        db.query(Project).filter(Project.account_id == conta_b_obj.id).all()
    )
    assert visiveis_para_b == []

    visiveis_para_a = (
        db.query(Project).filter(Project.account_id == conta_a_obj.id).all()
    )
    assert len(visiveis_para_a) == 1


def test_rollback_entre_testes(db):
    assert db.query(Project).count() == 0
```

O segundo teste falharia se o rollback não estivesse funcionando — o projeto do teste anterior apareceria.

- [ ] **Passo 7: Rodar e verificar que passa**

Run: `cd ArchSmart-api && pytest tests/test_harness.py -v`
Expected: 2 passed.

Se `test_rollback_entre_testes` falhar com `count() == 1`, o rollback não está isolando — corrija o fixture `db` antes de seguir.

- [ ] **Passo 8: Commit**

```bash
git add ArchSmart-api/docker-compose.test.yml ArchSmart-api/tests/ ArchSmart-api/pytest.ini ArchSmart-api/requirements-dev.txt
git commit -m "test: harness de teste contra Postgres real em Docker

O harness atual usa MagicMock como sessao de banco, que devolve o mesmo
objeto independentemente do filtro. Nenhum dos 83 testes existentes
conseguiria detectar vazamento entre contas. Este harness consegue, e e
o pre-requisito das correcoes P0."
```

---

### Tarefa 2: Escopo por conta nos endpoints de item de orçamento

Corrige `PATCH /api/budgets/items/{item_id}`, `DELETE /api/budgets/items/{item_id}` e `POST /api/budgets/items/{item_id}/options`.

**Files:**
- Create: `ArchSmart-api/tests/isolation/test_budgets_isolation.py`
- Modify: `ArchSmart-api/app/api/routers/budgets_router.py`

**Interfaces:**
- Consumes: fixtures `db`, `conta_a`, `conta_b`, `client_a` da Tarefa 1
- Produces: helper `buscar_item_da_conta(db: Session, item_id: UUID, account_id: UUID) -> BudgetItem` em `budgets_router.py`, usado também pela Tarefa 3

- [ ] **Passo 1: Escrever os testes que falham**

`ArchSmart-api/tests/isolation/test_budgets_isolation.py`:

```python
"""
Regressao dos IDORs de orcamento (auditoria 23/08/2026, achado P0-1).

Cada teste monta um orcamento na conta A e tenta alcanca-lo autenticado
como conta B. A resposta correta e 404 — nunca 200.
"""
import uuid

import pytest

from app.models.all_models import (
    Budget,
    BudgetItem,
    ItemOption,
    Product,
    RuleType,
)

from tests.conftest import criar_projeto


@pytest.fixture
def item_da_conta_a(db, conta_a):
    conta, _ = conta_a
    projeto = criar_projeto(db, conta, "Projeto A")

    orcamento = Budget(project_id=projeto.id, total_value=0.0)
    db.add(orcamento)
    db.flush()

    item = BudgetItem(
        budget_id=orcamento.id,
        rule_type=RuleType.UNIT,
        manual_quantity=1,
    )
    db.add(item)
    db.flush()
    return item


def test_conta_b_nao_altera_item_da_conta_a(client_b, item_da_conta_a):
    resposta = client_b.patch(
        f"/api/budgets/items/{item_da_conta_a.id}",
        json={"manual_quantity": 999},
    )
    assert resposta.status_code == 404


def test_conta_b_nao_apaga_item_da_conta_a(client_b, item_da_conta_a):
    resposta = client_b.delete(f"/api/budgets/items/{item_da_conta_a.id}")
    assert resposta.status_code == 404


def test_conta_b_nao_adiciona_opcao_em_item_da_conta_a(client_b, item_da_conta_a):
    resposta = client_b.post(
        f"/api/budgets/items/{item_da_conta_a.id}/options",
        json={"product_id": str(uuid.uuid4())},
    )
    assert resposta.status_code == 404


def test_conta_a_altera_o_proprio_item(client_a, item_da_conta_a):
    resposta = client_a.patch(
        f"/api/budgets/items/{item_da_conta_a.id}",
        json={"manual_quantity": 7},
    )
    assert resposta.status_code == 200
    assert resposta.json()["manual_quantity"] == 7
```

- [ ] **Passo 2: Rodar e verificar que falham**

Run: `cd ArchSmart-api && pytest tests/isolation/test_budgets_isolation.py -v`
Expected: os três primeiros FALHAM com `assert 200 == 404`. O quarto passa.

Se algum dos três já passar, pare e investigue — significa que o teste não está alcançando o endpoint.

- [ ] **Passo 3: Adicionar o helper de escopo**

Em `ArchSmart-api/app/api/routers/budgets_router.py`, logo após `router = APIRouter()`:

```python
def buscar_item_da_conta(db: Session, item_id: UUID, account_id: UUID) -> BudgetItem:
    """
    Devolve o BudgetItem apenas se ele pertencer a conta informada.

    O caminho ate a conta e: BudgetItem -> Budget -> Project -> account_id.
    Levanta 404 (nao 403) para nao revelar a existencia do recurso.
    """
    item = (
        db.query(BudgetItem)
        .join(Budget, BudgetItem.budget_id == Budget.id)
        .join(Project, Budget.project_id == Project.id)
        .filter(BudgetItem.id == item_id, Project.account_id == account_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item de orçamento não encontrado")
    return item
```

- [ ] **Passo 4: Aplicar o helper nos três endpoints**

Em `update_budget_item`, substituir:

```python
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Budget item not found")

    # TODO: Verify project constraints vs current_user
```

por:

```python
    item = buscar_item_da_conta(db, item_id, current_user.account_id)
```

Em `delete_budget_item`, substituir:

```python
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Budget item not found")
```

por:

```python
    item = buscar_item_da_conta(db, item_id, current_user.account_id)
```

Em `create_budget_item_option`, substituir:

```python
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Budget item not found")
```

por:

```python
    item = buscar_item_da_conta(db, item_id, current_user.account_id)

    produto = (
        db.query(Product)
        .filter(Product.id == data.product_id, Product.account_id == current_user.account_id)
        .first()
    )
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado na biblioteca")
```

A checagem do produto fecha o segundo furo do mesmo endpoint: sem ela, um produto de outra conta poderia ser anexado.

- [ ] **Passo 5: Rodar e verificar que passam**

Run: `cd ArchSmart-api && pytest tests/isolation/test_budgets_isolation.py -v`
Expected: 4 passed.

- [ ] **Passo 6: Commit**

```bash
git add ArchSmart-api/app/api/routers/budgets_router.py ArchSmart-api/tests/isolation/test_budgets_isolation.py
git commit -m "fix: escopo por conta nos endpoints de item de orcamento (P0-1)

PATCH e DELETE /budgets/items/{id} e POST /budgets/items/{id}/options nao
verificavam a conta: qualquer usuario autenticado alterava o orcamento de
outro escritorio conhecendo o UUID. O endpoint de opcoes tambem aceitava
product_id de outra conta.

Art. 1 da constitution."
```

---

### Tarefa 3: Escopo por conta nos endpoints de opção e resumo

Corrige `PATCH /api/budgets/options/{option_id}/select`, `DELETE /api/budgets/options/{option_id}` e `GET /api/budgets/{budget_id}/summary`.

**Files:**
- Modify: `ArchSmart-api/tests/isolation/test_budgets_isolation.py`
- Modify: `ArchSmart-api/app/api/routers/budgets_router.py`

**Interfaces:**
- Consumes: `buscar_item_da_conta` da Tarefa 2
- Produces: `buscar_opcao_da_conta(db, option_id, account_id) -> ItemOption` e `buscar_orcamento_da_conta(db, budget_id, account_id) -> Budget`

- [ ] **Passo 1: Acrescentar os testes que falham**

Adicionar ao final de `ArchSmart-api/tests/isolation/test_budgets_isolation.py`:

```python
@pytest.fixture
def opcao_da_conta_a(db, conta_a, item_da_conta_a):
    conta, _ = conta_a
    produto = Product(account_id=conta.id, name="Piso Vinilico", price=120.0)
    db.add(produto)
    db.flush()

    opcao = ItemOption(
        budget_item_id=item_da_conta_a.id,
        product_id=produto.id,
        is_selected=True,
    )
    db.add(opcao)
    db.flush()
    return opcao


def test_conta_b_nao_seleciona_opcao_da_conta_a(client_b, opcao_da_conta_a):
    resposta = client_b.patch(f"/api/budgets/options/{opcao_da_conta_a.id}/select")
    assert resposta.status_code == 404


def test_conta_b_nao_apaga_opcao_da_conta_a(client_b, opcao_da_conta_a):
    resposta = client_b.delete(f"/api/budgets/options/{opcao_da_conta_a.id}")
    assert resposta.status_code == 404


def test_conta_b_nao_le_resumo_de_orcamento_da_conta_a(client_b, db, item_da_conta_a):
    resposta = client_b.get(f"/api/budgets/{item_da_conta_a.budget_id}/summary")
    assert resposta.status_code == 404


def test_conta_a_le_o_proprio_resumo(client_a, item_da_conta_a):
    resposta = client_a.get(f"/api/budgets/{item_da_conta_a.budget_id}/summary")
    assert resposta.status_code == 200
```

- [ ] **Passo 2: Rodar e verificar que os três novos falham**

Run: `cd ArchSmart-api && pytest tests/isolation/test_budgets_isolation.py -v`
Expected: `test_conta_b_nao_seleciona_opcao_da_conta_a`, `test_conta_b_nao_apaga_opcao_da_conta_a` e `test_conta_b_nao_le_resumo_de_orcamento_da_conta_a` FALHAM.

- [ ] **Passo 3: Adicionar os dois helpers**

Em `budgets_router.py`, logo abaixo de `buscar_item_da_conta`:

```python
def buscar_opcao_da_conta(db: Session, option_id: UUID, account_id: UUID) -> ItemOption:
    """Devolve a ItemOption apenas se ela pertencer a conta informada."""
    opcao = (
        db.query(ItemOption)
        .join(BudgetItem, ItemOption.budget_item_id == BudgetItem.id)
        .join(Budget, BudgetItem.budget_id == Budget.id)
        .join(Project, Budget.project_id == Project.id)
        .filter(ItemOption.id == option_id, Project.account_id == account_id)
        .first()
    )
    if not opcao:
        raise HTTPException(status_code=404, detail="Opção não encontrada")
    return opcao


def buscar_orcamento_da_conta(db: Session, budget_id: UUID, account_id: UUID) -> Budget:
    """Devolve o Budget apenas se ele pertencer a conta informada."""
    orcamento = (
        db.query(Budget)
        .join(Project, Budget.project_id == Project.id)
        .filter(Budget.id == budget_id, Project.account_id == account_id)
        .first()
    )
    if not orcamento:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return orcamento
```

- [ ] **Passo 4: Aplicar nos três endpoints**

Em `select_budget_item_option` e em `delete_budget_item_option`, substituir:

```python
    option = db.query(ItemOption).filter(ItemOption.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")
```

por:

```python
    option = buscar_opcao_da_conta(db, option_id, current_user.account_id)
```

Em `get_budget_summary`, substituir:

```python
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
        
    # TODO: Auth check against budget.project.account_id 
```

por:

```python
    budget = buscar_orcamento_da_conta(db, budget_id, current_user.account_id)
```

- [ ] **Passo 5: Rodar a suíte inteira de isolamento**

Run: `cd ArchSmart-api && pytest tests/isolation/ -v`
Expected: 8 passed.

- [ ] **Passo 6: Commit**

```bash
git add ArchSmart-api/app/api/routers/budgets_router.py ArchSmart-api/tests/isolation/test_budgets_isolation.py
git commit -m "fix: escopo por conta em opcoes e resumo de orcamento (P0-1)

Fecha os tres endpoints restantes do achado: select, delete de opcao e
GET /budgets/{id}/summary — este ultimo tinha 'TODO: Auth check' escrito
no codigo desde a criacao.

Art. 1 da constitution."
```

---

### Tarefa 4: Token obrigatório nas ações do portal público

O `GET` da apresentação valida `verify_portal_token`; as cinco ações seguintes não. A senha do portal protege a leitura e nada mais.

**Files:**
- Create: `ArchSmart-api/tests/isolation/test_portal_access.py`
- Modify: `ArchSmart-api/app/api/endpoints/public.py`

**Interfaces:**
- Consumes: fixtures `db`, `conta_a`, `client_anon` da Tarefa 1; `verify_portal_token` e `create_portal_token` de `app/core/portal_security.py`
- Produces: dependência `exigir_acesso_ao_portal(presentation_uuid: str, authorization: str | None) -> Presentation`

- [ ] **Passo 1: Escrever os testes que falham**

`ArchSmart-api/tests/isolation/test_portal_access.py`:

```python
"""
Regressao do achado P0-2: as acoes do portal nao verificavam o token.

O GET da apresentacao exige senha; aprovar, rejeitar, selecionar, aceitar e
ler comentarios nao exigiam nada. Quem tivesse o UUID aceitava um orcamento.
"""
import pytest

from app.core.portal_security import create_portal_token, hash_password
from app.models.all_models import (
    Budget,
    BudgetItem,
    ItemOption,
    Presentation,
    Product,
    RuleType,
)

from tests.conftest import criar_projeto


@pytest.fixture
def apresentacao_com_senha(db, conta_a):
    conta, _ = conta_a
    projeto = criar_projeto(db, conta, "Projeto Portal")

    apresentacao = Presentation(
        project_id=projeto.id,
        name="Proposta Sala de Estar",
        access_password_hash=hash_password("senha-do-cliente"),
    )
    db.add(apresentacao)
    db.flush()

    orcamento = Budget(project_id=projeto.id, total_value=0.0)
    db.add(orcamento)
    db.flush()
    item = BudgetItem(budget_id=orcamento.id, rule_type=RuleType.UNIT, manual_quantity=1)
    db.add(item)
    db.flush()
    produto = Product(account_id=conta.id, name="Luminaria", price=300.0)
    db.add(produto)
    db.flush()
    opcao = ItemOption(budget_item_id=item.id, product_id=produto.id, is_selected=False)
    db.add(opcao)
    db.flush()

    return apresentacao, opcao


ACOES_SEM_CORPO = ["select", "approve", "reject"]


@pytest.mark.parametrize("acao", ACOES_SEM_CORPO)
def test_acao_no_portal_sem_token_e_recusada(client_anon, apresentacao_com_senha, acao):
    apresentacao, opcao = apresentacao_com_senha
    resposta = client_anon.post(
        f"/public/presentations/{apresentacao.id}/options/{opcao.id}/{acao}"
    )
    assert resposta.status_code == 401


def test_comentarios_sem_token_sao_recusados(client_anon, apresentacao_com_senha):
    apresentacao, _ = apresentacao_com_senha
    resposta = client_anon.get(f"/public/presentations/{apresentacao.id}/comments")
    assert resposta.status_code == 401


@pytest.mark.parametrize("acao", ACOES_SEM_CORPO)
def test_acao_no_portal_com_token_valido_e_aceita(client_anon, apresentacao_com_senha, acao):
    apresentacao, opcao = apresentacao_com_senha
    token = create_portal_token(str(apresentacao.id))
    resposta = client_anon.post(
        f"/public/presentations/{apresentacao.id}/options/{opcao.id}/{acao}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resposta.status_code == 200


def test_token_de_outra_apresentacao_nao_serve(client_anon, apresentacao_com_senha):
    apresentacao, opcao = apresentacao_com_senha
    token_alheio = create_portal_token("00000000-0000-0000-0000-000000000000")
    resposta = client_anon.post(
        f"/public/presentations/{apresentacao.id}/options/{opcao.id}/approve",
        headers={"Authorization": f"Bearer {token_alheio}"},
    )
    assert resposta.status_code == 401
```

- [ ] **Passo 2: Rodar e verificar que falham**

Run: `cd ArchSmart-api && pytest tests/isolation/test_portal_access.py -v`
Expected: os 4 testes de recusa FALHAM com `assert 200 == 401`; os 3 de aceitação passam.

- [ ] **Passo 3: Criar a dependência de acesso**

Em `ArchSmart-api/app/api/endpoints/public.py`, após os imports e antes do primeiro `@router`:

```python
def exigir_acesso_ao_portal(
    presentation_uuid: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Presentation:
    """
    Garante que quem chama tem o token do portal desta apresentacao.

    O GET da apresentacao ja fazia essa verificacao; as acoes de escrita nao
    faziam nenhuma. Sem isto, a senha do portal protege apenas a leitura.
    """
    try:
        uuid_obj = uuid_module.UUID(presentation_uuid)
    except ValueError:
        raise HTTPException(status_code=404, detail="ID de apresentação inválido")

    apresentacao = db.query(Presentation).filter(Presentation.id == uuid_obj).first()
    if not apresentacao:
        raise HTTPException(status_code=404, detail="Apresentação não encontrada")

    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()

    if not verify_portal_token(token, apresentacao.id):
        raise HTTPException(
            status_code=401,
            detail="Acesso não autorizado. Informe a senha da apresentação.",
        )

    return apresentacao
```

- [ ] **Passo 4: Aplicar a dependência nas cinco ações**

Em cada uma das cinco funções — `select_public_option`, `approve_public_option`, `reject_public_option`, `accept_public_presentation`, `get_public_presentation_comments` — trocar o parâmetro `presentation_uuid: str` pela dependência e remover a busca manual da apresentação.

Padrão da mudança, usando `select_public_option` como exemplo. Antes:

```python
def select_public_option(
    presentation_uuid: str,
    option_id: uuid_module.UUID,
    db: Session = Depends(get_db)
):
    presentation = db.query(Presentation).filter(Presentation.id == presentation_uuid).first()
    if not presentation:
        raise HTTPException(status_code=404, detail="Apresentação não encontrada")
```

Depois:

```python
def select_public_option(
    option_id: uuid_module.UUID,
    presentation: Presentation = Depends(exigir_acesso_ao_portal),
    db: Session = Depends(get_db)
):
```

O corpo restante de cada função permanece igual — todas já usam a variável `presentation`.

⚠️ Em `accept_public_presentation` mantenha o parâmetro `request: Request` e o `payload: AcceptRequest`. Em `get_public_presentation_comments`, o corpo usa `presentation_uuid` na query de comentários: troque por `presentation.id`.

- [ ] **Passo 5: Rodar e verificar que passam**

Run: `cd ArchSmart-api && pytest tests/isolation/test_portal_access.py -v`
Expected: 8 passed.

- [ ] **Passo 6: Rodar a suíte inteira para garantir que nada quebrou**

Run: `cd ArchSmart-api && pytest tests/ -v`
Expected: todos passam.

- [ ] **Passo 7: Commit**

```bash
git add ArchSmart-api/app/api/endpoints/public.py ArchSmart-api/tests/isolation/test_portal_access.py
git commit -m "fix: token obrigatorio nas acoes do portal publico (P0-2)

Selecionar, aprovar, rejeitar, aceitar e ler comentarios nao verificavam o
token de acesso — so o GET verificava. Quem tivesse o UUID da apresentacao
aceitava um orcamento sem a senha, e aceite tem efeito comercial.

Art. 1 da constitution."
```

---

### Tarefa 5: Fechar os dois endpoints sem autenticação

`GET /api/products/seed-captured` escreve no banco sem autenticação. `POST /api/products/normalize` chama o Gemini sem autenticação, sem cota e sem registro de custo.

**Files:**
- Create: `ArchSmart-api/app/core/rate_limit.py`
- Create: `ArchSmart-api/tests/isolation/test_public_endpoints.py`
- Modify: `ArchSmart-api/app/api/routers/product_router.py`
- Modify: `ArchSmart-api/app/api/endpoints/public.py`
- Modify: `ArchSmart-api/app/main.py`

**Interfaces:**
- Consumes: fixtures `client_anon`, `client_a` da Tarefa 1
- Produces: `limiter: Limiter` exportado por `app/core/rate_limit.py`

**Nota:** o registro de custo de IA (Art. 9) **não** entra aqui — é a Seção 7. Esta tarefa só fecha o acesso.

- [ ] **Passo 1: Escrever os testes que falham**

`ArchSmart-api/tests/isolation/test_public_endpoints.py`:

```python
"""Regressao do achado P0-3: endpoints sem autenticacao alguma."""


def test_seed_captured_nao_existe_mais(client_anon):
    resposta = client_anon.get("/api/products/seed-captured")
    assert resposta.status_code == 404


def test_normalize_exige_autenticacao(client_anon):
    resposta = client_anon.post(
        "/api/products/normalize",
        json={"text": "Sofá 3 lugares", "source_url": "https://exemplo.com/sofa"},
    )
    assert resposta.status_code in (401, 422)


def test_verify_password_tem_rate_limit(client_anon, db, conta_a):
    from app.core.portal_security import hash_password
    from app.models.all_models import Presentation

    from tests.conftest import criar_projeto

    conta, _ = conta_a
    projeto = criar_projeto(db, conta, "Projeto RL")
    apresentacao = Presentation(
        project_id=projeto.id,
        name="Proposta RL",
        access_password_hash=hash_password("certa"),
    )
    db.add(apresentacao)
    db.flush()

    codigos = []
    for _ in range(12):
        r = client_anon.post(
            f"/public/presentations/{apresentacao.id}/verify-password",
            json={"password": "errada"},
        )
        codigos.append(r.status_code)

    assert 429 in codigos, "sem rate limit, a senha do portal e forca-brutavel"
```

- [ ] **Passo 2: Rodar e verificar que falham**

Run: `cd ArchSmart-api && pytest tests/isolation/test_public_endpoints.py -v`
Expected: os 3 FALHAM.

- [ ] **Passo 3: Criar o limitador**

`ArchSmart-api/app/core/rate_limit.py`:

```python
"""
Limitador de requisicoes compartilhado.

Escopo atual: memoria do processo. Serve para a instancia unica do beta;
quando houver mais de uma instancia, trocar o storage por Redis — o ponto
de troca e apenas este arquivo.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

- [ ] **Passo 4: Registrar o limitador na aplicação**

Em `ArchSmart-api/app/main.py`, após a criação de `app`:

```python
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.rate_limit import limiter

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

- [ ] **Passo 5: Remover o `seed-captured`**

Em `ArchSmart-api/app/api/routers/product_router.py`, apagar integralmente o decorador `@router.get("/seed-captured")` e a função `seed_captured` (linhas 16 a ~66). O dado de exemplo passa a vir de `tools/seed.py`, criado na Seção 2.

- [ ] **Passo 6: Exigir autenticação e limitar o `normalize`**

Substituir:

```python
@router.post("/normalize", response_model=NormalizeResponse)
async def normalize_product(request: NormalizeRequest):
    try:
        return await extract_product_data(request.text, request.source_url)
```

por:

```python
@router.post("/normalize", response_model=NormalizeResponse)
@limiter.limit("20/minute")
async def normalize_product(
    request: Request,
    payload: NormalizeRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        return await extract_product_data(payload.text, payload.source_url)
```

Acrescentar aos imports do arquivo:

```python
from fastapi import Request
from app.core.rate_limit import limiter
```

⚠️ O `slowapi` exige que o parâmetro se chame exatamente `request` e seja do tipo `Request`. Por isso o corpo antigo, que se chamava `request`, foi renomeado para `payload`.

- [ ] **Passo 7: Limitar o `verify-password`**

Em `ArchSmart-api/app/api/endpoints/public.py`, no endpoint `verify_presentation_password`, adicionar o decorador e o parâmetro:

```python
@router.post("/presentations/{presentation_uuid}/verify-password")
@limiter.limit("10/minute")
def verify_presentation_password(
    request: Request,
    presentation_uuid: str,
    payload: VerifyPasswordRequest,
    db: Session = Depends(get_db),
):
```

Acrescentar aos imports: `from fastapi import Request` e `from app.core.rate_limit import limiter`.

- [ ] **Passo 8: Rodar e verificar que passam**

Run: `cd ArchSmart-api && pytest tests/ -v`
Expected: todos passam.

- [ ] **Passo 9: Commit**

```bash
git add ArchSmart-api/app/core/rate_limit.py ArchSmart-api/app/main.py ArchSmart-api/app/api/routers/product_router.py ArchSmart-api/app/api/endpoints/public.py ArchSmart-api/tests/isolation/test_public_endpoints.py
git commit -m "fix: fecha os endpoints sem autenticacao e limita forca bruta (P0-3)

- remove GET /products/seed-captured, que escrevia no banco sem autenticacao
- exige sessao em POST /products/normalize, que chamava o Gemini aberto na
  internet e queimava o orcamento de IA
- limita /verify-password, cuja senha do portal era forca-brutavel

O registro de custo de IA (Art. 9) vem na Secao 7."
```

---

### Tarefa 6: Registrar o resultado e atualizar o estado

**Files:**
- Create: `ArchSmart-api/tests/isolation/README.md`
- Modify: `spec-kit-2/auditoria-codigo-2026-08-23.md`

- [ ] **Passo 1: Documentar a suíte de isolamento**

`ArchSmart-api/tests/isolation/README.md`:

```markdown
# Testes de isolamento entre contas

Cada teste aqui prova que um recurso da conta A não é alcançável pela conta B.
São regressões de falhas que estiveram em produção (auditoria de 23/08/2026).

## Como rodar

```bash
docker compose -f docker-compose.test.yml up -d --wait
pytest tests/isolation/ -v
```

## Regra

Endpoint novo que devolve ou altera dado de conta entra aqui **junto com o
endpoint**, não depois. Na Seção 4 este diretório ganha um teste genérico que
percorre todas as rotas registradas automaticamente.

Resposta correta para acesso indevido é **404**, nunca 403 — 403 confirma que
o recurso existe.
```

- [ ] **Passo 2: Marcar os achados como corrigidos na auditoria**

Em `spec-kit-2/auditoria-codigo-2026-08-23.md`, acrescentar imediatamente abaixo do título de cada um dos três achados P0 (`### P0-1`, `### P0-2`, `### P0-3`):

```markdown
> ✅ **Corrigido pela Seção 1 do plano de reestruturação.** Regressão coberta em `ArchSmart-api/tests/isolation/`.
```

- [ ] **Passo 3: Rodar a suíte inteira uma última vez**

Run: `cd ArchSmart-api && pytest tests/ -v`
Expected: todos passam. Anote o número total de testes — ele vai para o commit.

- [ ] **Passo 4: Commit**

```bash
git add ArchSmart-api/tests/isolation/README.md spec-kit-2/auditoria-codigo-2026-08-23.md
git commit -m "docs: registra as correcoes P0 e a regra da suite de isolamento"
```

---

## Verificação final da Seção 1

Antes de declarar a seção concluída, rodar e conferir cada item:

- [ ] `docker compose -f ArchSmart-api/docker-compose.test.yml up -d --wait` → healthy
- [ ] `cd ArchSmart-api && pytest tests/ -v` → tudo verde
- [ ] `grep -rn "TODO: Verify project constraints\|TODO: Auth check" ArchSmart-api/app` → sem resultado
- [ ] `grep -rn "seed-captured" ArchSmart-api/app` → sem resultado
- [ ] Os 13 endpoints do achado estão cobertos: 6 em `test_budgets_isolation.py`, 5 em `test_portal_access.py`, 2 em `test_public_endpoints.py`

**O que esta seção deliberadamente NÃO faz:** não cria `RequestContext`, não cria `ScopedRepository`, não move arquivo de lugar, não mexe no frontend, não registra custo de IA. Tudo isso tem seção própria. Misturar aqui é o que impede saber se a correção de segurança funcionou.
