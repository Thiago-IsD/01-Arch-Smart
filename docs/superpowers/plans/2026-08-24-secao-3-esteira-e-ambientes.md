# Seção 3 — Esteira, Ambientes e Branches · Plano de Implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** Fazer o repositório ter um portão automático que barra merge, uma receita de banco que funciona do zero, e um ambiente de staging com volume de dado realista — para que as Seções 4 a 8 possam ser medidas em vez de estimadas.

**Arquitetura:** O portão nasce verde porque só bloqueia o que já passa hoje; o que hoje está vermelho (lint, cores literais) entra como **catraca** — um número medido, versionado, que só pode descer. As migrações do Alembic viram a fonte única do schema, e um teste prova isso a cada PR comparando o banco que a receita constrói com o que os models declaram. Nenhuma tela, endpoint ou componente é reescrito aqui.

**Stack:** GitHub Actions · Python 3.12 (stdlib, para os scripts de `tools/`) · pytest + Alembic + Postgres 16 em Docker · Node 24 + npm · CLI do Supabase

**Spec:** `docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md` (Seção 3)

## Restrições globais

- **Branch de trabalho:** `secao-3-esteira-e-ambientes`, criada a partir de `develop`. Merge de volta em `develop` com `--no-ff`, igual às Seções 1 e 2.
- **Os diretórios `ArchSmart-api/` e `ArchSmart-web/` mantêm os nomes.** O rename é a Seção 9.
- Grafia da marca: **Arq Smart** — duas palavras, com Q. `ArchSmart-api`/`ArchSmart-web` aparecem só como caminho.
- Textos, comentários e commits em **pt-BR**; commits no formato `tipo: descrição`.
- **Scripts de `tools/` da raiz usam só a biblioteca padrão do Python** e são testados com `unittest` — sem venv, sem `pip install`, para poderem rodar no CI antes de qualquer setup. É o padrão já estabelecido por `tools/progresso.py` e `tools/test_progresso.py`.
- **Script que fala com o banco da aplicação nunca vai no `tools/` da raiz** — vai em `ArchSmart-api/tools/`. Isso vale para o `seed.py` da Tarefa 9, e contradiz o texto da spec e do `PROGRESS.md`, que dizem `tools/seed.py`; a Tarefa 9 corrige os dois textos.
- **Nenhum código de aplicação é alterado**, com **uma exceção explícita e justificada**: a Tarefa 2 altera uma linha de `app/models/all_models.py` (`Event.created_at`) porque reconciliar schema e models é o entregável daquela tarefa, não uma melhoria de passagem.
- **Documentação afirma só o que é verdade hoje.** Passo de painel que ainda não foi executado é descrito como pendente, com quem executa.
- **Número afirmado leva o comando colado.** Ver `CLAUDE.md`, seção "Como trabalhar aqui".

## Contexto que todas as tarefas precisam

Seções 1 (merge `f190a07`) e 2 (merge `f167375`) concluídas. Estado medido em 24/08/2026, na máquina de desenvolvimento:

| Medida | Valor | Comando |
|---|---|---|
| Testes de backend | 29 passam | `docker compose -f docker-compose.test.yml up -d --wait; pytest -q` |
| Testes de frontend | 7 passam, 2 arquivos falham | `npx vitest run` |
| Erros de tipo | 4, todos em `src/__tests__/LoginForm.test.tsx` | `npx tsc --noEmit` |
| Lint do frontend | 93 erros, 126 avisos | `npx eslint .` |
| Classes de cor literal | 510 de paleta + 11 arbitrárias = 521 | ver Tarefa 3, Passo 1 |
| Migrações | 26 | `ls alembic/versions/*.py \| wc -l` |
| Node / Python | v24.18.0 / 3.12.10 | `node --version`, `python --version` |

**Dois defeitos encontrados durante o planejamento**, ambos na receita de migrações, ambos endereçados pela Tarefa 2:

1. `alembic upgrade head` num banco vazio **falha**: `c7403ff445fa` recria `ix_documents_id`, que `9f8a3b2c1d4e` já criou. Erro: `(psycopg2.errors.DuplicateTable) relation "ix_documents_id" already exists`.
2. Com aquela linha removida, a receita chega ao head, mas o banco resultante **diverge dos models em 6 pontos**: `products` fica sem `store`, `category`, `price`, `dimensions` e `created_at`, e `events.created_at` fica `NOT NULL` onde o model diz nulável. As quatro primeiras são usadas pelo código da aplicação (`grep -rn "dimensions" app/api app/services app/schemas` → 5 ocorrências). Um banco de produção criado pela receita hoje nasceria sem elas e quebraria a biblioteca de produtos.

O que ainda **não** existe e não deve ser descrito como existente:

| Alvo | Seção que cria |
|---|---|
| `ScopedRepository`, `RequestContext`, `tests/isolation/` | 4 |
| `web/src/features/`, `lib/api/`, `lib/query/` | 5 |
| Tokens `--success`/`--warning` e validador de contraste | 6 |
| Docs em `docs/dev/modulos/` para os módulos de produto | 8 |

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `ArchSmart-web/vitest.config.ts` | passa a excluir `e2e/` da coleta |
| `ArchSmart-web/package.json` | ganha os scripts `test` e `typecheck` |
| `ArchSmart-web/src/__tests__/LoginForm.test.tsx` | tipagem dos dois callbacks |
| `ArchSmart-api/alembic/versions/c7403ff445fa_add_origin_to_leads.py` | perde o `create_index` duplicado |
| `ArchSmart-api/alembic/versions/<hash>_reconcilia_products_com_os_models.py` | as 5 colunas que faltam em `products` |
| `ArchSmart-api/app/models/all_models.py` | `Event.created_at` alinhado à migração |
| `ArchSmart-api/tests/test_receita_migracoes.py` | prova que a receita reproduz os models |
| `tools/catraca.py` | mede lint, cores literais e módulos sem doc; compara com o baseline |
| `tools/catraca.json` | os baselines versionados |
| `tools/test_catraca.py` | testes do acima, com `unittest` |
| `.github/workflows/ci.yml` | os três jobs do portão |
| `supabase/config.toml` | stack Supabase local (Postgres + Auth + Storage + Studio) |
| `ArchSmart-api/tools/seed.py` | seed parametrizado com volume realista |
| `docs/dev/ambientes-online.md` | roteiro de painel: Render, Vercel, Supabase, branch protection |
| `docs/dev/decisoes/0006-portoes-de-ci-com-catraca.md` | ADR da decisão de baseline + catraca |
| `docs/dev/deploy.md`, `docs/dev/ambiente.md`, `CLAUDE.md`, `PROGRESS.md` | atualizações de fechamento |

---

### Tarefa 1: Destravar a suíte do frontend

Sem isto, o job `frontend` do CI nasce vermelho, e portão vermelho é portão desligado.

**Files:**
- Modify: `ArchSmart-web/vitest.config.ts`
- Modify: `ArchSmart-web/package.json`
- Modify: `ArchSmart-web/src/__tests__/LoginForm.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `npm test` e `npm run typecheck` em `ArchSmart-web/`, consumidos pelo job `frontend` da Tarefa 5.

- [ ] **Passo 1: Reproduzir as duas falhas**

```bash
cd ArchSmart-web
npx vitest run 2>&1 | tail -5
npx tsc --noEmit
```

Esperado: `Test Files 2 failed | 4 passed (6)` com `Playwright Test did not expect test.describe() to be called here`, e 4 linhas `error TS7006`.

- [ ] **Passo 2: Excluir `e2e/` da coleta do vitest**

Em `vitest.config.ts`, o import ganha `configDefaults`:

```ts
import { defineConfig, configDefaults } from 'vitest/config'
```

E `test:` ganha `exclude`. O default do vitest precisa ser repetido: declarar `exclude` **substitui** a lista padrão, e omitir `node_modules` faria o vitest tentar coletar as dependências.

```ts
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.ts'],
    globals: true,
    // e2e/ é do Playwright. Sem esta linha o vitest coleta as specs de lá e
    // falha com "Playwright Test did not expect test.describe() to be called
    // here" — o portão de CI da Seção 3 nasceria vermelho por causa disso.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
```

- [ ] **Passo 3: Confirmar que a suíte ficou verde**

```bash
npx vitest run 2>&1 | tail -3
```

Esperado: `Test Files  4 passed (4)` e `Tests  7 passed (7)`.

- [ ] **Passo 4: Tipar os dois callbacks de `LoginForm.test.tsx`**

Nos dois testes (`validates empty fields on submit` e `calls login when fields are filled`), a assinatura passa a ser explícita:

```ts
    const submit = (email: string, password: string) => {
        if (!email || !password) error = 'Fields are required'
        else mockLogin(email, password)
    }
```

- [ ] **Passo 5: Confirmar que os tipos ficaram limpos**

```bash
npx tsc --noEmit; echo "saida: $?"
```

Esperado: nenhuma linha de erro e `saida: 0`.

- [ ] **Passo 6: Dar nome aos comandos no `package.json`**

Em `"scripts"`, entre `"lint"` e `"build:clipper"`:

```json
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
```

- [ ] **Passo 7: Verificar pelos nomes novos**

```bash
npm test 2>&1 | tail -3 && npm run typecheck && echo OK
```

Esperado: 4 arquivos / 7 testes passando, depois `OK`.

- [ ] **Passo 8: Commit**

```bash
git add ArchSmart-web/vitest.config.ts ArchSmart-web/package.json ArchSmart-web/src/__tests__/LoginForm.test.tsx
git commit -m "fix: vitest para de coletar e2e/ e os tipos ficam limpos"
```

---

### Tarefa 2: A receita de migrações cria o banco do zero

O maior risco da Seção 3. As tarefas 8 (Supabase local), 7 (banco de produção novo) e a migração automática no deploy de staging assumem que banco vazio + `alembic upgrade head` = o banco certo. Hoje isso é falso.

**Files:**
- Create: `ArchSmart-api/tests/test_receita_migracoes.py`
- Modify: `ArchSmart-api/alembic/versions/c7403ff445fa_add_origin_to_leads.py`
- Create: `ArchSmart-api/alembic/versions/<hash>_reconcilia_products_com_os_models.py`
- Modify: `ArchSmart-api/app/models/all_models.py` (só a linha `created_at` de `class Event`)

**Interfaces:**
- Consumes: nada.
- Produces: o teste `test_receita_reproduz_os_models`, que o job `backend` da Tarefa 5 executa junto com o resto do `pytest`.

- [ ] **Passo 1: Escrever o teste que falha**

Crie `ArchSmart-api/tests/test_receita_migracoes.py`:

```python
"""
A receita de migracoes e a fonte unica do schema (ADR 0004).

Este teste constroi um banco descartavel so com `alembic upgrade head` e
compara o resultado com o que os models declaram. Se divergir, um banco novo
— staging, producao ou o Supabase local — nasce diferente do que a aplicacao
espera, e o erro so aparece em producao.

Roda contra o mesmo Postgres do docker-compose.test.yml, num banco proprio
(`arqsmart_receita_test`) para nao colidir com as fixtures da suite.
"""
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, text

from app.core import config as app_config
from app.db.base_class import Base
import app.models.all_models  # noqa: F401  (registra os models no metadata)

RAIZ = Path(__file__).resolve().parents[1]
# conftest.py exporta a URL do banco de teste em DATABASE_URL no momento em que
# e importado, antes de qualquer teste rodar.
URL_BASE = os.environ["DATABASE_URL"].rsplit("/", 1)[0]
BANCO_RECEITA = "arqsmart_receita_test"
URL_ADMIN = f"{URL_BASE}/postgres"
URL_RECEITA = f"{URL_BASE}/{BANCO_RECEITA}"


@pytest.fixture
def banco_da_receita(monkeypatch):
    """Banco vazio que recebe so a receita de migracoes."""
    admin = create_engine(URL_ADMIN, isolation_level="AUTOCOMMIT")
    with admin.connect() as conexao:
        conexao.execute(text(f"DROP DATABASE IF EXISTS {BANCO_RECEITA}"))
        conexao.execute(text(f"CREATE DATABASE {BANCO_RECEITA}"))
    admin.dispose()

    # alembic/env.py le settings.DATABASE_URL em tempo de execucao, entao
    # trocar o atributo redireciona a receita para o banco descartavel.
    monkeypatch.setattr(app_config.settings, "DATABASE_URL", URL_RECEITA)
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    command.upgrade(cfg, "head")

    engine = create_engine(URL_RECEITA)
    yield engine
    engine.dispose()


def test_receita_reproduz_os_models(banco_da_receita):
    with banco_da_receita.connect() as conexao:
        contexto = MigrationContext.configure(conexao)
        diferencas = compare_metadata(contexto, Base.metadata)

    assert diferencas == [], (
        "O banco construido pelas migracoes diverge dos models em "
        f"{len(diferencas)} ponto(s):\n"
        + "\n".join(f"  - {d!r}" for d in diferencas)
    )
```

- [ ] **Passo 2: Rodar o teste e ver a falha certa**

```bash
cd ArchSmart-api
docker compose -f docker-compose.test.yml up -d --wait
.\venv\Scripts\Activate.ps1
pytest tests/test_receita_migracoes.py -q
```

Esperado: FALHA com `sqlalchemy.exc.ProgrammingError: (psycopg2.errors.DuplicateTable) relation "ix_documents_id" already exists` — a receita nem chega ao head.

- [ ] **Passo 3: Remover o índice duplicado da migração `c7403ff445fa`**

Em `alembic/versions/c7403ff445fa_add_origin_to_leads.py`, dentro de `upgrade()`, a linha

```python
    op.create_index(op.f('ix_documents_id'), 'documents', ['id'], unique=False)
```

dá lugar a um comentário explicando por que ela sumiu — a migração foi gerada por `--autogenerate` contra um banco que já tinha o índice fora da receita, então o autogenerate achou que precisava criá-lo:

```python
    # O indice ix_documents_id ja e criado por 9f8a3b2c1d4e, a migracao
    # imediatamente anterior. Esta linha veio de um --autogenerate rodado
    # contra um banco fora de sincronia e fazia `alembic upgrade head` falhar
    # em qualquer banco vazio com DuplicateTable.
    # Ver tests/test_receita_migracoes.py.
```

O `op.drop_index(op.f('ix_documents_id'), table_name='documents')` correspondente em `downgrade()` também sai — sem isso, um `downgrade` derrubaria um índice que esta migração não criou.

- [ ] **Passo 4: Rodar de novo e ver a segunda falha**

```bash
pytest tests/test_receita_migracoes.py -q 2>&1 | tail -12
```

Esperado: a receita chega ao head, e agora o `assert` falha listando **6 divergências**: `modify_nullable` em `events.created_at` e `add_column` para `products.store`, `products.category`, `products.price`, `products.dimensions` e `products.created_at`.

- [ ] **Passo 5: Alinhar `Event.created_at` ao que a migração já decidiu**

A migração `f1a2b3c4d5e6` cria `events.created_at` como `NOT NULL` com `server_default=now()`; o model diz `nullable=True`, com default só no lado do Python. A migração é a mais correta das duas — o banco garante o valor mesmo numa escrita que não passe pelo ORM. Em `app/models/all_models.py`, dentro de `class Event`:

```python
    # NOT NULL com server_default espelha a migracao f1a2b3c4d5e6: o banco
    # garante o valor mesmo numa escrita que nao passe pelo ORM.
    created_at = Column(DateTime, nullable=False, server_default=func.now(), default=datetime.utcnow)
```

Confirme que `func` está importado no topo do arquivo (`from sqlalchemy import ... func`); se não estiver, acrescente-o ao import existente do `sqlalchemy`.

- [ ] **Passo 6: Criar a migração que devolve as 5 colunas de `products`**

```bash
alembic revision -m "reconcilia products com os models"
```

No arquivo gerado, preencha `upgrade()` e `downgrade()` à mão — **não use `--autogenerate`**: ele compara com o banco local, que está fora de sincronia, e foi exatamente assim que o defeito do Passo 3 entrou.

```python
def upgrade() -> None:
    # As cinco colunas existem nos models desde sempre e sao usadas pela
    # biblioteca de produtos, mas nenhuma migracao as criava: entraram no banco
    # do time por um ALTER TABLE rodado a mao (o antigo add_column.py). Um banco
    # criado do zero pela receita nascia sem elas.
    op.add_column('products', sa.Column('store', sa.String(), nullable=True))
    op.add_column('products', sa.Column('category', sa.String(), nullable=True))
    op.add_column('products', sa.Column('price', sa.Float(), nullable=True))
    op.add_column('products', sa.Column('dimensions', sa.JSON(), nullable=True))
    op.add_column('products', sa.Column('created_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'created_at')
    op.drop_column('products', 'dimensions')
    op.drop_column('products', 'price')
    op.drop_column('products', 'category')
    op.drop_column('products', 'store')
```

- [ ] **Passo 7: Rodar o teste e ver passar**

```bash
pytest tests/test_receita_migracoes.py -q
```

Esperado: `1 passed`.

- [ ] **Passo 8: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: `30 passed` — os 29 de antes mais o novo.

- [ ] **Passo 9: Confirmar que a contagem de migrações subiu para 27**

```bash
ls alembic/versions/*.py | wc -l
```

Esperado: `27`. Se algum documento afirmar "26 migrações", corrija-o no commit desta tarefa.

- [ ] **Passo 10: Cercar a portabilidade para AWS**

A spec declara portabilidade para AWS como objetivo e dá a regra que a mantém: **nada de recurso exclusivo do Supabase dentro do schema** — sem RLS como única proteção, sem FK para as tabelas internas de autenticação deles. Medido em 24/08/2026, a regra já é verdade (`grep -rni "create policy\|auth\.users" alembic/versions/*.py` não devolve nada), e a única função criada por migração é `match_documents`, plpgsql puro sobre pgvector, que roda em qualquer Postgres com a extensão. Um teste é o que impede a regra de deixar de valer sem ninguém notar. Acrescente a `tests/test_receita_migracoes.py`:

```python
def test_schema_nao_depende_de_recurso_exclusivo_do_supabase(banco_da_receita):
    """
    Portabilidade para AWS (spec, Secao 3): a protecao real fica na aplicacao,
    nao em RLS, e o schema nao referencia as tabelas internas de autenticacao
    do Supabase. Postgres e Postgres; e o que torna a troca possivel.
    """
    with banco_da_receita.connect() as conexao:
        com_rls = conexao.execute(text(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname = 'public' AND rowsecurity = true"
        )).scalars().all()
        fks_externas = conexao.execute(text(
            "SELECT DISTINCT ccu.table_schema || '.' || ccu.table_name "
            "FROM information_schema.table_constraints tc "
            "JOIN information_schema.constraint_column_usage ccu "
            "  ON tc.constraint_name = ccu.constraint_name "
            "WHERE tc.constraint_type = 'FOREIGN KEY' "
            "  AND tc.table_schema = 'public' "
            "  AND ccu.table_schema <> 'public'"
        )).scalars().all()

    assert com_rls == [], (
        f"Tabelas com RLS ligado: {com_rls}. A protecao por conta e do "
        "ScopedRepository (Secao 4), nao do banco — RLS aqui amarra o "
        "projeto ao Supabase."
    )
    assert fks_externas == [], (
        f"FK apontando para fora de public: {fks_externas}. Referencia as "
        "tabelas internas do Supabase impede migrar o banco para outro Postgres."
    )
```

- [ ] **Passo 11: Rodar os dois testes**

```bash
pytest tests/test_receita_migracoes.py -q
```

Esperado: `2 passed`.

- [ ] **Passo 12: Rodar a suíte inteira**

```bash
pytest -q
```

Esperado: `31 passed` — os 29 de antes mais os dois novos.

- [ ] **Passo 13: Commit**

```bash
git add ArchSmart-api/tests/test_receita_migracoes.py ArchSmart-api/alembic/versions/ ArchSmart-api/app/models/all_models.py
git commit -m "fix: a receita de migracoes volta a criar o banco do zero"
```

---

### Tarefa 3: `tools/catraca.py` — o número que só pode descer

**Files:**
- Create: `tools/catraca.py`
- Create: `tools/catraca.json`
- Create: `tools/test_catraca.py`

**Interfaces:**
- Consumes: nada.
- Produces: `python tools/catraca.py [--eslint-json <arquivo>]` — sai 0 se nenhuma métrica piorou, 1 se alguma piorou. Consumido pelo job `frontend` da Tarefa 5.

- [ ] **Passo 1: Medir os baselines, com o comando à vista**

```bash
cd ArchSmart-web
npx eslint . --format json -o /tmp/eslint.json || true
node -e "console.log(require('/tmp/eslint.json').reduce((s,f)=>s+f.errorCount,0))"
cd ..
grep -rEo '\b(bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b' ArchSmart-web/src --include=*.tsx --include=*.ts | wc -l
grep -rEo '\b(bg|text|border)-\[#[0-9a-fA-F]{3,8}\]' ArchSmart-web/src --include=*.tsx --include=*.ts | wc -l
ls ArchSmart-api/app/services/*.py
```

Esperado em 24/08/2026: `93`, `510`, `11`, e quatro services (`ai_service`, `auth_service`, `budget_calculator`, `financial_service`). **Se algum número divergir, o baseline correto é o que você acabou de medir** — atualize o `catraca.json` do Passo 4 e diga no commit qual mudou e por quê.

- [ ] **Passo 2: Escrever os testes que falham**

Crie `tools/test_catraca.py`:

```python
"""
Testes da catraca.

Rode com: cd tools; python -m unittest test_catraca -v

Usa `unittest` da biblioteca padrao pelo mesmo motivo de test_progresso.py: o
script nao tem dependencia externa, e o teste dele nao deve introduzir uma.
"""
import tempfile
import unittest
from pathlib import Path

from catraca import comparar, contar_cores, modulos_sem_doc


class TestContagemDeCores(unittest.TestCase):
    def _escrever(self, conteudo, nome="Componente.tsx"):
        dir_temp = Path(tempfile.mkdtemp())
        (dir_temp / nome).write_text(conteudo, encoding="utf-8")
        return dir_temp

    def test_conta_classe_de_paleta(self):
        raiz = self._escrever('<div className="bg-emerald-600 text-slate-50" />')
        self.assertEqual(contar_cores(raiz), 2)

    def test_conta_cor_arbitraria(self):
        raiz = self._escrever('<div className="bg-[#F88379]" />')
        self.assertEqual(contar_cores(raiz), 1)

    def test_ignora_token_semantico(self):
        raiz = self._escrever('<div className="bg-primary text-muted-foreground" />')
        self.assertEqual(contar_cores(raiz), 0)

    def test_ignora_arquivo_que_nao_e_ts_nem_tsx(self):
        raiz = self._escrever("bg-emerald-600", nome="LEIAME.md")
        self.assertEqual(contar_cores(raiz), 0)


class TestModulosSemDoc(unittest.TestCase):
    def _base(self):
        base = Path(tempfile.mkdtemp())
        (base / "services").mkdir()
        (base / "modulos").mkdir()
        return base

    def test_service_sem_doc_aparece(self):
        base = self._base()
        (base / "services" / "cobranca_service.py").write_text("", encoding="utf-8")
        self.assertEqual(
            modulos_sem_doc(base / "services", None, base / "modulos"),
            ["cobranca_service"],
        )

    def test_service_com_doc_nao_aparece(self):
        base = self._base()
        (base / "services" / "cobranca_service.py").write_text("", encoding="utf-8")
        (base / "modulos" / "cobranca_service.md").write_text("# doc", encoding="utf-8")
        self.assertEqual(modulos_sem_doc(base / "services", None, base / "modulos"), [])

    def test_diretorio_inexistente_nao_quebra(self):
        base = self._base()
        self.assertEqual(
            modulos_sem_doc(base / "nao_existe", base / "tambem_nao", base / "modulos"),
            [],
        )


class TestComparacao(unittest.TestCase):
    def test_subir_falha(self):
        ok, linhas = comparar({"cores_literais": 521}, {"cores_literais": 522})
        self.assertFalse(ok)
        self.assertIn("SUBIU", "\n".join(linhas))

    def test_manter_passa(self):
        ok, _ = comparar({"cores_literais": 521}, {"cores_literais": 521})
        self.assertTrue(ok)

    def test_descer_passa_e_avisa(self):
        ok, linhas = comparar({"cores_literais": 521}, {"cores_literais": 500})
        self.assertTrue(ok)
        self.assertIn("baixou", "\n".join(linhas))

    def test_modulo_novo_sem_doc_falha(self):
        ok, linhas = comparar(
            {"modulos_sem_doc": ["ai_service"]},
            {"modulos_sem_doc": ["ai_service", "cobranca_service"]},
        )
        self.assertFalse(ok)
        self.assertIn("cobranca_service", "\n".join(linhas))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Passo 3: Rodar os testes e ver falhar**

```bash
cd tools && python -m unittest test_catraca -v
```

Esperado: `ModuleNotFoundError: No module named 'catraca'`.

- [ ] **Passo 4: Escrever o baseline**

Crie `tools/catraca.json`:

```json
{
  "_leia-me": "Baselines medidos em 24/08/2026. Cada numero so pode descer. Ao baixar, rode `python tools/catraca.py --atualizar` e commite o resultado junto com a mudanca que o fez baixar.",
  "eslint_erros": 93,
  "cores_literais": 521,
  "modulos_sem_doc": [
    "ai_service",
    "auth_service",
    "budget_calculator",
    "financial_service"
  ]
}
```

- [ ] **Passo 5: Escrever o `catraca.py`**

Crie `tools/catraca.py`:

```python
"""
Catraca dos portoes graduais do CI.

Tres medidas que hoje estao vermelhas e nao podem piorar enquanto as secoes
que as consertam nao chegam (ver ADR 0006):

  - eslint_erros     93 hoje; as Secoes 5 e 6 derrubam
  - cores_literais   521 hoje; a Secao 6 zera, quando os tokens existirem
  - modulos_sem_doc  os 4 services de hoje; a Secao 8 documenta

Cada medida imprime o criterio que usou. Sai 1 se alguma piorou.

Uso:
    python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
    python tools/catraca.py --atualizar    # regrava o baseline com o medido

Sem --eslint-json a medida de lint e pulada, e nao falha: quem tem Node
instalado e o job `frontend` do CI, e e la que ela roda.
"""
import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BASELINE = Path(__file__).resolve().parent / "catraca.json"

SRC_WEB = RAIZ / "ArchSmart-web" / "src"
SERVICES_API = RAIZ / "ArchSmart-api" / "app" / "services"
FEATURES_WEB = RAIZ / "ArchSmart-web" / "src" / "features"
DOCS_MODULOS = RAIZ / "docs" / "dev" / "modulos"

_PREFIXOS = ("bg|text|border|ring|from|to|via|fill|stroke|outline|decoration"
             "|shadow|accent|caret|divide|placeholder")
_PALETAS = ("slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green"
            "|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose")
RE_PALETA = re.compile(rf"\b({_PREFIXOS})-({_PALETAS})-[0-9]{{2,3}}\b")
RE_ARBITRARIA = re.compile(r"\b(bg|text|border)-\[#[0-9a-fA-F]{3,8}\]")

CRITERIOS = {
    "eslint_erros": "soma de errorCount no `npx eslint . --format json`",
    "cores_literais": "regex de classe de paleta e de cor arbitraria em ArchSmart-web/src/**/*.{ts,tsx}",
    "modulos_sem_doc": "arquivo em app/services/ ou diretorio em src/features/ sem .md de mesmo nome em docs/dev/modulos/",
}


def contar_cores(raiz: Path) -> int:
    """Conta ocorrencias de classe utilitaria com cor literal sob `raiz`."""
    if not raiz.exists():
        return 0
    total = 0
    for caminho in raiz.rglob("*"):
        if caminho.suffix not in (".ts", ".tsx") or not caminho.is_file():
            continue
        texto = caminho.read_text(encoding="utf-8", errors="ignore")
        total += len(RE_PALETA.findall(texto)) + len(RE_ARBITRARIA.findall(texto))
    return total


def modulos_sem_doc(services: Path, features: Path | None, docs: Path) -> list[str]:
    """Modulos sem o .md correspondente em docs/dev/modulos/ (Art. 13)."""
    documentados = {p.stem for p in docs.glob("*.md")} if docs.exists() else set()
    nomes = []
    if services is not None and services.exists():
        nomes += [p.stem for p in services.glob("*.py") if p.stem != "__init__"]
    if features is not None and features.exists():
        nomes += [p.name for p in features.iterdir() if p.is_dir()]
    return sorted(n for n in nomes if n not in documentados)


def medir(eslint_json: Path | None) -> dict:
    medido = {
        "cores_literais": contar_cores(SRC_WEB),
        "modulos_sem_doc": modulos_sem_doc(SERVICES_API, FEATURES_WEB, DOCS_MODULOS),
    }
    if eslint_json is not None:
        relatorio = json.loads(eslint_json.read_text(encoding="utf-8"))
        medido["eslint_erros"] = sum(a.get("errorCount", 0) for a in relatorio)
    return medido


def comparar(baseline: dict, medido: dict) -> tuple[bool, list[str]]:
    """(passou, linhas para imprimir). Falha so quando a medida piora."""
    ok = True
    linhas = []
    for chave, valor in sorted(medido.items()):
        base = baseline.get(chave)
        criterio = CRITERIOS.get(chave, "")
        if isinstance(valor, list):
            novos = sorted(set(valor) - set(base or []))
            sumidos = sorted(set(base or []) - set(valor))
            if novos:
                ok = False
                linhas.append(f"[X] {chave}: SUBIU — sem doc e fora do baseline: {', '.join(novos)}")
                linhas.append(f"    criterio: {criterio}")
            elif sumidos:
                linhas.append(f"[v] {chave}: baixou — agora documentados: {', '.join(sumidos)}."
                              " Rode `python tools/catraca.py --atualizar`.")
            else:
                linhas.append(f"[v] {chave}: {len(valor)}, igual ao baseline")
        elif base is None:
            linhas.append(f"[v] {chave}: {valor} (sem baseline; nada a comparar)")
        elif valor > base:
            ok = False
            linhas.append(f"[X] {chave}: SUBIU de {base} para {valor}")
            linhas.append(f"    criterio: {criterio}")
        elif valor < base:
            linhas.append(f"[v] {chave}: baixou de {base} para {valor}."
                          " Rode `python tools/catraca.py --atualizar`.")
        else:
            linhas.append(f"[v] {chave}: {valor}, igual ao baseline")
    return ok, linhas


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--eslint-json", type=Path, default=None,
                        help="relatorio JSON do eslint; sem ele a medida de lint e pulada")
    parser.add_argument("--atualizar", action="store_true",
                        help="regrava catraca.json com o valor medido")
    args = parser.parse_args(argv)

    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    medido = medir(args.eslint_json)

    if args.atualizar:
        baseline.update(medido)
        BASELINE.write_text(json.dumps(baseline, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
        print(f"catraca.json atualizado: {json.dumps(medido, ensure_ascii=False)}")
        return 0

    ok, linhas = comparar(baseline, medido)
    print("\n".join(linhas))
    if not ok:
        print("\nA catraca so gira para baixo. Se o numero subiu de proposito,"
              " justifique no PR e atualize o baseline com --atualizar.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Passo 6: Rodar os testes e ver passar**

```bash
cd tools && python -m unittest test_catraca -v
```

Esperado: `Ran 11 tests` e `OK`.

- [ ] **Passo 7: Rodar a catraca contra o repositório de verdade**

```bash
cd ArchSmart-web && npx eslint . --format json -o eslint.json || true
cd .. && python tools/catraca.py --eslint-json ArchSmart-web/eslint.json; echo "saida: $?"
```

Esperado: três linhas `[v]` — `cores_literais: 521`, `eslint_erros: 93`, `modulos_sem_doc: 4` — e `saida: 0`.

- [ ] **Passo 8: Provar que a catraca morde**

```bash
echo 'export const X = "bg-emerald-600"' > ArchSmart-web/src/sonda-catraca.ts
python tools/catraca.py; echo "saida: $?"
rm ArchSmart-web/src/sonda-catraca.ts
```

Esperado: `[X] cores_literais: SUBIU de 521 para 522` e `saida: 1`.

- [ ] **Passo 9: Não versionar o relatório do eslint**

Acrescente `eslint.json` ao `ArchSmart-web/.gitignore` — é artefato de medição, regenerado a cada execução.

- [ ] **Passo 10: Commit**

```bash
git add tools/catraca.py tools/catraca.json tools/test_catraca.py ArchSmart-web/.gitignore
git commit -m "feat: catraca de lint, cores literais e doc de modulo"
```

---

### Tarefa 4: ADR 0006 — por que os portões entram graduais

**Files:**
- Create: `docs/dev/decisoes/0006-portoes-de-ci-com-catraca.md`
- Modify: `docs/dev/decisoes/README.md`
- Modify: `docs/dev/modulos/README.md`

**Interfaces:**
- Consumes: `tools/catraca.py` da Tarefa 3.
- Produces: nada consumido por código.

- [ ] **Passo 1: Ler o formato dos ADRs existentes**

```bash
cat docs/dev/decisoes/0005-tres-branches-develop-staging-main.md
cat docs/dev/decisoes/README.md
```

Siga a estrutura que estiver lá — inclusive a seção "como saberemos se foi certo", exigida pela spec.

- [ ] **Passo 2: Escrever o ADR**

`docs/dev/decisoes/0006-portoes-de-ci-com-catraca.md`, no formato dos anteriores, cobrindo:

- **Contexto:** a spec manda o CI barrar 8 verificações. Medido em 24/08/2026: o lint tem 93 erros, `ArchSmart-web/src` tem 521 classes de cor literal, e `docs/dev/modulos/` não documenta nenhum dos 4 services. O validador de contraste depende dos tokens da Seção 6; o teste de isolamento entre contas depende do `ScopedRepository` da Seção 4.
- **Decisão:** bloqueiam desde já tipos, testes de backend, testes de frontend, receita de migrações, `progresso.py --check`, `checa_links.py` e a sincronia `main`↔`develop`. Lint, cores literais e doc de módulo entram como catraca — falham só quando pioram. Contraste e isolamento ficam como bloco comentado no `ci.yml`, nomeando a seção que os liga.
- **O que foi rejeitado, e por quê:** (a) ligar os 8 portões de uma vez — obrigaria a Seção 3 a substituir 521 classes de cor antes de os tokens `--success`/`--warning` existirem, violando "completar antes de proibir"; (b) verificar só os arquivos que o PR alterou — mais simples, mas não deixa o total à vista, e um arquivo movido reaparece como novo e trava o PR sem que nada tenha piorado.
- **Como saberemos se foi certo:** os três números da catraca devem estar mais baixos no fim da Seção 6 do que hoje, e o `ci.yml` não pode ganhar nenhum `continue-on-error`. Se alguém precisar desligar um portão para conseguir mergear, a decisão falhou.

- [ ] **Passo 3: Indexar o ADR e explicar a regra mecânica de módulo**

Acrescente a linha do 0006 ao `docs/dev/decisoes/README.md`, no mesmo formato das outras.

Em `docs/dev/modulos/README.md`, substitua a seção final "O que ainda não existe" por uma que diga a verdade nova: a pasta continua sem documento de módulo de produto (Seção 8), **e** o CI já verifica mecanicamente a correspondência — todo arquivo em `ArchSmart-api/app/services/` e todo diretório em `ArchSmart-web/src/features/` precisa de um `.md` de mesmo nome aqui. Os 4 services de hoje estão no baseline de `tools/catraca.json`; um módulo novo sem doc reprova o PR.

- [ ] **Passo 4: Conferir que nenhum link quebrou**

```bash
python tools/checa_links.py; echo "saida: $?"
```

Esperado: `saida: 0`.

- [ ] **Passo 5: Commit**

```bash
git add docs/dev/decisoes/ docs/dev/modulos/README.md
git commit -m "docs: ADR 0006 — portoes de CI com catraca"
```

---

### Tarefa 5: O portão — `.github/workflows/ci.yml`

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm test` e `npm run typecheck` (Tarefa 1), `tests/test_receita_migracoes.py` (Tarefa 2), `tools/catraca.py` (Tarefa 3), `tools/progresso.py --check` e `tools/checa_links.py` (Seção 2).
- Produces: os três jobs `backend`, `frontend` e `repo`, exigidos como checks obrigatórios pelo branch protection da Tarefa 7.

- [ ] **Passo 1: Escrever o workflow**

Crie `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [develop, staging, main]
  push:
    branches: [develop, staging, main]

# Um PR que recebe varios pushes seguidos cancela a execucao anterior: o unico
# resultado que interessa e o do ultimo commit.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend:
    name: Backend — testes contra Postgres real
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: arqsmart
          POSTGRES_PASSWORD: arqsmart
          POSTGRES_DB: arqsmart_test
        ports:
          - 55432:5432
        options: >-
          --health-cmd "pg_isready -U arqsmart -d arqsmart_test"
          --health-interval 2s
          --health-timeout 3s
          --health-retries 20
    env:
      # A suite se recusa a rodar contra banco que nao termine em _test (ver
      # tests/conftest.py). As chaves abaixo sao obrigatorias em
      # app/core/config.py e precisam existir, mas nenhum teste as usa de
      # verdade — nao ha segredo de producao no CI.
      TEST_DATABASE_URL: postgresql://arqsmart:arqsmart@localhost:55432/arqsmart_test
      SUPABASE_URL: https://ci.invalido.supabase.co
      SUPABASE_KEY: chave-de-ci-sem-valor
      SUPABASE_SERVICE_ROLE_KEY: chave-de-ci-sem-valor
      GEMINI_API_KEY: chave-de-ci-sem-valor
    defaults:
      run:
        working-directory: ArchSmart-api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip
      - name: Instalar dependencias
        run: pip install -r requirements.txt -r requirements-dev.txt
      - name: Testes (inclui a receita de migracoes em banco vazio)
        run: pytest -q

  frontend:
    name: Frontend — tipos, testes e catraca
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm
          cache-dependency-path: ArchSmart-web/package-lock.json
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Instalar dependencias
        working-directory: ArchSmart-web
        run: npm ci
      - name: Tipos
        working-directory: ArchSmart-web
        run: npm run typecheck
      - name: Testes
        working-directory: ArchSmart-web
        run: npm test
      - name: Medir o lint
        # O eslint sai !=0 quando ha erro, e hoje ha 93. Quem decide se isso
        # reprova o PR e a catraca, comparando com o baseline versionado.
        working-directory: ArchSmart-web
        run: npx eslint . --format json -o eslint.json || true
      - name: Catraca — lint, cores literais e doc de modulo
        run: python tools/catraca.py --eslint-json ArchSmart-web/eslint.json

  repo:
    name: Repositorio — progresso, links e sincronia
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          # `git rev-list origin/develop..origin/main` precisa do historico
          # completo; o checkout raso padrao traz so o ultimo commit.
          fetch-depth: 0
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Testes dos scripts de tools/
        working-directory: tools
        run: python -m unittest discover -p "test_*.py" -v
      - name: PROGRESS.md bate com as caixas marcadas
        run: python tools/progresso.py --check
      - name: Links internos da documentacao
        run: python tools/checa_links.py
      - name: main nao tem commit ausente em develop
        # Hotfix aplicado em main precisa voltar para develop no mesmo dia
        # (ADR 0005). Este passo acusa quando isso nao aconteceu.
        run: |
          git fetch origin main develop --quiet
          faltando=$(git rev-list --count origin/develop..origin/main)
          if [ "$faltando" -ne 0 ]; then
            echo "main tem $faltando commit(s) que nao estao em develop:"
            git log --oneline origin/develop..origin/main
            exit 1
          fi
          echo "main e develop sincronizados."

# Portoes que ainda nao existem. Nao sao stub vazio de proposito: verificacao
# que nao mede nada da a impressao de uma cobertura que nao ha.
#
#   validador de contraste (4.5:1 nos dois temas) — Secao 6, junto com os
#     tokens --success/--warning que hoje faltam
#   teste de isolamento entre contas (tests/isolation/) — Secao 4, junto com o
#     ScopedRepository que o torna verificavel
```

- [ ] **Passo 2: Validar a sintaxe do YAML antes de empurrar**

```bash
ArchSmart-api/venv/Scripts/python.exe -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml',encoding='utf-8')); print('YAML valido')"
```

Esperado: `YAML valido`.

- [ ] **Passo 3: Verificar que os testes de `tools/` são descobertos**

O job `repo` roda `unittest discover`; confirme localmente que ele acha os três arquivos de teste:

```bash
cd tools && python -m unittest discover -p "test_*.py" 2>&1 | tail -3
```

Esperado: `OK`, com a contagem somando `test_progresso`, `test_checa_links` e `test_catraca`.

- [ ] **Passo 4: Commit e push, para o GitHub executar o workflow**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: CI que barra merge — backend, frontend e repositorio"
git push -u origin secao-3-esteira-e-ambientes
```

- [ ] **Passo 5: Ver os três jobs de verdade**

```bash
gh run watch $(gh run list --branch secao-3-esteira-e-ambientes --limit 1 --json databaseId --jq '.[0].databaseId')
```

Esperado: `backend`, `frontend` e `repo` verdes.

**Se `frontend` falhar na catraca**, é porque o runner mede um número diferente do desta máquina — provável em `eslint_erros`, que depende da versão do Node. Nesse caso o baseline correto é **o do runner**: pegue o número do log, corrija `tools/catraca.json` e registre no commit os dois valores e a razão. Não ajuste o medido para casar com o baseline; ver `CLAUDE.md`, "Como trabalhar aqui".

- [ ] **Passo 6: Commit de ajuste, se houve**

```bash
git add tools/catraca.json
git commit -m "fix: baseline da catraca alinhado ao medido no runner do CI"
git push
```

---

### Tarefa 6: Branch `staging`

**Files:**
- Nenhum arquivo. A entrega é a branch publicada.

**Interfaces:**
- Consumes: o `ci.yml` da Tarefa 5, que já dispara em `staging`.
- Produces: a branch que a Tarefa 7 configura no Render e no branch protection.

- [ ] **Passo 1: Criar `staging` a partir de `develop`**

`staging` sai de `develop`, não de `main`: o fluxo é `develop → staging → main`, e a branch precisa nascer com o que já foi integrado.

```bash
git fetch origin
git branch staging origin/develop
git push -u origin staging
```

- [ ] **Passo 2: Confirmar que as três branches existem no remoto**

```bash
git ls-remote --heads origin | awk '{print $2}'
```

Esperado: `refs/heads/develop`, `refs/heads/main` e `refs/heads/staging`, além da branch de trabalho.

- [ ] **Passo 3: Confirmar que o CI dispara em `staging`**

```bash
gh run list --branch staging --limit 3
```

Esperado: uma execução do workflow `CI`. Se não houver nenhuma, confirme que o push do Passo 1 aconteceu **depois** de `ci.yml` existir na base de `staging` — um workflow só roda se existir na branch empurrada.

---

### Tarefa 7: Roteiro dos painéis externos

Nada aqui é executado por quem implementa o plano — são os passos que dependem de acesso administrativo ao Render, à Vercel, ao Supabase e ao GitHub. O entregável é o roteiro, exato o bastante para ser seguido sem adivinhação.

**Files:**
- Create: `docs/dev/ambientes-online.md`
- Modify: `docs/dev/deploy.md`

**Interfaces:**
- Consumes: a branch `staging` (Tarefa 6) e os nomes dos jobs do `ci.yml` (Tarefa 5).
- Produces: nada consumido por código.

- [ ] **Passo 1: Escrever `docs/dev/ambientes-online.md`**

Abra com um bloco de estado dizendo que **nenhum destes passos foi executado ainda** e que quem os executa é o dono das contas. Depois, cinco seções numeradas:

**1. Serviço de staging no Render.** Novo Web Service a partir do mesmo repositório, branch `staging`, root directory `ArchSmart-api`, usando o `Dockerfile` que já existe. Variáveis de ambiente: as mesmas de produção listadas em `ArchSmart-api/.env.example`, com `DATABASE_URL` apontando para o projeto Supabase de staging (seção 3) e `FRONTEND_URL` para a URL de preview da Vercel. O comando de deploy precisa rodar `alembic upgrade head` antes de subir a API — é isso que torna a migração automática em staging (spec, Seção 3). Registre a URL resultante nesta seção quando ela existir.

**2. Preview automático da Vercel.** Recurso já disponível no plano atual, hoje não usado. Habilitar preview deployments para pull requests no projeto do frontend e definir `NEXT_PUBLIC_API_URL` no escopo *Preview* apontando para a API de staging da seção 1. Produção continua saindo de `main`.

**3. Projeto Supabase de staging.** Projeto novo, separado do de produção, mesma região (`sa-east-1`). Depois de criado: habilitar a extensão `vector` (a tabela `documents` depende dela), copiar as três chaves de *Project Settings → API* para o Render, e criar o bucket `secure-files` com as mesmas políticas do de produção. O schema vem de `alembic upgrade head` — **nunca** da CLI do Supabase (ADR 0004). Em *Authentication → Providers → Email*, deixe **"Confirm email" ligada**, como está em produção (confirmado em 24/08/2026).

**4. Banco de produção novo.** Mesma receita da seção 3, num projeto Supabase novo de produção. O banco atual é descartado (ADR 0003). Só depois de a esteira de staging estar verde. A migração roda pelo deploy, não à mão.

**5. Branch protection nas três branches.** Em *Settings → Branches*, uma regra para `main`, uma para `staging`, uma para `develop`. Em todas: exigir pull request antes do merge e exigir status checks verdes, marcando como obrigatórios exatamente os três nomes de job do `ci.yml` — `Backend — testes contra Postgres real`, `Frontend — tipos, testes e catraca`, `Repositorio — progresso, links e sincronia`. Em `main` e `staging`, exigir também que a branch esteja atualizada com a base antes do merge.

Feche com uma tabela "o que confirmar quando terminar", uma linha por seção, com o comando ou a tela que prova que funcionou — por exemplo, `curl https://<api-staging>/health` devolvendo 200.

- [ ] **Passo 2: Ligar o roteiro ao `deploy.md`**

Em `docs/dev/deploy.md`, a passagem que hoje diz que não existe staging passa a apontar para `ambientes-online.md`, deixando claro que o roteiro existe e a execução está pendente. **Não afirme que staging existe.**

- [ ] **Passo 3: Conferir os links**

```bash
python tools/checa_links.py; echo "saida: $?"
```

Esperado: `saida: 0`.

- [ ] **Passo 4: Commit**

```bash
git add docs/dev/ambientes-online.md docs/dev/deploy.md
git commit -m "docs: roteiro dos ambientes online e do branch protection"
```

---

### Tarefa 8: Supabase local em Docker

**Files:**
- Create: `supabase/config.toml`
- Modify: `docs/dev/ambiente.md`

**Interfaces:**
- Consumes: a receita corrigida (Tarefa 2).
- Produces: `supabase start`, que sobe Postgres + Auth + Storage + Studio locais; o Postgres resultante recebe `alembic upgrade head`.

- [ ] **Passo 1: Gerar a configuração**

```bash
cd /c/Users/thiagorodrigues_frwk/Music/01-Arch-Smart
supabase init
```

Se a CLI não estiver instalada, **pare e registre isso** — o restante da tarefa depende dela, e inventar um `config.toml` à mão produziria um arquivo que não corresponde à versão instalada. `supabase init` cria `supabase/config.toml` e `supabase/.gitignore`.

- [ ] **Passo 2: Desligar a migração da CLI do Supabase**

ADR 0004: Alembic é a fonte única do schema. Em `supabase/config.toml`, na seção `[db.migrations]`, deixe explícito que a CLI não gerencia schema, com o comentário dizendo por quê:

```toml
[db.migrations]
# Alembic e a fonte unica do schema (ADR 0004). A CLI do Supabase sobe a
# infraestrutura local (Postgres, Auth, Storage, Studio) e nada mais — duas
# ferramentas de migracao seriam dois historicos divergentes.
enabled = false
```

Confirme também que `major_version` em `[db]` é `16`, para bater com o Postgres dos testes e com o de produção.

- [ ] **Passo 3: Subir a stack e provar que a receita roda nela**

```bash
supabase start
supabase status
```

Pegue a `DB URL` da saída de `supabase status` e aplique a receita nela:

```bash
cd ArchSmart-api
DATABASE_URL="<DB URL do supabase status>" ./venv/Scripts/python.exe -m alembic upgrade head
```

Esperado: as 27 migrações aplicam sem erro. Se a extensão `vector` faltar, a própria migração `9f8a3b2c1d4e` a habilita (`CREATE EXTENSION IF NOT EXISTS vector`).

- [ ] **Passo 4: Não versionar o que é local**

Confirme que o `supabase/.gitignore` criado pelo `init` exclui `.branches` e `.temp`. Versionado fica só o `config.toml` (e o `.gitignore`).

- [ ] **Passo 5: Documentar em `ambiente.md`**

Acrescente uma seção **"Stack Supabase local"** logo antes de `## Banco de teste em Docker`, cobrindo: por que Supabase local e não Postgres puro (a aplicação depende de Auth e de Storage; Postgres puro deixaria login e upload ainda batendo na nuvem), como instalar a CLI, `supabase start`, onde ficam o Studio e as chaves locais, e que o schema vem do `alembic upgrade head` — nunca da CLI. Deixe claro que o banco descartável de teste (`docker-compose.test.yml`, porta 55432) continua separado e **não** é substituído por este.

- [ ] **Passo 6: Commit**

```bash
git add supabase/ docs/dev/ambiente.md
git commit -m "feat: stack Supabase local com Alembic como fonte unica do schema"
```

---

### Tarefa 9: `seed.py` com volume realista

O item crítico da Seção 3: é contra este volume que o orçamento de performance de cada tela das Seções 6 e 8 é medido. Medir com três produtos na biblioteca foi o que deixou a lentidão passar despercebida.

**Files:**
- Create: `ArchSmart-api/tools/seed.py`
- Delete: `ArchSmart-api/tools/seed_clipper.py`, `seed_mock.py`, `seed_products.py`, `seed_tokstok.py`
- Modify: `ArchSmart-api/tools/README.md`
- Modify: `PROGRESS.md`, `docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md`

**Interfaces:**
- Consumes: o schema criado pela receita (Tarefa 2).
- Produces: `python tools/seed.py --projetos 5 --ambientes 25 --biblioteca 300 --itens 500`.

- [ ] **Passo 1: Ler o que existe antes de apagar**

```bash
cd ArchSmart-api
wc -l tools/seed_*.py
cat tools/README.md
```

Os quatro scripts atuais viram um só, parametrizado. Se algum deles contiver dado de catálogo que valha a pena preservar — nomes reais de produto, por exemplo — traga-o como lista de constantes no script novo em vez de descartar.

- [ ] **Passo 2: Escrever o `seed.py`**

Crie `ArchSmart-api/tools/seed.py`. Requisitos, todos obrigatórios:

- **Recusa terminante de rodar contra produção.** Antes de qualquer escrita — a guarda é a primeira coisa que o `main()` chama, antes de abrir sessão:

```python
# Mesma guarda de tests/conftest.py: um seed de 800 linhas rodado por engano
# contra o banco do time nao tem desfazer.
HOSTS_PROIBIDOS = ("supabase.co", "pooler.supabase.com", "render.com", "amazonaws.com")


def recusar_producao(url: str, forcado: bool) -> None:
    achados = [h for h in HOSTS_PROIBIDOS if h in url]
    if achados and not forcado:
        sys.exit(
            f"Recusando rodar: DATABASE_URL contem {', '.join(achados)}, que e "
            f"host gerenciado.\n  URL: {url!r}\n"
            "Se e realmente o que voce quer, passe --eu-sei-o-que-estou-fazendo."
        )
```

- **Determinístico.** `random.seed(42)` fixo, para que duas execuções produzam o mesmo banco e uma medição de performance seja comparável com a da semana passada.
- **Idempotente por conta.** Cria (ou reusa) uma conta `Seed — volume realista` e escreve tudo dentro dela; rodar duas vezes não duplica.
- **Parâmetros com os defaults da spec:** `--projetos 5`, `--ambientes 25`, `--biblioteca 300`, `--itens 500`. `--ambientes` e `--itens` são **totais**, distribuídos entre os projetos, não valores por projeto.
- **Ordem de criação respeitando as chaves estrangeiras de `app/models/all_models.py`:** `Account` → `User` → `ProductOrigin`/`ProductState` → `Product` (a biblioteca) → `Client` → `Project` → `Environment` → `Budget` → `BudgetItem` → `ItemOption`. `Environment` exige `project_id` e `name`; `BudgetItem` exige `budget_id` e `rule_type` (enum `RuleType`).
- **Resumo contado ao final** — quantas linhas existem em cada tabela, lido do banco com `SELECT count(*)`, não do contador em memória. Número afirmado é número medido.

- [ ] **Passo 3: Rodar contra um banco limpo**

```bash
docker compose -f docker-compose.test.yml up -d --wait
docker exec archsmart-api-postgres-test-1 psql -U arqsmart -d postgres -c "DROP DATABASE IF EXISTS arqsmart_seed_test;" -c "CREATE DATABASE arqsmart_seed_test;"
DATABASE_URL="postgresql://arqsmart:arqsmart@localhost:55432/arqsmart_seed_test" ./venv/Scripts/python.exe -m alembic upgrade head
DATABASE_URL="postgresql://arqsmart:arqsmart@localhost:55432/arqsmart_seed_test" ./venv/Scripts/python.exe tools/seed.py
```

Esperado: o resumo contado, com 5 projetos, 25 ambientes, 300 produtos e 500 itens de orçamento.

- [ ] **Passo 4: Provar que é idempotente**

```bash
DATABASE_URL="postgresql://arqsmart:arqsmart@localhost:55432/arqsmart_seed_test" ./venv/Scripts/python.exe tools/seed.py
```

Esperado: exatamente os mesmos números da primeira execução.

- [ ] **Passo 5: Provar que a guarda de produção morde**

```bash
DATABASE_URL="postgresql://u:s@db.abcdef.supabase.co:5432/postgres" ./venv/Scripts/python.exe tools/seed.py; echo "saida: $?"
```

Esperado: a mensagem recusando a URL e `saida: 1`, **sem nenhuma escrita**.

- [ ] **Passo 6: Apagar os quatro scripts antigos e atualizar o README**

```bash
git rm ArchSmart-api/tools/seed_clipper.py ArchSmart-api/tools/seed_mock.py ArchSmart-api/tools/seed_products.py ArchSmart-api/tools/seed_tokstok.py
```

Em `ArchSmart-api/tools/README.md`, substitua as quatro entradas pela do `seed.py`, com o comando completo e os defaults.

- [ ] **Passo 7: Corrigir o caminho errado nos dois documentos**

`PROGRESS.md` (tarefa 5 da Seção 3) e a spec (Seção 3, tabela de ambientes) dizem `tools/seed.py`. O caminho certo é `ArchSmart-api/tools/seed.py`: o `tools/` da raiz é para scripts que checam o próprio repositório e nunca falam com o banco da aplicação (`CLAUDE.md`, tabela de estrutura). Corrija a menção nos dois arquivos.

- [ ] **Passo 8: Limpar o banco da sonda e commitar**

```bash
docker exec archsmart-api-postgres-test-1 psql -U arqsmart -d postgres -c "DROP DATABASE IF EXISTS arqsmart_seed_test;"
git add ArchSmart-api/tools/ PROGRESS.md docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md
git commit -m "feat: seed unico com volume realista, no tools/ da API"
```

---

### Tarefa 10: Fechamento

**Files:**
- Modify: `CLAUDE.md`, `ArchSmart-web/CLAUDE.md`, `PROGRESS.md`, `docs/dev/arquitetura.md`

**Interfaces:**
- Consumes: tudo acima.
- Produces: `develop` com a Seção 3 integrada.

- [ ] **Passo 1: Resolver os dois bloqueadores registrados no `CLAUDE.md`**

A seção "Antes de começar a Seção 3" descreve dois itens em aberto. Ambos foram resolvidos:

1. O vitest deixou de coletar `e2e/` (Tarefa 1). A seção sai, e "Rodando os testes" perde a ressalva de que o frontend falha em 2 arquivos — passa a `npm test`, com 4 arquivos e 7 testes.
2. **"Confirm email" está ligada** no Supabase, confirmado por Thiago em 24/08/2026. O auto-link por e-mail em `app/api/users.py` continua errado e continua marcado para a Seção 4, mas **não** é explorável por quem apenas conhece o e-mail da vítima. Atualize a advertência em `docs/dev/arquitetura.md`, seção "pendência de segurança conhecida", trocando a urgência não confirmada pelo fato medido e mantendo o achado aberto.

No lugar da seção removida, escreva uma **"Portões de CI"** curta: o que bloqueia, o que é catraca, e que baixar um número da catraca pede `python tools/catraca.py --atualizar` no mesmo commit.

Em `ArchSmart-web/CLAUDE.md`, remova a descrição do defeito de configuração do vitest e registre os comandos novos (`npm test`, `npm run typecheck`).

- [ ] **Passo 2: Atualizar o bloco de estado e o `PROGRESS.md`**

No `CLAUDE.md`, o "Estado em 24/08/2026" ganha a Seção 3.

No `PROGRESS.md`, marque **apenas** as tarefas concluídas de fato. As tarefas 2, 3 e 4 da Seção 3 (`staging` com ambiente online, Supabase local, banco de produção novo) dependem de passos de painel que só Thiago executa: deixe-as **desmarcadas**, com a nota de que o roteiro está em `docs/dev/ambientes-online.md` e o que falta é a execução. Marcar tarefa por causa do roteiro seria exatamente a falsidade que a auditoria da Seção 2 pegou.

> Exceção: se, no momento da execução, Thiago já tiver confirmado algum dos passos de painel, marque só o que ele confirmou, citando no commit o que foi confirmado e quando.

```bash
python tools/progresso.py --write
python tools/progresso.py --check; echo "saida: $?"
```

Esperado: `saida: 0`.

- [ ] **Passo 3: Rodar o portão inteiro localmente, uma última vez**

```bash
cd ArchSmart-api && docker compose -f docker-compose.test.yml up -d --wait && ./venv/Scripts/python.exe -m pytest -q
cd ../ArchSmart-web && npm run typecheck && npm test
cd .. && python tools/catraca.py && python tools/progresso.py --check && python tools/checa_links.py
cd tools && python -m unittest discover -p "test_*.py" 2>&1 | tail -2
```

Esperado: `31 passed` no backend, 7 testes no frontend, catraca sem nenhum `[X]`, e `OK` nos testes de `tools/`.

- [ ] **Passo 4: Commit e confirmação do CI**

```bash
git add CLAUDE.md ArchSmart-web/CLAUDE.md PROGRESS.md docs/dev/arquitetura.md
git commit -m "docs: fecha a Secao 3 e resolve os dois bloqueadores registrados"
git push
gh run watch $(gh run list --branch secao-3-esteira-e-ambientes --limit 1 --json databaseId --jq '.[0].databaseId')
```

Esperado: os três jobs verdes.

- [ ] **Passo 5: Revisão antes do merge**

Use `superpowers:requesting-code-review`. Só siga adiante com os achados endereçados.

- [ ] **Passo 6: Merge em `develop`**

```bash
git checkout develop
git merge --no-ff secao-3-esteira-e-ambientes -m "merge: Secao 3 — esteira, ambientes e branches"
git push origin develop
```

- [ ] **Passo 7: Registrar o sha do merge**

No `CLAUDE.md`, o bloco de estado ganha o sha, como as Seções 1 e 2 têm:

```bash
git rev-parse --short HEAD
```

Commite com `docs: preenche o sha do merge da Secao 3 no bloco de estado`.

---

## Verificação final da seção

Nenhuma tarefa é marcada sem o comando que a demonstra. Ao fim, estes são os comandos e os resultados esperados:

| Afirmação | Comando | Esperado |
|---|---|---|
| Backend passa, incluindo a receita | `pytest -q` | `31 passed` |
| Frontend passa | `npm test` | 4 arquivos, 7 testes |
| Tipos limpos | `npm run typecheck` | saída 0, sem linhas |
| Um banco vazio vira o banco certo, e portavel | `pytest tests/test_receita_migracoes.py -q` | `2 passed` |
| Nada piorou | `python tools/catraca.py --eslint-json ArchSmart-web/eslint.json` | nenhum `[X]` |
| `PROGRESS.md` é honesto | `python tools/progresso.py --check` | saída 0 |
| Portão roda no GitHub | `gh run list --branch develop --limit 1` | conclusão `success` |

Fica **pendente de execução por Thiago**, com roteiro em `docs/dev/ambientes-online.md`: serviço de staging no Render, preview da Vercel, projeto Supabase de staging, banco de produção novo e branch protection nas três branches. As tarefas 2, 3 e 4 da Seção 3 no `PROGRESS.md` só são marcadas depois disso.
