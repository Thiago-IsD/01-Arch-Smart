# Depois da Biblioteca — Seção 5, camada de dados do frontend

Medido em 06/09/2026, na branch `secao-5-camada-de-dados-frontend`, na Tarefa
12 (a medição final da seção).

## ✅ PORTÃO FECHADO em 10/09/2026 — Tarefa 1 da Seção 6

A medição de tempo que faltava foi executada em 10/09/2026, na Tarefa 1 da
Seção 6, depois de criado um usuário de teste E2E em staging — ver
[`2026-09-09-usuario-de-teste-e2e.md`](2026-09-09-usuario-de-teste-e2e.md).
Topologia: Playwright → `localhost:3000` (`npm run dev`) → API local em
`localhost:8000` (`uvicorn app.main:app --port 8000`) → banco de **staging**
→ Supabase de **staging**.

Comando (idêntico ao do brief, sem flag extra):

```bash
cd ArchSmart-web
E2E_EMAIL=ana.arquiteta@seed.arqsmart.local E2E_PASSWORD=<senha, não versionada> \
  npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line
```

Saída:

```
AMOSTRAS=1434,1445,1454,1469,1948
MEDIANA_MS=1454

1 passed (35.2s)
```

**Comparação:** o "antes" real (código de antes da Seção 5) não existe mais
nesta branch — `2026-09-06-biblioteca-baseline.md` permanece **não medido**,
por construção, não por falta de tentativa (ver correção nesse arquivo,
abaixo). A única referência disponível é o número da spec de agosto de 2026
(evidência estrutural/audit, não medição deste repositório): **3,6 s** para a
Biblioteca (`docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md:37`).
`1454 ms` é bem menor que os `3600 ms` de referência — uma leitura favorável,
mas contra um número de origem diferente (outra máquina, outro método,
agosto de 2026), não contra um "antes" medido nesta mesma tarefa. Rotulado
como tal: **ganho por comparação com a referência da spec**, não "X% mais
rápido que o develop anterior à Seção 5".

**Achado durante a execução, registrado por honestidade:** a primeira
tentativa de rodar exatamente este comando (antes de qualquer `--timeout`)
deu timeout em `page.waitForLoadState("networkidle")`, na primeira iteração
do laço de medição — não no login. Investigado antes de tentar de novo (não
"tentei de novo e deu certo" sem explicação):

- O log do uvicorn local mostrava, em todo request autenticado,
  `Validacao local do JWT falhou (The specified alg value is not allowed);
  tentando remota` seguido de uma chamada real a
  `https://ipbhtqzybgdltewwnvnl.supabase.co/auth/v1/user`. A API local usa
  `SUPABASE_JWT_SECRET` (HS256) para validar localmente
  (`ArchSmart-api/app/core/security.py`), e o projeto de staging aparenta
  assinar com uma chave que HS256 não decodifica — cada request paga uma
  ida e volta a Supabase em vez de validar em memória. Isso é lento, mas não
  destrava sozinho um timeout de 30 s.
- A causa provável do timeout foi outra, e mais simples: `playwright.config.ts`
  usa `reuseExistingServer: !process.env.CI` com `npm run dev` — no Next.js
  em modo dev, cada rota compila sob demanda na primeira requisição. A
  primeira chamada desta sessão a `/auth/login`, `/dashboard` e `/library`
  pagou essa compilação (mais a latência de JWT acima) dentro do mesmo
  orçamento de 30 s do teste, e não sobrou tempo para as 5 amostras do
  laço.
- Confirmação: rodando de novo o **mesmo comando exato**, com o mesmo
  `npm run dev` já quente (rotas já compiladas da tentativa anterior), o
  teste passou dentro do timeout padrão, produzindo os números acima. Uma
  repetição anterior com `--timeout=90000` (só para diagnóstico, não é o
  número oficial) deu `AMOSTRAS=1439,1457,1486,1554,1963`,
  `MEDIANA_MS=1486` — consistente com a run oficial, confirmando que não foi
  sorte de uma única execução.

Isto não é um defeito da Seção 5: é uma característica do `next dev` (compila
sob demanda) combinada com a latência real de validação remota de JWT contra
o Supabase de staging a partir de uma API local — nenhuma das duas aparece
rodando contra o Render de staging/produção, onde o processo já está quente
e não recompila por request. Registrado aqui para quem repetir esta medição
não gastar tempo re-descobrindo a mesma causa.

## Verificação viva da hidratação — a lista está confirmada; o inbox é lacuna separada, em aberto

`ArchSmart-web/e2e/hidratacao-biblioteca.spec.ts`, criado nesta tarefa, abre
`/library` duas vezes (a segunda com listener de rede já ligado) e falha se
o navegador pedir a **lista principal** de produtos
(`/api/products?...&state=NORMALIZED`, a chave que o servidor prefetcha) na
segunda.

### Primeira versão do teste (revisão da Tarefa 1) — assertava sobre qualquer `/api/products`

A primeira versão da asserção não filtrava por `state`: falhava para
**qualquer** requisição a `/api/products`, sem distinguir "a lista parou de
hidratar" de "o badge do inbox pediu, como já é sabido". Rodada assim:

```
Error: o navegador pediu /api/products: http://localhost:8000/api/products?page=1&size=1&state=CAPTURED,
http://localhost:8000/api/products/?page=1&size=1&state=CAPTURED

Expected length: 0
Received length: 2
1 failed
```

As duas URLs recebidas não eram duas chamadas diferentes: a segunda é o
redirect 307 de barra final que a própria API emite para a primeira
(`/api/products?...` → `/api/products/?...`), e as duas carregavam
`state=CAPTURED` — a contagem do inbox (`useInboxCount()` em
`features/library/hooks.ts`), não a lista principal. **Nenhuma URL com
`state=NORMALIZED` apareceu** nessa execução — sinal de que a lista já
hidratava; só a asserção não sabia distinguir isso de uma falha real.

Revisão da tarefa apontou o problema corretamente: um teste que fica vermelho
para sempre pelo mesmo motivo já conhecido, sem nenhum documento afirmando
isso de forma prospectiva, é exatamente o anti-padrão que a Seção 3 removeu
deste repositório (a orientação de ignorar dois arquivos vermelhos no
vitest) — "nada de 'é esperado que falhe'". A correção certa não é
documentar a exceção; é tornar a asserção discriminante.

### Versão corrigida — filtra por `state=NORMALIZED`, e passa

```bash
cd ArchSmart-web
E2E_EMAIL=ana.arquiteta@seed.arqsmart.local E2E_PASSWORD=<senha, não versionada> \
  npx playwright test e2e/hidratacao-biblioteca.spec.ts --reporter=line
```

Saída:

```
Running 1 test using 1 worker
[1/1] [chromium] › e2e\hidratacao-biblioteca.spec.ts:28:5 › a lista da Biblioteca nao busca /api/products no navegador no primeiro carregamento
1 passed (26.5s)
```

O teste agora captura todo `/api/products` (para diagnóstico, se um dia
falhar) mas só falha a asserção se alguma dessas URLs contiver
`state=NORMALIZED` — a chave da lista principal, produzida por
`filtrosDaUrl()`/`queryDeProdutos()` dos dois lados
(`queryKeys.products.list(filtros)`). **Passou.** Isto é a confirmação ao
vivo, pela primeira vez, de algo que até aqui só existia como leitura de
código (a ressalva que a seção "O que a evidência estrutural mostra — e o
que não mostra", abaixo, registrava como pendente): **a hidratação da lista
principal da Biblioteca funciona de fato em tempo de execução**, não só "por
construção".

### O que continua em aberto, e não foi corrigido aqui

A lacuna do badge do inbox (`useInboxCount()`, `state=CAPTURED`) é real e
**não fechada**: ela é a mesma que a Tarefa 12 da Seção 5 já tinha
documentado por leitura de código, na seção "1. Chamadas de rede do primeiro
carregamento, por construção" acima — *"`useInboxCount()` → chave diferente
(…) e **nunca prefetchada pelo servidor**. Este fetch acontece no browser
sempre, com uma resolução de sessão (`getAccessToken()`), independente de
qualquer coisa ter casado."* O teste corrigido deliberadamente não cobre essa
chamada — cobri-la faria o teste falhar por um motivo já conhecido e ainda
não corrigido, que é exatamente o padrão que a correção evitou.

**Não corrigir isto é intencional, não uma omissão desta tarefa:**
prefetchar `inboxCount` (ou juntá-lo à mesma chave/`HydrationBoundary` da
lista) é mudança na camada de dados do frontend (Seção 5), não na camada de
UI (Seção 6, a tarefa que escreveu este teste). Registrado em
`PROGRESS.md`, nota da Seção 5, item 9, como pendência aberta explícita —
não como "achado novo que quebrou o teste".

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

> **Nota de 10/09/2026 (Tarefa 1 da Seção 6):** os dois pontos acima — número
> de tempo e checagem viva de hidratação — estavam pendentes quando este
> parágrafo foi escrito em 06/09/2026. Os dois foram fechados na Tarefa 1 da
> Seção 6: o número de tempo está na seção "✅ PORTÃO FECHADO" no topo deste
> arquivo, e o resultado da checagem viva de hidratação está na seção
> "Verificação viva da hidratação", logo abaixo. Este parágrafo original fica
> como estava, para registrar o que se sabia em 06/09/2026.

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

---

## 12/09/2026 — a Seção 8 mudou a tela e **não** conseguiu re-medir

Registro na Tarefa 10 da Seção 8, a tarefa de fechamento. A mediana de
**1454 ms** acima continua sendo o último número medido desta tela, e ela é de
**antes** da Seção 8: antes de a lista passar pelo `QueryBoundary`, antes de o
badge do inbox entrar no prefetch, antes de a telemetria medir até os dados.

**Nenhuma medição nova rodou, e nenhum número foi estimado.** A causa é uma só:
a credencial do usuário de teste E2E
(`ana.arquiteta@seed.arqsmart.local`, ver
[`2026-09-09-usuario-de-teste-e2e.md`](2026-09-09-usuario-de-teste-e2e.md))
passou a ser **rejeitada** pelo Supabase de staging — `HTTP 400,
"Invalid login credentials"`, verificado direto no endpoint de auth em
11/09/2026. Todo spec desta pasta faz login de verdade pela UI, então todos
falham no primeiro passo. Só Thiago resolve isso (redefinir a senha do usuário,
ou recriar o usuário pelo roteiro do documento acima).

O que ficou por medir, com o comando de cada um — a retomada é um comando, não
uma investigação:

```bash
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a   # a senha nunca entra na linha de comando

# 1. A mediana depois da Seção 8 (compare com os 1454 ms acima).
npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line

# 2. A hidratação continua de pé (guarda: a Tarefa 7 mexeu no prefetch).
npx playwright test e2e/hidratacao-biblioteca.spec.ts --reporter=line

# 3. O `load_ms` real do `screen_viewed` — spec novo, nunca executado.
npx playwright test e2e/telemetria-biblioteca.spec.ts --reporter=line
```

Os três também rodam sozinhos no job `e2e` do CI
(`.github/workflows/ci.yml`), criado nesta mesma tarefa — **e esse job reprova
até os Secrets existirem no repositório**. Ver a nota da Seção 8 no
`PROGRESS.md`.

> **O `hidratacao-biblioteca.spec.ts` continua com o filtro de
> `state=NORMALIZED`, e isso é deliberado.** A Tarefa 7 pôs o badge do inbox no
> prefetch, então o `state=CAPTURED` **deveria** ter deixado de sair do
> navegador também — e apertar a asserção sem ter rodado o spec seria escrever
> uma afirmação não medida, que é exatamente o que este repositório não admite.
> Quem rodar confere os pedidos `state=CAPTURED` e, se vierem zero, aperta o
> filtro no mesmo commit.


## ✅ 12/09/2026, mais tarde — a parede caiu e os cinco números existem

A seção imediatamente acima registrou que nada pôde ser medido porque a
credencial do usuário de teste E2E estava sendo rejeitada. **Thiago corrigiu a
credencial** (tinha um caractere sobrando) e as medições rodaram no mesmo dia.
Esta seção substitui, na prática, a lista de "o que ficou por medir" acima — o
texto dela fica de pé como histórico de por que o atraso existiu.

Antes de qualquer medição, a credencial foi verificada direto no endpoint de
auth do Supabase de staging: **`HTTP 200`**, token recebido,
`email_confirmed_at: 2026-09-10T11:36:43Z`, usuário
`ana.arquiteta@seed.arqsmart.local`. A senha não aparece em nenhum comando
deste documento: ela é carregada de `ArchSmart-web/.env.e2e.local`
(não versionado) com `set -a; . ./.env.e2e.local; set +a`, e o Playwright a lê
de `process.env`.

**Topologia, idêntica à de 10/09/2026** — é o que torna os dois números
comparáveis: Playwright → `localhost:3000` (`npm run dev`) → API local em
`localhost:8000` (`uvicorn app.main:app`) → banco de **staging** → Supabase de
**staging**. O `ArchSmart-api/.env` foi conferido antes de subir a API: a
`DATABASE_URL` ativa é a de staging (usuário `postgres.ipbhtqzybgdltewwnvnl`,
pooler na **5432**), e a de produção (`postgres.wokgnojyrpzndtxzvfcz`) está
comentada. Nenhum `alembic upgrade` foi rodado à mão.

### 1. Mediana da Biblioteca depois da Seção 8 — **1415 ms**

```bash
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line --timeout=180000
```

```
AMOSTRAS=1390,1403,1415,1418,1422
MEDIANA_MS=1415
  1 passed (21.5s)
```

**Contra os 1454 ms de 10/09/2026 (antes da Seção 8): 39 ms a favor do código
novo**, dentro da variação entre execuções. Não é ganho reivindicado — é
**ausência de regressão**, que era a pergunta. `QueryBoundary` e o badge no
prefetch entraram sem custo de tempo mensurável.

> ⚠️ **Quatro execuções, e as três primeiras mentiriam.** No mesmo servidor,
> em sequência: medianas de **2426 ms**, **1923 ms**, **1409 ms** e **1415 ms**.
> O `next dev` compila sob demanda, e leva várias passagens para parar. Quem
> subir o servidor e parar na primeira execução reporta uma regressão de ~1 s
> que não existe. A quarta execução é a oficial porque é a única com dispersão
> estreita (1390–1422, amplitude de 32 ms; a primeira foi 1406–3972).
>
> O `--timeout=180000` não altera o que é medido — as amostras são
> `Date.now()` dentro do laço. Ele existe porque o orçamento padrão de **30 s
> por teste** não cobre login + compilação de três rotas + 5 amostras na
> primeira execução de uma sessão: a primeira tentativa desta medição morreu
> exatamente assim, com `Test timeout of 30000ms exceeded` dentro do laço
> (não no login). É o mesmo tropeco documentado na medição de 10/09/2026.

### 2. A hidratação continua de pé — e o badge do inbox **também** parou de sair

```bash
npx playwright test e2e/hidratacao-biblioteca.spec.ts --reporter=line
```

Passou. E, com o spec instrumentado para listar **todos** os pedidos (e não só
os da lista), três execuções consecutivas deram o mesmo:

```
PEDIDOS_TOTAL=0
PEDIDOS_NORMALIZED=0
PEDIDOS_CAPTURED=0
```

**Zero pedido a `/api/products` de qualquer tipo** sai do navegador no primeiro
carregamento. Isso responde a pergunta que a nota no fim da seção anterior
deixou aberta: o `state=CAPTURED` do badge do inbox **deixou de sair**, ou seja
o prefetch que a Tarefa 7 da Seção 8 acrescentou (`Promise.all` em
`LibraryData`) **está sendo aproveitado**. A lacuna aberta na Seção 5 e
confirmada ao vivo na Seção 6 fechou.

Por isso a asserção foi **apertada no mesmo commit**, como aquela nota mandava:
o spec não filtra mais por `state=NORMALIZED` e exige `toHaveLength(0)` sobre
todos os pedidos a `/api/products`. A discriminação entre lista e badge migrou
para a **mensagem** de falha, que é onde ela serve — a primeira pergunta de
quem investigar uma regressão aqui é "quem voltou a buscar, a lista ou o
badge?".

### 3. A prova viva do `screen_viewed` — o spec que nunca havia rodado **passou**

```bash
npx playwright test e2e/telemetria-biblioteca.spec.ts --reporter=line
```

```
  1 passed (11.4s)
```

**Primeira execução da história deste spec, e ela passou** — mais duas
repetições para descartar sorte (3/3). Ele afirma, sobre uma navegação por
**clique** para `/library`: `medido_ate: "dados"`, `medido_de: "clique"`,
`principal_declarada: true`, `is_empty: false`, e `load_ms` entre 200 ms e 10 s.
Nenhuma asserção foi afrouxada para isso passar, e nenhum defeito de spec
apareceu: o spec estava correto como escrito.

### 4. A linha no banco — `load_ms` virou **dado utilizável**

`product_events` tinha **0 linhas** quando a medição começou (medido, e não
suposto) — coerente com a pendência 2 da Seção 7: nunca uma navegação real
havia gravado um evento. Toda linha abaixo nasceu desta sessão.

```bash
cd ArchSmart-api
python -c "from app.db.session import SessionLocal; from sqlalchemy import text; db=SessionLocal(); print(db.execute(text(\"select name, properties->>'screen', properties->>'medido_ate', properties->>'medido_de', properties->>'load_ms', created_at from product_events where name='screen_viewed' order by created_at desc limit 5\")).fetchall())"
```

Agregado por tela e por rótulo, que é o que permite afirmar ordem de grandeza:

| `screen` | `medido_de` | `medido_ate` | n | mín | mediana | máx |
|---|---|---|---|---|---|---|
| `/library` | `clique` | `dados` | 21 | 871 | **1068** | 3607 |
| `/library` | `commit` | `dados` | 3 | 1420 | 1749 | 1920 |
| `/dashboard` | `commit` | `pintura` | 25 | 14 | 18 | 38 |

**A mediana de 1068 ms está na mesma ordem de grandeza dos 1415 ms do E2E**, e
é isso que fecha a pendência. Ser um pouco menor é o esperado, não uma
discrepância: o E2E cronometra de antes do `page.click()` até o seletor ficar
visível, incluindo o despacho do clique e a sondagem do seletor pelo
Playwright; o `load_ms` cronometra dentro da página, do clique até a região
principal reportar dados.

O defeito da Seção 7 está morto: `is_empty` sai **`false`** nas 24 linhas de
`/library` (era `null` em 100% dos eventos), `principal_declarada` sai **`true`**,
e não existe `load_ms` de dezenas de milissegundos em tela com região de dados.

> **A linha do `/dashboard` não é uma regressão, e precisa ser lida com
> cuidado:** `load_ms` de 18 ms com `medido_ate: "pintura"`,
> `principal_declarada: false` e `is_empty: null`. É a forma antiga do número —
> mas agora **corretamente rotulada**, porque o Dashboard ainda não foi migrado
> (a Seção 8 migrou a Biblioteca como piloto). Quem agregar a coluna
> `load_ms` **tem de filtrar por `medido_ate = 'dados'`**; misturar as duas
> populações produz uma média que não descreve tela nenhuma.

### 5. P95 de `GET /api/products` — **634 ms**, acima do orçamento de 400 ms, e **não pela query**

**Volume declarado** (P95 sem volume não significa nada): **300 produtos** na
conta do usuário de teste — **90 `NORMALIZED`**, **107 `CAPTURED`**, o resto
`INACTIVE`. É o volume de `tools/seed.py --biblioteca 300`, e ele **já estava no
banco**; nada foi semeado nesta sessão. A requisição medida é a que a tela
realmente faz, extraída do log do uvicorn:
`GET /api/products/?page=1&size=15&sort_by=created_at_desc&state=NORMALIZED`
(40 amostras, após 5 de aquecimento).

| O que foi medido | P50 | P95 |
|---|---|---|
| `GET /api/products/` (a lista) | 470 ms | **634 ms** |
| `GET /api/users/me` (rota autenticada que quase não faz trabalho) | 433 ms | 694 ms |
| o SQL da página da lista, direto no pooler de staging | **16 ms** | **17 ms** |

**Conforme a spec decidiu, nada foi otimizado — e a decomposição mostra que
otimizar query seria trabalho no lugar errado.** A query custa **17 ms**. Uma
rota autenticada que quase não faz trabalho custa praticamente o mesmo que a
lista inteira, o que só é possível se o custo estiver **antes** do endpoint.

A causa foi medida, não deduzida: o Supabase de staging assina o JWT com
**ES256** — cabeçalho lido do token, `{"alg":"ES256","kid":"33477cd1-…"}` —
enquanto a API valida com segredo compartilhado **HS256**
(`SUPABASE_JWT_SECRET`). A validação local falha sempre, e
`resolve_identity` (`ArchSmart-api/app/core/security.py:121`) cai no caminho
remoto: **uma chamada HTTP a `…/auth/v1/user` em toda requisição
autenticada**. 175 ocorrências no log desta sessão:

```
Validacao local do JWT falhou (The specified alg value is not allowed); tentando remota.
```

**Então a Tarefa 11 de backend precisa existir**, e o que ela tem para fazer não
é índice nem `joinedload`: é verificar ES256 pela chave pública/JWKS do projeto
em vez de cair no caminho remoto. O ganho não é de uma tela — é de **toda
requisição autenticada da plataforma**, e explicaria boa parte dos 1415 ms da
Biblioteca. O fenômeno já estava observado, **sem número**, na medição de
06/09/2026 neste mesmo arquivo; o que esta seção acrescenta é o custo medido e
a causa confirmada pelo cabeçalho do token.

Dois números que **não** são o P95 do endpoint, registrados para ninguém os
confundir com ele:

- **Contra o Render de staging:** P50 2303 ms, P95 **2762 ms**, com cold start de
  **52,8 s** na primeira chamada. Isso mede a ida e volta Brasil → Render free
  tier mais a CPU do free tier — não a rota.
- **Um `307` antes de todo `200`:** a tela chama `/api/products` sem barra final
  e o FastAPI redireciona para `/api/products/`. Medido no log: 44
  redirecionamentos para 44 respostas, nas duas queries (lista e badge) — duas
  idas onde bastaria uma. Não foi mexido aqui; é candidato barato para a
  Tarefa 11.

### O que **não** fechou

O item **6** de [`../modulos/library.md`](../modulos/library.md) continua
aberto, e nada nesta seção o toca: **axe no navegador, navegação só por
teclado, e as larguras de 390px e 1440px**. Depende de olho humano e de layout
real; Playwright com credencial não substitui isso. Pela mesma razão, a
**verificação visual da Seção 6** (pendência 1 da Seção 7) não é fechada por
estas medições — agora ela é **executável**, porque a credencial funciona e
`e2e/captura-visual-secao-6.spec.ts` existe, mas ninguém olhou as capturas
nesta sessão.
