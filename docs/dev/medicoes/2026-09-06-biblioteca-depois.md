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

**Correção feita nesta revisão:** a primeira versão desta seção usava
`git grep -c` sobre a string crua, que conta qualquer linha que contenha o
texto — call site, comentário, docstring ou falso-positivo de substring —
sem distinguir um do outro. Um revisor rodou os mesmos greps ingênuos e
mostrou que dois dos quatro números, lidos como estavam, contavam uma coisa
diferente do que pareciam contar. Refiz os quatro abrindo cada ocorrência,
não só a contagem.

**`createClient(` — 62 → 0 chamadas, não 62 → 1.**

```bash
cd ArchSmart-web
grep -rn "createClient(" src --include=*.ts --include=*.tsx
```

```
src/lib/api/auth.ts:18: * dois. Eram 62 `createClient()` espalhados antes desta secao.
```

A única ocorrência restante é a **menção dentro do comentário** de
`auth.ts:18`, que descreve o número antigo — não é um call site. Contando só
chamadas de verdade (`createBrowserClient(`/`createServerClient(`, que é o que
`supabase_fora_de_lib_api` da catraca mede): **0** nesta branch, dentro ou
fora de `lib/api/`. Em `develop`, as 62 são calls reais, uma por tela —
confirmado por amostragem dos arquivos que a listagem devolve
(`billing/page.tsx`, `calendar/page.tsx`, `dashboard/page.tsx`, ...).

**`getSession()` — 56 chamadas espalhadas → 2 chamadas, ambas centralizadas; os outros dois dos "4" são comentário.**

```bash
grep -rn "getSession()" src --include=*.ts --include=*.tsx
```

```
src/lib/api/auth.server.ts:38:    const { data } = await (await supabaseServer()).auth.getSession()
src/lib/api/auth.ts:30:    const { data } = await supabaseBrowser().auth.getSession()
src/lib/api/core.ts:9: * `Authorization` a mao e 56 `getSession()` — e um DELETE que esquecia o
src/proxy.ts:62:    // por getSession() aqui seria trocar seguranca por velocidade — o cookie
```

Das 4 linhas que a busca crua encontra, 2 são chamadas reais — uma no cliente
do browser (`auth.ts`), uma no cliente do servidor (`auth.server.ts`), as
duas dentro de `lib/api/` — e 2 são comentário (`core.ts` cita o número
antigo; `proxy.ts` explica por que `getUser()` foi escolhido em vez de
`getSession()` ali). Nenhuma tela fora de `lib/api/` chama `getSession()`
nesta branch.

**`Authorization` — 74 é maior que o 73 de `develop`, mas o que a medida quer rastrear (tela montando header à mão) caiu.**

```bash
cd ArchSmart-web/src
grep -rnoP 'Authorization' . --include=*.ts --include=*.tsx | wc -l                                   # total
grep -rnoP 'Authorization' ./lib/api ./__tests__ --include=*.ts --include=*.tsx | wc -l               # lib/api + __tests__
grep -rnoP 'Authorization' . --include=*.ts --include=*.tsx | grep -vP '^\./lib/api/|^\./__tests__/' | wc -l   # resto (telas/componentes)
```

| | total | `lib/api/` + `__tests__/` | telas e componentes |
|---|---|---|---|
| `develop` | 73 | 0 (`lib/api/` não existe em `develop`) | 73 |
| esta branch | 74 | 11 | 63 |

`lib/api/` e `__tests__/` não existiam com esse conteúdo em `develop` — são
o único lugar que hoje monta o header de verdade (`lib/api/core.ts`) mais as
asserções de teste que passaram a existir para ele. Sem esses 11, que
`develop` não tinha como contar, a contagem que é comparável —
telas/componentes montando o header à mão — caiu de **73 para 63**. O total
bruto subiu porque a medida passou a incluir um lugar novo que **é** a
correção (o cliente centralizado), não porque mais telas passaram a montar o
header manualmente. Um leitor que rodar o grep ingênuo (`git grep -c
"Authorization"`) vai achar os mesmos 74 daqui — a diferença para 73 é essa,
não uma regressão.

**`fetch(` — 76, não 78; a diferença é `tentarPrefetch(`/`prefetchQuery(`, que um grep sem fronteira de palavra conta como `fetch(`.**

A primeira versão usou `git grep -c -- "fetch("`, que casa qualquer
substring — inclusive o final de `tentarPrefetch(` e `prefetchQuery(`,
identificadores novos desta seção que não existiam em `develop`. A própria
catraca já evita isso: `RE_FETCH = re.compile(r"\bfetch\s*\(")` em
`tools/catraca.py:57`, com fronteira de palavra. Refeito com o mesmo padrão:

```bash
cd ArchSmart-web/src
grep -rnoP '\bfetch\s*\(' . --include=*.ts --include=*.tsx | wc -l                              # total, fronteira de palavra
grep -rnoP '\bfetch\s*\(' . --include=*.ts --include=*.tsx | grep '^\./lib/api/'                # dentro de lib/api/
grep -rn -P '\bfetch\s*\(' . --include=*.ts --include=*.tsx | grep -P '^\S+:\d+:\s*(//|\*)'      # dentro de comentário
```

Total: **76**, zero dentro de `lib/api/` (o único ponto que faz `fetch` de
verdade, `core.ts`, guarda a função numa variável — `const chamar =
opts.fetchImpl ?? fetch` — e chama `chamar(...)`, não literalmente
`fetch(...)`), e 1 dentro de comentário
(`src/__tests__/library-hooks.test.tsx:108`, citando o código antigo de
`ProductCard.tsx`). **76 é exatamente o `fetch_fora_de_lib_api` que a catraca
mediu na seção "### 2. Catraca" acima, desta mesma tarefa** — os dois números batem porque são a mesma contagem, e
isso fecha a conta: não sobra nenhum `fetch(` real dentro de `lib/api/` para
explicar uma diferença entre os dois. Os 75 restantes (76 menos o comentário)
são chamadas reais nas telas ainda não migradas.

Rodando a mesma fronteira de palavra em `develop`
(`git archive develop -- ArchSmart-web/src` para uma árvore à parte, já que
`tentarPrefetch`/`prefetchQuery` não existem lá para distorcer a contagem):
**87**, igual ao que a busca ingênua já dava — em `develop` não há
identificador que contenha `fetch(` como sufixo, então as duas formas de
contar coincidem.

| Padrão | `develop` (antes da seção) | esta branch (`HEAD`) |
|---|---|---|
| `createClient(` — chamadas reais | 62 | **0** |
| `getSession()` — chamadas reais | 56 | **2**, ambas em `lib/api/` |
| `Authorization` — em telas/componentes (exclui `lib/api/`+`__tests__/`) | 73 | **63** |
| `fetch(` — com fronteira de palavra, igual à catraca | 87 | **76** |

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

## Correção pós-revisão — o 76 tinha um falso positivo (revisão final da Seção 5)

As seções acima registram o que foi medido em 06/09/2026, na Tarefa 12, e
esse número — **76** — não foi alterado nelas: é evidência de uma medição
que de fato aconteceu, com o comando que a reproduz. Mas a própria análise
daquele dia (ver "`fetch(` — 76, não 78", acima) já apontava que 1 das 76
ocorrências estava dentro de um **comentário**
(`src/__tests__/library-hooks.test.tsx:108`, citando o código antigo de
`ProductCard.tsx` — `fetch(url, { method: "DELETE" })`), não uma chamada
real. `RE_FETCH` em `tools/catraca.py` mede texto, sem distinguir código de
comentário, então esse comentário sempre contou como se fosse uma tela a
migrar.

Na revisão final da Seção 5 (mesmo dia, antes do merge) o comentário foi
reescrito para não conter mais o literal `fetch(` — descreve a mesma chamada
antiga sem reproduzir a sintaxe (`fetch cru (\`url\`, { method: "DELETE" })`).
Re-medido com o mesmo comando de sempre:

```
python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
[v] fetch_fora_de_lib_api: baixou de 76 para 75. Rode `python tools/catraca.py --atualizar`.
```

Baseline atualizado com a própria ferramenta
(`python tools/catraca.py --eslint-json ArchSmart-web/eslint.json --atualizar`,
sem `--aceitar-piora` — é uma queda, o caminho normal). **A partir de agora,
`fetch_fora_de_lib_api=75` é o número vigente**, não mais 76 — todo lugar que
cita 76 neste documento é o registro do que foi medido naquele dia,
inclusive o falso positivo; não republique 76 como o número atual.

A mesma revisão final também unificou o payload de `/api/products` numa
função só (`queryDeProdutos`, em `features/library/api.ts`) e acrescentou um
teste garantindo que as duas montagens não voltam a divergir — por isso
`npm test` sai hoje `Test Files 11 passed (11)`, `Tests 63 passed (63)`, um
arquivo e um teste a mais que o `Test Files 10 passed (10)`/`Tests 62 passed
(62)` registrado acima.
