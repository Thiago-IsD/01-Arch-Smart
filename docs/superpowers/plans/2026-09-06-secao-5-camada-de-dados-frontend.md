# Seção 5 — Camada de dados do frontend · Plano de implementação

> **Para quem executa com agente:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixas (`- [ ]`) para acompanhamento.

**Objetivo:** tornar impossível uma tela buscar dado sozinha — um cliente HTTP
único que resolve sessão, monta header, trata erro e propaga cancelamento; um
arquivo só que sabe que o Supabase existe; chaves de cache hierárquicas que
fazem a invalidação errada deixar de ser escrevível; e uma catraca que impede
os 70+ call sites manuais de voltarem a crescer enquanto a Seção 8 não os
migra.

**Arquitetura:** cinco arquivos novos em `ArchSmart-web/src/lib/`
(`api/errors.ts`, `api/client.ts`, `api/auth.ts`, `api/auth.server.ts`,
`query/keys.ts`) e dois diretórios de domínio em `src/features/`
(`library/`, `account/`). O domínio Biblioteca inteiro migra como piloto e é
medido antes e depois; só com o ganho confirmado a catraca é ligada e a Seção 8
escala o resto. O `proxy.ts` é corrigido na mesma seção porque é onde mora o
ramo mock do Supabase que o `auth.ts` substitui.

**Stack:** Next.js 16 (App Router), React 19.2, TypeScript 5,
TanStack Query 5.90, `@supabase/ssr` 0.8, Zod 4, Vitest 4 + Testing Library,
Playwright 1.61, ESLint 9 (flat config).

**Spec:** [`docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md`](../specs/2026-08-23-reestruturacao-arq-smart-design.md),
seção "Seção 5 — Camada de dados do frontend".

---

## Global Constraints

Valem em toda tarefa, sem repetição em cada uma. Texto integral em
[`spec-kit-2/memory/constitution.md`](../../../spec-kit-2/memory/constitution.md).

- **Art. 1 — Nenhum `account_id` (ou id de usuário/tenant) literal no código.**
  A identidade é resolvida no servidor a partir do token; o front nunca a
  envia no payload nem a escreve.
- **Art. 3 — Nenhuma regra de negócio ou limite de plano decidido no front.**
  O front renderiza o que a API devolve em `entitlements`. `?? 2` como
  fallback de limite é violação, não defensividade.
- **Art. 4 — Nenhuma URL, chave ou host fixo no código.** Base da API sempre
  por `getApiUrl()`/`apiUrl()` de `src/lib/api-url.ts`; variáveis validadas em
  `src/lib/env.ts`.
- **Art. 5 — Componentes `PascalCase.tsx`, tipos `PascalCase`, instâncias e
  métodos `camelCase`.**
- **Art. 6 — Acessibilidade.** `<label>` ligado por `htmlFor`/`id`; nada
  interativo com `tabIndex={-1}`; contraste AA nos dois temas.
- **Art. 7 — Nenhuma cor literal em classe utilitária.** Não acrescente a
  511ª — a Seção 6 é quem cria `--success`/`--warning`/`--info`. Se um estado
  precisa de cor que não tem token, reaproveite o token semanticamente mais
  próximo.
- **Art. 8 — A marca é "Arq Smart"**, duas palavras, com Q. Zero ocorrência de
  `ArchSmart`, `Ark Smart` ou `Ecowe` em código, copy ou comentário.
  `ArchSmart-web` é nome de diretório, não grafia da marca.
- **Art. 13 — Módulo tem doc.** `tools/catraca.py` conta **diretório em
  `src/features/` sem `.md` de mesmo nome em `docs/dev/modulos/`**. Criar
  `features/library/` sem `docs/dev/modulos/library.md` **reprova a catraca no
  mesmo commit.** Isso não é opcional em nenhuma tarefa que cria feature.
- **Nada de "é esperado que falhe".** Se um comando deste repositório reportar
  falha, é falha.
- **Número afirmado sem medição é número errado.** Ao afirmar um número no PR
  ou na doc, cole o comando que o produziu.

---

## Onde a spec e o código divergem — medido em 06/09/2026

A spec é de 23/08/2026 e o código andou. **Os números deste plano são os
medidos; os da spec estão desatualizados e não devem ser republicados.**

| Spec diz | Medido em `develop` (06/09/2026) | Comando |
|---|---|---|
| "67 headers manuais" | **73** linhas com `Authorization` | `grep -rn 'Authorization' src --include=*.ts --include=*.tsx \| wc -l` |
| "56 `getSession()`" | **56** — confere | `grep -rn 'getSession()' src --include=*.ts --include=*.tsx \| wc -l` |
| "62 `createClient()`" | **62** — confere | `grep -rn 'createClient()' src --include=*.ts --include=*.tsx \| wc -l` |
| `lib/api/auth.ts` como **um** arquivo | **impossível em um arquivo** — ver Tarefa 3 | `next/headers` não pode ser importado por bundle de cliente |
| "prefetch no servidor" (bloqueante) | **dentro de `<Suspense>`** — ver decisão 3 | cold start medido: 41,9 s |
| "ligam-se os lints" | **catraca, não erro duro** — ver decisão 2 | 87 linhas com `fetch(` vivas hoje |

> ⚠️ **Os números 87 e 62 acima são contagem de _linha_ (`grep … | wc -l`), não
> de _ocorrência_.** Uma linha com dois `fetch(` conta 1. O baseline da catraca
> é contagem de **ocorrência** e tem que ser gerado pela própria ferramenta
> (Tarefa 11, Passo 4) — **nunca digite 87 ou 62 no `tools/catraca.json`.**

### Decisões tomadas por Thiago em 06/09/2026

1. **A taxonomia de erro discrimina por _formato_, nunca por status.**
   `detail` string → mensagem pronta em pt-BR, exibe. `detail` array → é o 422
   de schema do Pydantic, ou seja, defeito nosso: mensagem genérica + log.
   Nenhuma tela escreve `if (status === 422)`. Isso resolve a pendência 3 do
   `CLAUDE.md` sem tocar no backend, e sobrevive a qualquer rota que mude de
   status depois. **Verificado no backend:** todo `DomainError`
   (`app/core/errors.py`) responde `{"detail": "<string>"}` nos status 404,
   403, 402 e 422; só o Pydantic produz array. A discriminação é total.
2. **Os lints entram como catraca, não como erro duro.** Duas medidas novas em
   `tools/catraca.json`; o número só desce; a Seção 8 leva a zero e aí vira
   erro duro. É o raciocínio da [ADR 0006](../../dev/decisoes/0006-portoes-de-ci-com-catraca.md):
   portão que nasce vermelho é desligado na primeira semana.
3. **O prefetch do servidor vai dentro de `<Suspense>`, não bloqueando.**
   Medido em 06/09/2026 contra `https://arqsmart-staging.onrender.com/health`:
   **41,9 s** na primeira chamada (cold start do Render free tier), 0,46 s e
   0,79 s nas seguintes. Um prefetch bloqueante seguraria o HTML por 42 s com
   a API hibernada — regressão do pior caso. Com Suspense, o shell faz stream
   na hora e os dados chegam quando ficam prontos.
4. **O ramo mock do Supabase é removido.** Ele dispara com
   `your-project.supabase.co` / `dummy_anon_key`; o `.env.example` versionado
   entrega `seu-projeto.supabase.co` / `sua-chave-anon-aqui` — não casa.
   Nenhuma doc o menciona, e a Seção 3 subiu Supabase real local em Docker,
   que é o que ele existia para substituir. Medido: 3 ocorrências no
   repositório inteiro, todas nos três arquivos que esta seção reescreve.

---

## Estado medido do frontend em 06/09/2026

Todos de `ArchSmart-web/`, contando `src/**/*.{ts,tsx}`:

```
144   arquivos .ts/.tsx          find src -name '*.ts' -o -name '*.tsx' | wc -l
 62   createClient()             grep -rn 'createClient()' src --include=*.ts --include=*.tsx | wc -l
 56   getSession()               grep -rn 'getSession()' src --include=*.ts --include=*.tsx | wc -l
 73   Authorization              grep -rn 'Authorization' src --include=*.ts --include=*.tsx | wc -l
 87   fetch(                     grep -rn 'fetch(' src --include=*.ts --include=*.tsx | wc -l
  3   arquivos com TanStack      grep -rln 'useQuery\|useMutation' src --include=*.ts --include=*.tsx | wc -l
  0   next/dynamic / React.lazy  grep -rn 'next/dynamic\|React.lazy' src --include=*.ts --include=*.tsx | wc -l
 48   useEffect(                 grep -rn 'useEffect(' src --include=*.ts --include=*.tsx | wc -l
```

**A superfície real do Supabase no front são 4 métodos** — e é isso que faz o
ponto de troca por Cognito ser pequeno:

```
grep -rhno 'supabase\.auth\.[a-zA-Z]*' src --include=*.ts --include=*.tsx | sed 's/^[0-9]*://' | sort | uniq -c | sort -rn
     56 supabase.auth.getSession
      2 supabase.auth.signOut
      2 supabase.auth.setSession
      2 supabase.auth.getUser
```

Zero `supabase.storage.*` e zero `supabase.from(` — o front **não** fala com o
banco direto, e login/cadastro já passam pela API. `auth.ts` cobre 4 funções,
não um wrapper do SDK.

**O domínio Biblioteca (o piloto):**

| Arquivo | `fetch(` | linhas |
|---|---|---|
| `src/app/(dashboard)/library/page.tsx` | 0 | 45 |
| `src/app/(dashboard)/library/components/LibraryContent.tsx` | 2 | 196 |
| `src/components/library/ProductFormSheet.tsx` | 1 | 473 |
| `src/components/library/NormalizationSheet.tsx` | 1 | 450 |
| `src/components/library/BatchNormalizeModal.tsx` | 2 | 467 |
| `src/components/library/MoveToProjectModal.tsx` | 3 | 226 |
| `src/components/library/ProductCard.tsx` | 1 | 219 |
| `src/components/library/LibraryToolbar.tsx` | 0 | 285 |
| `src/components/library/ClipperOnboarding.tsx` | 0 | 144 |
| `src/lib/normalize-product.ts` | 1 | 108 |
| **total** | **11** | **2.613** |

**Seis arquivos usam o Supabase de servidor** e são os candidatos a prefetch
(só `library` migra nesta seção; os outros são Seção 8):
`projects/page.tsx`, `projects/[id]/budget/page.tsx`, `projects/[id]/page.tsx`,
`projects/[id]/presentation/page.tsx`,
`projects/[id]/presentation/[presentation_id]/builder/page.tsx`,
`projects/[id]/print/page.tsx`.

---

## Dois defeitos vivos encontrados na leitura

Ambos no domínio piloto. **Não são refactor de passagem** — são o que o piloto
existe para provar que a camada nova corrige, e cada um ganha teste que falha
antes e passa depois.

### Defeito A — `DELETE /api/products/{id}` vai sem `Authorization`

`src/components/library/ProductCard.tsx:89`:

```tsx
const res = await fetch(apiUrl(`/api/products/${id}`), {
    method: "DELETE",
})
```

Sem header nenhum. No backend, `app/api/routers/product_router.py:193` depende
de `get_repo` → `get_context`, que declara
`authorization: str = Header(...)` (`app/core/security.py:131`) — **header
obrigatório**. Sem ele o FastAPI responde **422 com `detail` em array** (erro
de validação de header, não de negócio), `res.ok` é falso, e a tela mostra
"Não foi possível excluir o produto".

**Excluir produto na Biblioteca não funciona hoje.** E é a demonstração exata
da decisão 1: um cliente que ramificasse por status veria 422 e tentaria
renderizar `detail[].msg` de um erro que não é de validação de formulário.

### Defeito B — três das quatro mutações invalidam o lugar errado

`ProductFormSheet.tsx:190`, `NormalizationSheet.tsx:155` e
`ProductCard.tsx:100` chamam **`router.refresh()`** depois de criar, aprovar e
excluir produto. `router.refresh()` revalida Server Components; **não toca no
`QueryClient`**, que é de onde `LibraryContent` lê a grade. Só
`BatchNormalizeModal.tsx:278-279` invalida de verdade — e precisa invalidar
**duas** chaves à mão (`["products"]` e `["inbox-count"]`) porque hoje elas são
irmãs planas, não hierárquicas. Quem esquecer a segunda deixa o badge do inbox
mentindo.

É literalmente o que a spec previu: *"sem padrão, duas pessoas inventam duas
convenções e a invalidação erra de formas difíceis de achar"*.

---

## Estrutura de arquivos

**Criar:**

```
ArchSmart-web/src/lib/api/errors.ts          ApiError + discriminação por formato
ArchSmart-web/src/lib/api/client.ts          criarCliente() + `api` (browser)
ArchSmart-web/src/lib/api/auth.ts            Supabase do browser — 4 funções
ArchSmart-web/src/lib/api/auth.server.ts     Supabase do servidor (next/headers)
ArchSmart-web/src/lib/api/server.ts          `apiServer` (cliente com token do servidor)
ArchSmart-web/src/lib/query/keys.ts          queryKeys + cachePolicy
ArchSmart-web/src/lib/query/hydration.ts     prefetchParaHidratar()
ArchSmart-web/src/features/library/api.ts    chamadas tipadas do domínio
ArchSmart-web/src/features/library/hooks.ts  useProducts, useProduct, mutações
ArchSmart-web/src/features/library/types.ts  Product, ProductsResponse, filtros
ArchSmart-web/src/features/account/api.ts    /api/users/me
ArchSmart-web/src/features/account/hooks.ts  useMe, useEntitlements
ArchSmart-web/src/features/account/types.ts  Me, Entitlements
ArchSmart-web/src/app/(dashboard)/library/components/LibraryData.tsx   prefetch + hidratação
docs/dev/modulos/library.md                  Art. 13 — obrigatório
docs/dev/modulos/account.md                  Art. 13 — obrigatório
docs/dev/decisoes/0009-prefetch-dentro-de-suspense.md
ArchSmart-web/src/__tests__/api-errors.test.ts
ArchSmart-web/src/__tests__/api-client.test.ts
ArchSmart-web/src/__tests__/query-keys.test.ts
ArchSmart-web/src/__tests__/library-hooks.test.tsx
tools/test_catraca_camada_de_dados.py
```

**Modificar:**

```
ArchSmart-web/src/proxy.ts                                   ordem, matcher, sem mock, sem log
ArchSmart-web/src/utils/supabase/client.ts                   APAGAR (vira lib/api/auth.ts)
ArchSmart-web/src/utils/supabase/server.ts                   APAGAR (vira lib/api/auth.server.ts)
ArchSmart-web/src/lib/normalize-product.ts                   perde getToken/apiErrorMessage/fetch
ArchSmart-web/src/hooks/use-user-profile.ts                  APAGAR (vira features/account)
ArchSmart-web/src/app/(dashboard)/library/page.tsx           shell + Suspense
ArchSmart-web/src/app/(dashboard)/library/components/LibraryContent.tsx
ArchSmart-web/src/components/library/{ProductFormSheet,NormalizationSheet,BatchNormalizeModal,MoveToProjectModal,ProductCard,ClipperOnboarding}.tsx
ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx:217     plan_limit ?? 2
ArchSmart-web/src/app/(dashboard)/projects/page.tsx:44       plan_limit ?? 2
ArchSmart-web/eslint.config.mjs                              3 regras novas (warn)
tools/catraca.py                                             2 medidas novas
tools/catraca.json                                           baseline gerado pela ferramenta
PROGRESS.md, CLAUDE.md, ArchSmart-web/CLAUDE.md
```

---

## Comandos de verificação (da raiz de `ArchSmart-web/`)

```
npm run typecheck        # tsc --noEmit
npm test                 # vitest run
npx eslint . --format json --output-file eslint.json
```

Da raiz do repositório:

```
python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
python tools/progresso.py --check
python tools/checa_links.py
cd tools; python -m unittest discover -p "test_*.py"
```

**Estado limpo de partida** (medido em 06/09/2026, antes da Tarefa 1):
`Test Files 4 passed (4)`, `Tests 7 passed (7)`, `tsc --noEmit` sem saída.
Qualquer `failed` a partir daqui é regressão desta seção.

---

## Tarefa 1: Baseline medido da Biblioteca

Antes de tocar em uma linha. Os "3,6 s" da doc são de agosto e não valem como
referência para medir o ganho desta seção.

**Files:**
- Create: `docs/dev/medicoes/2026-09-06-biblioteca-baseline.md`
- Create: `ArchSmart-web/e2e/medicao-biblioteca.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: o arquivo de medição que a Tarefa 12 compara. Formato fixo:
  uma linha `mediana_ms=<n>` que a Tarefa 12 lê.

- [ ] **Step 1: Escrever o spec de medição**

`ArchSmart-web/e2e/medicao-biblioteca.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

/**
 * Mede "do clique até os dados na tela" na Biblioteca.
 *
 * Não é teste de regressão: é instrumento. Roda com sessão real e API quente
 * (o Render free tier hiberna — a primeira chamada mediu 41,9 s em
 * 06/09/2026, e incluir esse número na mediana mediria o Render, não o front).
 */
const REPETICOES = 5

test("mede o tempo até a grade da Biblioteca ter dados", async ({ page }) => {
    const amostras: number[] = []

    // Aquece: descarta a primeira, que pode pagar cold start da API.
    await page.goto("/library")
    await page.waitForSelector("[data-testid='product-grid'], [data-testid='library-empty']")

    for (let i = 0; i < REPETICOES; i++) {
        await page.goto("/dashboard")
        await page.waitForLoadState("networkidle")

        const inicio = Date.now()
        await page.click("a[href='/library']")
        await page.waitForSelector("[data-testid='product-grid'], [data-testid='library-empty']")
        amostras.push(Date.now() - inicio)
    }

    amostras.sort((a, b) => a - b)
    const mediana = amostras[Math.floor(amostras.length / 2)]
    console.log(`AMOSTRAS=${amostras.join(",")}`)
    console.log(`MEDIANA_MS=${mediana}`)
    expect(amostras).toHaveLength(REPETICOES)
})
```

- [ ] **Step 2: Acrescentar os `data-testid` que a medição precisa**

Em `src/app/(dashboard)/library/components/LibraryContent.tsx`, na `div` da
grade (hoje a que tem `className="grid grid-cols-1 sm:grid-cols-2 ..."`) e no
bloco de vazio:

```tsx
<div data-testid="product-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
```

```tsx
<div data-testid="library-empty" className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground">
```

- [ ] **Step 3: Rodar a medição contra a Biblioteca de hoje**

```bash
cd ArchSmart-web
npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line
```

Se o Playwright pedir sessão e não houver uma configurada, use a
`storageState` do `playwright.config.ts`; se não existir, faça o login uma vez
com `npx playwright codegen` e salve o estado. **Não invente o número: se a
medição não rodar, pare e diga.**

- [ ] **Step 4: Registrar a medição**

`docs/dev/medicoes/2026-09-06-biblioteca-baseline.md`:

```markdown
# Baseline da Biblioteca — antes da Seção 5

Medido em 06/09/2026, na branch `secao-5-camada-de-dados-frontend`, no commit
imediatamente anterior à Tarefa 2.

Comando:

    cd ArchSmart-web
    npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line

API quente (a primeira navegação é descartada: o Render free tier hiberna e
mediu 41,9 s de cold start em 06/09/2026).

    amostras_ms=<colar AMOSTRAS da saída>
    mediana_ms=<colar MEDIANA_MS da saída>

Cascata de rede observada por navegação, hoje:
`createClient()` → `getSession()` → `fetch /api/products` → render.
Duas queries em paralelo (`products` e `inbox-count`), cada uma repetindo a
resolução de sessão.
```

- [ ] **Step 5: Commit**

```bash
git add ArchSmart-web/e2e/medicao-biblioteca.spec.ts docs/dev/medicoes/ "ArchSmart-web/src/app/(dashboard)/library/components/LibraryContent.tsx"
git commit -m "test(medicao): baseline da Biblioteca antes da camada de dados"
```

---

## Tarefa 2: `lib/api/errors.ts` — a discriminação por formato

Função pura, sem rede. É a decisão 1 virando código, e é o único lugar do front
que decide como um erro da API vira frase para o usuário.

**Files:**
- Create: `ArchSmart-web/src/lib/api/errors.ts`
- Test: `ArchSmart-web/src/__tests__/api-errors.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `class ApiError extends Error` com `readonly status: number`,
    `readonly detail: unknown`, `readonly ehDeSchema: boolean`
  - `const MENSAGEM_GENERICA: string`
  - `function mensagemDoCorpo(corpo: unknown, fallback?: string): string`
  - `async function erroDaResposta(res: Response, fallback?: string): Promise<ApiError>`

- [ ] **Step 1: Escrever o teste que falha**

`ArchSmart-web/src/__tests__/api-errors.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
    ApiError,
    MENSAGEM_GENERICA,
    mensagemDoCorpo,
    erroDaResposta,
} from "@/lib/api/errors"

describe("mensagemDoCorpo", () => {
    it("usa o detail quando ele e string — erro de dominio do backend", () => {
        expect(mensagemDoCorpo({ detail: "Seu plano não permite esta ação." }))
            .toBe("Seu plano não permite esta ação.")
    })

    it("cai na generica quando o detail e array — 422 de schema do Pydantic", () => {
        const corpo = { detail: [{ loc: ["header", "authorization"], msg: "Field required" }] }
        expect(mensagemDoCorpo(corpo)).toBe(MENSAGEM_GENERICA)
    })

    it("cai na generica quando nao ha corpo", () => {
        expect(mensagemDoCorpo(null)).toBe(MENSAGEM_GENERICA)
    })

    it("respeita o fallback do chamador", () => {
        expect(mensagemDoCorpo(null, "Falha ao aprovar em lote."))
            .toBe("Falha ao aprovar em lote.")
    })
})

describe("erroDaResposta", () => {
    it("monta ApiError a partir de um erro de dominio", async () => {
        const res = new Response(JSON.stringify({ detail: "Recurso não encontrado." }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        })
        const erro = await erroDaResposta(res)
        expect(erro).toBeInstanceOf(ApiError)
        expect(erro.status).toBe(404)
        expect(erro.message).toBe("Recurso não encontrado.")
        expect(erro.ehDeSchema).toBe(false)
    })

    it("marca ehDeSchema quando o detail e array, mesmo com status 422", async () => {
        const res = new Response(JSON.stringify({ detail: [{ msg: "Field required" }] }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
        })
        const erro = await erroDaResposta(res)
        expect(erro.status).toBe(422)
        expect(erro.ehDeSchema).toBe(true)
        expect(erro.message).toBe(MENSAGEM_GENERICA)
    })

    it("nao explode com corpo que nao e JSON", async () => {
        const res = new Response("<html>502 Bad Gateway</html>", { status: 502 })
        const erro = await erroDaResposta(res)
        expect(erro.status).toBe(502)
        expect(erro.message).toBe(MENSAGEM_GENERICA)
    })

    it("um 422 de dominio e indistinguivel de um 400 de dominio — por formato", async () => {
        // As dez rotas que a Secao 4 mudou de 400/500 para 422 continuam
        // devolvendo `detail` string. O cliente nao pode ramificar por status.
        const dominio422 = new Response(JSON.stringify({ detail: "Dados inválidos." }), { status: 422 })
        const dominio400 = new Response(JSON.stringify({ detail: "Dados inválidos." }), { status: 400 })
        expect((await erroDaResposta(dominio422)).message)
            .toBe((await erroDaResposta(dominio400)).message)
    })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ArchSmart-web && npx vitest run src/__tests__/api-errors.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/api/errors"`

- [ ] **Step 3: Implementar**

`ArchSmart-web/src/lib/api/errors.ts`:

```ts
/**
 * Como um erro da API vira frase para o usuario.
 *
 * REGRA, decidida em 06/09/2026: discriminamos por FORMATO do `detail`, nunca
 * por status HTTP.
 *
 *   detail: string  -> erro de dominio. Frase em pt-BR pronta para exibir.
 *   detail: array   -> 422 de schema do Pydantic. E defeito nosso (o cliente
 *                      mandou o corpo errado, ou esqueceu um header), nao algo
 *                      que o usuario possa corrigir: mensagem generica + log.
 *
 * Por que nao por status: a Secao 4 mudou dez rotas de 400->422 e 500->422, e
 * `ValidacaoDeDominio` (status 422) devolve `detail` string igual a qualquer
 * outro erro de dominio. Um cliente que fizesse `if (status === 422)` para
 * renderizar `detail[].msg` quebraria nessas dez. O formato nao mente; o
 * status, para este fim, mente.
 *
 * Ver `ArchSmart-api/app/core/errors.py`: todo `DomainError` responde
 * `{"detail": "<frase>"}` nos status 404, 403, 402 e 422.
 */

export const MENSAGEM_GENERICA = "Não foi possível completar a ação. Tente novamente."

export class ApiError extends Error {
    readonly status: number
    readonly detail: unknown
    /** `true` quando o corpo e o 422 de schema do Pydantic, nao erro de dominio. */
    readonly ehDeSchema: boolean

    constructor(status: number, mensagem: string, detail: unknown, ehDeSchema: boolean) {
        super(mensagem)
        this.name = "ApiError"
        this.status = status
        this.detail = detail
        this.ehDeSchema = ehDeSchema
    }
}

function detailDe(corpo: unknown): unknown {
    if (corpo === null || typeof corpo !== "object") return undefined
    return (corpo as { detail?: unknown }).detail
}

export function mensagemDoCorpo(corpo: unknown, fallback: string = MENSAGEM_GENERICA): string {
    const detail = detailDe(corpo)
    return typeof detail === "string" && detail.trim() !== "" ? detail : fallback
}

export async function erroDaResposta(res: Response, fallback?: string): Promise<ApiError> {
    let corpo: unknown = null
    try {
        corpo = await res.json()
    } catch {
        // Resposta sem corpo JSON (502 do proxy, 504, HTML de erro do Render).
        // Nao e caso excepcional: e o que se ve quando a infra falha.
    }

    const detail = detailDe(corpo)
    const ehDeSchema = Array.isArray(detail)

    if (ehDeSchema) {
        // Log, nao exibicao: o array traz `loc`/`msg`/`type`, que descrevem o
        // NOSSO payload — util para quem depura, ruido para quem usa.
        console.error("[api] 422 de schema em", res.url, detail)
    }

    return new ApiError(res.status, mensagemDoCorpo(corpo, fallback), detail, ehDeSchema)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd ArchSmart-web && npx vitest run src/__tests__/api-errors.test.ts`
Expected: PASS — 9 testes.

- [ ] **Step 5: Commit**

```bash
git add ArchSmart-web/src/lib/api/errors.ts ArchSmart-web/src/__tests__/api-errors.test.ts
git commit -m "feat(api): erro do cliente discrimina por formato do detail, nao por status"
```

---

## Tarefa 3: `lib/api/auth.ts` e `auth.server.ts` — o ponto único do Supabase

**Por que dois arquivos, e não um como a spec diz.** `auth.server.ts` importa
`cookies` de `next/headers`, que não pode existir num bundle de cliente — um
`import` dele em código do browser é erro de build do Next, não escolha de
estilo. A spec diz "o único arquivo que sabe que Supabase existe"; a intenção
(um ponto de troca por Cognito) é preservada com dois arquivos irmãos no mesmo
diretório, e a regra da catraca isenta `src/lib/api/**`, não um arquivo só.
Registre o desvio no `ArchSmart-web/CLAUDE.md` na Tarefa 13.

**Files:**
- Create: `ArchSmart-web/src/lib/api/auth.ts`
- Create: `ArchSmart-web/src/lib/api/auth.server.ts`
- Delete: `ArchSmart-web/src/utils/supabase/client.ts`
- Delete: `ArchSmart-web/src/utils/supabase/server.ts`

**Interfaces:**
- Consumes: `env` de `@/lib/env`.
- Produces:
  - `auth.ts`: `supabaseBrowser(): SupabaseClient`,
    `getAccessToken(): Promise<string | undefined>`,
    `signOut(): Promise<void>`,
    `setSession(t: { access_token: string; refresh_token: string }): Promise<void>`
  - `auth.server.ts`: `supabaseServer(): Promise<SupabaseClient>`,
    `getServerAccessToken(): Promise<string | undefined>`,
    `getServerUser(): Promise<User | null>`

- [ ] **Step 1: Escrever `auth.ts`**

```ts
"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/env"

/**
 * O unico arquivo do browser que sabe que o Supabase existe.
 *
 * Superficie deliberadamente pequena: medido em 06/09/2026, o front inteiro
 * usa quatro metodos de auth (`getSession` 56x, `signOut` 2x, `setSession` 2x,
 * `getUser` 2x), zero `storage` e zero `from()`. Login e cadastro ja passam
 * pela API. Trocar Supabase por Cognito e reescrever estas quatro funcoes e o
 * irmao `auth.server.ts` — nada mais.
 *
 * O cliente e memoizado: `createBrowserClient` monta listeners de storage e
 * um timer de refresh, e chamar de novo a cada `getAccessToken()` vazava os
 * dois. Eram 62 `createClient()` espalhados antes desta secao.
 */
let cliente: SupabaseClient | undefined

export function supabaseBrowser(): SupabaseClient {
    if (!cliente) {
        cliente = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    }
    return cliente
}

export async function getAccessToken(): Promise<string | undefined> {
    const { data } = await supabaseBrowser().auth.getSession()
    return data.session?.access_token
}

export async function signOut(): Promise<void> {
    await supabaseBrowser().auth.signOut()
}

export async function setSession(tokens: {
    access_token: string
    refresh_token: string
}): Promise<void> {
    const { error } = await supabaseBrowser().auth.setSession(tokens)
    if (error) throw error
}
```

- [ ] **Step 2: Escrever `auth.server.ts`**

```ts
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { env } from "@/lib/env"

/**
 * Irmao servidor do `auth.ts`.
 *
 * Existe separado porque `next/headers` nao pode ser importado por bundle de
 * cliente — juntar os dois num arquivo so quebra o build do Next, nao e
 * questao de estilo. A spec pede "um arquivo"; a intencao (um ponto de troca
 * por Cognito) fica preservada por serem dois arquivos irmaos no mesmo
 * diretorio.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
    const cookieStore = await cookies()

    return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options),
                    )
                } catch {
                    // Server Component nao pode escrever cookie. Quem renova a
                    // sessao e o proxy.ts, que roda em middleware e pode.
                }
            },
        },
    })
}

export async function getServerAccessToken(): Promise<string | undefined> {
    const { data } = await (await supabaseServer()).auth.getSession()
    return data.session?.access_token
}

export async function getServerUser(): Promise<User | null> {
    const { data } = await (await supabaseServer()).auth.getUser()
    return data.user
}
```

- [ ] **Step 3: Apagar os dois arquivos antigos e reapontar os imports**

```bash
cd ArchSmart-web
git rm src/utils/supabase/client.ts src/utils/supabase/server.ts
grep -rn "utils/supabase" src --include=*.ts --include=*.tsx
```

Cada arquivo que a busca listar troca:

| Antes | Depois |
|---|---|
| `import { createClient } from "@/utils/supabase/client"` + `createClient()` + `.auth.getSession()` | `import { getAccessToken } from "@/lib/api/auth"` |
| `import { createClient } from "@/utils/supabase/server"` + `.auth.getSession()` | `import { getServerAccessToken } from "@/lib/api/auth.server"` |
| `.auth.signOut()` | `signOut()` de `@/lib/api/auth` |
| `.auth.setSession(...)` | `setSession(...)` de `@/lib/api/auth` |

**O ramo mock some junto** (decisão 4): nenhum dos dois arquivos novos o tem.
As telas que restam ainda montam header à mão — isso é normal e some por
domínio na Tarefa 6 e na Seção 8. **Não reescreva nesta tarefa nada além do
import e da resolução de token.**

- [ ] **Step 4: Verificar que o mock morreu**

```bash
cd ..
grep -rn "dummy_anon_key\|your-project.supabase.co" ArchSmart-web/src
```

Expected: **duas** ocorrências, ambas em `src/proxy.ts` (a Tarefa 9 as remove).
Zero em qualquer outro arquivo.

- [ ] **Step 5: Tipos e testes**

```bash
cd ArchSmart-web && npm run typecheck && npm test
```

Expected: `tsc` sem saída; `Test Files 5 passed (5)`.

- [ ] **Step 6: Commit**

```bash
git add -A ArchSmart-web/src
git commit -m "feat(api): auth.ts e auth.server.ts como ponto unico do Supabase, sem mock"
```

---

## Tarefa 4: `lib/api/client.ts` — o cliente único

**Files:**
- Create: `ArchSmart-web/src/lib/api/client.ts`
- Create: `ArchSmart-web/src/lib/api/server.ts`
- Test: `ArchSmart-web/src/__tests__/api-client.test.ts`

**Interfaces:**
- Consumes: `ApiError`, `erroDaResposta` (Tarefa 2); `getAccessToken`
  (Tarefa 3); `apiUrl` de `@/lib/api-url`.
- Produces:
  - `type ValorDeQuery = string | number | boolean | string[] | undefined | null`
  - `interface Requisicao { method?, body?, signal?, query?, fallbackDeErro? }`
  - `function criarCliente(opts: OpcoesDoCliente): ClienteApi`
  - `type ClienteApi = <T>(path: string, req?: Requisicao) => Promise<T>`
  - `const api: ClienteApi` (browser) — em `client.ts`
  - `const apiServer: ClienteApi` (servidor) — em `server.ts`

- [ ] **Step 1: Escrever o teste que falha**

`ArchSmart-web/src/__tests__/api-client.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { criarCliente } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"

function clienteDeTeste(resposta: Response, token: string | undefined = "tok123") {
    const fetchFalso = vi.fn().mockResolvedValue(resposta)
    const cliente = criarCliente({
        resolverToken: async () => token,
        baseUrl: () => "http://api.teste",
        fetchImpl: fetchFalso as unknown as typeof fetch,
    })
    return { cliente, fetchFalso }
}

function json(corpo: unknown, status = 200) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

describe("criarCliente", () => {
    it("monta o header Authorization sozinho", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }))
        await cliente("/api/products")
        const [, init] = fetchFalso.mock.calls[0]
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok123")
    })

    it("nao manda Authorization quando nao ha sessao", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }), undefined)
        await cliente("/api/public")
        const [, init] = fetchFalso.mock.calls[0]
        expect(new Headers(init.headers).has("Authorization")).toBe(false)
    })

    it("manda Authorization tambem em DELETE — o defeito do ProductCard", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }))
        await cliente("/api/products/abc", { method: "DELETE" })
        const [, init] = fetchFalso.mock.calls[0]
        expect(init.method).toBe("DELETE")
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok123")
    })

    it("serializa query, inclusive parametro repetido", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ items: [] }))
        await cliente("/api/products", {
            query: { page: 1, size: 15, categories: ["Mobiliário", "Iluminação"], q: undefined },
        })
        const [url] = fetchFalso.mock.calls[0]
        const params = new URL(url).searchParams
        expect(params.get("page")).toBe("1")
        expect(params.getAll("categories")).toEqual(["Mobiliário", "Iluminação"])
        expect(params.has("q")).toBe(false)
    })

    it("propaga o AbortSignal do chamador", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }))
        const controller = new AbortController()
        await cliente("/api/products", { signal: controller.signal })
        const [, init] = fetchFalso.mock.calls[0]
        expect(init.signal).toBe(controller.signal)
    })

    it("levanta ApiError com a frase de dominio", async () => {
        const { cliente } = clienteDeTeste(json({ detail: "Seu plano não permite esta ação." }, 402))
        await expect(cliente("/api/projects", { method: "POST" })).rejects.toMatchObject({
            status: 402,
            message: "Seu plano não permite esta ação.",
        })
        await expect(cliente("/api/projects", { method: "POST" })).rejects.toBeInstanceOf(ApiError)
    })

    it("manda Content-Type e corpo JSON so quando ha body", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }))
        await cliente("/api/products", { method: "POST", body: { name: "Cadeira" } })
        const [, init] = fetchFalso.mock.calls[0]
        expect(new Headers(init.headers).get("Content-Type")).toBe("application/json")
        expect(init.body).toBe(JSON.stringify({ name: "Cadeira" }))
    })

    it("devolve undefined em 204 sem estourar no json()", async () => {
        const { cliente } = clienteDeTeste(new Response(null, { status: 204 }))
        await expect(cliente("/api/products/abc", { method: "DELETE" })).resolves.toBeUndefined()
    })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ArchSmart-web && npx vitest run src/__tests__/api-client.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/api/client"`

- [ ] **Step 3: Implementar `client.ts`**

```ts
import { erroDaResposta } from "@/lib/api/errors"
import { getAccessToken } from "@/lib/api/auth"
import { getApiUrl } from "@/lib/api-url"

/**
 * O unico lugar do front que chama `fetch`.
 *
 * Resolve sessao, monta header, serializa query, propaga AbortSignal, traduz
 * erro e tipa a resposta. Antes desta secao eram 73 linhas montando
 * `Authorization` a mao e 56 `getSession()` — e um DELETE que esquecia o
 * header e falhava calado (ProductCard.tsx:89).
 *
 * `criarCliente` recebe suas dependencias por parametro para ser testavel sem
 * rede e sem Supabase; `api` (browser) e `apiServer` (servidor, em server.ts)
 * sao as duas instancias que a aplicacao usa.
 */

export type ValorDeQuery = string | number | boolean | string[] | undefined | null

export interface Requisicao {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    body?: unknown
    signal?: AbortSignal
    query?: Record<string, ValorDeQuery>
    /** Frase a exibir quando a API nao mandar uma. Ver lib/api/errors.ts. */
    fallbackDeErro?: string
}

export type ClienteApi = <T>(path: string, req?: Requisicao) => Promise<T>

export interface OpcoesDoCliente {
    resolverToken: () => Promise<string | undefined>
    baseUrl?: () => string
    fetchImpl?: typeof fetch
}

function montarQuery(query: Record<string, ValorDeQuery> | undefined): string {
    if (!query) return ""
    const params = new URLSearchParams()
    for (const [chave, valor] of Object.entries(query)) {
        if (valor === undefined || valor === null || valor === "") continue
        if (Array.isArray(valor)) valor.forEach((v) => params.append(chave, String(v)))
        else params.set(chave, String(valor))
    }
    const texto = params.toString()
    return texto ? `?${texto}` : ""
}

export function criarCliente(opts: OpcoesDoCliente): ClienteApi {
    const base = opts.baseUrl ?? getApiUrl
    const chamar = opts.fetchImpl ?? fetch

    return async function requisitar<T>(path: string, req: Requisicao = {}): Promise<T> {
        const token = await opts.resolverToken()

        const headers = new Headers()
        if (token) headers.set("Authorization", `Bearer ${token}`)
        if (req.body !== undefined) headers.set("Content-Type", "application/json")

        const caminho = path.startsWith("/") ? path : `/${path}`
        const url = `${base()}${caminho}${montarQuery(req.query)}`

        const res = await chamar(url, {
            method: req.method ?? "GET",
            headers,
            body: req.body === undefined ? undefined : JSON.stringify(req.body),
            signal: req.signal,
        })

        if (!res.ok) throw await erroDaResposta(res, req.fallbackDeErro)

        // 204, e qualquer resposta sem corpo, nao sao erro: sao o contrato de
        // DELETE nesta API. Chamar .json() aqui estouraria SyntaxError.
        if (res.status === 204 || res.headers.get("Content-Length") === "0") {
            return undefined as T
        }
        return (await res.json()) as T
    }
}

/** Cliente do browser. Toda tela usa este. */
export const api: ClienteApi = criarCliente({ resolverToken: getAccessToken })
```

- [ ] **Step 4: Implementar `server.ts`**

```ts
import { criarCliente, type ClienteApi } from "@/lib/api/client"
import { getServerAccessToken } from "@/lib/api/auth.server"

/**
 * Cliente para Server Component e Route Handler. Mesmo comportamento do `api`
 * do browser; muda so de onde vem o token — cookie, via `next/headers`.
 *
 * Arquivo separado porque `auth.server.ts` importa `next/headers`, que nao
 * pode ser alcancado por bundle de cliente.
 */
export const apiServer: ClienteApi = criarCliente({ resolverToken: getServerAccessToken })
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd ArchSmart-web && npx vitest run src/__tests__/api-client.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 6: Commit**

```bash
git add ArchSmart-web/src/lib/api/client.ts ArchSmart-web/src/lib/api/server.ts ArchSmart-web/src/__tests__/api-client.test.ts
git commit -m "feat(api): cliente HTTP unico com header, query, abort e erro tipado"
```

---

## Tarefa 5: `lib/query/keys.ts` — chaves hierárquicas e política de cache

**Files:**
- Create: `ArchSmart-web/src/lib/query/keys.ts`
- Test: `ArchSmart-web/src/__tests__/query-keys.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface FiltrosDeProduto { tab, q, categories, origins, sortBy, page, size }`
  - `const queryKeys` com `products.{all,lists,list,details,detail,inboxCount}`,
    `projects.{all,lists,list,environments}`, `account.{all,me}`
  - `const cachePolicy` com `referencia`, `conta`, `transacional`

- [ ] **Step 1: Escrever o teste que falha**

`ArchSmart-web/src/__tests__/query-keys.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { queryKeys, cachePolicy } from "@/lib/query/keys"

/** Uma chave e prefixo de outra? E assim que o React Query decide invalidacao. */
function ehPrefixoDe(prefixo: readonly unknown[], chave: readonly unknown[]) {
    return prefixo.every((parte, i) => JSON.stringify(parte) === JSON.stringify(chave[i]))
}

describe("queryKeys", () => {
    it("inboxCount e FILHO de products — invalidar products alcanca o badge", () => {
        // Este era o defeito: ["products"] e ["inbox-count"] eram irmaos planos,
        // entao BatchNormalizeModal precisava invalidar as duas a mao e quem
        // esquecesse a segunda deixava o badge do inbox mentindo.
        expect(ehPrefixoDe(queryKeys.products.all, queryKeys.products.inboxCount())).toBe(true)
    })

    it("list e detail tambem sao filhos de products", () => {
        const filtros = { tab: "library", page: 1, size: 15 }
        expect(ehPrefixoDe(queryKeys.products.all, queryKeys.products.list(filtros))).toBe(true)
        expect(ehPrefixoDe(queryKeys.products.all, queryKeys.products.detail("abc"))).toBe(true)
    })

    it("list e detail nao colidem entre si", () => {
        const filtros = { tab: "library", page: 1, size: 15 }
        expect(ehPrefixoDe(queryKeys.products.lists(), queryKeys.products.detail("abc"))).toBe(false)
    })

    it("filtros diferentes produzem chaves diferentes", () => {
        const a = queryKeys.products.list({ tab: "library", page: 1, size: 15 })
        const b = queryKeys.products.list({ tab: "inbox", page: 1, size: 15 })
        expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
    })

    it("ambientes sao filhos do projeto a que pertencem", () => {
        expect(ehPrefixoDe(queryKeys.projects.all, queryKeys.projects.environments("p1"))).toBe(true)
    })
})

describe("cachePolicy", () => {
    it("referencia vive mais que transacional", () => {
        expect(cachePolicy.referencia.staleTime).toBeGreaterThan(cachePolicy.transacional.staleTime)
    })

    it("conta fica entre as duas", () => {
        expect(cachePolicy.conta.staleTime).toBeGreaterThan(cachePolicy.transacional.staleTime)
        expect(cachePolicy.conta.staleTime).toBeLessThan(cachePolicy.referencia.staleTime)
    })

    it("nada rebusca por troca de aba", () => {
        for (const politica of Object.values(cachePolicy)) {
            expect(politica.refetchOnWindowFocus).toBe(false)
        }
    })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ArchSmart-web && npx vitest run src/__tests__/query-keys.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/query/keys"`

- [ ] **Step 3: Implementar**

```ts
/**
 * Chaves de cache e politica por natureza do dado.
 *
 * HIERARQUIA, nao lista plana. O React Query invalida por PREFIXO: uma chave
 * `["products", ...]` e alcancada por `invalidateQueries({ queryKey: ["products"] })`.
 * Antes desta secao as chaves eram irmas planas — `["products"]` e
 * `["inbox-count"]` — e o BatchNormalizeModal precisava invalidar as duas a
 * mao (linhas 278-279). Quem esquecesse a segunda deixava o badge do inbox
 * mentindo, sem erro nenhum aparecer. Com a hierarquia, esse esquecimento
 * deixa de ser possivel de escrever.
 */

export interface FiltrosDeProduto {
    tab?: string
    q?: string
    categories?: string[]
    origins?: string[]
    sortBy?: string
    page: number
    size: number
}

export const queryKeys = {
    products: {
        all: ["products"] as const,
        lists: () => [...queryKeys.products.all, "list"] as const,
        list: (filtros: FiltrosDeProduto) => [...queryKeys.products.lists(), filtros] as const,
        details: () => [...queryKeys.products.all, "detail"] as const,
        detail: (id: string) => [...queryKeys.products.details(), id] as const,
        inboxCount: () => [...queryKeys.products.all, "inbox-count"] as const,
    },
    projects: {
        all: ["projects"] as const,
        lists: () => [...queryKeys.projects.all, "list"] as const,
        list: (page: number, size: number) => [...queryKeys.projects.lists(), { page, size }] as const,
        environments: (projectId: string) =>
            [...queryKeys.projects.all, projectId, "environments"] as const,
    },
    account: {
        all: ["account"] as const,
        me: () => [...queryKeys.account.all, "me"] as const,
    },
} as const

/**
 * Politica de cache por natureza do dado.
 *
 * `refetchOnWindowFocus: false` em todas: rebuscar por troca de aba foi
 * medido como custo sem beneficio nesta aplicacao — o usuario alterna entre a
 * ferramenta e o site do fornecedor o tempo todo.
 */
export const cachePolicy = {
    /** Catalogo, planos, categorias: muda por deploy, nao por uso. */
    referencia: {
        staleTime: 60 * 60_000,
        gcTime: 24 * 60 * 60_000,
        refetchOnWindowFocus: false,
    },
    /** Perfil e entitlements: muda quando o usuario troca de plano. */
    conta: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
    },
    /** Produtos, projetos, orcamento: o usuario edita e espera ver. */
    transacional: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
    },
} as const
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd ArchSmart-web && npx vitest run src/__tests__/query-keys.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 5: Commit**

```bash
git add ArchSmart-web/src/lib/query/keys.ts ArchSmart-web/src/__tests__/query-keys.test.ts
git commit -m "feat(query): chaves hierarquicas e politica de cache por natureza do dado"
```

---

## Tarefa 6: `features/library` — leitura, e o fim da cascata em `LibraryContent`

**Files:**
- Create: `ArchSmart-web/src/features/library/types.ts`
- Create: `ArchSmart-web/src/features/library/filters.ts`
- Create: `ArchSmart-web/src/features/library/api.ts`
- Create: `ArchSmart-web/src/features/library/hooks.ts`
- Create: `docs/dev/modulos/library.md` — **Art. 13, senão a catraca reprova**
- Modify: `ArchSmart-web/src/app/(dashboard)/library/components/LibraryContent.tsx`
- Test: `ArchSmart-web/src/__tests__/library-hooks.test.tsx`

**Interfaces:**
- Consumes: `api` (Tarefa 4); `queryKeys`, `cachePolicy`, `FiltrosDeProduto`
  (Tarefa 5).
- Produces:
  - `types.ts`: `Product`, `ProductsResponse`, `RESPOSTA_VAZIA`
  - `filters.ts`: `FILTROS_PADRAO`, `filtrosDaUrl(params)` — **a Tarefa 8
    depende desta função para a hidratação casar**
  - `api.ts`: `listarProdutos(filtros, signal)`, `obterProduto(id, signal)`
  - `hooks.ts`: `useProducts(filtros, opts?)`, `useProduct(id, ativo)`,
    `useInboxCount()`

- [ ] **Step 1: Escrever `types.ts`**

```ts
/**
 * Tipos do dominio Biblioteca.
 *
 * `state` e `origin` vem do catalogo global (tabelas sem `account_id`, ver
 * Secao 4) e chegam como objeto com `name`, nao como string.
 */
export interface Product {
    id: string
    name: string
    store?: string | null
    price?: number | null
    image_url?: string | null
    dimensions?: { width?: number | null; height?: number | null; depth?: number | null } | null
    yield_factor?: number | null
    state?: { name: string } | null
    origin?: { name: string } | null
}

export interface ProductsResponse {
    items: Product[]
    total: number
    page: number
    size: number
    pages: number
}

export const RESPOSTA_VAZIA: ProductsResponse = {
    items: [],
    total: 0,
    page: 1,
    size: 15,
    pages: 0,
}
```

- [ ] **Step 1B: Escrever `filters.ts` — a forma canônica dos filtros**

Esta é a correção de um defeito encontrado antes da execução. A chave do
cache é montada em **dois** lugares — no servidor (Tarefa 8, `page.tsx`) e no
cliente (`LibraryContent`) — e se as duas divergirem em um único campo a
hidratação nunca casa: a tela busca de novo, o prefetch vira custo puro e
**nenhum erro aparece**. `LibraryContent` hoje resolve `tab` como
`searchParams.get("tab") || "library"`; um `page.tsx` que passasse
`tab: undefined` produziria outra chave. A defesa é não ter dois lugares.

```ts
import type { FiltrosDeProduto } from "@/lib/query/keys"

/**
 * A forma canonica dos filtros da Biblioteca, derivada da URL.
 *
 * UMA funcao, usada pelo Server Component e pelo client component, porque a
 * chave de cache montada em dois lugares diverge em silencio — e o modo de
 * falha e o prefetch da Tarefa 8 virar custo puro sem erro nenhum.
 *
 * Aceita as duas formas de parametro que o Next entrega: `URLSearchParams`
 * (de `useSearchParams`, no cliente) e o objeto simples de `searchParams`
 * (no servidor).
 */
export const FILTROS_PADRAO = {
    tab: "library",
    sortBy: "created_at_desc",
    page: 1,
    size: 15,
} as const

type ParamsDaUrl = URLSearchParams | Record<string, string | string[] | undefined>

function pegar(params: ParamsDaUrl, chave: string): string | undefined {
    if (params instanceof URLSearchParams) return params.get(chave) ?? undefined
    const valor = params[chave]
    return Array.isArray(valor) ? valor[0] : valor
}

function pegarTodos(params: ParamsDaUrl, chave: string): string[] {
    if (params instanceof URLSearchParams) return params.getAll(chave)
    const valor = params[chave]
    if (valor === undefined) return []
    return Array.isArray(valor) ? valor : [valor]
}

export function filtrosDaUrl(params: ParamsDaUrl): FiltrosDeProduto {
    return {
        tab: pegar(params, "tab") ?? FILTROS_PADRAO.tab,
        q: pegar(params, "q"),
        sortBy: pegar(params, "sort_by") ?? FILTROS_PADRAO.sortBy,
        page: Number(pegar(params, "page") ?? FILTROS_PADRAO.page),
        size: Number(pegar(params, "size") ?? FILTROS_PADRAO.size),
        categories: pegarTodos(params, "categories"),
        origins: pegarTodos(params, "origins"),
    }
}
```

O teste desta função é o que trava o defeito, e vai no Step 4:

```ts
import { filtrosDaUrl } from "@/features/library/filters"

describe("filtrosDaUrl", () => {
    it("da a MESMA chave a partir de URLSearchParams e do objeto do servidor", () => {
        // Se estes dois divergirem, a hidratacao da Tarefa 8 nunca casa e o
        // prefetch vira custo puro sem erro nenhum aparecer.
        expect(filtrosDaUrl(new URLSearchParams(""))).toEqual(filtrosDaUrl({}))
        expect(filtrosDaUrl(new URLSearchParams("tab=inbox&page=2&categories=A&categories=B")))
            .toEqual(filtrosDaUrl({ tab: "inbox", page: "2", categories: ["A", "B"] }))
    })

    it("preenche os padroes que o LibraryContent usava inline", () => {
        expect(filtrosDaUrl({})).toMatchObject({
            tab: "library", sortBy: "created_at_desc", page: 1, size: 15,
            categories: [], origins: [],
        })
    })
})
```

- [ ] **Step 2: Escrever `api.ts`**

```ts
import { api } from "@/lib/api/client"
import type { FiltrosDeProduto } from "@/lib/query/keys"
import type { Product, ProductsResponse } from "./types"

/**
 * Chamadas do dominio Biblioteca. Nenhuma monta header nem resolve sessao —
 * quem faz isso e `lib/api/client.ts`.
 *
 * O `state` do filtro nao vem da aba direto: a aba "inbox" mostra CAPTURED e
 * a "library" mostra NORMALIZED. Traduzir isso aqui, e nao na tela, e o que
 * impede a proxima tela de inventar outra traducao.
 */
export function stateDaAba(tab: string | undefined): "CAPTURED" | "NORMALIZED" {
    return tab === "inbox" ? "CAPTURED" : "NORMALIZED"
}

export function listarProdutos(
    filtros: FiltrosDeProduto,
    signal?: AbortSignal,
): Promise<ProductsResponse> {
    return api<ProductsResponse>("/api/products", {
        signal,
        query: {
            page: filtros.page,
            size: filtros.size,
            q: filtros.q,
            sort_by: filtros.sortBy,
            state: stateDaAba(filtros.tab),
            categories: filtros.categories,
            origins: filtros.origins,
        },
    })
}

export function contarInbox(signal?: AbortSignal): Promise<ProductsResponse> {
    return api<ProductsResponse>("/api/products", {
        signal,
        query: { page: 1, size: 1, state: "CAPTURED" },
    })
}

export function obterProduto(id: string, signal?: AbortSignal): Promise<Product> {
    return api<Product>(`/api/products/${id}`, { signal })
}
```

- [ ] **Step 3: Escrever `hooks.ts` (parte de leitura)**

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys, cachePolicy, type FiltrosDeProduto } from "@/lib/query/keys"
import { contarInbox, listarProdutos, obterProduto } from "./api"
import { RESPOSTA_VAZIA } from "./types"

/**
 * Hooks do dominio Biblioteca.
 *
 * O `signal` vem do proprio React Query: trocar de filtro ou sair da tela
 * cancela a requisicao em voo, em vez de deixa-la chegar e sobrescrever a
 * mais nova. Isso vale de graca aqui porque `api()` propaga AbortSignal.
 */
export function useProducts(filtros: FiltrosDeProduto, opcoes: { ativo?: boolean } = {}) {
    return useQuery({
        queryKey: queryKeys.products.list(filtros),
        queryFn: ({ signal }) => listarProdutos(filtros, signal),
        enabled: opcoes.ativo ?? true,
        // Mantem a lista anterior visivel enquanto a nova carrega: sem isso a
        // grade pisca em branco a cada pagina e a cada filtro.
        placeholderData: (anterior) => anterior,
        ...cachePolicy.transacional,
    })
}

export function useInboxCount() {
    return useQuery({
        queryKey: queryKeys.products.inboxCount(),
        queryFn: ({ signal }) => contarInbox(signal),
        select: (resposta) => resposta.total,
        ...cachePolicy.transacional,
    })
}

export function useProduct(id: string | undefined, ativo: boolean) {
    return useQuery({
        queryKey: queryKeys.products.detail(id ?? ""),
        queryFn: ({ signal }) => obterProduto(id as string, signal),
        enabled: !!id && ativo,
        ...cachePolicy.transacional,
    })
}

export { RESPOSTA_VAZIA }
```

- [ ] **Step 4: Escrever o teste dos hooks**

`ArchSmart-web/src/__tests__/library-hooks.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useProducts, useInboxCount } from "@/features/library/hooks"

vi.mock("@/lib/api/auth", () => ({
    getAccessToken: async () => "tok123",
    supabaseBrowser: () => {
        throw new Error("nao deve ser chamado no teste")
    },
    signOut: async () => {},
    setSession: async () => {},
}))

function envolver() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
}

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ items: [{ id: "p1", name: "Cadeira" }], total: 7, page: 1, size: 15, pages: 1 }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        ),
    )
})

describe("useProducts", () => {
    it("busca a lista e manda o header de autorizacao", async () => {
        const { result } = renderHook(() => useProducts({ tab: "library", page: 1, size: 15 }), {
            wrapper: envolver(),
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.items[0].name).toBe("Cadeira")

        const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok123")
    })

    it("traduz a aba inbox para o state CAPTURED", async () => {
        const { result } = renderHook(() => useProducts({ tab: "inbox", page: 1, size: 15 }), {
            wrapper: envolver(),
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(new URL(url).searchParams.get("state")).toBe("CAPTURED")
    })

    it("propaga um AbortSignal — o cancelamento automatico do React Query", async () => {
        const { result } = renderHook(() => useProducts({ tab: "library", page: 1, size: 15 }), {
            wrapper: envolver(),
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(init.signal).toBeInstanceOf(AbortSignal)
    })
})

describe("useInboxCount", () => {
    it("devolve so o total", async () => {
        const { result } = renderHook(() => useInboxCount(), { wrapper: envolver() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toBe(7)
    })
})
```

- [ ] **Step 5: Rodar e ver falhar, depois passar**

Run: `cd ArchSmart-web && npx vitest run src/__tests__/library-hooks.test.tsx`
Expected: primeiro FAIL (import não resolve), depois PASS — 4 testes.

- [ ] **Step 6: Reescrever `LibraryContent.tsx` para usar os hooks**

Remova de `LibraryContent.tsx`: as interfaces `ProductQuery` e
`ProductsResponse`, a constante `EMPTY_RESPONSE`, as funções `fetchProducts` e
`fetchProduct`, e os imports de `getToken` e `apiUrl`. Remova também a leitura
campo a campo dos `searchParams` para montar filtro — ela vira
`filtrosDaUrl()`. O corpo do componente passa a ser:

```tsx
import { useProducts, useProduct, useInboxCount, RESPOSTA_VAZIA } from "@/features/library/hooks"
import { filtrosDaUrl } from "@/features/library/filters"

// ...dentro do componente:
const searchParams = useSearchParams()
const filtros = filtrosDaUrl(searchParams)

// Estes dois nao sao filtro de busca — sao estado de UI vindo da URL.
const action = searchParams.get("action") || undefined
const editId = searchParams.get("id") || undefined

const needsList = filtros.tab === "library" || filtros.tab === "inbox"

const { data, isLoading } = useProducts(filtros, { ativo: needsList })
const { data: inboxCount = 0 } = useInboxCount()
const { data: productToEdit } = useProduct(editId, action === "edit" || action === "normalize")

const result = data ?? RESPOSTA_VAZIA
const products = result.items
```

O resto do JSX passa a ler `filtros.tab` onde lia `tab`, e `filtros.q`,
`filtros.categories`, `filtros.origins` onde lia as variáveis soltas.

Apague também `const productState = tab === "inbox" ? "CAPTURED" : "NORMALIZED"`
— isso agora é `stateDaAba()` dentro de `features/library/api.ts`.

> **Preserve os dois `data-testid`** que a Tarefa 1 acrescentou
> (`product-grid` e `library-empty`). Eles são o instrumento de medição da
> Tarefa 12, que é o portão da seção — apagá-los cega o portão.

- [ ] **Step 7: Escrever a doc do módulo (Art. 13)**

`docs/dev/modulos/library.md`:

```markdown
# Módulo: `features/library`

A camada de dados do domínio Biblioteca — o piloto da Seção 5.

## O que expõe

| Símbolo | Onde | O que faz |
|---|---|---|
| `useProducts(filtros, { ativo })` | `hooks.ts` | Lista paginada e filtrada. `placeholderData` mantém a lista anterior visível ao paginar. |
| `useInboxCount()` | `hooks.ts` | Total de produtos `CAPTURED` (o badge do inbox). Devolve número, não a resposta inteira. |
| `useProduct(id, ativo)` | `hooks.ts` | Um produto, para editar ou normalizar. |
| `useCreateProduct()` / `useUpdateProduct()` | `hooks.ts` | Cria e edita. Invalida `queryKeys.products.all`. |
| `useDeleteProduct()` | `hooks.ts` | Soft delete. |
| `useApproveProduct()` / `useBatchApprove()` | `hooks.ts` | Move de `CAPTURED` para `NORMALIZED`. |
| `useMoveToProject()` | `hooks.ts` | Cria item de orçamento a partir de um produto. Invalida `projects`, não `products`. |
| `stateDaAba(tab)` | `api.ts` | Traduz aba (`inbox`/`library`) para estado (`CAPTURED`/`NORMALIZED`). |

## Do que depende

`lib/api/client.ts` (header, erro, cancelamento) e `lib/query/keys.ts` (chaves
e política de cache). Não fala com Supabase e não monta URL — Art. 4.

## Invalidação

Todas as chaves de produto são filhas de `queryKeys.products.all`, então uma
mutação invalida o ramo inteiro — lista, detalhe e o badge do inbox — com uma
chamada. Antes da Seção 5, `["products"]` e `["inbox-count"]` eram irmãs
planas e o `BatchNormalizeModal` invalidava as duas à mão; três outras
mutações chamavam `router.refresh()`, que revalida Server Component e **não**
toca no cache do cliente de onde a grade lê.
```

- [ ] **Step 8: Verificar tudo**

```bash
cd ArchSmart-web && npm run typecheck && npm test
cd .. && python tools/catraca.py
```

Expected: `tsc` sem saída; `Test Files 8 passed (8)` — os 4 que já existiam
(`Dashboard`, `LoginForm`, `PortalBudget`, `portal-token`) mais os 4 desta
seção; catraca **sem** `library` em `modulos_sem_doc` (é o que o Step 7
garante).

- [ ] **Step 9: Commit**

```bash
git add ArchSmart-web/src/features/library ArchSmart-web/src/__tests__/library-hooks.test.tsx docs/dev/modulos/library.md "ArchSmart-web/src/app/(dashboard)/library/components/LibraryContent.tsx"
git commit -m "feat(library): leitura por hooks de dominio, com cache e cancelamento"
```

---

## Tarefa 7: `features/library` — as mutações, e os dois defeitos vivos

Aqui os Defeitos A e B morrem. **Cada um ganha teste que falha antes.**

**Files:**
- Modify: `ArchSmart-web/src/features/library/api.ts`
- Modify: `ArchSmart-web/src/features/library/hooks.ts`
- Modify: `ArchSmart-web/src/components/library/{ProductFormSheet,NormalizationSheet,BatchNormalizeModal,MoveToProjectModal,ProductCard,ClipperOnboarding}.tsx`
- Modify: `ArchSmart-web/src/lib/normalize-product.ts`
- Test: `ArchSmart-web/src/__tests__/library-hooks.test.tsx` (acrescenta)

**Interfaces:**
- Consumes: tudo da Tarefa 6.
- Produces: `useCreateProduct()`, `useUpdateProduct()`, `useDeleteProduct()`,
  `useApproveProduct()`, `useBatchApprove()`, `useMoveToProject()` — todos
  `UseMutationResult` com `mutateAsync`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `library-hooks.test.tsx`:

```tsx
import { useDeleteProduct, useBatchApprove } from "@/features/library/hooks"
import { queryKeys } from "@/lib/query/keys"

describe("useDeleteProduct — Defeito A", () => {
    it("manda Authorization no DELETE", async () => {
        // ProductCard.tsx:89 chamava fetch(url, { method: "DELETE" }) sem
        // header nenhum. get_context declara `authorization: str = Header(...)`,
        // entao o FastAPI respondia 422 e a exclusao nunca funcionava.
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        )
        const { result } = renderHook(() => useDeleteProduct(), { wrapper })

        await result.current.mutateAsync("p1")

        const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(String(url)).toContain("/api/products/p1")
        expect(init.method).toBe("DELETE")
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok123")
    })
})

describe("mutacoes — Defeito B", () => {
    it("invalidar products alcanca lista, detalhe e badge do inbox com uma chamada", async () => {
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
        const espia = vi.spyOn(client, "invalidateQueries")
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        )
        const { result } = renderHook(() => useBatchApprove(), { wrapper })

        await result.current.mutateAsync({ items: [{ id: "p1", name: "Cadeira" }] })

        expect(espia).toHaveBeenCalledWith({ queryKey: queryKeys.products.all })
        // Uma so: a hierarquia da Tarefa 5 dispensa invalidar o badge a parte.
        expect(espia).toHaveBeenCalledTimes(1)
    })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ArchSmart-web && npx vitest run src/__tests__/library-hooks.test.tsx`
Expected: FAIL — `useDeleteProduct`/`useBatchApprove` não existem.

- [ ] **Step 3: Acrescentar as chamadas em `api.ts`**

```ts
export interface PayloadDeProduto {
    name: string
    store?: string | null
    price?: number | null
    category?: string | null
    image_url?: string | null
    dimensions?: { width?: number | null; height?: number | null; depth?: number | null; unit: string } | null
    yield_factor?: number | null
}

export function criarProduto(payload: PayloadDeProduto): Promise<Product> {
    return api<Product>("/api/products/", { method: "POST", body: payload })
}

export function atualizarProduto(id: string, payload: PayloadDeProduto): Promise<Product> {
    return api<Product>(`/api/products/${id}`, { method: "PUT", body: payload })
}

/**
 * Soft delete (o backend move para o estado INACTIVE).
 *
 * Antes da Secao 5 esta chamada ia sem `Authorization` — o header e
 * obrigatorio em `get_context`, entao ela respondia 422 e a exclusao nunca
 * funcionou. Passando por `api()`, esquecer o header deixa de ser possivel.
 */
export function excluirProduto(id: string): Promise<void> {
    return api<void>(`/api/products/${id}`, {
        method: "DELETE",
        fallbackDeErro: "Não foi possível excluir o produto.",
    })
}

export function aprovarProduto(id: string, payload: PayloadDeProduto): Promise<Product> {
    return api<Product>(`/api/products/${id}/approve`, {
        method: "PATCH",
        body: payload,
        fallbackDeErro: "Falha ao aprovar produto.",
    })
}

export function aprovarEmLote(payload: { items: unknown[] }): Promise<{ approved?: string[] }> {
    return api<{ approved?: string[] }>("/api/products/batch-approve", {
        method: "PATCH",
        body: payload,
        fallbackDeErro: "Falha ao aprovar em lote.",
    })
}

export function moverParaProjeto(payload: {
    project_id: string
    environment_id: string
    product_id: string
    rule_type: string
}): Promise<unknown> {
    return api("/api/budgets/items", {
        method: "POST",
        body: payload,
        fallbackDeErro: "Não foi possível enviar para o orçamento.",
    })
}

export function listarProjetos(signal?: AbortSignal) {
    return api<{ items: { id: string; name: string }[] }>("/api/projects", { signal })
}

export function listarAmbientes(projectId: string, signal?: AbortSignal) {
    return api<{ id: string; name: string }[]>(`/api/projects/${projectId}/environments`, { signal })
}
```

- [ ] **Step 4: Acrescentar as mutações em `hooks.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
    aprovarEmLote, aprovarProduto, atualizarProduto, criarProduto, excluirProduto,
    listarAmbientes, listarProjetos, moverParaProjeto, type PayloadDeProduto,
} from "./api"

/**
 * Toda mutacao de produto invalida `queryKeys.products.all` — UMA chamada que
 * alcanca lista, detalhe e badge do inbox, porque as chaves sao hierarquicas.
 *
 * Antes desta secao, tres das quatro mutacoes chamavam `router.refresh()`,
 * que revalida Server Component e nao toca no QueryClient de onde a grade le.
 */
function useInvalidarProdutos() {
    const queryClient = useQueryClient()
    return () => queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
}

export function useCreateProduct() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: (payload: PayloadDeProduto) => criarProduto(payload),
        onSuccess: invalidar,
    })
}

export function useUpdateProduct() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: PayloadDeProduto }) =>
            atualizarProduto(id, payload),
        onSuccess: invalidar,
    })
}

export function useDeleteProduct() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: (id: string) => excluirProduto(id),
        onSuccess: invalidar,
    })
}

export function useApproveProduct() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: PayloadDeProduto }) =>
            aprovarProduto(id, payload),
        onSuccess: invalidar,
    })
}

export function useBatchApprove() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: (payload: { items: unknown[] }) => aprovarEmLote(payload),
        onSuccess: invalidar,
    })
}

/** Invalida `projects`, nao `products`: o produto nao mudou; o orcamento sim. */
export function useMoveToProject() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: moverParaProjeto,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
    })
}

export function useProjetosParaMover(ativo: boolean) {
    return useQuery({
        queryKey: queryKeys.projects.list(1, 100),
        queryFn: ({ signal }) => listarProjetos(signal),
        enabled: ativo,
        select: (r) => r.items ?? [],
        ...cachePolicy.transacional,
    })
}

export function useAmbientesDoProjeto(projectId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.projects.environments(projectId ?? ""),
        queryFn: ({ signal }) => listarAmbientes(projectId as string, signal),
        enabled: !!projectId,
        ...cachePolicy.transacional,
    })
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd ArchSmart-web && npx vitest run src/__tests__/library-hooks.test.tsx`
Expected: PASS — 6 testes.

- [ ] **Step 6: Migrar os seis componentes**

Um de cada vez, rodando `npm run typecheck` entre eles.

| Arquivo | O que sai | O que entra |
|---|---|---|
| `ProductFormSheet.tsx` | `getSession()`, `fetch`, `router.refresh()` (linha 190) | `useCreateProduct()` / `useUpdateProduct()` |
| `ProductCard.tsx` | `fetch` sem header (linha 89), `router.refresh()` (linha 100) | `useDeleteProduct()` |
| `NormalizationSheet.tsx` | `getToken()`, `fetch`, `router.refresh()` (linha 155) | `useApproveProduct()` |
| `BatchNormalizeModal.tsx` | `getToken()`, os 2 `fetch`, as 2 `invalidateQueries` (278-279) | `useBatchApprove()`; a paginação do inbox vira `listarProdutos` em laço dentro de `api.ts` |
| `MoveToProjectModal.tsx` | os 2 `useEffect` com `fetch`, o 3º `fetch` | `useProjetosParaMover()`, `useAmbientesDoProjeto()`, `useMoveToProject()` |
| `ClipperOnboarding.tsx` | `createClient()` + `getSession()` no `useEffect` | `getAccessToken()` de `@/lib/api/auth` |

**Regra ao migrar:** troque a camada de dados, **não** reorganize o
componente. Quebrar os arquivos de 450–473 linhas é Seção 6, não esta.

- [ ] **Step 7: Limpar `lib/normalize-product.ts`**

Saem `getToken` (vira `getAccessToken` em `lib/api/auth.ts`) e
`apiErrorMessage` (vira `mensagemDoCorpo` em `lib/api/errors.ts`). A função
`normalizeProduct` passa a chamar `api()`, mantendo o timeout de 45 s e o
`AbortSignal.any` que já tem — **esse comportamento não regride**:

```ts
export async function normalizeProduct(
    input: { text: string; source_url?: string | null },
    options: { signal?: AbortSignal } = {},
): Promise<NormalizedProduct> {
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), NORMALIZE_TIMEOUT_MS)
    const signals = [timeout.signal, options.signal].filter(Boolean) as AbortSignal[]
    const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0]

    try {
        return await api<NormalizedProduct>("/api/products/normalize", {
            method: "POST",
            body: { text: input.text, source_url: input.source_url ?? null },
            signal,
            fallbackDeErro: "Não foi possível analisar este produto.",
        })
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            throw new Error(
                timeout.signal.aborted ? "A análise demorou demais e foi cancelada." : "Análise cancelada.",
            )
        }
        throw err
    } finally {
        clearTimeout(timer)
    }
}
```

`mapWithConcurrency` e `NORMALIZE_CONCURRENCY` ficam onde estão — são política
de lote, não camada de dados.

- [ ] **Step 8: Verificar que o domínio ficou limpo**

```bash
cd ArchSmart-web
grep -rn 'fetch(\|getSession()\|createClient()\|router.refresh()' src/components/library src/app/\(dashboard\)/library src/lib/normalize-product.ts
```

Expected: **zero linhas**.

```bash
npm run typecheck && npm test
```

- [ ] **Step 9: Commit**

```bash
git add -A ArchSmart-web/src
git commit -m "fix(library): mutacoes por hook — DELETE com header e invalidacao no cache certo"
```

---

## Tarefa 8: Prefetch no servidor dentro de `<Suspense>`

**Files:**
- Create: `ArchSmart-web/src/lib/query/hydration.ts`
- Create: `ArchSmart-web/src/app/(dashboard)/library/components/LibraryData.tsx`
- Modify: `ArchSmart-web/src/app/(dashboard)/library/page.tsx`
- Create: `docs/dev/decisoes/0009-prefetch-dentro-de-suspense.md`

**Interfaces:**
- Consumes: `apiServer` (Tarefa 4); `queryKeys`, `cachePolicy` (Tarefa 5);
  `stateDaAba` e **`filtrosDaUrl`** (Tarefa 6).
- Produces: `criarQueryClientDoServidor()`, `tentarPrefetch()`,
  `<LibraryData filtros>`.

> **A hidratação só casa se a chave casar, e a defesa disso é `filtrosDaUrl`.**
> O `page.tsx` (servidor) e o `LibraryContent` (cliente) derivam os filtros
> pela **mesma** função da Tarefa 6. Não monte o objeto de filtros inline
> aqui: um único campo divergente — `tab: undefined` contra `tab: "library"`,
> por exemplo — faz a hidratação falhar em silêncio, e o sintoma é só o
> prefetch não adiantar nada.

- [ ] **Step 1: Escrever `hydration.ts`**

```ts
import { QueryClient } from "@tanstack/react-query"

/**
 * QueryClient por requisicao, para o servidor.
 *
 * NUNCA reuse um QueryClient entre requisicoes no servidor: o cache seria
 * compartilhado entre usuarios, e dado de uma conta apareceria em outra. E o
 * mesmo risco que o `ScopedRepository` fecha no backend (Art. 1), pela outra
 * ponta.
 */
export function criarQueryClientDoServidor(): QueryClient {
    return new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
    })
}

/**
 * Teto para o prefetch do servidor.
 *
 * A API roda no free tier do Render, que hiberna: medido em 06/09/2026,
 * `/health` levou 41,9 s na primeira chamada e 0,46 s nas seguintes. Sem
 * teto, um cold start prenderia o stream ate o timeout da plataforma. Com
 * teto, o prefetch desiste, nao hidrata nada, e o cliente busca — que e
 * exatamente o comportamento de hoje. O pior caso nunca fica pior que o atual.
 */
export const TIMEOUT_DO_PREFETCH_MS = 3_000

export async function tentarPrefetch(tarefa: () => Promise<unknown>): Promise<void> {
    try {
        await Promise.race([
            tarefa(),
            new Promise((_, rejeitar) =>
                setTimeout(() => rejeitar(new Error("timeout do prefetch")), TIMEOUT_DO_PREFETCH_MS),
            ),
        ])
    } catch (erro) {
        // Prefetch e otimizacao, nao contrato: falhar aqui degrada para busca
        // no cliente, e a tela funciona igual. Engolir e deliberado.
        console.warn("[prefetch] desistiu, o cliente vai buscar:", erro)
    }
}
```

- [ ] **Step 2: Escrever `LibraryData.tsx`**

```tsx
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { apiServer } from "@/lib/api/server"
import { queryKeys, type FiltrosDeProduto } from "@/lib/query/keys"
import { criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { stateDaAba } from "@/features/library/api"
import type { ProductsResponse } from "@/features/library/types"
import { LibraryContent } from "./LibraryContent"

/**
 * Busca no servidor e entrega hidratado.
 *
 * Fica dentro de um <Suspense> em page.tsx: o shell da Biblioteca faz stream
 * na hora e este bloco chega quando ficar pronto. Ver ADR 0009 — a spec pedia
 * prefetch bloqueante, e o cold start medido de 41,9 s tornaria isso uma
 * regressao do pior caso.
 */
export async function LibraryData({ filtros }: { filtros: FiltrosDeProduto }) {
    const queryClient = criarQueryClientDoServidor()

    await tentarPrefetch(() =>
        queryClient.prefetchQuery({
            queryKey: queryKeys.products.list(filtros),
            queryFn: () =>
                apiServer<ProductsResponse>("/api/products", {
                    query: {
                        page: filtros.page,
                        size: filtros.size,
                        q: filtros.q,
                        sort_by: filtros.sortBy,
                        state: stateDaAba(filtros.tab),
                        categories: filtros.categories,
                        origins: filtros.origins,
                    },
                }),
        }),
    )

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <LibraryContent />
        </HydrationBoundary>
    )
}
```

> **A chave tem que bater exatamente.** `LibraryData` monta
> `queryKeys.products.list(filtros)` com os mesmos campos que `useProducts`
> monta no cliente. Um campo a mais ou a menos e a hidratação não casa: a tela
> busca de novo e o prefetch vira custo puro. É a falha silenciosa mais comum
> deste padrão — o Passo 5 a mede.

- [ ] **Step 3: Reescrever `page.tsx`**

Mantenha o cabeçalho como está (título, botão "Adicionar Produto"); troque só
o `<Suspense>`:

```tsx
<Suspense fallback={
    <div data-testid="library-skeleton" className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
    </div>
}>
    <LibraryData filtros={filtrosDaUrl(searchParams)} />
</Suspense>
```

Apague o comentário "Shell leve: os dados são buscados no cliente..." — ele
descreve o comportamento anterior. Ele veio de `093d8d4 "fix bugs 17/07"`,
anterior à reestruturação e sem justificativa registrada.

- [ ] **Step 4: Escrever a ADR 0009**

`docs/dev/decisoes/0009-prefetch-dentro-de-suspense.md`, no formato das ADRs
existentes (Contexto / Decisão / Por que / Consequências). O núcleo:

- **Contexto:** a spec da Seção 5 pede "o Server Component busca antes de
  mandar a página".
- **Decisão:** o prefetch acontece dentro de um limite de `<Suspense>`, com
  teto de 3 s e queda para busca no cliente.
- **Por que:** medido em 06/09/2026,
  `curl -w '%{time_total}' https://arqsmart-staging.onrender.com/health` →
  **41,9 s** na primeira chamada, 0,46 s e 0,79 s nas seguintes. O free tier
  do Render hiberna. Prefetch bloqueante entregaria aba em branco por ~42 s.
- **Consequências:** com a API quente, os dados vêm no HTML e o browser não
  faz round-trip; com a API fria, o comportamento degrada exatamente para o de
  hoje. O custo é um caminho a mais para manter, e a exigência de a chave do
  servidor bater com a do cliente.
- **Reverter quando:** a API sair do free tier. Aí `TIMEOUT_DO_PREFETCH_MS`
  pode subir, ou o Suspense pode sair.

- [ ] **Step 5: Medir que a hidratação realmente casou**

```bash
cd ArchSmart-web && npm run build && npm start
```

Com a API quente, abra `/library` com o DevTools na aba Network e confirme:
**nenhuma requisição a `/api/products` partindo do browser** no primeiro
carregamento. Se houver uma, a chave não casou — compare campo a campo o
objeto de `LibraryData` com o de `useProducts`.

- [ ] **Step 6: Commit**

```bash
git add ArchSmart-web/src/lib/query/hydration.ts "ArchSmart-web/src/app/(dashboard)/library" docs/dev/decisoes/0009-prefetch-dentro-de-suspense.md
git commit -m "perf(library): prefetch no servidor dentro de Suspense, com queda para o cliente"
```

---

## Tarefa 9: `proxy.ts`

**Files:**
- Modify: `ArchSmart-web/src/proxy.ts`

- [ ] **Step 1: Reescrever**

```ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/lib/env"

const ROTAS_PUBLICAS = [
    "/", "/produto", "/precos", "/web-clipper", "/sobre", "/termos",
    "/privacidade", "/legal", "/beta", "/beta/register", "/portal",
    "/auth/login", "/auth/register", "/auth/verify", "/auth/recover",
    "/auth/reset-password", "/auth/callback",
]

/** Rotas que processam token vindo do fragmento da URL — nao podem redirecionar. */
const CALLBACKS_DE_AUTH = ["/auth/verify", "/auth/callback", "/auth/reset-password"]

function ehEstatico(pathname: string): boolean {
    return (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/static") ||
        pathname.startsWith("/assets") ||
        pathname.includes(".")
    )
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // ORDEM IMPORTA, e esta e a correcao da Secao 5: o desvio de estatico e de
    // /api acontece ANTES de montar o cliente Supabase e chamar getUser().
    // Antes, toda requisicao de imagem, chunk de JS e chamada de API pagava uma
    // ida ao Supabase para validar token que ela nem usaria.
    if (ehEstatico(pathname)) return NextResponse.next()
    if (CALLBACKS_DE_AUTH.includes(pathname)) return NextResponse.next()

    let response = NextResponse.next({ request: { headers: request.headers } })

    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request: { headers: request.headers } })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options),
                    )
                },
            },
        },
    )

    // getUser() fica: e a verificacao real do token contra o Supabase. Trocar
    // por getSession() aqui seria trocar seguranca por velocidade — o cookie
    // sozinho nao prova nada.
    const { data } = await supabase.auth.getUser()
    const user = data.user

    const ehPublica = ROTAS_PUBLICAS.some((rota) =>
        rota === "/" ? pathname === "/" : pathname === rota || pathname.startsWith(`${rota}/`),
    )

    if (!user && !ehPublica) {
        return NextResponse.redirect(new URL("/auth/login", request.url))
    }
    if (user && pathname.startsWith("/auth/login")) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return response
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|assets|favicon.ico).*)"],
}
```

- [ ] **Step 2: Verificar que os logs e o mock morreram**

```bash
cd ArchSmart-web
grep -n "console.log\|dummy_anon_key" src/proxy.ts
```

Expected: **zero linhas.**

```bash
cd .. && grep -rn "dummy_anon_key\|your-project.supabase.co" ArchSmart-web/src
```

Expected: **zero linhas** no repositório inteiro.

- [ ] **Step 3: Verificar os caminhos à mão**

Com `npm run dev`, confirme os quatro:

1. `/dashboard` sem sessão → redireciona para `/auth/login`
2. `/dashboard` com sessão → carrega
3. `/auth/login` com sessão → redireciona para `/dashboard`
4. `/portal/<uuid>` sem sessão → carrega (é público, é o cliente do arquiteto)

- [ ] **Step 4: Commit**

```bash
git add ArchSmart-web/src/proxy.ts
git commit -m "perf(proxy): desvia estatico antes do getUser, matcher sem /assets, sem log por requisicao"
```

---

## Tarefa 10: `features/account` — o fim do `plan_limit ?? 2` (Art. 3)

**Files:**
- Create: `ArchSmart-web/src/features/account/{types,api,hooks}.ts`
- Create: `docs/dev/modulos/account.md` — **Art. 13**
- Delete: `ArchSmart-web/src/hooks/use-user-profile.ts`
- Modify: `ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx:217`
- Modify: `ArchSmart-web/src/app/(dashboard)/projects/page.tsx:44`

**Interfaces:**
- Consumes: `api`/`apiServer` (Tarefa 4); `queryKeys`, `cachePolicy` (Tarefa 5).
- Produces: `useMe()`, `useEntitlements()`, `obterMe(signal?)`.

- [ ] **Step 1: `types.ts`**

```ts
/**
 * `entitlements` e dicionario ABERTO de proposito: um entitlement novo no
 * backend nao deve exigir deploy casado do front. Por isso o tipo declara as
 * chaves que o front usa hoje e aceita o resto — nao ha lista fechada para
 * tipar contra. Ver ArchSmart-web/CLAUDE.md, "O que a Secao 4 mudou".
 */
export interface Entitlements {
    project_limit?: number
    can_use_ai?: boolean
    can_use_portal?: boolean
    [outro: string]: unknown
}

export interface Me {
    id: string
    full_name: string
    email: string
    avatar_url?: string | null
    role: string
    account: {
        id: string
        name: string
        subscription_status: string
        plan_name?: string
    }
    entitlements: Entitlements
}
```

- [ ] **Step 2: `api.ts` e `hooks.ts`**

```ts
// api.ts
import { api } from "@/lib/api/client"
import type { Me } from "./types"

/**
 * `GET /api/users/me` — nao `/api/v1/me` como a spec dizia. Ver ADR 0008: nao
 * existe prefixo /api/v1 nesta aplicacao e criar um para uma rota so foi
 * recusado.
 */
export function obterMe(signal?: AbortSignal): Promise<Me> {
    return api<Me>("/api/users/me", { signal })
}
```

```ts
// hooks.ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys, cachePolicy } from "@/lib/query/keys"
import { obterMe } from "./api"
import type { Entitlements } from "./types"

export function useMe() {
    return useQuery({
        queryKey: queryKeys.account.me(),
        queryFn: ({ signal }) => obterMe(signal),
        ...cachePolicy.conta,
    })
}

/**
 * A fonte unica de limite de plano no front (Art. 3).
 *
 * Devolve `undefined` enquanto carrega — de proposito. O padrao anterior era
 * `data?.plan_limit ?? 2`, que decidia no front um limite que so o servidor
 * conhece: uma conta com limite 10 via "2" por um instante, e uma falha da
 * chamada fazia o "2" ficar. Quem consome trata `undefined` como "ainda nao
 * sei" e nao renderiza numero nenhum, em vez de inventar um.
 */
export function useEntitlements(): { entitlements: Entitlements | undefined; isLoading: boolean } {
    const { data, isLoading } = useMe()
    return { entitlements: data?.entitlements, isLoading }
}
```

- [ ] **Step 3: Corrigir os dois call sites**

Em `dashboard/page.tsx:217`, `const planLimit = data?.plan_limit ?? 2` sai. A
tela passa a usar `useEntitlements()` e, enquanto `entitlements` for
`undefined`, renderiza o `Skeleton` que a tela já tem em vez de uma barra de
progresso com denominador inventado.

`projects/page.tsx` é Server Component: troque `data.plan_limit ?? 2` pelo
`entitlements.project_limit` vindo de `apiServer<Me>("/api/users/me")`. Se a
chamada falhar, **não** renderize o contador de limite — não invente 2.

> **Cuidado com o nome de fio.** `/api/projects` devolve `plan_limit` e
> `/api/users/me` devolve `entitlements.project_limit`. São o mesmo conceito
> com dois nomes; o front passa a ler **um só**, o do `/me`. Unificar o nome no
> backend não é desta seção.

- [ ] **Step 4: Apagar `use-user-profile.ts` e reapontar quem o usa**

```bash
cd ArchSmart-web
grep -rn "use-user-profile\|useUserProfile" src
git rm src/hooks/use-user-profile.ts
```

Cada consumidor passa a usar `useMe()`. O hook antigo era `useEffect` +
`fetch` — o próprio anti-padrão que a Tarefa 11 passa a contar.

- [ ] **Step 5: `docs/dev/modulos/account.md` (Art. 13)**

Mesma estrutura de `library.md`: o que expõe (`useMe`, `useEntitlements`,
`obterMe`), do que depende, e a nota de que `Entitlements` é dicionário aberto
e por quê.

- [ ] **Step 6: Verificar**

```bash
cd ArchSmart-web && npm run typecheck && npm test
grep -rn "plan_limit" src
```

Expected: `plan_limit` **zero** em `src/app/`; catraca sem `account` em
`modulos_sem_doc`.

- [ ] **Step 7: Commit**

```bash
git add -A ArchSmart-web/src docs/dev/modulos/account.md
git commit -m "fix(account): limite de plano vem de entitlements, nao de fallback no front (Art. 3)"
```

---

## Tarefa 11: Os lints e as duas medidas novas na catraca

**Files:**
- Modify: `ArchSmart-web/eslint.config.mjs`
- Modify: `tools/catraca.py`
- Modify: `tools/catraca.json` — **gerado pela ferramenta, nunca à mão**
- Create: `tools/test_catraca_camada_de_dados.py`

- [ ] **Step 1: Regras no eslint (nível `warn`)**

As regras servem ao editor; **o portão é a catraca** (decisão 2). Acrescente
ao `eslintConfig`:

```js
const PROIBICOES = [
  {
    selector: "CallExpression[callee.name='fetch']",
    message: "Chame a API por `api()` de @/lib/api/client — ele resolve sessao, monta header, propaga AbortSignal e traduz erro. Ver Secao 5.",
  },
  {
    selector: "CallExpression[callee.name='createBrowserClient'], CallExpression[callee.name='createServerClient']",
    message: "So @/lib/api/auth.ts e @/lib/api/auth.server.ts falam com o Supabase — sao o ponto de troca por Cognito.",
  },
  {
    selector: "CallExpression[callee.name='useEffect'] CallExpression[callee.name='fetch']",
    message: "Busca de dado em useEffect nao tem cache, nem cancelamento, nem estado de erro. Use um hook de @/features/<dominio>/hooks.ts.",
  },
  {
    selector: "CallExpression[callee.name='useEffect'] CallExpression[callee.name='api']",
    message: "Busca de dado em useEffect nao tem cache, nem cancelamento, nem estado de erro. Use um hook de @/features/<dominio>/hooks.ts.",
  },
]
```

e, depois dos blocos existentes, dois blocos — **nesta ordem**, porque no flat
config o último que casa vence:

```js
  { files: ["src/**/*.{ts,tsx}"], rules: { "no-restricted-syntax": ["warn", ...PROIBICOES] } },
  // lib/api/ e o territorio isento: e onde `fetch` e o Supabase devem morar.
  { files: ["src/lib/api/**/*.ts", "src/proxy.ts"], rules: { "no-restricted-syntax": "off" } },
```

> `src/proxy.ts` entra na isenção porque roda em middleware, onde o cliente
> Supabase precisa dos cookies da `NextRequest` — o `auth.server.ts` usa
> `next/headers`, que não existe lá.

- [ ] **Step 2: As duas medidas na catraca**

Em `tools/catraca.py`, junto das constantes:

```python
LIB_API_WEB = RAIZ / "ArchSmart-web" / "src" / "lib" / "api"
PROXY_WEB = RAIZ / "ArchSmart-web" / "src" / "proxy.ts"

# `\bfetch\s*\(` nao casa "prefetch(": entre "pre" e "fetch" nao ha fronteira
# de palavra. Casa `fetch(` e `client.fetch(`, que e o que queremos contar.
RE_FETCH = re.compile(r"\bfetch\s*\(")
RE_SUPABASE = re.compile(r"\bcreate(Browser|Server)Client\s*\(")
```

e a função de contagem, no estilo de `contar_cores` (inclusive
`DiretorioMedidoSumiu`, pelo mesmo motivo: a Seção 9 renomeia o diretório):

```python
def contar_ocorrencias(raiz: Path, padrao: re.Pattern, isentos: tuple[Path, ...] = ()) -> int:
    """Ocorrencias de `padrao` em .ts/.tsx sob `raiz`, fora dos caminhos isentos."""
    if not raiz.exists():
        raise DiretorioMedidoSumiu(
            f"{raiz} nao existe. A catraca mede esse caminho; se ele foi renomeado, "
            "atualize SRC_WEB em tools/catraca.py no mesmo commit do rename."
        )
    total = 0
    for caminho in raiz.rglob("*"):
        if caminho.suffix not in (".ts", ".tsx") or not caminho.is_file():
            continue
        if any(caminho == isento or isento in caminho.parents for isento in isentos):
            continue
        total += len(padrao.findall(caminho.read_text(encoding="utf-8", errors="ignore")))
    return total
```

Em `medir()`:

```python
        "fetch_fora_de_lib_api": contar_ocorrencias(SRC_WEB, RE_FETCH, (LIB_API_WEB,)),
        "supabase_fora_de_lib_api": contar_ocorrencias(SRC_WEB, RE_SUPABASE, (LIB_API_WEB, PROXY_WEB)),
```

Em `CRITERIOS`:

```python
    "fetch_fora_de_lib_api": "ocorrencias de `fetch(` em ArchSmart-web/src/**/*.{ts,tsx}, fora de src/lib/api/",
    "supabase_fora_de_lib_api": "ocorrencias de `create{Browser,Server}Client(` fora de src/lib/api/ e src/proxy.ts",
```

E no docstring do módulo, junto das três medidas de hoje:

```
  - fetch_fora_de_lib_api       a Secao 8 zera, quando as 33 telas migrarem
  - supabase_fora_de_lib_api    idem
```

- [ ] **Step 3: Teste da catraca**

`tools/test_catraca_camada_de_dados.py`:

```python
"""Testes das duas medidas que a Secao 5 acrescentou a catraca."""
import re
import tempfile
import unittest
from pathlib import Path

from catraca import RE_FETCH, RE_SUPABASE, contar_ocorrencias


class TestContagem(unittest.TestCase):
    def _arvore(self, arquivos: dict[str, str]) -> Path:
        raiz = Path(tempfile.mkdtemp())
        for nome, conteudo in arquivos.items():
            caminho = raiz / nome
            caminho.parent.mkdir(parents=True, exist_ok=True)
            caminho.write_text(conteudo, encoding="utf-8")
        return raiz

    def test_conta_ocorrencia_e_nao_linha(self):
        raiz = self._arvore({"a.ts": "fetch(x); fetch(y)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_FETCH), 2)

    def test_nao_confunde_prefetch_com_fetch(self):
        raiz = self._arvore({"a.ts": "queryClient.prefetchQuery({})\nprefetch(url)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_FETCH), 0)

    def test_isenta_lib_api(self):
        raiz = self._arvore({"lib/api/client.ts": "fetch(url)\n", "app/tela.tsx": "fetch(url)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_FETCH, (raiz / "lib" / "api",)), 1)

    def test_isenta_arquivo_avulso_alem_de_diretorio(self):
        raiz = self._arvore({"proxy.ts": "createServerClient(a, b)\n", "app/tela.tsx": "createBrowserClient(a, b)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_SUPABASE, (raiz / "proxy.ts",)), 1)

    def test_ignora_arquivo_que_nao_e_ts(self):
        raiz = self._arvore({"leia.md": "fetch(url)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_FETCH), 0)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 4: Gerar o baseline — pela ferramenta**

```bash
cd ArchSmart-web && npx eslint . --format json --output-file eslint.json
cd ..
python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
```

A saída vai reclamar `SEM BASELINE` para as duas chaves novas — é o
fail-closed do `comparar()`, e está correto. Grave então:

```bash
python tools/catraca.py --eslint-json ArchSmart-web/eslint.json --atualizar
```

> **Nunca digite o número no `tools/catraca.json`.** Os "87" e "62" deste
> plano são contagem de linha e vão dar diferente da contagem de ocorrência
> que a ferramenta faz. O job `Repositorio` compara o `catraca.json` do PR com
> o da base e reprova número editado à mão. Cole a saída do comando no PR.

- [ ] **Step 5: Rodar tudo**

```bash
cd tools && python -m unittest discover -p "test_*.py"
```

Expected: o total que sai hoje **mais 5**, todos passando. Meça o "hoje"
rodando o comando **antes** de acrescentar o arquivo — não parta de um número
decorado. (O `CLAUDE.md` cita 44, mas também registra que esse mesmo comando
sai diferente quando rodado da raiz em vez de `tools/`; use o que a sua
execução imprimir.)

- [ ] **Step 6: Commit**

```bash
git add ArchSmart-web/eslint.config.mjs tools/catraca.py tools/catraca.json tools/test_catraca_camada_de_dados.py
git commit -m "feat(catraca): fetch e Supabase fora de lib/api viram medida que so desce"
```

---

## Tarefa 12: A medição final — o portão da seção

**A spec é explícita:** *"Só com o ganho confirmado ligam-se os lints e
migra-se o resto."* Esta tarefa pode reprovar a seção, e isso é o ponto dela.

**Files:**
- Create: `docs/dev/medicoes/2026-09-06-biblioteca-depois.md`

- [ ] **Step 1: Rodar a mesma medição da Tarefa 1**

```bash
cd ArchSmart-web
npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line
```

Mesmo spec, mesma máquina, API quente, primeira navegação descartada.
**Não mude o spec entre as duas medições** — se precisar mudar, remeça as
duas.

- [ ] **Step 2: Contar as chamadas de rede do primeiro carregamento**

Com `npm run build && npm start` e a API quente, abra `/library` com o
DevTools e registre quantas requisições a `/api/*` partem do **browser**.
Antes: duas (`products` e `inbox-count`), cada uma precedida da resolução de
sessão. Depois, com a hidratação casando: a de `products` deve sumir.

- [ ] **Step 3: Registrar**

`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`, com `amostras_ms=`,
`mediana_ms=`, o número de chamadas do browser, e o delta contra o baseline —
**em números, com o comando colado.**

- [ ] **Step 4: O portão**

- **Ganho confirmado** (mediana desceu e/ou as chamadas do browser caíram):
  siga para a Tarefa 13.
- **Ganho não apareceu:** **pare.** Não marque as caixas do `PROGRESS.md` como
  se tivesse aparecido. Escreva no arquivo de medição o que foi medido e o que
  se suspeita, e leve a Thiago. A hipótese mais provável, e a primeira a
  checar, é a chave da hidratação não casar (Tarefa 8, Passo 5) — nesse caso o
  prefetch é custo puro e o número não desce.

- [ ] **Step 5: Commit**

```bash
git add docs/dev/medicoes/2026-09-06-biblioteca-depois.md
git commit -m "docs(medicao): Biblioteca depois da camada de dados"
```

---

## Tarefa 13: Documentação e fechamento

**Files:**
- Modify: `PROGRESS.md`, `CLAUDE.md`, `ArchSmart-web/CLAUDE.md`
- Modify: `docs/dev/arquitetura.md`

- [ ] **Step 1: `ArchSmart-web/CLAUDE.md`**

Reescreva as seções que a Seção 5 tornou falsas — **elas hoje instruem o
oposto do que passa a valer**:

- "Onde vão morar" dizia *"Essas pastas ainda não existem, não as crie
  agora"*. Agora existem: `lib/api/`, `lib/query/`, `features/library/`,
  `features/account/`.
- "Autenticação da chamada — até a Seção 5 existir" dizia *"siga o padrão do
  arquivo vizinho: `getSession()` e header à mão; não crie uma abstração
  nova"*. Substitua por: **toda chamada é `api()` de `@/lib/api/client`**; o
  padrão manual é legado que a Seção 8 remove, e a catraca impede de crescer.
- "Busca de dados": acrescente que hook de domínio vem de
  `features/<dominio>/hooks.ts`, e que chave nova entra em `lib/query/keys.ts`,
  nunca inline.
- Acrescente a nota do **desvio da spec**: `auth.ts` + `auth.server.ts` são
  dois arquivos porque `next/headers` não pode ser importado por bundle de
  cliente.
- Atualize "O que está medido — não piore" com os números da Tarefa 12.

- [ ] **Step 2: `CLAUDE.md` da raiz**

- Estado: Seção 5 concluída, e qual é a próxima.
- Da lista "O que a Seção 4 deixou em aberto", o item **3** (a taxonomia do
  422) sai: foi decidido em 06/09/2026 — o cliente discrimina por formato.
  Registre a decisão em vez de apagar a linha.
- Acrescente as duas medidas novas da catraca à descrição do portão.

- [ ] **Step 3: `PROGRESS.md`**

Marque as 8 caixas da Seção 5 e escreva a nota da seção, no espírito das
anteriores: o que foi medido, com que comando, e **o que ficou em aberto**.
Ficam em aberto, no mínimo:

1. As ~33 telas fora do piloto continuam no padrão manual — é a Seção 8.
2. `plan_limit` (em `/api/projects`) e `entitlements.project_limit` (em
   `/api/users/me`) continuam sendo dois nomes para o mesmo conceito no
   backend. O front lê um só; unificar o fio é trabalho de outra seção.
3. Os quatro arquivos de 450–473 linhas do domínio Biblioteca continuam
   grandes — quebrar é Seção 6.
4. `MoveToProjectModal` passou a usar hooks de `features/library`, mas fala de
   projetos e orçamento: quando a Seção 8 criar `features/projects`, esses
   três hooks mudam de casa.

Depois:

```bash
python tools/progresso.py --write
python tools/progresso.py --check
```

- [ ] **Step 4: Verificação final da seção**

Da raiz:

```bash
cd ArchSmart-web && npm run typecheck && npm test && npx eslint . --format json --output-file eslint.json
cd .. && python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
python tools/progresso.py --check
python tools/checa_links.py
cd tools && python -m unittest discover -p "test_*.py"
```

Todos verdes. `checa_links.py` roda **da raiz** — é assim que o CI o executa.

- [ ] **Step 5: Commit e PR**

```bash
git add -A
git commit -m "docs: fecha a Secao 5 — camada de dados do frontend"
git push -u origin secao-5-camada-de-dados-frontend
```

Abra o PR para `develop`. No corpo, cole **a saída** de `tools/catraca.py` e
os dois arquivos de medição. Antes de mergear, olhe os três checks: a esteira
reprova mas não bloqueia, então quem mergeia é o portão.

---

## Verificação final da seção

| O que | Comando | Esperado |
|---|---|---|
| Tipos | `cd ArchSmart-web && npm run typecheck` | sem saída |
| Testes do front | `cd ArchSmart-web && npm test` | `Test Files 8 passed`, zero `failed` |
| Mock morto | `grep -rn "dummy_anon_key\|your-project.supabase.co" ArchSmart-web/src` | zero linhas |
| Domínio piloto limpo | `grep -rn 'fetch(\|getSession()\|router.refresh()' ArchSmart-web/src/components/library` | zero linhas |
| Art. 3 | `grep -rn "plan_limit" ArchSmart-web/src/app` | zero linhas |
| Catraca | `python tools/catraca.py --eslint-json ArchSmart-web/eslint.json` | nenhuma medida subiu |
| Progresso | `python tools/progresso.py --check` | saída 0 |
| Links | `python tools/checa_links.py` (da raiz) | saída 0 |
| Ferramentas | `cd tools && python -m unittest discover -p "test_*.py"` | 5 testes a mais que antes da seção, 0 falhas |
| Ganho | `docs/dev/medicoes/2026-09-06-biblioteca-depois.md` | mediana e chamadas de rede menores que o baseline |

---

## Sobre os números deste plano

Todos os números aqui foram medidos em 06/09/2026 na branch
`secao-5-camada-de-dados-frontend`, e cada um vem com o comando que o produziu.
Três avisos, no espírito do `CLAUDE.md`:

1. **87 e 62 são contagem de _linha_, não de ocorrência.** O baseline da
   catraca é de ocorrência e sai diferente. Gere pela ferramenta.
2. **41,9 s foi uma medida, de uma vez.** É cold start do Render free tier —
   varia. O que importa dela não é o valor exato: é que a ordem de grandeza
   torna prefetch bloqueante inaceitável.
3. **"Excluir produto está quebrado" foi concluído por leitura**, cruzando
   `ProductCard.tsx:89` (sem header) com `app/core/security.py:131`
   (`Header(...)`, obrigatório). O teste do Passo 1 da Tarefa 7 é o que
   transforma essa leitura em fato medido — se ele passar sem a correção,
   a conclusão estava errada e o plano deve ser corrigido, não o teste.
