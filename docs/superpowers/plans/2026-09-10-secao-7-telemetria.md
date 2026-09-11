# Seção 7 — Telemetria: plano de execução

> **Para quem executa com agente:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixas (`- [ ]`) para acompanhamento.

**Objetivo:** dar à plataforma o esqueleto de telemetria — eventos de produto e
custo de IA — antes que a Seção 8 comece a migrar as telas, para que cada tela
migrada nasça medida.

**Arquitetura:** duas tabelas novas com regras de gravação **opostas**:
`product_events` grava dentro de um SAVEPOINT e engole erro (telemetria não
derruba requisição); `ai_usage_logs` grava na transação da resposta e falha
junto com ela (Art. 9 — não se serve resposta de IA sem registrar o custo). No
frontend, `useTrack()` manda eventos por `lib/api/`, e o `screen_viewed`
automático tira `load_ms` do cache do react-query e `is_empty` do
`QueryBoundary`.

**Stack:** FastAPI + SQLAlchemy (sessão síncrona) + Alembic + Postgres 17;
Next.js App Router + TanStack Query v5 + vitest.

**Spec:** [`docs/superpowers/specs/2026-09-10-secao-7-telemetria-design.md`](../specs/2026-09-10-secao-7-telemetria-design.md)

---

## Restrições globais

Valem para **todas** as tarefas. Copiadas da spec e do `CLAUDE.md`:

- **Branch:** `secao-7-telemetria`, criada de `develop`. Merge em `develop` no
  fim da seção.
- **Art. 1 — nenhum `account_id` literal.** Toda leitura e escrita passa por
  `ScopedRepository`; a identidade vem do `RequestContext`, montado no servidor.
- **Art. 4 — nenhuma URL, chave ou host fixo.** Front usa
  `process.env.NEXT_PUBLIC_API_URL` (já embrulhado por `lib/api/core.ts`);
  backend usa `app/core/config.py`.
- **Art. 7 — nenhuma cor literal em classe utilitária.**
- **Art. 8 — a marca é "Arq Smart"**, duas palavras, com Q. Zero ocorrência de
  `ArchSmart`, `Ark Smart` ou `Ecowe` em código, copy ou comentário.
  `ArchSmart-api`/`ArchSmart-web` são nome de diretório, não grafia da marca.
- **Nunca rode `alembic upgrade head` à mão** contra staging ou produção. A
  migração roda no `CMD` do contêiner (ADR 0007).
- **Confira o `.env` antes de rodar qualquer script** que fale com o banco:
  `ArchSmart-api/.env` tem staging e produção, com produção comentada. A suíte
  roda contra o Postgres do `docker-compose.test.yml`, não contra ambiente.
- **Número afirmado sem medição é número errado.** Ao afirmar um número, cole o
  comando que o produziu.
- **Nada de "é esperado que falhe".** Se um comando reportar falha, é falha.
- Comentários e docstrings **em português**, sem acento em código Python novo
  quando o arquivo vizinho também não usa (siga o arquivo que você está
  editando).

**Como rodar os testes** (os mesmos comandos do CI):

```bash
# Backend
cd ArchSmart-api
.\venv\Scripts\Activate.ps1
docker compose -f docker-compose.test.yml up -d --wait
pytest

# Frontend
cd ArchSmart-web
npm run typecheck
npm test

# Repositório (sem venv, só biblioteca padrão)
python tools/catraca.py
python tools/progresso.py --check
python tools/checa_links.py
cd tools; python -m unittest discover -p "test_*.py"
```

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `docs/dev/medicoes/2026-09-10-verificacao-visual-secao-6.md` | o que os olhos viram nas três mudanças da Seção 6 | 1 |
| `ArchSmart-api/app/models/all_models.py` | + `ProductEvent`, `AiUsageLog` | 2 |
| `ArchSmart-api/alembic/versions/<hash>_telemetria.py` | as duas tabelas e seus índices | 2 |
| `ArchSmart-api/app/services/telemetry_service.py` | `track()` — grava evento em savepoint, engole erro | 2 |
| `ArchSmart-api/tests/services/test_telemetria.py` | prova do savepoint e do escopo | 2 |
| `ArchSmart-api/tests/test_colunas_de_escopo.py` | contagem de tabelas de dado: 21 → 23 | 2 |
| `docs/dev/modulos/telemetry_service.md` | doc do módulo (catraca) | 2 |
| `ArchSmart-api/app/core/precos_ia.py` | preço por milhão de tokens, por modelo; `custo_usd()` | 3 |
| `ArchSmart-api/app/services/ai_service.py` | passa a devolver `(dados, UsoIA)` | 3 |
| `ArchSmart-api/app/api/routers/product_router.py` | grava `AiUsageLog` na transação da resposta | 3 |
| `ArchSmart-api/tests/services/test_uso_de_ia.py` | custo, tokens e `usage_metadata` ausente | 3 |
| `docs/dev/modulos/ai_service.md` | doc do módulo (catraca: 2 → 1) | 3 |
| `ArchSmart-api/app/api/endpoints/telemetry.py` | `POST /api/telemetry/events` | 4 |
| `ArchSmart-api/app/schemas/telemetry_schema.py` | contrato do lote | 4 |
| `ArchSmart-api/app/main.py` | monta o router | 4 |
| `ArchSmart-api/tests/api/test_telemetria.py` | `account_id` forjado ignorado, lote, anônimo | 4 |
| `ArchSmart-web/src/lib/api/telemetry.ts` | envio fire-and-forget | 5 |
| `ArchSmart-web/src/features/telemetry/{types,api,hooks}.ts` | tipos, envio e `useTrack()` | 5 |
| `ArchSmart-web/src/features/telemetry/contexto.tsx` | o canal do `is_empty`, do boundary até a telemetria | 5 |
| `ArchSmart-web/src/features/telemetry/TelemetriaDeTela.tsx` | o `screen_viewed` automático, uma vez por navegação | 5 |
| `ArchSmart-web/src/components/ui/query-boundary.tsx` | reporta `vazio` para a telemetria | 5 |
| `ArchSmart-web/src/app/(dashboard)/layout.tsx` | monta o provider, dentro do `QueryProvider` | 5 |
| `ArchSmart-web/src/__tests__/telemetry.test.tsx` | dedupe, `medido_ate`, `is_empty` nulo | 5 |
| `docs/dev/modulos/telemetry.md` | doc do módulo de front (catraca) | 5 |

**Por que `created_by` e não `user_id`:** é a convenção das 21 tabelas de dado
desde a Seção 4, é o que `ScopedRepository.create()` preenche do contexto, e é o
que `test_colunas_de_escopo.py` exige. Ter as duas colunas seria duplicar
significado. Ver a spec, seção "Modelo de dados".

---

## Tarefa 0: abrir a branch

- [ ] **Passo 1: criar a branch a partir de `develop` atualizado**

```bash
git checkout develop
git pull
git checkout -b secao-7-telemetria
```

- [ ] **Passo 2: confirmar que os portões partem verdes**

```bash
python tools/catraca.py
python tools/progresso.py --check
python tools/checa_links.py
```

Esperado: os três com exit 0, catraca com 9 medidas iguais ao baseline (a de
`eslint_erros` sai como PULADA fora do CI — é esperado e está impresso no
próprio comando, não é falha).

---

## Tarefa 1: verificação visual do que a Seção 6 mudou

Herdada da Seção 6 e decidida por Thiago em 10/09/2026. **Não há teste visual
neste repositório**: `tsc`, `vitest` e a catraca ficam verdes enquanto uma tela
muda de aparência. Abrir e olhar é a única verificação possível.

**Files:**
- Create: `docs/dev/medicoes/2026-09-10-verificacao-visual-secao-6.md`

**Interfaces:**
- Consumes: nada.
- Produces: nada em código. Produz o registro escrito que fecha a pendência.

**O que precisa ser olhado** (medido em 10/09/2026):

| Mudança | Onde | Como saber se está certo |
|---|---|---|
| `DropdownMenuItem` com `min-h-11` | 14 itens em 6 arquivos | altura renderizada ≥ 44px |
| botão de fechar do toast destrutivo com token | todo toast de erro | o X é legível sobre o fundo destrutivo |
| `Skeleton` com `aria-hidden="true"` | todo carregamento | leitor de tela não anuncia o esqueleto |

Os 6 arquivos com `DropdownMenuItem` — 5 telas mais a galeria:

```
ArchSmart-web/src/app/(dashboard)/finance/components/FinancialTable.tsx
ArchSmart-web/src/app/dev/componentes/galeria.tsx
ArchSmart-web/src/components/layout/app-shell/Header.tsx
ArchSmart-web/src/components/library/ProductCard.tsx
ArchSmart-web/src/components/projects/environments/EnvironmentCard.tsx
ArchSmart-web/src/components/theme-toggle.tsx
```

- [ ] **Passo 1: subir o front em desenvolvimento**

```bash
cd ArchSmart-web
npm run dev
```

A galeria só existe em desenvolvimento — em produção ela chama `notFound()`.

- [ ] **Passo 2: abrir a galeria e olhar**

Abra `http://localhost:3000/dev/componentes`. Percorra a página inteira, nos
**dois temas** (o alternador está na própria galeria) e nas **duas larguras**
(390px e 1440px — use o modo dispositivo do navegador).

- [ ] **Passo 3: medir o alvo de toque, em vez de julgar no olho**

Com o menu aberto, no console do navegador:

```js
const itens = document.querySelectorAll('[role="menuitem"]')
console.log([...itens].map((i) => i.getBoundingClientRect().height))
```

Esperado: todos ≥ 44. Anote os números que saírem — são a prova, não a
impressão.

- [ ] **Passo 4: olhar o toast destrutivo e o esqueleto**

Na galeria, dispare um toast destrutivo e confirme que o X de fechar é legível.
Para o `Skeleton`, confirme no inspetor que o elemento tem
`aria-hidden="true"`.

- [ ] **Passo 5: abrir as 5 telas reais**

Cabeçalho (qualquer tela do dashboard), card de produto (Biblioteca), tabela
financeira (Financeiro), card de ambiente (dentro de um projeto) e o alternador
de tema. Abra o menu de cada um e confirme que nada ficou cortado, sobreposto ou
fora da tela — menu comprido cresce junto com o item.

- [ ] **Passo 6: escrever o que se viu**

Crie `docs/dev/medicoes/2026-09-10-verificacao-visual-secao-6.md` com: a data, o
que foi aberto, os números de altura medidos no Passo 3, e **o que estava
errado, se algo estava**. Se nada estava errado, diga isso — "olhei e está
certo" é um resultado, e é o registro que fecha a pendência.

Se algo **estiver** errado: registre, e trate como defeito da Seção 6. Não
conserte de passagem dentro desta tarefa — abra a correção no próprio commit,
para que o histórico diga o que causou o quê.

- [ ] **Passo 7: commit**

```bash
git add docs/dev/medicoes/2026-09-10-verificacao-visual-secao-6.md
git commit -m "docs(secao-7): verificacao visual do que a Secao 6 mudou"
```

- [ ] **Passo 8: marcar a caixa e recalcular o progresso**

Marque a primeira caixa da Seção 7 no `PROGRESS.md` (`- [x] Verificação
visual...`), depois:

```bash
python tools/progresso.py --write
python tools/progresso.py --check
git add PROGRESS.md
git commit -m "docs(secao-7): marca a Tarefa 1"
```

---

## Tarefa 2: tabelas, migração e `track()`

**Files:**
- Modify: `ArchSmart-api/app/models/all_models.py` (fim do arquivo, depois de `Document`)
- Modify: `ArchSmart-api/app/models/all_models.py:4` (imports)
- Create: `ArchSmart-api/app/services/telemetry_service.py`
- Create: `ArchSmart-api/alembic/versions/<hash>_telemetria.py` (gerado)
- Create: `ArchSmart-api/tests/services/test_telemetria.py`
- Modify: `ArchSmart-api/tests/test_colunas_de_escopo.py` (a contagem 21 → 23)
- Create: `docs/dev/modulos/telemetry_service.md`

**Interfaces:**
- Consumes: `ScopedRepository` (`app/db/repository.py`) — `repo.db`, `repo.ctx`,
  `repo.create(model, **campos)`, que injeta `account_id` e `created_by` do
  contexto e **descarta** qualquer um dos dois passado em `campos`.
- Produces:
  - `ProductEvent` e `AiUsageLog` em `app.models.all_models`
  - `track(ctx: ScopedRepository, evento: str, propriedades: Mapping[str, Any] | None = None) -> None`
    em `app.services.telemetry_service`

- [ ] **Passo 1: conferir para qual banco o `.env` aponta**

```bash
cd ArchSmart-api
grep -n "DATABASE_URL" .env
```

Confirme que a linha **ativa** (sem `#`) é a de staging ou a de teste local, e
que a de produção está comentada. Isto não é cerimônia: a suíte e os scripts
leem `settings`, e um `.env` apontado para o lugar errado escreve num banco
real. Se estiver na dúvida, pare e pergunte.

- [ ] **Passo 2: subir o Postgres de teste**

```bash
docker compose -f docker-compose.test.yml up -d --wait
```

- [ ] **Passo 3: escrever o teste que falha**

Crie `ArchSmart-api/tests/services/test_telemetria.py`:

```python
"""
Telemetria: escopo e isolamento de falha.

O segundo teste e o que importa. Sem o SAVEPOINT dentro de `track`, um INSERT
que estoura invalida a transacao inteira do SQLAlchemy, e a requisicao que a
telemetria so deveria observar morre com PendingRollbackError no proximo
flush. O teste prova que a sessao continua utilizavel depois da falha.
"""
from sqlalchemy.orm import Session

from app.db.repository import ScopedRepository
from app.models.all_models import ProductEvent, Project
from app.services.telemetry_service import track
from tests.conftest import _contexto_de, criar_projeto


def _repo(db: Session, usuario) -> ScopedRepository:
    return ScopedRepository(db, _contexto_de(db, usuario))


def test_track_grava_o_evento_na_conta_da_sessao(db: Session, conta_a):
    conta, usuario = conta_a

    track(_repo(db, usuario), "screen_viewed", {"screen": "/library"})
    db.flush()

    evento = db.query(ProductEvent).one()
    assert evento.name == "screen_viewed"
    assert evento.properties == {"screen": "/library"}
    assert evento.account_id == conta.id
    assert evento.created_by == usuario.id


def test_track_sem_propriedades_grava_objeto_vazio(db: Session, conta_a):
    _, usuario = conta_a

    track(_repo(db, usuario), "app_opened")
    db.flush()

    assert db.query(ProductEvent).one().properties == {}


def test_track_que_estoura_nao_derruba_a_transacao_de_fora(db: Session, conta_a):
    conta, usuario = conta_a

    # `name` e NOT NULL: passar None faz o INSERT do savepoint estourar.
    track(_repo(db, usuario), None, {"qualquer": "coisa"})

    # A prova: a sessao continua utilizavel depois da falha da telemetria.
    projeto = criar_projeto(db, conta, "Projeto depois da falha")
    db.flush()

    assert db.query(Project).filter(Project.id == projeto.id).one() is not None
    assert db.query(ProductEvent).count() == 0
```

- [ ] **Passo 4: rodar e ver falhar**

```bash
pytest tests/services/test_telemetria.py -v
```

Esperado: FAIL com `ImportError` / `cannot import name 'ProductEvent'`.

- [ ] **Passo 5: acrescentar os imports que faltam em `all_models.py`**

Em `ArchSmart-api/app/models/all_models.py`, linha 4, acrescente `Numeric` e
`text` à lista do `from sqlalchemy import ...`, e uma linha nova para o JSONB:

```python
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Float, Integer, JSON, Date, Text, Enum, func, Index, Numeric, text
from sqlalchemy.dialects.postgresql import JSONB
```

`JSONB` e não `JSON`: a tabela de eventos é feita para ser consultada por
propriedade, e o `jsonb` é o tipo que indexa. O dialeto já aparece nas
migrações deste repositório (`c7403ff445fa`), então não é precedente novo.

- [ ] **Passo 6: escrever os dois modelos**

No fim de `ArchSmart-api/app/models/all_models.py`, depois de `Document`:

```python
class ProductEvent(Base):
    """
    Evento de produto: uma linha por acontecimento observado.

    `created_by` e a coluna de usuario da casa — e o que ScopedRepository.create
    preenche do contexto. Nullable porque evento de sistema nao tem usuario.
    """
    __tablename__ = "product_events"
    __table_args__ = (
        Index("ix_product_events_account_created", "account_id", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    properties = Column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict
    )
    created_at = Column(
        DateTime, nullable=False, server_default=func.now(), default=datetime.utcnow
    )


class AiUsageLog(Base):
    """
    Custo de uma chamada de IA, gravado na MESMA transacao da resposta (Art. 9).

    `cost_usd` e nullable de proposito: modelo fora da tabela de precos grava os
    tokens com custo nulo. Perder a contagem de tokens e pior que nao saber o
    custo de uma linha.

    `input_tokens`/`output_tokens` existem porque o provedor cobra entrada e
    saida a precos diferentes; `token_count` e a soma, que a spec pede.
    """
    __tablename__ = "ai_usage_logs"
    __table_args__ = (
        Index("ix_ai_usage_logs_account_created", "account_id", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    model_name = Column(String, nullable=False)
    input_tokens = Column(Integer, nullable=False)
    output_tokens = Column(Integer, nullable=False)
    token_count = Column(Integer, nullable=False)
    # Numeric, nao Float: dinheiro nao anda em ponto flutuante.
    cost_usd = Column(Numeric(10, 6), nullable=True)
    latency_ms = Column(Integer, nullable=False)
    feature = Column(String, nullable=False)
    created_at = Column(
        DateTime, nullable=False, server_default=func.now(), default=datetime.utcnow
    )
```

- [ ] **Passo 7: escrever o serviço**

Crie `ArchSmart-api/app/services/telemetry_service.py`:

```python
"""
Telemetria de produto.

`track` grava dentro de um SAVEPOINT e engole qualquer erro. A spec pede que
falha de telemetria nao derrube a requisicao — e sem o savepoint isso nao se
cumpre sozinho: um INSERT que estoura invalida a transacao inteira do
SQLAlchemy, e a requisicao que a telemetria so deveria observar morre junto,
no proximo flush.

Savepoint, e nao sessao nova: DATABASE_URL aponta para o host pooler na 5432
justamente porque estado de sessao vaza entre clientes, e abrir conexao por
evento e a ultima coisa que se quer ali.
"""
import logging
from typing import Any, Mapping

from app.db.repository import ScopedRepository
from app.models.all_models import ProductEvent

logger = logging.getLogger(__name__)


def track(
    ctx: ScopedRepository,
    evento: str,
    propriedades: Mapping[str, Any] | None = None,
) -> None:
    """
    Grava um evento de produto na conta da sessao.

    `ctx` e o ScopedRepository: e ele que carrega a identidade resolvida no
    servidor. `account_id` e `created_by` saem dali, nunca de argumento.

    Nunca levanta. Um erro aqui vira log e o evento e descartado.
    """
    try:
        with ctx.db.begin_nested():
            ctx.create(
                ProductEvent, name=evento, properties=dict(propriedades or {})
            )
    except Exception:
        logger.warning(
            "telemetria: evento %r descartado", evento, exc_info=True
        )
```

- [ ] **Passo 8: gerar a migração**

```bash
alembic revision --autogenerate -m "telemetria: product_events e ai_usage_logs"
```

- [ ] **Passo 9: revisar a migração gerada, à mão**

Abra o arquivo criado em `alembic/versions/`. Confirme:

1. `down_revision` é `'9b0c34de353b'` (o head de hoje — confira com
   `alembic heads`).
2. O `upgrade()` cria **só** as duas tabelas e os dois índices. Se o
   autogenerate tiver incluído qualquer outra coisa, **apague** — é drift entre
   modelo e banco que não é desta tarefa.
3. O `downgrade()` tem `drop_index` + `drop_table` das duas, e **nenhum**
   `op.drop_constraint(None, ...)` — essa é a forma que estoura em execução, e
   quatro migrações antigas já sofrem dela.

O `downgrade()` deve ficar assim:

```python
def downgrade() -> None:
    op.drop_index("ix_ai_usage_logs_account_created", table_name="ai_usage_logs")
    op.drop_table("ai_usage_logs")
    op.drop_index("ix_product_events_account_created", table_name="product_events")
    op.drop_table("product_events")
```

- [ ] **Passo 10: provar que a migração sobe e desce**

```bash
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

Esperado: os três sem erro. Este é o passo que a regra da casa cobra — "todo
`downgrade()` não vazio" nunca significou "funciona", e é assim que se descobre.

> Isto roda contra o Postgres **do Docker**, nunca contra staging ou produção.
> Se `DATABASE_URL` estiver apontada para ambiente, pare (ver Passo 1).

- [ ] **Passo 11: atualizar a contagem de tabelas de dado**

Em `ArchSmart-api/tests/test_colunas_de_escopo.py`, a asserção que trava a
contagem:

```python
def test_sao_vinte_e_tres_tabelas_de_dado():
    """
    Trava a contagem. Se este teste falhar, uma tabela foi adicionada ou
    removida — atualize o numero DEPOIS de decidir o escopo dela, nunca antes.

    21 -> 23 na Secao 7: product_events e ai_usage_logs. As duas tem dono
    (account_id + created_by), entao nao entram em CATALOGO_GLOBAL.
    """
    assert len(tabelas_de_dado()) == 23
```

Renomeie a função junto com o número — um teste chamado
`test_sao_vinte_e_uma...` que afirma 23 é a próxima afirmação errada deste
repositório.

- [ ] **Passo 12: rodar os testes e ver passar**

```bash
pytest tests/services/test_telemetria.py tests/test_colunas_de_escopo.py -v
```

Esperado: PASS em todos.

- [ ] **Passo 13: rodar a suíte inteira**

```bash
pytest
```

Esperado: nenhuma falha. Se `test_indices.py` ou `test_receita_migracoes.py`
reclamarem, leia o que eles cobram e atenda — são as redes que existem
justamente para tabela nova.

- [ ] **Passo 14: escrever a doc do módulo**

Crie `docs/dev/modulos/telemetry_service.md`, seguindo a forma de
`docs/dev/modulos/financial_service.md`: o que o módulo é, o que expõe (tabela
de símbolos), do que depende, e **por que o savepoint existe**. A catraca conta
`app/services/*.py` sem `.md` de mesmo nome — sem esta doc, `modulos_sem_doc`
sobe de 2 para 3.

- [ ] **Passo 15: conferir a catraca**

```bash
cd ../  # raiz do repositorio
python tools/catraca.py
```

Esperado: `modulos_sem_doc: 2, igual ao baseline` (o novo serviço nasce
documentado, então a medida não se mexe nesta tarefa; quem a derruba para 1 é a
Tarefa 3).

- [ ] **Passo 16: commit**

```bash
git add ArchSmart-api/app/models/all_models.py \
        ArchSmart-api/app/services/telemetry_service.py \
        ArchSmart-api/alembic/versions/ \
        ArchSmart-api/tests/services/test_telemetria.py \
        ArchSmart-api/tests/test_colunas_de_escopo.py \
        docs/dev/modulos/telemetry_service.md
git commit -m "feat(telemetria): product_events, ai_usage_logs e track() em savepoint"
```

- [ ] **Passo 17: marcar a caixa**

Marque `- [x] Tabela product_events e serviço track(...)` no `PROGRESS.md`,
depois `python tools/progresso.py --write && python tools/progresso.py --check`,
e commite.

---

## Tarefa 3: `ai_usage_logs` no caminho da IA

**Files:**
- Create: `ArchSmart-api/app/core/precos_ia.py`
- Modify: `ArchSmart-api/app/services/ai_service.py:148-183` (`_generate`) e `:254` (`extract_product_data`)
- Modify: `ArchSmart-api/app/api/routers/product_router.py:115-127` (`normalize_product`)
- Create: `ArchSmart-api/tests/services/test_uso_de_ia.py`
- Create: `docs/dev/modulos/ai_service.md`

**Interfaces:**
- Consumes: `AiUsageLog` (Tarefa 2); `ScopedRepository.create` e `repo.db`.
- Produces:
  - `PrecoPorMilhao(entrada: Decimal, saida: Decimal)` e
    `custo_usd(modelo: str, input_tokens: int, output_tokens: int) -> Decimal | None`
    em `app.core.precos_ia`
  - `UsoIA(model_name: str, input_tokens: int, output_tokens: int, latency_ms: int)`
    em `app.services.ai_service`
  - `extract_product_data(raw_text, source_url=None) -> tuple[Dict[str, Any], UsoIA]`

- [ ] **Passo 1: buscar os preços oficiais — e parar se não achar**

Abra a tabela oficial de preços do Gemini (`https://ai.google.dev/pricing`) e
anote, para `gemini-2.5-flash`, o preço por **milhão de tokens** de entrada e de
saída, além da data da consulta e da URL.

**Não estime, não arredonde de memória, não use preço de outro modelo.** Se a
página não der os dois números com clareza, **pare e pergunte** — é a decisão de
fronteira nº 3 da spec, e um preço inventado contamina toda a coluna
`cost_usd` sem emitir erro nenhum.

- [ ] **Passo 2: escrever o teste que falha**

Crie `ArchSmart-api/tests/services/test_uso_de_ia.py`:

```python
"""
Custo de IA: calculo, modelo desconhecido e metadata ausente.

O caso do modelo desconhecido e o que importa: ele prova que a linha e gravada
com os tokens mesmo sem preco. Perder a contagem de tokens e pior que nao saber
o custo daquela linha.
"""
from decimal import Decimal

import pytest

from app.core.precos_ia import PRECOS, custo_usd


def test_custo_soma_entrada_e_saida_com_precos_diferentes():
    preco = PRECOS["gemini-2.5-flash"]

    # 1 milhao de cada: o custo e exatamente a soma dos dois precos.
    assert custo_usd("gemini-2.5-flash", 1_000_000, 1_000_000) == (
        preco.entrada + preco.saida
    )


def test_custo_e_proporcional_ao_numero_de_tokens():
    inteiro = custo_usd("gemini-2.5-flash", 1_000_000, 0)
    metade = custo_usd("gemini-2.5-flash", 500_000, 0)

    assert metade == inteiro / 2


def test_entrada_e_saida_nao_tem_o_mesmo_preco():
    """
    Se este teste falhar, ou o provedor unificou os precos, ou alguem copiou o
    mesmo numero nas duas colunas. Nos dois casos, va olhar a tabela oficial
    antes de mexer aqui.
    """
    preco = PRECOS["gemini-2.5-flash"]
    assert preco.entrada != preco.saida


def test_modelo_desconhecido_devolve_none_em_vez_de_estourar():
    assert custo_usd("modelo-que-nao-existe", 1000, 1000) is None


def test_custo_e_decimal_nao_float():
    """Dinheiro nao anda em ponto flutuante."""
    assert isinstance(custo_usd("gemini-2.5-flash", 1000, 1000), Decimal)
```

- [ ] **Passo 3: rodar e ver falhar**

```bash
pytest tests/services/test_uso_de_ia.py -v
```

Esperado: FAIL com `ModuleNotFoundError: No module named 'app.core.precos_ia'`.

- [ ] **Passo 4: escrever a tabela de preços**

Crie `ArchSmart-api/app/core/precos_ia.py`. Substitua `<ENTRADA>`, `<SAIDA>`,
`<URL>` e `<DATA>` pelos valores do Passo 1 — o arquivo não fica com
marcador nenhum:

```python
"""
Preco por milhao de tokens, por modelo.

Fonte: <URL>, consultada em <DATA>.

O custo e calculado e CONGELADO no momento da gravacao (ver AiUsageLog), nunca
recalculado depois: quando o preco mudar, o custo historico continua sendo o
que de fato se pagou.

Modelo que nao estiver aqui devolve None, e a linha e gravada com os tokens e
sem custo. Nao invente preco: perder a contagem de tokens e pior que nao saber
o custo de uma linha, e as duas coisas sao melhores que um numero errado.
"""
from decimal import Decimal
from typing import NamedTuple


class PrecoPorMilhao(NamedTuple):
    entrada: Decimal
    saida: Decimal


PRECOS: dict[str, PrecoPorMilhao] = {
    "gemini-2.5-flash": PrecoPorMilhao(
        entrada=Decimal("<ENTRADA>"),
        saida=Decimal("<SAIDA>"),
    ),
}

UM_MILHAO = Decimal(1_000_000)


def custo_usd(
    modelo: str, input_tokens: int, output_tokens: int
) -> Decimal | None:
    """Custo em USD, ou None se o modelo nao estiver na tabela."""
    preco = PRECOS.get(modelo)
    if preco is None:
        return None
    return (
        Decimal(input_tokens) * preco.entrada
        + Decimal(output_tokens) * preco.saida
    ) / UM_MILHAO
```

- [ ] **Passo 5: rodar e ver passar**

```bash
pytest tests/services/test_uso_de_ia.py -v
```

Esperado: PASS nos 5.

- [ ] **Passo 6: escrever o teste do `UsoIA` (o que falha em seguida)**

Acrescente a `tests/services/test_uso_de_ia.py`:

```python
from app.services.ai_service import UsoIA, _uso_de


class _MetadataFalsa:
    def __init__(self, prompt, candidates):
        self.prompt_token_count = prompt
        self.candidates_token_count = candidates


class _RespostaFalsa:
    def __init__(self, metadata):
        self.usage_metadata = metadata


def test_uso_le_os_tokens_da_resposta():
    resposta = _RespostaFalsa(_MetadataFalsa(prompt=120, candidates=45))

    uso = _uso_de(resposta, latency_ms=800)

    assert uso == UsoIA(
        model_name="gemini-2.5-flash",
        input_tokens=120,
        output_tokens=45,
        latency_ms=800,
    )


def test_uso_sem_metadata_conta_zero_em_vez_de_estourar():
    """
    O caminho com url_context usa tool e nao JSON mode, e ja voltou sem
    usage_metadata. A linha e gravada com o que houver; o que nao se faz e
    descartar o registro nem inventar o numero.
    """
    uso = _uso_de(_RespostaFalsa(None), latency_ms=800)

    assert uso.input_tokens == 0
    assert uso.output_tokens == 0
    assert uso.latency_ms == 800
```

- [ ] **Passo 7: rodar e ver falhar**

```bash
pytest tests/services/test_uso_de_ia.py -v
```

Esperado: FAIL com `cannot import name 'UsoIA'`.

- [ ] **Passo 8: acrescentar `UsoIA` e `_uso_de` ao `ai_service.py`**

No topo de `ArchSmart-api/app/services/ai_service.py`, junto dos outros
imports, e depois da constante `GEMINI_MODEL`:

```python
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class UsoIA:
    """
    O que uma chamada de IA consumiu. Nao fala com banco: quem grava e o
    endpoint, que e quem tem o contexto da sessao (Art. 1).
    """
    model_name: str
    input_tokens: int
    output_tokens: int
    latency_ms: int


def _uso_de(response: Any, latency_ms: int) -> UsoIA:
    """
    Le usage_metadata da resposta. Tolerante de proposito: o caminho com
    url_context ja voltou sem metadata, e nesse caso o registro e gravado com
    zero em vez de descartado.
    """
    metadata = getattr(response, "usage_metadata", None)
    return UsoIA(
        model_name=GEMINI_MODEL,
        input_tokens=getattr(metadata, "prompt_token_count", None) or 0,
        output_tokens=getattr(metadata, "candidates_token_count", None) or 0,
        latency_ms=latency_ms,
    )
```

- [ ] **Passo 9: fazer `_generate` devolver o uso**

Em `ai_service.py`, `_generate` hoje devolve `Tuple[str, bool]`. Passe a
devolver `Tuple[str, bool, UsoIA]`, medindo a latência em volta da chamada:

```python
async def _generate(prompt: str, use_url_context: bool) -> Tuple[str, bool, UsoIA]:
    ...
    inicio = time.perf_counter()
    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
    except AIServiceError:
        raise
    except Exception as e:
        raise _classify(e) from e
    latency_ms = int((time.perf_counter() - inicio) * 1000)

    return (
        response.text or "",
        _url_retrieval_failed(response) if use_url_context else False,
        _uso_de(response, latency_ms),
    )
```

A latência mede **a tentativa que respondeu**. O `@retry` tenta até 3 vezes; as
que falharam não são cobradas, então contá-las inflaria o número sem
corresponder a custo nenhum.

- [ ] **Passo 10: fazer `extract_product_data` devolver `(dados, uso)`**

Leia `extract_product_data` (a partir da linha 254) e ajuste: onde ela hoje
desempacota `texto, bloqueado = await _generate(...)`, passe a desempacotar os
três valores, e devolva `(dados, uso)` em vez de `dados`. A assinatura fica:

```python
async def extract_product_data(
    raw_text: str, source_url: str | None = None
) -> Tuple[Dict[str, Any], UsoIA]:
```

Se a função tiver mais de um `return`, **todos** devolvem a tupla — inclusive
os caminhos de extração parcial (`source_blocked`).

- [ ] **Passo 11: gravar o log no endpoint**

Em `ArchSmart-api/app/api/routers/product_router.py`, `normalize_product`
(linha 115). Ele já recebe `repo: ScopedRepository = Depends(get_repo)`, que é
onde mora a identidade:

```python
@router.post("/normalize", response_model=NormalizeResponse)
@limiter.limit("20/minute")
async def normalize_product(
    request: Request,
    payload: NormalizeRequest,
    repo: ScopedRepository = Depends(get_repo),
):
    try:
        dados, uso = await extract_product_data(payload.text, payload.source_url)
    except tuple(AI_ERROR_RESPONSES) as e:
        status_code, detail = AI_ERROR_RESPONSES[type(e)]
        raise HTTPException(status_code=status_code, detail=detail)

    # Art. 9: na MESMA transacao da resposta, sem savepoint e sem engolir. Se o
    # registro de custo falhar, a requisicao falha — nao se serve resposta de IA
    # sem registrar o que ela custou. E o oposto de `track()`, de proposito.
    repo.create(
        AiUsageLog,
        model_name=uso.model_name,
        input_tokens=uso.input_tokens,
        output_tokens=uso.output_tokens,
        token_count=uso.input_tokens + uso.output_tokens,
        cost_usd=custo_usd(uso.model_name, uso.input_tokens, uso.output_tokens),
        latency_ms=uso.latency_ms,
        feature="product_normalize",
    )
    repo.db.commit()

    return dados
```

Acrescente aos imports do arquivo:

```python
from app.core.precos_ia import custo_usd
from app.models.all_models import AiUsageLog
```

Note que o `try` agora embrulha **só** a chamada de IA. Antes ele embrulhava o
`return` inteiro; deixá-lo assim faria um erro de gravação virar
"Erro de conexão com IA", que é exatamente o defeito que o dicionário
`AI_ERROR_RESPONSES` foi criado para corrigir.

- [ ] **Passo 12: rodar os testes**

```bash
pytest tests/services/test_uso_de_ia.py -v
pytest
```

Esperado: PASS. Testes existentes que chamam `extract_product_data` vão
quebrar por causa da tupla — conserte-os desempacotando os dois valores; é a
mudança de contrato desta tarefa, não um defeito.

- [ ] **Passo 13: escrever a doc do `ai_service`**

Crie `docs/dev/modulos/ai_service.md`, na forma de
`docs/dev/modulos/financial_service.md`. Cubra: o que o módulo faz, os dois
caminhos de geração (JSON mode e `url_context`, e por que não dá para combinar
tools com `response_mime_type` hoje), o dicionário de erros, o `@retry` que só
re-tenta o transitório, e o `UsoIA` — **que o módulo não grava**, porque não
tem sessão nem contexto.

- [ ] **Passo 14: conferir a catraca descer**

```bash
cd ../
python tools/catraca.py
```

Esperado: `modulos_sem_doc: 1` — **abaixo** do baseline de 2. Grave o número
novo, no mesmo commit que o fez descer:

```bash
python tools/catraca.py --atualizar
```

O script recusa gravar se alguma medida tiver piorado. Se ele recusar, leia o
que piorou antes de insistir.

- [ ] **Passo 15: commit**

```bash
git add ArchSmart-api/app/core/precos_ia.py \
        ArchSmart-api/app/services/ai_service.py \
        ArchSmart-api/app/api/routers/product_router.py \
        ArchSmart-api/tests/ \
        docs/dev/modulos/ai_service.md \
        tools/catraca.json
git commit -m "feat(telemetria): registra custo de IA na transacao da resposta"
```

- [ ] **Passo 16: marcar a caixa** — como na Tarefa 2.

---

## Tarefa 4: `POST /api/telemetry/events`

**Files:**
- Create: `ArchSmart-api/app/schemas/telemetry_schema.py`
- Create: `ArchSmart-api/app/api/endpoints/telemetry.py`
- Modify: `ArchSmart-api/app/main.py` (junto dos outros `include_router`)
- Create: `ArchSmart-api/tests/api/test_telemetria.py`

**Interfaces:**
- Consumes: `track()` (Tarefa 2); `get_repo`; `limiter` (o mesmo usado por
  `product_router`).
- Produces: `POST /api/telemetry/events`, corpo `{"eventos": [{"name": str,
  "properties": object}]}`, resposta `204 No Content`.

- [ ] **Passo 1: escrever o teste que falha**

Crie `ArchSmart-api/tests/api/test_telemetria.py`:

```python
"""
Endpoint de telemetria: escopo, lote e identidade.

O teste do account_id forjado e o que fecha a tarefa. Ele nao prova que o
endpoint "ignora um campo": prova que a conta gravada e a da SESSAO, mesmo
quando o corpo pede outra (Art. 1).
"""
from sqlalchemy.orm import Session

from app.models.all_models import ProductEvent


def test_evento_e_gravado_na_conta_da_sessao(db: Session, client_a, conta_a):
    conta, usuario = conta_a

    r = client_a.post(
        "/api/telemetry/events",
        json={"eventos": [{"name": "screen_viewed", "properties": {"screen": "/library"}}]},
    )

    assert r.status_code == 204
    evento = db.query(ProductEvent).one()
    assert evento.name == "screen_viewed"
    assert evento.account_id == conta.id
    assert evento.created_by == usuario.id


def test_account_id_forjado_no_corpo_e_ignorado(db: Session, client_a, conta_a, conta_b):
    minha_conta, _ = conta_a
    conta_alheia, _ = conta_b

    r = client_a.post(
        "/api/telemetry/events",
        json={
            "eventos": [
                {
                    "name": "screen_viewed",
                    "properties": {"screen": "/library"},
                    "account_id": str(conta_alheia.id),
                }
            ]
        },
    )

    assert r.status_code == 204
    evento = db.query(ProductEvent).one()
    assert evento.account_id == minha_conta.id
    assert evento.account_id != conta_alheia.id


def test_lote_grava_todos_os_eventos(db: Session, client_a):
    r = client_a.post(
        "/api/telemetry/events",
        json={
            "eventos": [
                {"name": "screen_viewed", "properties": {"screen": "/library"}},
                {"name": "screen_viewed", "properties": {"screen": "/dashboard"}},
            ]
        },
    )

    assert r.status_code == 204
    assert db.query(ProductEvent).count() == 2


def test_lote_vazio_nao_grava_nada(db: Session, client_a):
    r = client_a.post("/api/telemetry/events", json={"eventos": []})

    assert r.status_code == 204
    assert db.query(ProductEvent).count() == 0


def test_anonimo_nao_grava(db: Session, client_anon):
    r = client_anon.post(
        "/api/telemetry/events",
        json={"eventos": [{"name": "screen_viewed", "properties": {}}]},
    )

    assert r.status_code in (401, 403)
    assert db.query(ProductEvent).count() == 0
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
pytest tests/api/test_telemetria.py -v
```

Esperado: FAIL com 404 — a rota não existe.

- [ ] **Passo 3: escrever o schema**

Crie `ArchSmart-api/app/schemas/telemetry_schema.py`:

```python
"""
Contrato do endpoint de telemetria.

O corpo e SEMPRE um lote, desde o primeiro dia, mesmo que o cliente de hoje
mande um evento por vez: trocar de objeto para array depois significa mexer em
servidor, cliente e testes no mesmo commit.

Nao ha campo de conta nem de usuario. Nao e esquecimento: a identidade vem do
contexto do servidor (Art. 1), e um campo aqui daria a impressao de que o
cliente pode escolher.
"""
from typing import Any, Dict, List

from pydantic import BaseModel, Field


class EventoRecebido(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    properties: Dict[str, Any] = Field(default_factory=dict)


class LoteDeEventos(BaseModel):
    eventos: List[EventoRecebido] = Field(default_factory=list, max_length=50)
```

O `max_length=50` no lote existe para que um cliente com defeito não mande
dez mil eventos numa requisição. Não é regra de negócio — é limite de
transporte.

- [ ] **Passo 4: escrever o endpoint**

Crie `ArchSmart-api/app/api/endpoints/telemetry.py`:

```python
"""
POST /api/telemetry/events.

O prefixo `telemetry` existe porque `/api/events` ja significa Agenda. E nao ha
`/v1`: o ADR 0008 descartou esse prefixo para a reestruturacao inteira.
"""
from fastapi import APIRouter, Depends, Request, Response, status

from app.core.limiter import limiter
from app.db.repository import ScopedRepository, get_repo
from app.schemas.telemetry_schema import LoteDeEventos
from app.services.telemetry_service import track

router = APIRouter()


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")
def receber_eventos(
    request: Request,
    lote: LoteDeEventos,
    repo: ScopedRepository = Depends(get_repo),
) -> Response:
    for evento in lote.eventos:
        track(repo, evento.name, evento.properties)
    repo.db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

**Confirme de onde vem o `limiter`** antes de copiar o import: veja como
`product_router.py` o importa (`grep -n "limiter" ArchSmart-api/app/api/routers/product_router.py`)
e use o mesmo caminho. O `Request` no parâmetro é exigência do slowapi, não
enfeite.

- [ ] **Passo 5: montar o router**

Em `ArchSmart-api/app/main.py`, junto dos outros `include_router` (perto da
linha 69, onde está o de `events`):

```python
from app.api.endpoints import telemetry
app.include_router(telemetry.router, prefix="/api/telemetry", tags=["telemetry"])
```

- [ ] **Passo 6: rodar e ver passar**

```bash
pytest tests/api/test_telemetria.py -v
```

Esperado: PASS nos 5.

- [ ] **Passo 7: rodar a suíte inteira**

```bash
pytest
```

Esperado: nenhuma falha. Atenção a `tests/test_arquitetura.py` e aos testes
genéricos de isolamento — rota nova entra automaticamente na varredura deles.

- [ ] **Passo 8: commit**

```bash
git add ArchSmart-api/app/schemas/telemetry_schema.py \
        ArchSmart-api/app/api/endpoints/telemetry.py \
        ArchSmart-api/app/main.py \
        ArchSmart-api/tests/api/test_telemetria.py
git commit -m "feat(telemetria): POST /api/telemetry/events com identidade do contexto"
```

- [ ] **Passo 9: marcar a caixa** — como nas anteriores.

---

## Tarefa 5: `useTrack()` e `screen_viewed` automático

**Files:**
- Create: `ArchSmart-web/src/lib/api/telemetry.ts`
- Create: `ArchSmart-web/src/features/telemetry/types.ts`
- Create: `ArchSmart-web/src/features/telemetry/api.ts`
- Create: `ArchSmart-web/src/features/telemetry/hooks.ts`
- Create: `ArchSmart-web/src/features/telemetry/contexto.tsx`
- Create: `ArchSmart-web/src/features/telemetry/TelemetriaDeTela.tsx`
- Modify: `ArchSmart-web/src/components/ui/query-boundary.tsx`
- Modify: `ArchSmart-web/src/app/(dashboard)/layout.tsx`
- Create: `ArchSmart-web/src/__tests__/telemetry.test.tsx`
- Create: `docs/dev/modulos/telemetry.md`

**Interfaces:**
- Consumes: `api` de `lib/api/client.ts` (assinatura
  `<T>(path: string, req?: Requisicao) => Promise<T>`); `useQueryClient` do
  TanStack Query; `usePathname` do `next/navigation`.
- Produces:
  - `enviarEventos(eventos: EventoDeProduto[]): Promise<void>` em `lib/api/telemetry.ts`
  - `normalizarTela(caminho: string): string` e
    `decidirMedicao({ queriesAssentaram: boolean }): MedidoAte` em `types.ts`
  - `useTrack(): (nome: string, propriedades?: Record<string, unknown>) => void`
  - `VazioDaTelaProvider`, `useReportarVazio(): (vazio: boolean) => void` e
    `useVazioDaTela(): VazioDaTela | null` em `contexto.tsx`
  - `<TelemetriaDeTela />`, montado dentro do `QueryProvider` **e** do
    `VazioDaTelaProvider`

**Escopo:** só as **15 telas autenticadas** de `app/(dashboard)/`. As outras 19
são anônimas — sem sessão não há `account_id`, e o Art. 1 não admite um
inventado. Ver a spec, decisão 5.

- [ ] **Passo 1: escrever o teste que falha**

Crie `ArchSmart-web/src/__tests__/telemetry.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest"
import { normalizarTela, decidirMedicao } from "@/features/telemetry/types"

describe("normalizarTela", () => {
    it("troca uuid por [id]", () => {
        expect(normalizarTela("/projects/3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b")).toBe(
            "/projects/[id]"
        )
    })

    it("troca cada uuid de um caminho aninhado", () => {
        const caminho =
            "/projects/3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b/presentation/" +
            "8e7d6c5b-4a39-2817-6f5e-4d3c2b1a0987"
        expect(normalizarTela(caminho)).toBe("/projects/[id]/presentation/[id]")
    })

    it("deixa caminho sem id intacto", () => {
        expect(normalizarTela("/library")).toBe("/library")
    })
})

describe("decidirMedicao", () => {
    it("diz 'dados' quando alguma query da rota assentou", () => {
        expect(decidirMedicao({ queriesAssentaram: true })).toBe("dados")
    })

    it("diz 'pintura' quando a tela nao tem query nenhuma", () => {
        expect(decidirMedicao({ queriesAssentaram: false })).toBe("pintura")
    })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
cd ArchSmart-web
npx vitest run src/__tests__/telemetry.test.tsx
```

Esperado: FAIL — o módulo não existe.

- [ ] **Passo 3: escrever os tipos e as duas funções puras**

Crie `ArchSmart-web/src/features/telemetry/types.ts`:

```ts
/** O que o servidor recebe. Sem conta e sem usuario: quem decide isso e ele. */
export interface EventoDeProduto {
    name: string
    properties: Record<string, unknown>
}

/**
 * `dados` = o tempo ate os dados aparecerem, que e a metrica do orcamento de
 * performance. `pintura` = o tempo ate a tela pintar, que e outra coisa. As
 * duas moram na mesma coluna `load_ms`, e sem este campo quem consultar depois
 * soma laranja com maca.
 */
export type MedidoAte = "dados" | "pintura"

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * `/projects/<uuid>` vira `/projects/[id]`.
 *
 * Sem isso a cardinalidade da coluna `screen` explode — uma linha por projeto
 * visitado — e um id de dado do cliente vaza para dentro do nome do evento.
 */
export function normalizarTela(caminho: string): string {
    return caminho.replace(UUID, "[id]")
}

export function decidirMedicao(estado: { queriesAssentaram: boolean }): MedidoAte {
    return estado.queriesAssentaram ? "dados" : "pintura"
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/__tests__/telemetry.test.tsx
```

Esperado: PASS nos 5.

- [ ] **Passo 5: escrever o envio**

Crie `ArchSmart-web/src/lib/api/telemetry.ts`:

```ts
"use client"

import { api } from "@/lib/api/client"
import type { EventoDeProduto } from "@/features/telemetry/types"

/**
 * Manda o lote e engole qualquer erro.
 *
 * Fire-and-forget de verdade: esta funcao NUNCA rejeita. Telemetria que
 * derruba a tela do usuario e pior que telemetria nenhuma — e o modo de falha
 * de uma promise rejeitada aqui e um unhandled rejection que ninguem ve ate
 * virar erro no console de um cliente.
 *
 * Fica em lib/api/ porque e daqui que sai toda chamada de rede (Art. 4): o
 * cliente resolve base, token e erro num lugar so.
 */
export async function enviarEventos(eventos: EventoDeProduto[]): Promise<void> {
    if (eventos.length === 0) return
    try {
        await api<void>("/api/telemetry/events", {
            method: "POST",
            body: { eventos },
        })
    } catch {
        // Silencio proposital. Ver a docstring.
    }
}
```

- [ ] **Passo 6: escrever o hook e o componente**

Crie `ArchSmart-web/src/features/telemetry/api.ts`:

```ts
export { enviarEventos } from "@/lib/api/telemetry"
```

Crie `ArchSmart-web/src/features/telemetry/hooks.ts`:

```ts
"use client"

import { useCallback } from "react"
import { enviarEventos } from "./api"

/**
 * `track(nome, propriedades)` — estavel entre renders, entao pode entrar em
 * lista de dependencia de efeito sem re-disparar.
 *
 * Manda um evento por vez. O contrato do servidor ja e um lote; o buffer, se um
 * dia fizer falta, entra aqui sem mexer no servidor.
 */
export function useTrack() {
    return useCallback((nome: string, propriedades: Record<string, unknown> = {}) => {
        void enviarEventos([{ name: nome, properties: propriedades }])
    }, [])
}
```

Crie `ArchSmart-web/src/features/telemetry/contexto.tsx` — o canal por onde o
`QueryBoundary` conta que a tela está vazia:

```tsx
"use client"

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react"

/**
 * O canal do `is_empty`.
 *
 * Quem sabe se a tela esta vazia e o QueryBoundary, nao o shell. Este contexto
 * carrega esse unico dado da tela ate a telemetria, para que nenhuma tela
 * precise lembrar de reportar nada.
 *
 * Guardado em ref, e nao em state, DE PROPOSITO: um setState aqui re-renderiza
 * a arvore inteira do dashboard a cada boundary que decide, e o valor so e
 * lido uma vez, na hora de emitir o evento.
 */
interface VazioDaTela {
    reportar: (vazio: boolean) => void
    ler: () => boolean | null
    limpar: () => void
}

const Contexto = createContext<VazioDaTela | null>(null)

export function VazioDaTelaProvider({ children }: { children: ReactNode }) {
    const valor = useRef<boolean | null>(null)
    const canal = useMemo<VazioDaTela>(
        () => ({
            reportar: (vazio: boolean) => {
                valor.current = vazio
            },
            ler: () => valor.current,
            limpar: () => {
                valor.current = null
            },
        }),
        []
    )
    return <Contexto.Provider value={canal}>{children}</Contexto.Provider>
}

/**
 * O QueryBoundary chama isto.
 *
 * Fora do provider vira no-op: a galeria `/dev/componentes` usa o boundary e
 * NAO fica dentro de `(dashboard)`. Sem o no-op, abrir a galeria estouraria.
 */
export function useReportarVazio(): (vazio: boolean) => void {
    const canal = useContext(Contexto)
    return canal ? canal.reportar : () => {}
}

export function useVazioDaTela(): VazioDaTela | null {
    return useContext(Contexto)
}
```

Crie `ArchSmart-web/src/features/telemetry/TelemetriaDeTela.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useVazioDaTela } from "./contexto"
import { useTrack } from "./hooks"
import { decidirMedicao, normalizarTela } from "./types"

/**
 * Emite `screen_viewed` uma vez por navegacao.
 *
 * O `load_ms` vem de quando as queries da rota assentam — isso e "dados na
 * tela", que e a metrica do orcamento de performance. Tela sem query nenhuma
 * emite depois da pintura, e `medido_ate` diz qual dos dois o numero e.
 *
 * Monta DENTRO do QueryProvider, senao `useQueryClient` estoura.
 */
export function TelemetriaDeTela() {
    const pathname = usePathname()
    const queryClient = useQueryClient()
    const vazioDaTela = useVazioDaTela()
    const track = useTrack()

    // Dedupe por navegacao: o duplo-efeito do StrictMode monta este efeito
    // duas vezes em desenvolvimento, e sem isto cada tela conta duas.
    const jaEmitido = useRef<string | null>(null)

    useEffect(() => {
        if (jaEmitido.current === pathname) return
        jaEmitido.current = pathname
        vazioDaTela?.limpar()

        const inicio = performance.now()
        let emitido = false
        let aguardandoRender = 0

        const emitir = (queriesAssentaram: boolean) => {
            if (emitido) return
            emitido = true
            track("screen_viewed", {
                screen: normalizarTela(pathname),
                load_ms: Math.round(performance.now() - inicio),
                medido_ate: decidirMedicao({ queriesAssentaram }),
                // null, e nao false: "nao sei" e "nao esta vazia" sao coisas
                // diferentes, e gravar false aqui inventaria uma medicao.
                is_empty: vazioDaTela?.ler() ?? null,
            })
        }

        const buscandoAlgo = () =>
            queryClient
                .getQueryCache()
                .getAll()
                .some((q) => q.state.fetchStatus !== "idle")

        const houveBusca = () => queryClient.getQueryCache().getAll().length > 0

        const cancelarInscricao = queryClient.getQueryCache().subscribe(() => {
            if (buscandoAlgo()) return
            // Um frame de folga antes de ler `is_empty`: o cache assenta ANTES
            // de o React re-renderizar, e o QueryBoundary so decide "vazio" no
            // render. Sem esta espera, `ler()` volta null em toda tela.
            cancelAnimationFrame(aguardandoRender)
            aguardandoRender = requestAnimationFrame(() => emitir(true))
        })

        // Nenhuma query subiu ate o fim do frame: a tela nao busca dados, e o
        // unico numero honesto e o tempo ate a pintura.
        const aoPintar = requestAnimationFrame(() => {
            if (!houveBusca()) emitir(false)
        })

        return () => {
            cancelarInscricao()
            cancelAnimationFrame(aoPintar)
            cancelAnimationFrame(aguardandoRender)
        }
    }, [pathname, queryClient, track, vazioDaTela])

    return null
}
```

> **Este componente é a parte do plano com mais chance de precisar de ajuste
> na execução** — a ordem exata em que o cache do react-query assenta depende
> de como a tela dispara as queries. Se o evento sair antes da hora (com
> `medido_ate: "dados"` e `load_ms` pequeno demais para ser verdade), **não
> ajuste o número: ajuste o gatilho**, e registre no PR o que mudou. Um
> `load_ms` que não corresponde ao que o usuário esperou é pior que não medir.
> A conferência do Passo 10 existe justamente para pegar isso.

- [ ] **Passo 7: fazer o `QueryBoundary` reportar o vazio**

Em `ArchSmart-web/src/components/ui/query-boundary.tsx`. Hoje o componente
calcula `vazio` **depois** dos `return` antecipados; para chamar um hook é
preciso subir o cálculo, porque hook não pode ficar atrás de `return`.
Substitua o corpo da função por:

```tsx
export function QueryBoundary<T>({
    query,
    skeleton,
    empty,
    error,
    isEmpty,
    children,
}: Props<T>): ReactElement {
    const reportarVazio = useReportarVazio()

    // Calculado antes dos returns porque hook nao pode ficar atras de return.
    // `null` enquanto nao ha resposta: nao da para dizer "vazio" nem
    // "nao vazio" sobre dados que ainda nao chegaram.
    const pronto = !query.isPending && !query.isError
    const vazio = pronto
        ? isEmpty
            ? isEmpty(query.data as T)
            : vazioPorPadrao(query.data)
        : null

    // Em efeito, nao no render: reportar durante o render e efeito colateral
    // no meio de uma fase que o React pode repetir ou descartar.
    useEffect(() => {
        if (vazio !== null) reportarVazio(vazio)
    }, [vazio, reportarVazio])

    if (query.isPending) return <>{skeleton}</>
    if (query.isError) return <>{error(query.error as Error, () => void query.refetch())}</>
    if (vazio) return <>{empty}</>

    return <>{children(query.data as T)}</>
}
```

Acrescente os imports `useEffect` (de `react`) e `useReportarVazio` (de
`@/features/telemetry/contexto`).

**Nenhuma prop nova.** A tela não passa nada, não configura nada e não sabe que
telemetria existe — que é o que a spec pede. E `useReportarVazio` é no-op fora
do provider, então a galeria continua funcionando.

- [ ] **Passo 7b: provar que o boundary não quebrou**

```bash
npx vitest run src/__tests__/query-boundary.test.tsx src/__tests__/galeria.test.tsx
```

Esperado: PASS. Estes dois testes já existem e cobrem o componente que você
acabou de reescrever — é a rede que diz se a subida do cálculo mudou
comportamento.

- [ ] **Passo 8: montar os providers**

Em `ArchSmart-web/src/app/(dashboard)/layout.tsx`. Leia o arquivo inteiro antes
(são ~15 linhas). O `VazioDaTelaProvider` precisa embrulhar **o `AppShell`
também**, senão os `QueryBoundary` das telas ficam fora dele e o `is_empty`
nunca chega:

```tsx
<QueryProvider>
    <VazioDaTelaProvider>
        <TelemetriaDeTela />
        <AppShell>{children}</AppShell>
    </VazioDaTelaProvider>
</QueryProvider>
```

A ordem importa duas vezes: `TelemetriaDeTela` dentro do `QueryProvider`
(senão `useQueryClient` estoura) e dentro do `VazioDaTelaProvider` (senão
`useVazioDaTela` volta `null` e o `is_empty` é sempre nulo).

- [ ] **Passo 9: rodar tipos e testes**

```bash
npm run typecheck
npm test
```

Esperado: ambos limpos. A contagem de testes sobe em relação aos
`19 passed (19)` / `151 passed (151)` medidos em 10/09/2026 — **meça, não copie
o número**.

- [ ] **Passo 10: a prova viva — uma navegação real gravando uma linha**

Esta é a prova que fecha a tarefa, e não pode ser substituída por teste
unitário: o que se quer saber é se um `screen_viewed` de verdade chega ao banco
com um `load_ms` que corresponde ao que o usuário esperou.

1. Confirme de novo para qual banco o `.env` aponta.
2. Suba a API e o front locais.
3. Entre e navegue até a **Biblioteca**.
4. Confirme no banco:

```sql
SELECT name, properties, created_at FROM product_events ORDER BY created_at DESC LIMIT 5;
```

Esperado: uma linha `screen_viewed` com `screen = "/library"`,
`medido_ate = "dados"` e um `load_ms` na mesma ordem de grandeza da mediana de
**1454 ms** medida no E2E de 10/09/2026
([medição](../../dev/medicoes/2026-09-06-biblioteca-depois.md)). Não precisa
bater no milissegundo — precisa não ser 30 ms nem 30 s. Se for, o gatilho está
errado (ver o aviso do Passo 6).

5. Confirme que **uma** navegação gravou **uma** linha, não duas.

Anote o número medido no PR.

- [ ] **Passo 11: escrever a doc do módulo**

Crie `docs/dev/modulos/telemetry.md`, na forma de
`docs/dev/modulos/library.md`. Sem ela a catraca sobe: `modulos_sem_doc` conta
diretório em `src/features/` sem `.md` de mesmo nome.

- [ ] **Passo 12: conferir a catraca**

```bash
cd ../
python tools/catraca.py
```

Esperado: `modulos_sem_doc: 1` (o valor gravado na Tarefa 3),
`fetch_fora_de_lib_api: 75` **igual** ao baseline — se subiu, algum `fetch(`
novo escapou de `src/lib/api/`, e o lugar de consertar é aqui.

- [ ] **Passo 13: commit**

```bash
git add ArchSmart-web/src/lib/api/telemetry.ts \
        ArchSmart-web/src/features/telemetry/ \
        ArchSmart-web/src/components/ui/query-boundary.tsx \
        "ArchSmart-web/src/app/(dashboard)/layout.tsx" \
        ArchSmart-web/src/__tests__/telemetry.test.tsx \
        docs/dev/modulos/telemetry.md
git commit -m "feat(telemetria): useTrack e screen_viewed automatico no shell"
```

- [ ] **Passo 14: marcar a caixa** — como nas anteriores.

---

## Fechamento da seção

- [ ] **Passo 1: rodar os cinco portões, do jeito que o CI roda**

```bash
cd ArchSmart-api && pytest
cd ../ArchSmart-web && npm run typecheck && npm test
cd .. && python tools/catraca.py && python tools/progresso.py --check && python tools/checa_links.py
cd tools && python -m unittest discover -p "test_*.py"
```

> O último roda **de dentro de `tools/`** — é assim que o job do CI o executa
> (`working-directory: tools`), e da raiz ele reprova por um caso conhecido.

- [ ] **Passo 2: escrever a nota da Seção 7 no `PROGRESS.md`**

Na forma das seções anteriores: o que foi entregue, **com os números medidos e
o comando ao lado de cada um**, o que ficou aberto, e o que a Seção 8 herda.
Inclua obrigatoriamente:

- o `load_ms` real medido na Biblioteca (Tarefa 5, Passo 10), e como ele se
  compara à mediana de 1454 ms do E2E;
- o resultado da verificação visual (Tarefa 1) — inclusive se nada estava
  errado;
- os preços que entraram em `precos_ia.py`, com a fonte e a data;
- a catraca: `modulos_sem_doc` de 2 para 1, e as demais iguais.

- [ ] **Passo 3: abrir o PR para `develop`**

Descrição na forma dos PRs anteriores. Olhe os **três checks** antes de mergear:
a esteira reprova mas **não bloqueia**, então quem mergeia é o portão. Um X
vermelho ali é defeito real, não ruído.

- [ ] **Passo 4: atualizar o `CLAUDE.md`**

O bloco de estado ("Estado em 10/09/2026") e a linha "a próxima é a Seção 7"
passam a apontar para a Seção 8. Registre o que a Seção 7 deixou em aberto no
formato dos blocos anteriores — **cada pendência com a decisão de pôr como
tarefa ou não**, que é o que a Seção 8 vai ter de planejar.

---

## O que este plano deliberadamente não faz

- Não escolhe ferramenta de analytics, não implementa funil nem session replay.
- Não instrumenta evento de negócio nenhum além do `screen_viewed`.
- Não mede visitante anônimo (as 19 telas fora de `app/(dashboard)/`).
- Não põe buffer no cliente.
- Não põe `e2e/` em portão de CI — segue pendência da Seção 8.
- Não migra o `AppShell` nem nenhuma das 75 ocorrências de `fetch` fora de
  `lib/api/`.
- Não define política de retenção para `product_events`.
