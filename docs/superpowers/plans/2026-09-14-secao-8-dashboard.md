# Seção 8 — Dashboard: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o Dashboard para o padrão da Biblioteca — prefetch no servidor, `QueryBoundary`, `features/dashboard` — com uma requisição e 5 consultas por carregamento, e fechar na mesma passada de navegador os itens de olho humano que a Biblioteca deixou abertos.

**Architecture:** Cada query prefetchada vira uma fábrica `queryOptions(cliente)` em `features/<dominio>/queries.ts`, chamada com `apiServer` no Server Component e com `api` no hook — a chave deixa de poder divergir. `page.tsx` do Dashboard vira Server Component com `<Suspense>` + `DashboardData` (prefetch) + `HydrationBoundary` + `DashboardContent` (cliente, `QueryBoundary`). No backend, `/api/dashboard/lean` cai de 8 para 5 consultas e passa a devolver `financial_entries_count`; `/api/users/me` cai de 5 para 3.

**Tech Stack:** Next.js 16 (App Router), React 19, `@tanstack/react-query` 5.90, Vitest + Testing Library, Playwright; FastAPI + SQLAlchemy 2 + Postgres 17, pytest contra Postgres em Docker.

**Spec:** [`docs/superpowers/specs/2026-09-14-secao-8-dashboard-design.md`](../specs/2026-09-14-secao-8-dashboard-design.md) — leia inteira antes da Tarefa 1. Ela tem as cinco decisões de Thiago e a razão de cada uma.

## Global Constraints

- Branch: `secao-8-dashboard` (já existe, com a spec commitada). Merge em `develop`, PR `develop` → `staging`.
- A marca é **"Arq Smart"** — nunca `ArchSmart`, `Ark Smart` ou `Ecowe` em código, copy ou comentário (Art. 8).
- Nenhuma cor literal em classe utilitária (`bg-emerald-600`, `text-slate-700`, `bg-[#...]`) — só tokens semânticos (Art. 7).
- Nenhum `account_id`, URL, host ou limite de plano literal no código (Arts. 1, 3, 4).
- Endpoint não chama `db.query()` em model com `account_id`; lê e escreve por `ScopedRepository` (`tests/test_arquitetura.py` reprova).
- **Número afirmado sem medição é número errado.** Todo número que entrar em commit ou doc vai com o comando que o produz.
- **Nada de "é esperado que falhe".** Um comando vermelho é defeito.
- **Não migre área de passagem.** Projetos, Billing e Perfil continuam no padrão antigo; o N+1 de `/api/projects` não é tocado.
- Achado de layout na Biblioteca durante a passada de navegador: **registrar, nunca consertar sem ok de Thiago.**
- Catraca: quando uma medida descer, `python tools/catraca.py --atualizar` **no mesmo commit**. Nunca editar `tools/catraca.json` à mão.
- Todo commit termina com:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CakYQdZyHoEKwuWa7pcMHx
  ```

### Comandos que o plano usa

```bash
# frontend, de ArchSmart-web/
npx vitest run <arquivo>        # um arquivo
npm run typecheck && npm test   # o que o CI roda

# backend, de ArchSmart-api/ (Postgres de teste precisa estar de pé)
docker compose -f docker-compose.test.yml up -d --wait
./venv/Scripts/python.exe -m pytest <arquivo>::<teste> -q
./venv/Scripts/python.exe -m pytest -q

# repositório, da RAIZ
python tools/catraca.py
python tools/progresso.py --check
python tools/checa_links.py
```

> ⚠️ **Git Bash no Windows reescreve argumentos que começam com `/`** —
> `/api/dashboard/lean` vira `C:/Program Files/Git/api/dashboard/lean`. Em
> script que recebe rota por argumento, prefixe `MSYS_NO_PATHCONV=1`.

---

### Task 1: `queryOptions` — uma definição só para o prefetch e o hook, com a Biblioteca migrada

**Por quê:** item 10 da Biblioteca, decisão 4 da spec. Hoje `LibraryData` (servidor) e `useProducts`/`useInboxCount` (cliente) montam a mesma chave em dois lugares; divergir não dá erro, só faz o prefetch virar custo puro.

**O detalhe que esta tarefa resolve:** `tentarPrefetch` passa um `AbortSignal` com teto de 3 s, e hoje `LibraryData` o repassa à mão para `apiServer`. Com a fábrica, a `queryFn` recebe o `signal` do **React Query**, não o do teto. A solução é embrulhar o cliente: `clienteComSinal(apiServer, signal)` devolve um `ClienteApi` que aborta quando **qualquer** um dos dois sinais abortar (`AbortSignal.any`, Node ≥ 20; medido: `node --version` → v24.18.0).

**Files:**
- Modify: `ArchSmart-web/src/lib/query/hydration.ts` (acrescenta `clienteComSinal`)
- Create: `ArchSmart-web/src/features/library/queries.ts`
- Modify: `ArchSmart-web/src/features/library/hooks.ts` (`useProducts`, `useInboxCount`)
- Modify: `ArchSmart-web/src/app/(dashboard)/library/components/LibraryData.tsx`
- Test: `ArchSmart-web/src/__tests__/query-options.test.ts` (novo)
- Test (continua valendo, não editar): `ArchSmart-web/src/__tests__/library-query-payload.test.tsx`, `library-hooks.test.tsx`

**Interfaces:**
- Produces: `clienteComSinal(cliente: ClienteApi, sinal: AbortSignal): ClienteApi` em `@/lib/query/hydration`
- Produces: `queryDaListaDeProdutos(cliente: ClienteApi, filtros: FiltrosDeProduto)` e `queryDoBadgeDoInbox(cliente: ClienteApi)` em `@/features/library/queries` — ambas devolvem o objeto de `queryOptions` (chave + `queryFn` + `cachePolicy.transacional`)

- [ ] **Step 1: Escrever o teste que falha**

`ArchSmart-web/src/__tests__/query-options.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import type { ClienteApi } from "@/lib/api/core"
import { queryKeys } from "@/lib/query/keys"
import { clienteComSinal } from "@/lib/query/hydration"
import { queryDaListaDeProdutos, queryDoBadgeDoInbox } from "@/features/library/queries"
import { queryDeProdutos, queryDoInbox } from "@/features/library/api"

/**
 * A fabrica e a fonte unica: o servidor chama com `apiServer`, o hook com
 * `api`, e os dois recebem a MESMA chave e o MESMO payload. Estes testes
 * prendem o que a fabrica devolve; o que prende que o servidor e o hook USAM a
 * fabrica e `library-query-payload.test.tsx`, que ja existia.
 */
describe("fabricas de query da Biblioteca", () => {
    const filtros = { tab: "inbox", q: "cadeira", page: 2, size: 15 }

    it("a lista usa a chave de products.list e o payload de queryDeProdutos", async () => {
        const cliente = vi.fn().mockResolvedValue({ items: [] }) as unknown as ClienteApi
        const opcoes = queryDaListaDeProdutos(cliente, filtros)

        expect(opcoes.queryKey).toEqual(queryKeys.products.list(filtros))

        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/products/", {
            signal: sinal,
            query: queryDeProdutos(filtros),
        })
    })

    it("o badge usa a chave de products.inboxCount e o payload de queryDoInbox", async () => {
        const cliente = vi.fn().mockResolvedValue({ total: 3 }) as unknown as ClienteApi
        const opcoes = queryDoBadgeDoInbox(cliente)

        expect(opcoes.queryKey).toEqual(queryKeys.products.inboxCount())

        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/products/", {
            signal: sinal,
            query: queryDoInbox(),
        })
    })
})

describe("clienteComSinal", () => {
    it("aborta a chamada quando o sinal do teto aborta, mesmo sem sinal do React Query", async () => {
        let recebido: AbortSignal | undefined
        const cliente = vi.fn(async (_p: string, req?: { signal?: AbortSignal }) => {
            recebido = req?.signal
            return null
        }) as unknown as ClienteApi

        const teto = new AbortController()
        await clienteComSinal(cliente, teto.signal)("/api/x")

        expect(recebido?.aborted).toBe(false)
        teto.abort()
        expect(recebido?.aborted).toBe(true)
    })

    it("aborta tambem quando o sinal da propria requisicao aborta", async () => {
        let recebido: AbortSignal | undefined
        const cliente = vi.fn(async (_p: string, req?: { signal?: AbortSignal }) => {
            recebido = req?.signal
            return null
        }) as unknown as ClienteApi

        const doReactQuery = new AbortController()
        await clienteComSinal(cliente, new AbortController().signal)("/api/x", {
            signal: doReactQuery.signal,
        })

        doReactQuery.abort()
        expect(recebido?.aborted).toBe(true)
    })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run (de `ArchSmart-web/`): `npx vitest run src/__tests__/query-options.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/library/queries"`.

- [ ] **Step 3: `clienteComSinal` em `hydration.ts`**

Acrescentar ao fim de `ArchSmart-web/src/lib/query/hydration.ts` (e o import no topo):

```ts
import type { ClienteApi } from "@/lib/api/core"
```

```ts
/**
 * Um cliente que aborta quando o teto de `tentarPrefetch` aborta.
 *
 * Existe por causa das fabricas de `features/<dominio>/queries.ts`: la a
 * `queryFn` recebe o `signal` do REACT QUERY, nao o do teto. Antes delas o
 * `LibraryData` repassava o sinal do teto a mao para `apiServer`; sem este
 * embrulho, a fabrica perderia isso e um cold start voltaria a pendurar a
 * conexao ate a API responder — o custo que `tentarPrefetch` documenta.
 *
 * `AbortSignal.any` aborta quando QUALQUER um aborta: o teto, ou o proprio
 * React Query cancelando a query.
 */
export function clienteComSinal(cliente: ClienteApi, sinal: AbortSignal): ClienteApi {
    return (path, req = {}) =>
        cliente(path, {
            ...req,
            signal: req.signal ? AbortSignal.any([req.signal, sinal]) : sinal,
        })
}
```

- [ ] **Step 4: As fábricas da Biblioteca**

`ArchSmart-web/src/features/library/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"

import type { ClienteApi } from "@/lib/api/core"
import { cachePolicy, queryKeys, type FiltrosDeProduto } from "@/lib/query/keys"

import { queryDeProdutos, queryDoInbox } from "./api"
import type { ProductsResponse } from "./types"

/**
 * As queries que a Biblioteca prefetcha, definidas UMA vez.
 *
 * O servidor (`LibraryData`) chama com `apiServer`, o cliente (`hooks.ts`) com
 * `api`. Chave, `queryFn` e politica de cache saem daqui para os dois lados —
 * divergir deixa de ser possivel de escrever. Ate a Secao 8 os dois lados
 * montavam cada chave a mao, e o piloto errou isso uma vez: o prefetch vira
 * custo puro sem erro nenhum.
 *
 * Este arquivo NAO importa `@/lib/api/client` (que e "use client"): quem
 * escolhe o cliente e quem chama. `select`, `enabled` e `placeholderData` ficam
 * no hook — o que se prefetcha e a resposta crua.
 */
export const queryDaListaDeProdutos = (cliente: ClienteApi, filtros: FiltrosDeProduto) =>
    queryOptions({
        queryKey: queryKeys.products.list(filtros),
        queryFn: ({ signal }) =>
            cliente<ProductsResponse>("/api/products/", { signal, query: queryDeProdutos(filtros) }),
        ...cachePolicy.transacional,
    })

export const queryDoBadgeDoInbox = (cliente: ClienteApi) =>
    queryOptions({
        queryKey: queryKeys.products.inboxCount(),
        queryFn: ({ signal }) =>
            cliente<ProductsResponse>("/api/products/", { signal, query: queryDoInbox() }),
        ...cachePolicy.transacional,
    })
```

- [ ] **Step 5: Rodar o teste novo**

Run: `npx vitest run src/__tests__/query-options.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 6: Hooks passam a usar as fábricas**

Em `ArchSmart-web/src/features/library/hooks.ts`, trocar `useProducts` e `useInboxCount` por:

```ts
export function useProducts(filtros: FiltrosDeProduto, opcoes: { ativo?: boolean } = {}) {
    return useQuery({
        ...queryDaListaDeProdutos(api, filtros),
        enabled: opcoes.ativo ?? true,
        // Mantem a lista anterior visivel enquanto a nova carrega: sem isso a
        // grade pisca em branco a cada pagina e a cada filtro.
        placeholderData: (anterior) => anterior,
    })
}

export function useInboxCount() {
    return useQuery({
        ...queryDoBadgeDoInbox(api),
        select: (resposta) => resposta.total,
    })
}
```

Imports no topo: acrescentar `import { api } from "@/lib/api/client"` e
`import { queryDaListaDeProdutos, queryDoBadgeDoInbox } from "./queries"`; tirar
`contarInbox` e `listarProdutos` da lista de `./api` **só se** o `tsc` acusar
import sem uso. Não apagar `listarProdutos`/`contarInbox` de `api.ts`:
`library-query-payload.test.tsx` os usa.

- [ ] **Step 7: `LibraryData` passa a usar as fábricas**

Substituir o `Promise.all` de `LibraryData.tsx` por:

```ts
    await Promise.all([
        tentarPrefetch((signal) =>
            queryClient.prefetchQuery(
                queryDaListaDeProdutos(clienteComSinal(apiServer, signal), filtros),
            ),
        ),
        tentarPrefetch((signal) =>
            queryClient.prefetchQuery(queryDoBadgeDoInbox(clienteComSinal(apiServer, signal))),
        ),
    ])
```

Imports: `clienteComSinal` de `@/lib/query/hydration`; as duas fábricas de
`@/features/library/queries`; remover `queryKeys`, `queryDeProdutos`,
`queryDoInbox` e `ProductsResponse` se ficarem sem uso. **Reescrever o
comentário** acima do `Promise.all`: o parágrafo sobre "a MESMA função que
`contarInbox` usa" passa a dizer que chave e payload vêm da fábrica.

- [ ] **Step 8: Rodar a suíte inteira e o typecheck**

Run: `npm run typecheck && npm test`
Expected: `tsc` sem erro; `Test Files 31 passed (31)` e nenhum `failed`. **`library-query-payload.test.tsx` precisa continuar verde sem edição** — é ele que prova que servidor e cliente mandam o mesmo payload.

- [ ] **Step 9: Commit**

```bash
git add ArchSmart-web/src/lib/query/hydration.ts ArchSmart-web/src/features/library/queries.ts \
        ArchSmart-web/src/features/library/hooks.ts \
        "ArchSmart-web/src/app/(dashboard)/library/components/LibraryData.tsx" \
        ArchSmart-web/src/__tests__/query-options.test.ts
git commit -m "refactor(web): prefetch e hook da Biblioteca saem da mesma fabrica queryOptions

<corpo: por que (item 10 da Biblioteca), o clienteComSinal e o problema do
sinal do teto que ele resolve, e que library-query-payload continua verde
sem edicao>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CakYQdZyHoEKwuWa7pcMHx"
```

---

### Task 2: `/api/users/me` de 5 para 3 consultas

**Por quê:** a rota relê o usuário que o caminho compartilhado acabou de carregar, recalcula entitlements que o `RequestContext` já traz, e busca `plans` numa consulta separada. Billing, Perfil e Projetos a consomem.

**O mecanismo do usuário sem consulta:** `get_context` e `get_repo` recebem a **mesma** `Session` (`Depends(get_db)` é resolvido uma vez por requisição pelo FastAPI), e o caminho compartilhado carrega o `User` nela. `Session.get(User, id)` consulta a **identity map antes do banco** — então devolve o usuário sem ida nenhuma. `repo.get()` não serve: é um `SELECT` com filtro de conta. O método novo mora em `app/db/repository.py`, que é o dono do escopo e fica fora do lint de query direta.

**Files:**
- Modify: `ArchSmart-api/app/db/repository.py` (método `usuario()`)
- Modify: `ArchSmart-api/app/api/users.py:18-89` (`get_current_user_profile`)
- Create: `ArchSmart-api/tests/contador_de_queries.py`
- Test: `ArchSmart-api/tests/api/test_me.py` (acrescenta dois testes)

**Interfaces:**
- Produces: `ScopedRepository.usuario(self) -> User` — o usuário da sessão; levanta `NotFound` se não existir ou for de outra conta
- Produces: `tests/contador_de_queries.py::ContadorDeQueries` e `tests/contador_de_queries.py::contexto_de_verdade(client, usuario, monkeypatch)` — context manager que faz a requisição passar pelo `get_context` real

- [ ] **Step 1: O contador e o contexto de verdade, compartilhados**

`ArchSmart-api/tests/contador_de_queries.py`:

```python
"""
Conta idas ao banco, e faz a requisicao passar pelo `get_context` de verdade.

Existem porque cada consulta e uma ida a rede, e na API implantada cada ida
custa 0,17 s (docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md).
Tres arquivos de teste ja tinham a sua copia do contador; os testes novos usam
esta.

`contexto_de_verdade` importa porque as fixtures `client_a`/`client_b`
SOBREPOEM `get_context`: com a sobreposicao, o caminho compartilhado nao roda,
o `User` nao entra na identity map, e a contagem mediria uma requisicao que a
producao nunca faz.
"""
from contextlib import contextmanager

from sqlalchemy import event

from app.services.auth_service import auth_service


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

    def resumo(self) -> str:
        return "\n  ".join(" ".join(sql.split())[:90] for sql in self.sqls)


@contextmanager
def contexto_de_verdade(client, usuario, monkeypatch):
    """
    A validacao local do JWT falha (segredo None, token que nao e JWT) e a
    remota e stubada para SUCEDER com o `sub` do usuario: e o caminho que
    resolve identidade no banco, igual a producao.
    """
    monkeypatch.setattr("app.core.security.settings.SUPABASE_JWT_SECRET", None)

    async def _resolve(_token):
        return {"id": usuario.supabase_id, "email": usuario.email}

    monkeypatch.setattr(auth_service, "get_user", _resolve)
    with client.sem_sobreposicao_de_contexto():
        yield {"Authorization": "Bearer nao-e-jwt"}
```

- [ ] **Step 2: Escrever os testes que falham**

Acrescentar ao fim de `ArchSmart-api/tests/api/test_me.py` (e os imports no topo:
`from tests.contador_de_queries import ContadorDeQueries, contexto_de_verdade`):

```python
def test_me_gasta_no_maximo_tres_consultas_com_assinatura_e_plano(
    db: Session, client_a, conta_a, monkeypatch
):
    """
    Com assinatura E plano, que e o caso que mais consultava: usuario de novo,
    conta, assinatura, plano e entitlements recalculados. O teto e 3: o caminho
    compartilhado (1), a conta (1) e assinatura com plano num join (1).
    """
    conta, usuario = conta_a
    plano = Plan(name="Estudio", limits={"project_limit": 25})
    db.add(plano)
    db.flush()
    db.add(Subscription(account_id=conta.id, plan_id=plano.id))
    db.flush()

    with contexto_de_verdade(client_a, usuario, monkeypatch) as headers:
        with ContadorDeQueries(db.connection()) as contador:
            r = client_a.get("/api/users/me", headers=headers)

    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["account"]["plan_name"] == "Estudio"
    assert corpo["entitlements"]["project_limit"] == 25
    assert len(contador) <= 3, f"{len(contador)} consultas:\n  {contador.resumo()}"


def test_me_nao_devolve_usuario_de_outra_conta_pelo_atalho_da_sessao(
    db: Session, conta_a, conta_b
):
    """
    `repo.usuario()` le da identity map, e a identity map nao sabe de conta.
    A guarda de `account_id` dentro do metodo e o que impede um contexto
    inconsistente de devolver o usuario errado.
    """
    import pytest

    from app.core.errors import NotFound
    from app.core.security import RequestContext
    from app.db.repository import ScopedRepository

    _, usuario_b = conta_b
    db.get(type(usuario_b), usuario_b.id)  # garante que esta na identity map
    ctx = RequestContext(
        user_id=usuario_b.id,
        account_id=conta_a[0].id,  # conta errada de proposito
        email=usuario_b.email,
        entitlements={},
    )

    with pytest.raises(NotFound):
        ScopedRepository(db, ctx).usuario()
```

- [ ] **Step 3: Rodar e ver falhar**

Run (de `ArchSmart-api/`): `./venv/Scripts/python.exe -m pytest tests/api/test_me.py -q`
Expected: 2 falhas — a de contagem com `5 consultas` (ou mais) na mensagem, e a
outra com `AttributeError: 'ScopedRepository' object has no attribute 'usuario'`.

- [ ] **Step 4: `ScopedRepository.usuario()`**

Em `ArchSmart-api/app/db/repository.py`, logo depois de `obter`:

```python
    def usuario(self) -> "User":
        """
        O usuario da sessao, sem ida ao banco no caminho normal.

        `get_context` e `get_repo` recebem a MESMA `Session` (o FastAPI resolve
        `Depends(get_db)` uma vez por requisicao), e o caminho compartilhado ja
        carregou este `User` nela. `Session.get` consulta a identity map antes
        do banco: zero consultas. Fora desse caminho — um teste com contexto
        sobreposto, por exemplo — ele faz UMA consulta por chave primaria.

        A identity map nao sabe de conta, entao a guarda de `account_id` aqui
        e a que o `repo.get()` faria pelo `WHERE`. Nunca 403: 404, pelo mesmo
        motivo de `obter`.
        """
        from app.models.all_models import User

        achado = self.db.get(User, self.ctx.user_id)
        if achado is None or achado.account_id != self.ctx.account_id:
            raise NotFound()
        return achado
```

(O import fica dentro do método por cautela: `repository.py` importa
`app.core.security`, que importa `app.models.all_models`, e import circular em
Python só aparece em tempo de execução. Se mover o import para o topo e
`./venv/Scripts/python.exe -m pytest -q` continuar verde, pode deixar no topo.)

- [ ] **Step 5: `get_current_user_profile` com 3 consultas**

Em `ArchSmart-api/app/api/users.py`:

1. `usuario = repo.obter(User, repo.ctx.user_id)` → `usuario = repo.usuario()`
2. Substituir o bloco da assinatura (de `subscription = repo.query(Subscription)...`
   até o fim do `if subscription:`) por:

```python
    # Assinatura e nome do plano num JOIN so. `plans` e catalogo global, sem
    # account_id: o escopo vem da `subscriptions` do `repo.query`, e o
    # outerjoin traz o nome sem uma segunda ida. `order_by(Subscription.id)`
    # e a MESMA ordem de `entitlements_de` no caminho compartilhado
    # (app/core/security.py) — status/plano daqui e entitlements dali tem de
    # sair da MESMA linha quando a conta tem mais de uma assinatura.
    linha = (
        repo.query(Subscription)
        .outerjoin(Plan, Plan.id == Subscription.plan_id)
        .order_by(Subscription.id)
        .with_entities(Subscription.status, Plan.name)
        .first()
    )
    subscription_status = "BETA"  # Default
    plan_name = None
    if linha is not None:
        subscription_status, plan_name = linha
```

3. `entitlements=entitlements_da_conta(db, repo.ctx.account_id)` →
   `entitlements=dict(repo.ctx.entitlements)` na resposta de `GET /me`
   **apenas** (a de `PUT /profile`, linha ~155, fica como está — fora do
   escopo). Comentário acima: os entitlements já foram resolvidos pelo caminho
   compartilhado, da mesma linha de assinatura.

- [ ] **Step 6: Rodar os testes de `/me`, de identidade e a suíte**

Run: `./venv/Scripts/python.exe -m pytest tests/api/test_me.py tests/api/test_identidade.py -q`
Expected: todos PASS.
Run: `./venv/Scripts/python.exe -m pytest -q`
Expected: `355 passed, 1 skipped` (eram 353 + os 2 novos) — **meça, não copie**; o que importa é zero `failed`.

- [ ] **Step 7: Medir contra o banco de staging, para o commit**

```bash
MSYS_NO_PATHCONV=1 ./venv/Scripts/python.exe "$TEMP/contar_queries.py" /api/users/me
```

(O `contar_queries.py` e o token estão descritos em "Como reproduzir" de
`docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md`; se o script
não existir mais no `$TEMP`, recrie pelo bloco Python de lá.) Expected: `consultas=3`.

- [ ] **Step 8: Commit**

```bash
git add ArchSmart-api/app/db/repository.py ArchSmart-api/app/api/users.py \
        ArchSmart-api/tests/contador_de_queries.py ArchSmart-api/tests/api/test_me.py
git commit -m "perf(api): /api/users/me de 5 para 3 consultas

<corpo: as tres idas que sumiram e por que cada uma sumiu; repo.usuario()
pela identity map e a guarda de conta; o numero medido contra o banco de
staging com o comando>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CakYQdZyHoEKwuWa7pcMHx"
```

---

### Task 3: `/api/dashboard/lean` de 8 para 5 consultas, com `financial_entries_count`

**Por quê:** decisões 3 e 5 da spec. As três reduções: o `repo.get(User)` vira `repo.usuario()` (−1); saldo realizado e entradas/saídas do mês viram uma agregação com soma condicional (−1); os 4 projetos recentes e a contagem de ativos viram uma consulta com `count(*) OVER ()` (−1).

**Ordem obrigatória:** a caracterização dos **valores** é escrita e fica **verde contra o código antigo** antes de qualquer mudança. Refatorar agregação sem isso é trocar número certo por número parecido.

**Files:**
- Modify: `ArchSmart-api/app/api/endpoints/dashboard.py`
- Modify: `ArchSmart-api/app/schemas/dashboard_schema.py` (campo `financial_entries_count`)
- Test: `ArchSmart-api/tests/api/test_dashboard_lean.py` (novo)

**Interfaces:**
- Consumes: `ScopedRepository.usuario()` (Task 2), `tests/contador_de_queries.py` (Task 2)
- Produces: `DashboardLeanResponse.financial_entries_count: int` na resposta de `GET /api/dashboard/lean`

- [ ] **Step 1: A caracterização dos valores**

`ArchSmart-api/tests/api/test_dashboard_lean.py`:

```python
"""
/api/dashboard/lean: os valores que a tela mostra, e quantas idas custam.

O primeiro teste e CARACTERIZACAO — escrito e verde contra o codigo anterior a
Task 3 do plano do Dashboard. Ele existe porque a task troca duas agregacoes
por uma com soma condicional, e agregacao errada nao da erro: da numero.

O segundo prende o custo. Cada consulta e uma ida a rede, 0,17 s na API
implantada (docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md).
"""
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.all_models import Event, FinancialEntry, Product
from tests.conftest import criar_projeto
from tests.contador_de_queries import ContadorDeQueries, contexto_de_verdade


def _lancamento(db, conta, valor, tipo, status, vencimento):
    db.add(
        FinancialEntry(
            account_id=conta.id,
            description="Lancamento",
            amount=valor,
            type=tipo,
            status=status,
            due_date=vencimento,
        )
    )
    db.flush()


def _cenario(db: Session, conta, usuario, projetos: int) -> None:
    hoje = date.today()
    # 40 dias antes do dia 1 cai, no minimo, dois meses atras: nunca no mes
    # corrente, em qualquer dia em que o teste rodar.
    fora_do_mes = hoje.replace(day=1) - timedelta(days=40)
    _lancamento(db, conta, 1000.0, "INCOME", "REALIZED", hoje)
    _lancamento(db, conta, 300.0, "EXPENSE", "REALIZED", hoje)
    _lancamento(db, conta, 200.0, "INCOME", "PREDICTED", hoje)
    _lancamento(db, conta, 50.0, "EXPENSE", "REALIZED", fora_do_mes)
    for indice in range(projetos):
        criar_projeto(db, conta, f"Projeto {indice}", usuario)  # status default ACTIVE
    db.add(Product(account_id=conta.id, created_by=usuario.id, name="Cadeira", price=10.0))
    inicio = datetime.now() + timedelta(days=1)
    db.add(
        Event(account_id=conta.id, title="Reuniao", start_time=inicio, end_time=inicio + timedelta(hours=1))
    )
    db.flush()


def test_lean_devolve_os_mesmos_valores(db: Session, client_a, conta_a):
    conta, usuario = conta_a
    _cenario(db, conta, usuario, projetos=6)

    corpo = client_a.get("/api/dashboard/lean").json()

    # saldo = receitas realizadas - despesas realizadas, de qualquer mes
    assert corpo["financial_balance"] == 1000.0 - 300.0 - 50.0
    # entradas e saidas do MES, previstas e realizadas
    assert corpo["financial_income"] == 1000.0 + 200.0
    assert corpo["financial_expense"] == 300.0
    # a contagem e de todos os ativos; a lista para em 4
    assert corpo["active_projects_count"] == 6
    assert len(corpo["recent_projects"]) == 4
    assert len(corpo["recent_products"]) == 1
    assert len(corpo["upcoming_events"]) == 1
```

- [ ] **Step 2: Rodar a caracterização contra o código antigo**

Run: `./venv/Scripts/python.exe -m pytest tests/api/test_dashboard_lean.py -q`
Expected: **PASS**. Se falhar, o cenário ou a leitura do código está errada —
conserte o **teste** até ele descrever o presente, e só então siga.

- [ ] **Step 3: Os testes que falham — contagem e o campo novo**

Acrescentar a `test_dashboard_lean.py`:

```python
def test_lean_conta_os_lancamentos(db: Session, client_a, conta_a):
    """
    "Dashboard vazio" (decisao 3 da spec) inclui zero lancamentos, e isso nao
    se deduz de somas zeradas: lancamentos que se anulam somam zero.
    """
    conta, usuario = conta_a
    _cenario(db, conta, usuario, projetos=1)

    corpo = client_a.get("/api/dashboard/lean").json()

    assert corpo["financial_entries_count"] == 4


def test_lean_nao_cresce_com_os_projetos_e_gasta_no_maximo_cinco(
    db: Session, client_a, conta_a, monkeypatch
):
    conta, usuario = conta_a

    def consultas() -> tuple[int, str]:
        with contexto_de_verdade(client_a, usuario, monkeypatch) as headers:
            with ContadorDeQueries(db.connection()) as contador:
                r = client_a.get("/api/dashboard/lean", headers=headers)
        assert r.status_code == 200, r.text
        return len(contador), contador.resumo()

    _cenario(db, conta, usuario, projetos=1)
    com_um, _ = consultas()
    for indice in range(5):
        criar_projeto(db, conta, f"Mais {indice}", usuario)
    com_seis, resumo = consultas()

    assert com_um == com_seis, f"cresceu com os projetos: {com_um} -> {com_seis}"
    # 1 caminho compartilhado + projetos com contagem + produtos + financeiro + eventos
    assert com_seis <= 5, f"{com_seis} consultas:\n  {resumo}"
```

Run: `./venv/Scripts/python.exe -m pytest tests/api/test_dashboard_lean.py -q`
Expected: 2 FAIL — `KeyError: 'financial_entries_count'` e `8 consultas` na mensagem; a caracterização continua PASS.

- [ ] **Step 4: O schema**

Em `ArchSmart-api/app/schemas/dashboard_schema.py`, em `DashboardLeanResponse`,
depois de `financial_expense: float`:

```python
    financial_entries_count: int
```

- [ ] **Step 5: O endpoint**

Em `ArchSmart-api/app/api/endpoints/dashboard.py`:

Imports: `from sqlalchemy import and_, case, desc, extract, func`. Remover `User` do
import de models se ficar sem uso.

(a) Mover `now = datetime.now()` para o topo da função (é usado pelo financeiro e pelos eventos).

(b) Substituir o bloco "1. Projetos Recentes" **e** o bloco "Contagem de projetos ativos" por:

```python
    # 1. Projetos recentes E a contagem de ativos, numa ida so.
    #
    # `count(*) OVER ()` e calculado ANTES do LIMIT: cada uma das ate 4 linhas
    # carrega o total de ativos. Era uma consulta separada, e cada consulta
    # custa 0,17 s na API implantada.
    #
    # ⚠️ Semantica: conta projetos ativos CUJO CLIENTE E DA MESMA CONTA, porque
    # a contagem agora passa pelo JOIN abaixo. A consulta anterior contava todo
    # projeto ativo. Os dois conjuntos so divergem num estado que o schema
    # permite e nenhum caminho de escrita produz — o descrito a seguir.
    #
    # O `Client.account_id == repo.ctx.account_id` no ON e obrigatorio, e nao
    # redundante. `repo.query(Project)` escopa PROJECT; o `with_entities` traz
    # colunas de CLIENT, que o escopo do repositorio nao alcanca - e o
    # `client.name` vai para a resposta logo abaixo. Nenhuma constraint do
    # banco proibe um `projects.client_id` apontando para o cliente de outra
    # conta; hoje nao acontece porque todo caminho que grava esse FK resolve o
    # cliente por `repo.obter`/`repo.get` antes, mas isso e disciplina de
    # codigo, nao invariante de schema. Mesmo padrao de
    # `financial.py::list_financial_entries`.
    linhas_de_projeto = (
        repo.query(Project)
        .join(
            Client,
            and_(
                Project.client_id == Client.id,
                Client.account_id == repo.ctx.account_id,
            ),
        )
        .filter(Project.status == "ACTIVE")
        .order_by(desc(Project.created_at))
        .with_entities(Project.id, Project.name, Client.name, func.count().over())
        .limit(4)
        .all()
    )
    recent_projects = [
        {"id": pid, "name": nome, "client_name": cliente}
        for pid, nome, cliente, _ in linhas_de_projeto
    ]
    active_projects_count = linhas_de_projeto[0][3] if linhas_de_projeto else 0
```

(c) Substituir os dois blocos de "3. Métricas Financeiras" (saldo e mensal) por:

```python
    # 3. Metricas financeiras numa agregacao so.
    #
    # Eram duas: o saldo (so REALIZED, qualquer data) e o mes (qualquer status,
    # so o mes corrente). A soma condicional separa as duas no mesmo SELECT, e o
    # `count` sai de graca para a definicao de "Dashboard vazio" (decisao 3 da
    # spec do Dashboard). `test_lean_devolve_os_mesmos_valores` foi escrito
    # verde contra a versao de duas consultas antes desta troca.
    do_mes = and_(
        extract("month", FinancialEntry.due_date) == now.month,
        extract("year", FinancialEntry.due_date) == now.year,
    )
    linhas_financeiras = (
        repo.query(FinancialEntry)
        .with_entities(
            FinancialEntry.type,
            func.coalesce(
                func.sum(case((FinancialEntry.status == "REALIZED", FinancialEntry.amount), else_=0.0)),
                0.0,
            ),
            func.coalesce(func.sum(case((do_mes, FinancialEntry.amount), else_=0.0)), 0.0),
            func.count(FinancialEntry.id),
        )
        .group_by(FinancialEntry.type)
        .all()
    )

    financial_balance = 0.0
    financial_income = 0.0
    financial_expense = 0.0
    financial_entries_count = 0
    for tipo, realizado, do_mes_total, quantos in linhas_financeiras:
        financial_entries_count += quantos
        if tipo == "INCOME":
            financial_balance += realizado
            financial_income = do_mes_total
        elif tipo == "EXPENSE":
            financial_balance -= realizado
            financial_expense = do_mes_total
```

(d) Substituir as linhas do `usuario = repo.get(User, repo.ctx.user_id)` por
`full_name = repo.usuario().full_name`, com o comentário: o usuário vem da
identity map, carregado pelo caminho compartilhado — zero consultas.

(e) Acrescentar `"financial_entries_count": financial_entries_count,` ao dicionário de retorno.

- [ ] **Step 6: Rodar os testes do Dashboard e a suíte**

Run: `./venv/Scripts/python.exe -m pytest tests/api/test_dashboard_lean.py tests/api/test_financeiro_e_agenda.py tests/isolation/test_join_entre_contas.py -q`
Expected: todos PASS — os de isolamento existentes incluídos.
Run: `./venv/Scripts/python.exe -m pytest -q`
Expected: zero `failed`.

- [ ] **Step 7: Medir contra o banco de staging**

```bash
MSYS_NO_PATHCONV=1 ./venv/Scripts/python.exe "$TEMP/contar_queries.py" /api/dashboard/lean
```

Expected: `consultas=5`.

- [ ] **Step 8: Commit**

```bash
git add ArchSmart-api/app/api/endpoints/dashboard.py ArchSmart-api/app/schemas/dashboard_schema.py \
        ArchSmart-api/tests/api/test_dashboard_lean.py
git commit -m "perf(api): /api/dashboard/lean de 8 para 5 consultas, com financial_entries_count

<corpo: as tres reducoes; a caracterizacao escrita verde antes; a mudanca de
semantica da contagem na janela; o numero medido com o comando>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CakYQdZyHoEKwuWa7pcMHx"
```

---

### Task 4: `features/dashboard` e a tela no padrão novo

**Por quê:** o núcleo da migração. Server Component com prefetch, `QueryBoundary` com os cinco estados, zero `fetch` na tela, e o card de limite lendo `plan_limit` de `lean` (decisão 5).

**Files:**
- Create: `ArchSmart-web/src/features/dashboard/types.ts`
- Create: `ArchSmart-web/src/features/dashboard/queries.ts`
- Create: `ArchSmart-web/src/features/dashboard/hooks.ts`
- Create: `ArchSmart-web/src/features/dashboard/vazio.ts`
- Create: `ArchSmart-web/src/app/(dashboard)/dashboard/components/DashboardData.tsx`
- Create: `ArchSmart-web/src/app/(dashboard)/dashboard/components/DashboardContent.tsx`
- Create: `ArchSmart-web/src/app/(dashboard)/dashboard/components/DashboardComErro.tsx`
- Modify: `ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx` (reescrita)
- Modify: `ArchSmart-web/src/lib/query/keys.ts` (`dashboard.lean`)
- Modify: os 5 componentes que importam `./types` → `@/features/dashboard/types`
- Delete: `ArchSmart-web/src/app/(dashboard)/dashboard/components/types.ts`
- Delete: `ArchSmart-web/src/__tests__/Dashboard.test.tsx` (placeholder que afirma `expect(5).toBe(5)` sobre um objeto literal; não testa código nenhum)
- Replace: `ArchSmart-web/src/__tests__/dashboard-page.test.tsx` → `ArchSmart-web/src/__tests__/dashboard-content.test.tsx`
- Create: `ArchSmart-web/src/__tests__/dashboard-data.test.tsx`

**Interfaces:**
- Consumes: `clienteComSinal` (Task 1); `financial_entries_count` e `plan_limit` na resposta (Task 3)
- Produces: `queryDoDashboard(cliente: ClienteApi)` em `@/features/dashboard/queries`; `useDashboard()` em `@/features/dashboard/hooks`; `dashboardVazio(d: DashboardLean): boolean` em `@/features/dashboard/vazio`; `queryKeys.dashboard.lean()`; testids `dashboard-shell-streaming`, `dashboard-painel`, `dashboard-error`

- [ ] **Step 1: A regra de vazio, com teste**

`ArchSmart-web/src/__tests__/dashboard-vazio.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { dashboardVazio } from "@/features/dashboard/vazio"
import type { DashboardLean } from "@/features/dashboard/types"

const NADA: DashboardLean = {
    user_first_name: "Ana",
    recent_projects: [],
    recent_products: [],
    upcoming_events: [],
    active_projects_count: 0,
    plan_limit: 2,
    financial_balance: 0,
    financial_income: 0,
    financial_expense: 0,
    financial_entries_count: 0,
}

describe("dashboardVazio — decisao 3 da spec do Dashboard", () => {
    it("conta sem nada e vazia", () => {
        expect(dashboardVazio(NADA)).toBe(true)
    })

    it("conta so com financeiro NAO e vazia", () => {
        expect(dashboardVazio({ ...NADA, financial_entries_count: 1 })).toBe(false)
    })

    it("lancamentos que se anulam nao fazem a conta parecer vazia", () => {
        // soma zero, mas existem dois lancamentos
        expect(dashboardVazio({ ...NADA, financial_entries_count: 2 })).toBe(false)
    })

    it.each([
        ["projeto ativo", { active_projects_count: 1 }],
        ["captura", { recent_products: [{ id: "p", name: "Cadeira" }] }],
        ["compromisso", { upcoming_events: [{ id: "e", title: "R", start_time: "", end_time: "" }] }],
    ])("conta com %s nao e vazia", (_nome, parcial) => {
        expect(dashboardVazio({ ...NADA, ...parcial } as DashboardLean)).toBe(false)
    })
})
```

Run: `npx vitest run src/__tests__/dashboard-vazio.test.ts` → FAIL (módulo não existe).

- [ ] **Step 2: Tipos, chave, vazio, fábrica e hook**

`ArchSmart-web/src/features/dashboard/types.ts` — o conteúdo de
`components/types.ts`, com o nome da interface raiz `DashboardLean` e dois campos
a mais:

```ts
/** Formato de GET /api/dashboard/lean. */
export interface RecentProject {
    id: string
    name: string
    client_name?: string
}

export interface RecentProduct {
    id: string
    name: string
    image_url?: string
    price?: number
    store?: string
}

export interface UpcomingEvent {
    id: string
    title: string
    start_time: string
    end_time: string
    meet_link?: string
    project_name?: string
}

export interface DashboardLean {
    user_first_name: string
    recent_projects: RecentProject[]
    recent_products: RecentProduct[]
    active_projects_count: number
    /**
     * O limite de projetos do plano, decidido no servidor a partir dos
     * entitlements da sessao. A tela le daqui, e nao de `useEntitlements()`:
     * decisao 5 da spec do Dashboard, que abre uma excecao escrita a regra da
     * Secao 5 — "quando o endpoint da tela ja traz o entitlement, calculado dos
     * mesmos entitlements da sessao, a tela le de la". Art. 3 intacto.
     */
    plan_limit: number
    financial_balance: number
    financial_income: number
    financial_expense: number
    financial_entries_count: number
    upcoming_events: UpcomingEvent[]
}
```

Em `ArchSmart-web/src/lib/query/keys.ts`, dentro de `queryKeys`, depois de `account`:

```ts
    dashboard: {
        all: ["dashboard"] as const,
        lean: () => [...queryKeys.dashboard.all, "lean"] as const,
    },
```

`ArchSmart-web/src/features/dashboard/vazio.ts`:

```ts
import type { DashboardLean } from "./types"

/**
 * "Dashboard vazio" e conta sem nada ainda — decisao 3 da spec do Dashboard.
 *
 * Zero projetos ativos, zero capturas, zero compromissos E zero lancamentos: o
 * estado de conta recem-criada, que e o que interessa medir para onboarding.
 * Conta so com financeiro NAO e vazia.
 *
 * `financial_entries_count`, e nao as somas: lancamentos que se anulam somam
 * zero, e deduzir "sem lancamentos" de "saldo zero" mentiria justamente ai.
 *
 * Isto decide o `is_empty` da telemetria, nao o que a tela mostra: vazio e com
 * dados renderizam a mesma pagina (as colunas ja tem mensagem de vazio propria).
 */
export function dashboardVazio(d: DashboardLean): boolean {
    return (
        d.active_projects_count === 0 &&
        d.recent_products.length === 0 &&
        d.upcoming_events.length === 0 &&
        d.financial_entries_count === 0
    )
}
```

`ArchSmart-web/src/features/dashboard/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query"

import type { ClienteApi } from "@/lib/api/core"
import { cachePolicy, queryKeys } from "@/lib/query/keys"

import type { DashboardLean } from "./types"

/**
 * A query do Dashboard, definida UMA vez: `DashboardData` (servidor) chama com
 * `apiServer`, `useDashboard` (cliente) com `api`. Ver
 * `features/library/queries.ts` para o porque do padrao.
 */
export const queryDoDashboard = (cliente: ClienteApi) =>
    queryOptions({
        queryKey: queryKeys.dashboard.lean(),
        queryFn: ({ signal }) => cliente<DashboardLean>("/api/dashboard/lean", { signal }),
        ...cachePolicy.transacional,
    })
```

`ArchSmart-web/src/features/dashboard/hooks.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api/client"

import { queryDoDashboard } from "./queries"

export function useDashboard() {
    return useQuery(queryDoDashboard(api))
}
```

Run: `npx vitest run src/__tests__/dashboard-vazio.test.ts` → PASS.

- [ ] **Step 3: Mover os tipos nos componentes**

```bash
cd ArchSmart-web
grep -rln 'from "./types"' "src/app/(dashboard)/dashboard/components"
```

Em cada arquivo listado, trocar
`import type { DashboardLeanResponse } from "./types"` por
`import type { DashboardLean } from "@/features/dashboard/types"` e o uso
`DashboardLeanResponse | null` por `DashboardLean`. Os componentes deixam de
receber `null`: dentro do `QueryBoundary` o dado sempre existe. Onde houver
`data?.x ?? 0`, virar `data.x`. Depois:

```bash
git rm "src/app/(dashboard)/dashboard/components/types.ts"
npm run typecheck
```

Expected: `tsc` acusa **só** `page.tsx` (ainda no padrão antigo). Qualquer outro erro, conserte antes de seguir.

- [ ] **Step 4: O teste da tela, escrito antes dela**

`ArchSmart-web/src/__tests__/dashboard-content.test.tsx` substitui
`dashboard-page.test.tsx`. **As asserções de exibição são copiadas verbatim do
arquivo antigo** — são elas que provam a paridade. As três de comportamento
removido (token no header da `fetch`, redirecionamento sem token, erro por
`toast`) **saem**, e no lugar entram erro-como-estado e o card lendo `plan_limit`:

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardContent } from "@/app/(dashboard)/dashboard/components/DashboardContent"

const push = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/dashboard",
}))

const apiMock = vi.fn()
vi.mock("@/lib/api/client", () => ({ api: (...args: unknown[]) => apiMock(...args) }))

const RESPOSTA = {
    user_first_name: "Thiago",
    recent_projects: [
        { id: "p1", name: "Casa da Praia", client_name: "Maria" },
        { id: "p2", name: "Loft Centro" },
    ],
    recent_products: [
        { id: "prod1", name: "Cadeira Eames", price: 1200, store: "Loja X", image_url: "http://exemplo/img.png" },
        { id: "prod2", name: "Mesa Lateral" },
    ],
    active_projects_count: 3,
    plan_limit: 5,
    financial_balance: 1500.5,
    financial_income: 3000,
    financial_expense: 1499.5,
    financial_entries_count: 4,
    upcoming_events: [
        {
            id: "e1",
            title: "Reuniao com cliente",
            start_time: "2026-09-15T14:00:00",
            end_time: "2026-09-15T15:00:00",
            meet_link: "http://meet/abc",
            project_name: "Casa da Praia",
        },
    ],
}

function renderizar() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return render(<DashboardContent />, { wrapper: Wrapper })
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ")

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2026-09-10T09:00:00"))
    apiMock.mockResolvedValue(RESPOSTA)
})

afterEach(() => {
    vi.useRealTimers()
})

describe("DashboardContent", () => {
    it("mostra o esqueleto enquanto carrega", () => {
        apiMock.mockReturnValue(new Promise(() => {}))
        renderizar()
        expect(screen.getByLabelText("Carregando painel")).toHaveAttribute("aria-busy", "true")
    })

    it("busca /api/dashboard/lean pela camada de dados, sem fetch na tela", async () => {
        renderizar()
        await waitFor(() => expect(apiMock).toHaveBeenCalled())
        expect(apiMock.mock.calls[0][0]).toBe("/api/dashboard/lean")
    })

    it("mostra o erro NA TELA, com tentar de novo — nao por toast", async () => {
        apiMock.mockRejectedValueOnce(new Error("A API esta fora do ar."))
        renderizar()
        const erro = await screen.findByTestId("dashboard-error")
        expect(erro).toHaveTextContent("A API esta fora do ar.")

        apiMock.mockResolvedValueOnce(RESPOSTA)
        await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }))
        expect(await screen.findByText(/Bom dia, Thiago/)).toBeInTheDocument()
    })

    it("sauda pelo primeiro nome, conforme a hora do dia", async () => {
        renderizar()
        expect(await screen.findByText(/Bom dia, Thiago/)).toBeInTheDocument()
    })

    it("mostra as tres metricas financeiras formatadas em BRL", async () => {
        renderizar()
        expect(await screen.findByText("Saldo Realizado")).toBeInTheDocument()
        expect(screen.getByText("Receitas deste Mês")).toBeInTheDocument()
        expect(screen.getByText("Despesas deste Mês")).toBeInTheDocument()
        expect(screen.getByText(brl(1500.5))).toBeInTheDocument()
        expect(screen.getByText(brl(3000))).toBeInTheDocument()
        expect(screen.getByText(brl(1499.5))).toBeInTheDocument()
    })

    it("mostra o card de limite com o plan_limit que veio de lean (decisao 5)", async () => {
        renderizar()
        expect(await screen.findByText("Projetos Ativos")).toBeInTheDocument()
        expect(screen.getByText("limite de 5")).toBeInTheDocument()
        expect(screen.getByText("2 espaço(s) livre(s)")).toBeInTheDocument()
    })

    // Copie VERBATIM do dashboard-page.test.tsx antigo, trocando so
    // `render(<DashboardPage />)` por `renderizar()`:
    //   - "os tres botoes de acesso rapido navegam para projetos, biblioteca e financeiro"
    //   - "lista projetos recentes, com e sem cliente, ligados a rota do projeto"
    //   - "lista compromissos com data, hora, badge do projeto e botao Entrar"
    //   - "lista produtos recentes, com preco so quando ha preco"
    //   - "mostra os tres vazios quando a resposta vem sem listas"
    //     (troque `fetchMock.mockResolvedValue({ ok: true, json: async () => X })`
    //     por `apiMock.mockResolvedValue(X)`)
})
```

> O executor **copia os cinco testes do arquivo antigo** para o bloco marcado
> acima — o texto deles está em `git show HEAD:ArchSmart-web/src/__tests__/dashboard-page.test.tsx`,
> e eles não mudam além das duas trocas mecânicas descritas. Não reescreva as
> asserções: é a cópia literal que prova que a paridade não mudou.

Depois: `git rm ArchSmart-web/src/__tests__/dashboard-page.test.tsx ArchSmart-web/src/__tests__/Dashboard.test.tsx`

Run: `npx vitest run src/__tests__/dashboard-content.test.tsx` → FAIL (módulo `DashboardContent` não existe).

- [ ] **Step 5: `DashboardComErro`, `DashboardContent`, `DashboardData`, `page.tsx`**

`ArchSmart-web/src/app/(dashboard)/dashboard/components/DashboardComErro.tsx`:

```tsx
"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * O erro vira estado na tela, nao toast.
 *
 * Quebra de paridade DE PROPOSITO (spec do Dashboard, "A tela"): o toast some
 * sozinho e deixava o painel com os numeros zerados parecendo dado real — o
 * pior modo de falha de um painel financeiro. A mensagem vem de
 * `lib/api/errors.ts`, que garante frase de dominio em pt-BR ou o generico.
 */
export function DashboardComErro({ erro, refazer }: { erro: Error; refazer: () => void }) {
    return (
        <div
            data-testid="dashboard-error"
            role="alert"
            className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-3 p-8 py-16 text-center"
        >
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="font-medium text-foreground">Não foi possível carregar o painel.</p>
            <p className="max-w-sm text-sm text-muted-foreground">{erro.message}</p>
            <Button variant="outline" onClick={refazer}>
                Tentar de novo
            </Button>
        </div>
    )
}
```

`ArchSmart-web/src/app/(dashboard)/dashboard/components/DashboardContent.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { QueryBoundary } from "@/components/ui/query-boundary"
import { useDashboard } from "@/features/dashboard/hooks"
import { dashboardVazio } from "@/features/dashboard/vazio"
import type { DashboardLean } from "@/features/dashboard/types"

import { DashboardComErro } from "./DashboardComErro"
import { DashboardSkeleton } from "./DashboardSkeleton"
import { FinancialMetricCards } from "./FinancialMetricCards"
import { GreetingBanner } from "./GreetingBanner"
import { ProjectsLimitCard } from "./ProjectsLimitCard"
import { QuickActions } from "./QuickActions"
import { RecentProductsColumn } from "./RecentProductsColumn"
import { RecentProjectsColumn } from "./RecentProjectsColumn"
import { UpcomingEventsColumn } from "./UpcomingEventsColumn"

/**
 * A data da saudacao e calculada no NAVEGADOR, no efeito. Renderizada no
 * servidor ela usaria o fuso do Render e mostraria o dia errado a quem abre a
 * tela perto da meia-noite.
 */
function useDataDeHoje(): string {
    const [data, setData] = useState("")
    useEffect(() => {
        const formatada = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        setData(formatada.replace(/^\w/, (c) => c.toUpperCase()))
    }, [])
    return data
}

function Painel({ dados }: { dados: DashboardLean }) {
    const hoje = useDataDeHoje()

    return (
        <div data-testid="dashboard-painel" className="flex flex-col gap-8 p-4 md:p-8 w-full max-w-7xl mx-auto">
            <GreetingBanner userName={dados.user_first_name || "Usuário"} currentDate={hoje} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <FinancialMetricCards data={dados} />
                <ProjectsLimitCard
                    activeProjectsCount={dados.active_projects_count}
                    planLimit={dados.plan_limit}
                />
            </div>

            <QuickActions />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <RecentProjectsColumn data={dados} />
                <UpcomingEventsColumn data={dados} />
                <RecentProductsColumn data={dados} />
            </div>
        </div>
    )
}

/**
 * Uma requisicao, uma regiao, marcada `principal`.
 *
 * `empty` renderiza a MESMA pagina que os dados: as tres colunas ja tem vazio
 * proprio e a paridade e total. O que o vazio muda e o `is_empty` que a
 * telemetria grava — `dashboardVazio`, decisao 3 da spec.
 */
export function DashboardContent() {
    const query = useDashboard()

    return (
        <QueryBoundary
            query={query}
            principal
            isEmpty={dashboardVazio}
            skeleton={<DashboardSkeleton />}
            empty={query.data ? <Painel dados={query.data} /> : null}
            error={(erro, refazer) => <DashboardComErro erro={erro} refazer={refazer} />}
        >
            {(dados) => <Painel dados={dados} />}
        </QueryBoundary>
    )
}
```

`ArchSmart-web/src/app/(dashboard)/dashboard/components/DashboardData.tsx`:

```tsx
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { apiServer } from "@/lib/api/server"
import { clienteComSinal, criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { queryDoDashboard } from "@/features/dashboard/queries"

import { DashboardContent } from "./DashboardContent"

/**
 * Busca no servidor e entrega hidratado, dentro do <Suspense> de page.tsx —
 * o desenho da ADR 0009. Uma query so: o card de limite le `plan_limit` da
 * propria resposta (decisao 5 da spec do Dashboard), entao nao ha `useMe` a
 * prefetchar.
 */
export async function DashboardData() {
    const queryClient = criarQueryClientDoServidor()

    await tentarPrefetch((signal) =>
        queryClient.prefetchQuery(queryDoDashboard(clienteComSinal(apiServer, signal))),
    )

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <DashboardContent />
        </HydrationBoundary>
    )
}
```

`ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx` (substitui o arquivo inteiro):

```tsx
import { Suspense } from "react"

import { DashboardData } from "./components/DashboardData"
import { DashboardSkeleton } from "./components/DashboardSkeleton"

/**
 * Server Component. O fallback e o SERVIDOR fazendo stream (DashboardData ainda
 * nao chegou); o skeleton do QueryBoundary, dentro de DashboardContent, e o
 * CLIENTE carregando. Por isso o `data-testid` do wrapper e diferente: na
 * Biblioteca os dois tinham o mesmo, e um teste que esperava "o skeleton do
 * cliente apareceu" passava aqui sem nunca chegar ao boundary.
 */
export default function DashboardPage() {
    return (
        <Suspense
            fallback={
                <div data-testid="dashboard-shell-streaming">
                    <DashboardSkeleton />
                </div>
            }
        >
            <DashboardData />
        </Suspense>
    )
}
```

- [ ] **Step 6: O teste do prefetch**

`ArchSmart-web/src/__tests__/dashboard-data.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"

const apiServerMock = vi.fn().mockResolvedValue({ user_first_name: "Ana" })
vi.mock("@/lib/api/server", () => ({ apiServer: (...args: unknown[]) => apiServerMock(...args) }))
vi.mock("@/app/(dashboard)/dashboard/components/DashboardContent", () => ({
    DashboardContent: () => null,
}))

describe("DashboardData", () => {
    it("prefetcha /api/dashboard/lean sob a chave que useDashboard le, e nada mais", async () => {
        const { DashboardData } = await import("@/app/(dashboard)/dashboard/components/DashboardData")

        const elemento = (await DashboardData()) as { props: { state: { queries: { queryKey: unknown }[] } } }

        expect(apiServerMock).toHaveBeenCalledTimes(1)
        expect(apiServerMock.mock.calls[0][0]).toBe("/api/dashboard/lean")
        const chaves = elemento.props.state.queries.map((q) => q.queryKey)
        expect(chaves).toEqual([queryKeys.dashboard.lean()])
    })
})
```

- [ ] **Step 7: Rodar tudo**

Run: `npx vitest run src/__tests__/dashboard-content.test.tsx src/__tests__/dashboard-data.test.tsx src/__tests__/dashboard-vazio.test.ts`
Expected: PASS.
Run: `npm run typecheck && npm test`
Expected: `tsc` limpo; zero `failed`.
Run (da raiz): `grep -rn "fetch(\|useEffect" "ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx"` → nada.
Run (da raiz): `python tools/catraca.py` → `fetch_fora_de_lib_api: 74` (era 75). Se desceu:
`python tools/catraca.py --atualizar` e incluir `tools/catraca.json` no commit.

- [ ] **Step 8: Commit**

```bash
git add -A "ArchSmart-web/src/features/dashboard" "ArchSmart-web/src/app/(dashboard)/dashboard" \
        ArchSmart-web/src/lib/query/keys.ts ArchSmart-web/src/__tests__ tools/catraca.json
git commit -m "feat(web): Dashboard no padrao da Secao 8 — prefetch, QueryBoundary e uma requisicao

<corpo: Server Component + Suspense + HydrationBoundary; os cinco estados;
erro como estado (paridade quebrada de proposito, e por que); plan_limit de
lean (decisao 5); dashboardVazio (decisao 3); os dois testes antigos que
sairam e por que; fetch_fora_de_lib_api 75 -> 74>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CakYQdZyHoEKwuWa7pcMHx"
```

---

### Task 5: Cores literais, a imagem e acessibilidade dos componentes do Dashboard

**Por quê:** decisão da Seção 6 — cores e imagens de cada tela convertem na passada da tela. Art. 7.

**Files:**
- Modify: `ArchSmart-web/src/app/(dashboard)/dashboard/components/FinancialMetricCards.tsx`
- Modify: `ArchSmart-web/src/app/(dashboard)/dashboard/components/RecentProductsColumn.tsx`
- Modify: `ArchSmart-web/src/app/(dashboard)/dashboard/components/QuickActions.tsx`
- Modify: qualquer outro arquivo de `dashboard/components` que o Step 1 listar
- Modify: `tools/catraca.json` (via `--atualizar`)

**Interfaces:** nenhuma nova. A saída é visual e é conferida na Task 6.

- [ ] **Step 1: Medir antes**

```bash
python tools/catraca.py | grep -E "cores_literais|hover_sem_focus|tabindex_negativo"
grep -rnE "(bg|text|border|from|to|via|ring)-(white|black|slate|gray|zinc|red|emerald|indigo|green|blue)(-[0-9]{2,3})?" "ArchSmart-web/src/app/(dashboard)/dashboard"
grep -rn "<img\|group-hover\|tabIndex" "ArchSmart-web/src/app/(dashboard)/dashboard"
```

Anote os três números da catraca: são o "antes" do commit.

- [ ] **Step 2: O mapa de tokens — e a conferência de contraste ANTES de trocar**

Tokens disponíveis em `ArchSmart-web/src/app/globals.css`: `success`, `destructive`, `warning`, `info`, `primary`, `secondary`, `muted`, `foreground`, `muted-foreground`, `card`, `border`.

| Hoje | Vira | Onde |
|---|---|---|
| `bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30` | `bg-success/10 text-success` | ícones de saldo positivo e receitas |
| `bg-red-50 text-red-600 dark:bg-red-950/30` | `bg-destructive/10 text-destructive` | ícones de saldo negativo e despesas |
| `text-red-500` (saldo negativo), `text-red-600 dark:text-red-400` | `text-destructive` | valores |
| `text-emerald-600 dark:text-emerald-400`, `text-emerald-500` | `text-success` | valores e seta |
| `bg-emerald-500` / `bg-red-500` (faixa lateral) | `bg-success` / `bg-destructive` | decorativo |
| `text-indigo-500`, `hover:text-indigo-600`, `hover:border-indigo-300` | `text-primary`, `hover:text-primary/80`, `hover:border-primary/40` | coluna de capturas |
| `bg-slate-50 dark:bg-slate-900 text-slate-400` | `bg-muted text-muted-foreground` | "Sem imagem" |
| `text-slate-800 dark:text-slate-200` | `text-foreground` | preço |
| `border-slate-200 hover:border-slate-400` | `border-border hover:border-muted-foreground/40` | botão financeiro |
| `bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300` | `bg-muted text-foreground` | ícone do botão financeiro |

**Antes de trocar, meça o contraste dos tokens que viram TEXTO** — `success` e
`destructive` sobre `card` e `background`, nos dois temas. A Biblioteca pegou
`text-warning` a **1,99:1** passando verde porque a catraca só mede pares
`(cor, cor-foreground)`. Script (da raiz, sem dependência):

```bash
python - <<'PY'
import re
css = open("ArchSmart-web/src/app/globals.css", encoding="utf-8").read()
def hsl(nome, bloco):
    m = re.search(rf"--{nome}:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%", bloco)
    h, s, l = (float(x) for x in m.groups()); s/=100; l/=100
    c=(1-abs(2*l-1))*s; x=c*(1-abs((h/60)%2-1)); m_=l-c/2
    r,g,b = [(c,x,0),(x,c,0),(0,c,x),(0,x,c),(x,0,c),(c,0,x)][int(h//60)%6]
    def lin(v):
        v+=m_; return v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
claro = css.split(".dark")[0]; escuro = css.split(".dark")[1]
for tema, bloco in (("claro", claro), ("escuro", escuro)):
    for texto in ("success", "destructive", "primary"):
        for fundo in ("card", "background"):
            a, b = hsl(texto, bloco), hsl(fundo, bloco)
            print(f"{tema:6} {texto:12} sobre {fundo:10} {(max(a,b)+0.05)/(min(a,b)+0.05):5.2f}:1")
PY
```

**Regra:** texto precisa de **≥ 4,5:1** (valores de `text-2xl` bold contam como
texto grande: **≥ 3:1**). Se algum par usado como texto ficar abaixo,
**não invente token nem ajuste cor em `globals.css`** — isso é decisão de design
e tem catraca própria (`contraste_reprovado`). Pare, registre o par e o número,
e pergunte a Thiago. Ícone e faixa decorativa não entram na regra de texto.

- [ ] **Step 3: Trocar as classes**

Aplicar o mapa do Step 2 nos arquivos. Em `FinancialMetricCards.tsx` o
condicional de template string passa a ser, por exemplo:

```tsx
<div className={`p-2 rounded-lg ${data.financial_balance >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
```

- [ ] **Step 4: A imagem**

Em `RecentProductsColumn.tsx`, trocar o `<img>` (e o `eslint-disable` acima dele) por `next/image`, no padrão de `src/components/library/ProductCard.tsx:113-128`:

```tsx
// `unoptimized`: a imagem vem da loja que o Web Clipper raspou, de qualquer
// dominio da internet — nao da para declarar em `images.remotePatterns`, e sem
// isso o otimizador recusa o dominio em tempo de execucao, sem erro de build.
// Sem `sizes`: sem otimizacao nao ha srcset para escolher.
<Image
    src={prod.image_url}
    alt={prod.name}
    fill
    unoptimized
    className="object-cover transition-transform duration-500 group-hover:scale-105"
/>
```

Import: `import Image from "next/image"`.

- [ ] **Step 5: Hover sem foco**

Todo `group-hover:` que **revela ou move** algo precisa do par `group-focus-visible:` (ou `group-focus-within:`) no mesmo elemento, senão quem navega por teclado não vê o efeito. Para os links de `RecentProductsColumn` e `RecentProjectsColumn` e os botões de `QuickActions`: acrescentar `group-focus-visible:` com o mesmo efeito ao lado de cada `group-hover:`, e `focus-visible:ring-2 focus-visible:ring-ring` no elemento focável (`Link`/`Button`) que ainda não tiver anel de foco.

- [ ] **Step 6: Medir depois e atualizar a catraca**

```bash
python tools/catraca.py | grep -E "cores_literais|hover_sem_focus|tabindex_negativo"
```

Expected: `cores_literais` desce pelo número de classes trocadas; nenhuma medida sobe. Então:

```bash
python tools/catraca.py --atualizar
cd ArchSmart-web && npm run typecheck && npm test
```

Expected: a ferramenta grava sem pedir `--aceitar-piora`; `tsc` limpo; zero `failed` (`dashboard-content.test.tsx` continua verde — as trocas são de classe, não de texto).

- [ ] **Step 7: Commit**

```bash
git add "ArchSmart-web/src/app/(dashboard)/dashboard/components" tools/catraca.json
git commit -m "style(web): Dashboard sem cor literal, com next/image e foco visivel

<corpo: cores_literais X -> Y e hover_sem_focus X -> Y medidos; o contraste de
success/destructive como texto, com os numeros do script; a imagem unoptimized
e por que>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CakYQdZyHoEKwuWa7pcMHx"
```

---

### Task 6: A passada de navegador — Dashboard, Biblioteca e a captura da Seção 6

**Por quê:** item 2 da Biblioteca (axe em navegador, teclado, 390/1440px nunca verificados), a captura visual da Seção 6 (nunca rodou), e os dois specs de guarda do Dashboard. Tudo depende de sessão real, que funciona desde 12/09.

**Esta task produz evidência, não só código.** O que se viu a olho vai para `docs/dev/medicoes/2026-09-14-passada-de-navegador.md` com data, largura, tema e o que foi observado — **inclusive o que estiver quebrado**.

**Files:**
- Create: `ArchSmart-web/e2e/dashboard-dados.ts` (auxiliar, espelha `e2e/biblioteca.ts`)
- Create: `ArchSmart-web/e2e/hidratacao-dashboard.spec.ts`
- Create: `ArchSmart-web/e2e/telemetria-dashboard.spec.ts`
- Modify: `.github/workflows/e2e.yml` (linha de specs de guarda)
- Create: `docs/dev/medicoes/2026-09-14-passada-de-navegador.md`

**Interfaces:**
- Consumes: testids `dashboard-painel` e `dashboard-error` (Task 4)
- Produces: `esperarPainelDoDashboard(page: Page): Promise<void>` em `e2e/dashboard-dados.ts`

**Pré-requisitos locais — as duas armadilhas medidas em 14/09, que custaram duas execuções:**

```bash
# 1. A API LOCAL de pe em :8000 — .env.local aponta NEXT_PUBLIC_API_URL para ela.
#    Sem isso o login falha com ERR_CONNECTION_REFUSED e o spec so diz
#    "timeout em waitForURL".
cd ArchSmart-api && ./venv/Scripts/python.exe -m uvicorn app.main:app --port 8000   # em background

# 2. Credencial e timeout: os 30 s locais nao cobrem a 1a compilacao do dev server.
cd ArchSmart-web && set -a && . ./.env.e2e.local && . ./.env.local && set +a
npx playwright test <spec> --reporter=line --timeout=180000
```

**Encerre os dois processos no fim da task** (`uvicorn` e `next dev`) — confira com `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` → `000`.

- [ ] **Step 1: O auxiliar**

`ArchSmart-web/e2e/dashboard-dados.ts`:

```ts
import type { Page } from "@playwright/test"

/**
 * Espera o painel do Dashboard resolver — e nomeia a falha quando o desfecho
 * foi erro. Mesmo contrato de `biblioteca.ts`: esperar so pelo painel faria
 * uma falha virar timeout mudo, e seguir apos o erro mediria carga falhada.
 */
export async function esperarPainelDoDashboard(page: Page): Promise<void> {
    await page.waitForSelector("[data-testid='dashboard-painel'], [data-testid='dashboard-error']")
    const erro = page.locator("[data-testid='dashboard-error']")
    if ((await erro.count()) > 0) {
        const texto = (await erro.first().innerText()).replace(/\s+/g, " ").trim()
        throw new Error(`o Dashboard falhou em vez de carregar: ${texto}`)
    }
}
```

- [ ] **Step 2: O spec de hidratação**

`ArchSmart-web/e2e/hidratacao-dashboard.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

import { esperarPainelDoDashboard } from "./dashboard-dados"

/**
 * O prefetch do Dashboard hidrata: abrir /dashboard direto (navegacao de
 * servidor) nao pode emitir /api/dashboard/lean do navegador, e — decisao 5 da
 * spec — nao pode emitir /api/users/me tambem: o card le plan_limit de lean.
 */
test("o Dashboard nao busca lean nem users/me no navegador no primeiro carregamento", async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
        throw new Error("E2E_EMAIL e/ou E2E_PASSWORD nao definidos. Localmente: ArchSmart-web/.env.e2e.local")
    }

    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")
    // Aquece: o cold start do Render nao pode virar falha de hidratacao.
    await esperarPainelDoDashboard(page)

    const pedidos: string[] = []
    page.on("request", (r) => {
        const url = r.url()
        if (url.includes("/api/dashboard/lean") || url.includes("/api/users/me")) pedidos.push(url)
    })

    await page.goto("/dashboard")
    await esperarPainelDoDashboard(page)

    expect(
        pedidos,
        `o primeiro carregamento de /dashboard pediu no navegador: ${pedidos.join(", ")} — ` +
            "o prefetch nao esta sendo aproveitado, ou o card voltou a chamar users/me",
    ).toHaveLength(0)
})
```

- [ ] **Step 3: O spec de telemetria**

`ArchSmart-web/e2e/telemetria-dashboard.spec.ts` — **copie
`e2e/telemetria-biblioteca.spec.ts` inteiro** e troque, e só isto:

| Na cópia | Vira |
|---|---|
| `import { esperarListaDaBiblioteca } from "./biblioteca"` | `import { esperarPainelDoDashboard } from "./dashboard-dados"` |
| aquecimento `page.goto("/library")` + `esperarListaDaBiblioteca` | `page.goto("/dashboard")` + `esperarPainelDoDashboard` |
| "volta ao Dashboard" (`page.goto("/dashboard")`) antes do clique | `page.goto("/library")` + `page.waitForLoadState("networkidle")` |
| `page.click("a[href='/library']")` + `esperarListaDaBiblioteca` | `page.click("a[href='/dashboard']")` + `esperarPainelDoDashboard` |
| a pré-condição `product-grid` visível | `expect(page.getByTestId("dashboard-painel")).toBeVisible()` com a mensagem "a conta de teste esta vazia: o evento sairia is_empty true" |
| `evento.properties?.screen === "/library"` | `=== "/dashboard"` |
| o nome do teste | `"o screen_viewed do Dashboard mede ate os dados, a partir do clique"` |

As asserções finais ficam **iguais**: `medido_ate: "dados"`, `medido_de: "clique"`,
`principal_declarada: true`, `is_empty: false`, `load_ms` entre `PISO_MS` e `TETO_MS`.
Antes de rodar, confirme que existe `a[href='/dashboard']` na sidebar:
`grep -rn "/dashboard" ArchSmart-web/src/components/layout` — se o link tiver outro
`href`, use o seletor real e escreva por quê no comentário.

- [ ] **Step 4: Rodar os dois specs, três vezes cada**

```bash
npx playwright test e2e/hidratacao-dashboard.spec.ts e2e/telemetria-dashboard.spec.ts --reporter=line --timeout=180000 --repeat-each=3
```

Expected: `6 passed`. Uma reprovação é defeito — investigue (`superpowers:systematic-debugging`), **não afrouxe asserção**.

- [ ] **Step 5: Os guardas no CI**

Em `.github/workflows/e2e.yml`, na linha `run:` dos specs de guarda, acrescentar
`e2e/hidratacao-dashboard.spec.ts` e `e2e/telemetria-dashboard.spec.ts`.

- [ ] **Step 6: A passada a olho — Dashboard e Biblioteca**

Com `npm run dev` e a API local de pé, logado como o usuário de teste, **nas duas
telas** (`/dashboard` e `/library`), nos **dois temas** e nas **duas larguras**
(DevTools → device toolbar → `390x844` e `1440x900`):

1. **Teclado:** `Tab` a partir do topo, sem mouse. Todo elemento interativo é alcançável, o anel de foco é visível, a ordem segue a leitura, e `Enter`/`Espaço` acionam.
2. **axe em navegador:** no console, cole o conteúdo de `https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js` e rode `axe.run().then(r => console.table(r.violations.map(v => ({id: v.id, impacto: v.impact, nos: v.nodes.length}))))`. Anote cada violação.
3. **Largura:** nada estoura horizontalmente em 390px; em 1440px a grade não fica esticada.
4. **Os dois riscos da Biblioteca (item 3):** `LibraryToolbar` em 390px (`:167` sem quebra abaixo de `md`, `:180` `SelectTrigger` `w-[160px]` ao lado de input sem `min-w-0`) e o `group-focus-within` do menu do `ProductCard` ao chegar nele por `Tab`. **Registre o que viu. Não conserte** — se estourar, é commit próprio com ok de Thiago.

- [ ] **Step 7: A captura visual da Seção 6**

```bash
mkdir -p "$TEMP/capturas-secao-6"
CAPTURAS_DIR="$TEMP/capturas-secao-6" npx playwright test e2e/captura-visual-secao-6.spec.ts --reporter=line --timeout=180000
```

Abra **cada imagem** gerada e confira as três mudanças da Seção 6: `DropdownMenuItem` com alvo de 44px (`min-h-11`), o botão de fechar do toast destrutivo, e o `aria-hidden` do `Skeleton`. As imagens **não** entram no repositório.

- [ ] **Step 8: O registro**

`docs/dev/medicoes/2026-09-14-passada-de-navegador.md`, com uma seção por tela e
uma para a Seção 6. Para cada item dos Steps 6 e 7: o que foi olhado, largura e
tema, **o resultado** (passou / violação com o `id` do axe / estouro com a
largura), e o comando. Termine com **"O que continua aberto"** listando todo
achado não consertado — é a lista que vira pergunta para Thiago.

- [ ] **Step 9: Commit**

```bash
git add ArchSmart-web/e2e/dashboard-dados.ts ArchSmart-web/e2e/hidratacao-dashboard.spec.ts \
        ArchSmart-web/e2e/telemetria-dashboard.spec.ts .github/workflows/e2e.yml \
        docs/dev/medicoes/2026-09-14-passada-de-navegador.md
git commit -m "test(e2e): guardas do Dashboard e a passada de navegador das duas telas

<corpo: 6/6 dos guardas com --repeat-each=3; o que a passada achou em cada
tela, com numero de violacoes do axe; a captura da Secao 6; o que ficou aberto>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CakYQdZyHoEKwuWa7pcMHx"
```

> **Se a passada achar violação ou estouro no Dashboard**, o conserto entra nesta
> task, com commit próprio antes do Step 9, e a Task 5 não é reaberta. **Se achar
> na Biblioteca**, ele fica registrado e a task termina sem consertar.

---

### Task 7: Deploy, medição e a doc do módulo

**Por quê:** o número real só existe depois do deploy, e a definição de pronto exige `docs/dev/modulos/dashboard.md` com o número medido. Decisão 1 da spec: o orçamento de API é **registrado, não marcado como atingido**.

**Files:**
- Create: `ArchSmart-web/e2e/medicao-dashboard.spec.ts`
- Create: `docs/dev/modulos/dashboard.md`
- Modify: `PROGRESS.md` (caixa do Dashboard e a nota)
- Modify: `CLAUDE.md` (estado da Seção 8 e o bloco de pendências da próxima tela)
- Modify: `docs/dev/modulos/library.md` (os itens de navegador que a Task 6 fechou)

**Interfaces:**
- Consumes: tudo das Tasks 1–6.

- [ ] **Step 1: O instrumento de medição**

`ArchSmart-web/e2e/medicao-dashboard.spec.ts` — **copie `e2e/medicao-biblioteca.spec.ts`**
e troque: aquecimento em `/dashboard` com `esperarPainelDoDashboard`; dentro do laço,
`page.goto("/library")` + `waitForLoadState("networkidle")`, depois
`page.click("a[href='/dashboard']")` + `esperarPainelDoDashboard`. Mesmas
`REPETICOES = 5`, mesmas linhas `AMOSTRAS=` e `MEDIANA_MS=`. **Não** acrescentar ao
`e2e.yml`: é instrumento, não guarda (ver o comentário da linha de specs lá).

- [ ] **Step 2: Integrar e implantar**

Rodar as verificações finais e seguir `superpowers:finishing-a-development-branch`:

```bash
cd ArchSmart-web && npm run typecheck && npm test
cd ../ArchSmart-api && ./venv/Scripts/python.exe -m pytest -q
cd .. && python tools/catraca.py && python tools/progresso.py --check && python tools/checa_links.py
```

Expected: tudo verde. Merge `--no-ff` de `secao-8-dashboard` em `develop`, push,
PR `develop` → `staging`, esperar os três checks do CI, e **pedir a Thiago o
merge** — quem mergeia é o portão. Depois do merge, esperar o Render subir o
contêiner novo: a primeira chamada paga ~40–50 s de cold start.

- [ ] **Step 3: Medir contra a API implantada**

```bash
# token: bloco "Como reproduzir" de docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md
API=https://arqsmart-staging.onrender.com; H="Authorization: Bearer $TOKEN"
# controles: tem de bater com 13/09 (health ~0,29 s, health/db ~0,99 s, token invalido ~0,52 s)
for i in $(seq 8); do
  curl -s -o /dev/null -w "health %{time_total}\n"   "$API/health"
  curl -s -o /dev/null -w "healthdb %{time_total}\n" "$API/health/db"
  curl -s -o /dev/null -w "invalido %{time_total}\n" -H "Authorization: Bearer nao.e.jwt" "$API/api/users/me"
  curl -s -o /dev/null -w "lean %{time_total}\n"     -H "$H" "$API/api/dashboard/lean"
  curl -s -o /dev/null -w "me %{time_total}\n"       -H "$H" "$API/api/users/me"
done
# P50/P95 de lean: 45 chamadas, descartadas as 5 primeiras
for i in $(seq 45); do curl -s -o /dev/null -w "%{time_total}\n" -H "$H" "$API/api/dashboard/lean"; done
```

Com o volume declarado: conte, para a conta de teste, projetos ativos, produtos,
lançamentos e eventos futuros (consulta de leitura contra o banco de staging,
com o `venv` da API) e escreva os quatro números ao lado do P95.

Previsão escrita antes, para a medição julgar: `lean` ≈ `0,29 + 0,17 × (3 + 5)` = **1,65 s**.

E a tela, no arranjo da Seção 8 (API local em `:8000`, `--timeout=180000`):

```bash
npx playwright test e2e/medicao-dashboard.spec.ts --reporter=line --timeout=180000
```

E o `load_ms` gravado — consulta de leitura em `product_events` de staging,
filtrando `screen='/dashboard'` e `medido_ate='dados'`, mediana e `n`.
**Filtre sempre por `medido_ate`**: linhas antigas de `/dashboard` são `pintura`, 18 ms.

- [ ] **Step 4: `docs/dev/modulos/dashboard.md`**

Mesma estrutura de `docs/dev/modulos/library.md`: o que expõe
(`features/dashboard`), do que depende, invalidação (hoje nenhuma mutação invalida
`dashboard.all` — **escreva isso**, é a próxima pergunta de quem migrar Projetos),
a tela e o que consome, os cinco estados (com a quebra de paridade do erro), quem
é a região principal e a definição de vazio, o que o prefetch entrega, a exceção à
regra da Seção 5 (decisão 5, com a condição exata), e **os números medidos, cada
um com o comando**. O orçamento de API vai assim:

> **P95 de `/api/dashboard/lean`: X ms contra 400 ms — não atingido.** Estoura
> por distância (0,17 s × idas ao banco), não pela tela: 5 consultas + 3 idas de
> protocolo. Decisão 1 da spec do Dashboard: carregado adiante, por escrito.

- [ ] **Step 5: `PROGRESS.md`, `library.md` e `CLAUDE.md`**

- `PROGRESS.md`: marcar `- [x] Dashboard` **só** com os nove itens da definição de
  pronto conferidos — o orçamento de API conta como "registrado", como a decisão 1
  manda. Nota curta abaixo da lista, no formato das anteriores: números, comandos,
  e o que ficou aberto.
- `docs/dev/modulos/library.md`: os três itens de navegador da seção "O que continua
  faltando" passam a "fechados em 14/09/2026", com o resultado da Task 6 — ou
  continuam abertos com o que a passada achou.
- `CLAUDE.md`: o parágrafo de estado da Seção 8 passa a 2/9; o bloco "O que a
  Biblioteca (Seção 8) deixou em aberto" risca os itens 2, 3 (se só registrado,
  diz isso), 5 e 10, com o que fechou cada um — e ganha, se a Task 6 achou algo, os
  itens novos que a próxima tela (Projetos) precisa pôr como tarefa ou recusar.

```bash
python tools/progresso.py --check && python tools/checa_links.py
```

- [ ] **Step 6: Commit e promoção**

```bash
git add ArchSmart-web/e2e/medicao-dashboard.spec.ts docs/dev/modulos/dashboard.md \
        docs/dev/modulos/library.md PROGRESS.md CLAUDE.md
git commit -m "docs(secao-8): Dashboard medido — <mediana da tela> e P95 de lean <X ms>

<corpo: os numeros com os controles; a previsao contra a medicao; o orcamento
registrado e nao atingido, pela decisao 1; o que ficou aberto>

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CakYQdZyHoEKwuWa7pcMHx"
git push origin develop
```

O commit de docs chega a `staging` no PR da próxima tela, ou num PR curto se Thiago preferir.
