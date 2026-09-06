# Depois da Biblioteca — Seção 5, camada de dados do frontend

Medido em 06/09/2026, na branch `secao-5-camada-de-dados-frontend`, na Tarefa
12 (a medição final da seção).

## 🚧 PORTÃO ABERTO — a comparação de tempo exigida pela spec não foi feita

A spec da Seção 5 é explícita: *"Só com o ganho confirmado ligam-se os lints
e migra-se o resto."* Este documento **não confirma o ganho**, porque a
medição de tempo — a única coisa que provaria "mais rápido" — não pôde ser
executada neste ambiente, pelo mesmo motivo que impediu o "antes" na
[`2026-09-06-biblioteca-baseline.md`](2026-09-06-biblioteca-baseline.md):
faltam credenciais de um usuário real.

Isto **não é** o caso "ganho não apareceu" que a Tarefa 12 prevê como saída
possível — esse caso pressupõe que a medição rodou e o número não desceu.
Aqui a medição não rodou. Os dois casos pedem decisões diferentes de quem lê,
e por isso a distinção importa: este documento não deve ser lido como "a
Seção 5 falhou o portão", e sim como "o portão não pôde ser fechado, nesta
máquina, hoje".

**Confirmado nesta tarefa, não herdado da Tarefa 1:**

    env | grep -i E2E_

saída vazia — `E2E_EMAIL`/`E2E_PASSWORD` continuam indefinidas. Rodei o
mesmo comando da Tarefa 1 de novo, sem tocar no spec, para confirmar que a
falha ainda é a mesma (e não uma quebra nova):

    cd ArchSmart-web
    npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line

Saída: `1 failed`, com o mesmo erro da baseline —

    Error: E2E_EMAIL e/ou E2E_PASSWORD não estão definidos no ambiente. ...

— nunca `AMOSTRAS`/`MEDIANA_MS`. O spec não inventou número desta vez também.

**Uma correção à premissa, para o registro ficar preciso:** o Chromium do
Playwright **está instalado** neste ambiente —

    npx playwright --version
    → Version 1.61.1

    ls "$LOCALAPPDATA/ms-playwright"
    → chromium-1228  chromium-1234  chromium_headless_shell-1228  chromium_headless_shell-1234  ffmpeg-1011  winldd-1007

— então "não há navegador" não é a causa raiz; o teste falha antes de abrir
qualquer página, na checagem de credenciais (`e2e/medicao-biblioteca.spec.ts:23`).
E mesmo dirigindo um navegador manualmente (fora do spec), o resultado seria
o mesmo: `/library` não está em `ROTAS_PUBLICAS` (`src/proxy.ts`), então
`proxy()` chama `supabase.auth.getUser()`, não encontra sessão e redireciona
para `/auth/login` antes de a página renderizar qualquer coisa — não há como
contar as chamadas de rede de uma tela que nunca carrega. O bloqueio real, nos
dois passos (Passo 1 e Passo 2 da Tarefa 12), é a falta de uma sessão válida
de um usuário real — não a ausência de ferramenta de navegador.

Não existe hoje, neste repositório ou ambiente, uma forma de fabricar essa
sessão sem uma conta real: o token é assinado pelo Supabase depois de um
login de verdade, e não há usuário de teste documentado (a baseline já
confirmou isso: `grep -rln "E2E_EMAIL\|E2E_PASSWORD" ... .` não encontra
credencial nenhuma, só os próprios arquivos de medição).

### O que fecha o portão

Quando `E2E_EMAIL`/`E2E_PASSWORD` existirem (credenciais de um usuário real,
de preferência em staging):

```bash
cd ArchSmart-web
E2E_EMAIL=<usuario> E2E_PASSWORD=<senha> npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line
```

Colar a saída (`AMOSTRAS=...` e `MEDIANA_MS=...`) em **dois** lugares:

1. Nesta seção, substituindo o parágrafo acima.
2. Em [`2026-09-06-biblioteca-baseline.md`](2026-09-06-biblioteca-baseline.md),
   na linha `mediana_ms=pendente` (ver a correção feita nesta tarefa, abaixo).

Depois, comparar as duas medianas. Separadamente, repetir o Passo 2 da
Tarefa 12 (`npm run build && npm start`, abrir `/library` com DevTools e
sessão real, contar quantas requisições a `/api/*` partem do browser) e
registrar o número ao lado do esperado por construção (seção seguinte).
**Ganho confirmado** = mediana desceu e/ou as chamadas do browser caíram;
qualquer outro resultado é o caso "ganho não apareceu" do Passo 4 da Tarefa
12, que pede parar e levar a Thiago, com suspeita prioritária na chave de
hidratação (Tarefa 8, Passo 5) não casar.

---

## Evidência estrutural — não é medição de tempo

Tudo abaixo é **o que o código faz por construção**, lido e contado por mim
nesta tarefa, cada um com o comando que produziu o número. Isto não mede
velocidade — mede se a arquitetura mudou na direção que deveria.

### 1. Chamadas de rede do primeiro carregamento, por construção

Lido: `ArchSmart-web/src/app/(dashboard)/library/page.tsx`,
`.../library/components/LibraryData.tsx`, `.../library/components/LibraryContent.tsx`,
`ArchSmart-web/src/features/library/hooks.ts`, `ArchSmart-web/src/features/library/filters.ts`,
`ArchSmart-web/src/lib/query/keys.ts`, `ArchSmart-web/src/lib/api/{core,client,server}.ts`,
e o antes com:

    git show develop:ArchSmart-web/src/app/\(dashboard\)/library/components/LibraryContent.tsx

**Antes (`develop`):** `LibraryContent` é só client component. Três
`useQuery`, cada um chamando `fetchProducts`/`fetchProduct`, e cada uma dessas
duas funções chama `getToken()` (resolve sessão) antes do `fetch`:

- `["products", {...}]` → `fetchProducts(...)` → `getToken()` + `fetch(/api/products?...)`
- `["inbox-count"]` → `fetchProducts({ state: "CAPTURED", size: 1 })` → outro `getToken()` + outro `fetch`
- `["product", editId]` → só quando `action` é `edit`/`normalize`

No primeiro load de `/library` sem edição: **2 fetches do browser**
(`products`, `inbox-count`), **2 resoluções de sessão** independentes (uma
por `fetchProducts` chamado), nenhuma delas no servidor.

**Depois (esta branch):** `page.tsx` é Server Component; dentro de um
`<Suspense>` ele renderiza `LibraryData` (também servidor), que roda:

```ts
await tentarPrefetch((signal) =>
    queryClient.prefetchQuery({
        queryKey: queryKeys.products.list(filtros),
        queryFn: () => apiServer<ProductsResponse>("/api/products", { signal, query: {...} }),
    }),
)
```

Isso é **1 fetch no servidor** (via `apiServer`, que resolve o token pelo
cookie da requisição — `getServerAccessToken()` em `auth.server.ts` —, sem ida
ao browser), com teto de 3 s (`TIMEOUT_DO_PREFETCH_MS`). O resultado é
desidratado num `HydrationBoundary` que envolve `LibraryContent`.

`LibraryContent` (ainda client) chama três hooks de `features/library/hooks.ts`:

- `useProducts(filtros, { ativo: needsList })` → `queryKeys.products.list(filtros)` —
  **a mesma chave** que o servidor prefetchou, produzida pela **mesma função**
  `filtrosDaUrl()` (`features/library/filters.ts`) dos dois lados — page.tsx
  passa o `searchParams` do servidor, `LibraryContent` passa o
  `useSearchParams()` do cliente, e é a função, não o call site, quem decide o
  formato da chave.
- `useInboxCount()` → `queryKeys.products.inboxCount()` — chave **diferente**
  (`["products", "inbox-count"]` contra `["products", "list", filtros]`) e
  **nunca prefetchada pelo servidor**. Este fetch acontece no browser sempre,
  com uma resolução de sessão (`getAccessToken()`), independente de qualquer
  coisa ter casado.
- `useProduct(editId, ...)` → só ativo com `action=edit`/`normalize`, igual
  antes.

**Portanto, por construção, no primeiro load sem edição:**

| | Antes (`develop`) | Depois (esta branch) |
|---|---|---|
| Fetch no servidor | 0 | 1 (`products`, via `apiServer`) |
| Fetch no browser — `products` | 1 | 0, **se e somente se** a chave de hidratação casar e o prefetch não tiver estourado o teto de 3 s |
| Fetch no browser — `inbox-count` | 1 | 1 (sempre — não é prefetchado) |
| Resoluções de sessão do browser | 2 (`getToken()` × 2) | 1 (`getAccessToken()` × 1), mais a do servidor via cookie, que não é do browser |

A queda de "products" para 0 chamadas do browser é **condicional**, não
garantida pela leitura do código: depende da chave bater em tempo de execução
e do prefetch ter terminado dentro do teto. É exatamente essa condição que a
checagem de hidratação ao vivo (Tarefa 8, Passo 5) verificaria e que este
ambiente não consegue rodar (ver seção acima). O que a leitura do código
garante é o desenho: uma função só, duas chaves feitas por ela, um
`HydrationBoundary` de fato colocado entre o prefetch e o consumo.

### 2. Catraca — `fetch`/Supabase fora de `lib/api/`

Comandos:

```bash
cd ArchSmart-web
npx eslint . --format json --output-file eslint.json
cd ..
python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
```

Saída:

```
[v] cores_literais: 521, igual ao baseline
[v] eslint_erros: 85, igual ao baseline
[v] fetch_fora_de_lib_api: 76, igual ao baseline
[v] modulos_sem_doc: 2, igual ao baseline
[v] supabase_fora_de_lib_api: 0, igual ao baseline
```

`fetch_fora_de_lib_api=76` é o número de telas fora de `src/lib/api/` que
ainda fazem `fetch` cru — a Biblioteca (o domínio desta seção) já não está
nessa lista; o resto do app está, de propósito: a Seção 8 é quem zera essa
medida, migrando as ~30 telas restantes, e só depois deste portão confirmar o
ganho é que faz sentido religar esse trabalho (`tools/catraca.py --help`).
`supabase_fora_de_lib_api=0` confirma que nenhuma chamada de
`createBrowserClient`/`createServerClient` sobrou fora de `src/lib/api/` e
`src/proxy.ts` — já é catraca no piso, sem regressão.

`ArchSmart-web/eslint.json` é gerado e ignorado por
`ArchSmart-web/.gitignore:45`; não foi commitado.

### 3. Contagem de padrão manual — esta branch contra `develop`

Comandos (escopo `ArchSmart-web/src`, para não contar `node_modules`):

```bash
git grep -c -- "createClient(" HEAD -- ArchSmart-web/src | awk -F: '{sum+=$NF} END {print sum+0}'
git grep -c -- "createClient(" develop -- ArchSmart-web/src | awk -F: '{sum+=$NF} END {print sum+0}'

git grep -c -- "getSession()" HEAD -- ArchSmart-web/src | awk -F: '{sum+=$NF} END {print sum+0}'
git grep -c -- "getSession()" develop -- ArchSmart-web/src | awk -F: '{sum+=$NF} END {print sum+0}'

git grep -c -- "Authorization" HEAD -- ArchSmart-web/src | awk -F: '{sum+=$NF} END {print sum+0}'
git grep -c -- "Authorization" develop -- ArchSmart-web/src | awk -F: '{sum+=$NF} END {print sum+0}'

git grep -c -- "fetch(" HEAD -- ArchSmart-web/src | awk -F: '{sum+=$NF} END {print sum+0}'
git grep -c -- "fetch(" develop -- ArchSmart-web/src | awk -F: '{sum+=$NF} END {print sum+0}'
```

| Padrão | `develop` (antes da seção) | esta branch (`HEAD`) |
|---|---|---|
| `createClient(` | 62 | 1 |
| `getSession()` | 56 | 4 |
| `Authorization` (string, qualquer contexto) | 73 | 74 |
| `fetch(` | 87 | 78 |

`createClient(` e `getSession()` caem porque a Seção 5 centralizou o cliente
Supabase em `src/lib/api/auth.ts` (browser) e `auth.server.ts` (servidor) —
cada um chama esses métodos uma vez, memoizado, em vez de cada tela montar o
seu. `Authorization` **não caiu** — o número contado inclui toda menção à
palavra, e a maioria das 74 ocorrências de hoje está em telas que **ainda
não foram migradas** (ex.: `ProjectWizard.tsx`, `AppShell.tsx`,
`projects/[id]/print/page.tsx`), continuando a montar o header à mão; a
Biblioteca é a exceção — sua única ocorrência é dentro de `features/library/api.ts`
(um comentário) e o header de verdade é montado uma vez, em
`lib/api/core.ts`. `fetch(` caiu 87→78, não a zero: o mesmo motivo — só a
Biblioteca, `lib/api/*` e `proxy.ts`/`account` foram migrados nesta seção; o
resto do app segue no padrão antigo, como o `fetch_fora_de_lib_api=76` acima
já mostra.

### 4. `npm test`, `npm run typecheck`, `npm run build`

```bash
cd ArchSmart-web
npm test
npm run typecheck
npm run build
```

- `npm test` → `Test Files 10 passed (10)`, `Tests 62 passed (62)`.
- `npm run typecheck` → sem saída, sem erro (`tsc --noEmit` limpo).
- `npm run build` → `✓ Compiled successfully`, build completo; a rota
  `/library` aparece como `ƒ` (dinâmica/server-rendered sob demanda), coerente
  com o prefetch no servidor descrito acima.

---

## O que a evidência estrutural mostra — e o que não mostra

**Mostra:**

- O browser deixou de resolver sessão e buscar a lista de produtos *antes* de
  a árvore renderizar — essa busca agora é responsabilidade do servidor,
  dentro de um `Suspense`, com um teto de tempo explícito.
- Existe cache entre navegações onde antes não havia estrutura para isso: as
  chaves são hierárquicas (`queryKeys.products.*`), com política de
  `staleTime`/`gcTime` por natureza do dado (`cachePolicy`), e uma mutação
  invalida lista, detalhe e badge do inbox com uma chamada, não três.
- O padrão manual (`createClient()`, `getSession()`, header montado à mão)
  saiu da Biblioteca e ficou centralizado em quatro arquivos
  (`lib/api/{core,client,server,auth,auth.server}.ts`), medido pela queda de
  `createClient(` e `getSession()` acima.
- O resto do app **não** foi silenciosamente deixado para trás sem registro:
  `fetch_fora_de_lib_api=76` e as contagens da seção 3 são exatamente o
  tamanho do trabalho que falta, uma medida que só desce a partir de agora.

**Não mostra:**

- Que a página ficou **mais rápida** para um usuário. Nenhum número de tempo
  foi produzido nesta tarefa — nem "antes" (Tarefa 1) nem "depois" (esta).
  Prefetch que não hidrata vira só mais uma chamada, e nada aqui descarta essa
  possibilidade.
- Que a **chave de hidratação bate em tempo de execução**. A leitura do
  código mostra um desenho que deveria bater (uma função,
  `filtrosDaUrl()`, usada dos dois lados) — mas "deveria bater, pela leitura"
  não é o mesmo que "bateu, medido". Isso é exatamente o que o Passo 2 da
  Tarefa 12 (contar requisições no DevTools, com sessão real) provaria, e
  exatamente o que este ambiente não pode rodar.

## Correção na baseline (Tarefa 1)

`2026-09-06-biblioteca-baseline.md` tinha a string `mediana_ms=` duas vezes:
uma como o valor real (pendente) e outra dentro do bloco de instrução para
quando as credenciais existirem — texto idêntico, sem marcação do que
distingue as duas. Corrigido nesta tarefa: a linha pendente agora é
`mediana_ms=pendente # PENDENTE — ainda não medido` e o bloco de instrução
passou a dizer explicitamente "substituir a linha `mediana_ms=pendente`
acima por", para não haver ambiguidade de qual das duas um leitor futuro (ou
um script) deve tratar como o valor vigente.
