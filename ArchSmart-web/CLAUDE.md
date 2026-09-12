# ArchSmart-web — regras do frontend

A **Seção 5** (camada de dados do frontend) concluiu em 06/09/2026. Este arquivo descreve o estado atual do frontend, não mais um alvo futuro. Leia primeiro `../CLAUDE.md` para o estado geral da reestruturação.

## Onde as coisas moram hoje

- `src/app/` — App Router (rotas, layouts, páginas).
- `src/components/ui/` — primitivos shadcn. Não editar aqui para meter regra de negócio.
- `src/components/` — componentes de domínio, por área (`budget/`, `library/`, `projects/`, `landing/`...).
- `src/lib/` — utilitários e clientes soltos (`env.ts`, `api-url.ts`, `utils.ts`).
- `src/hooks/`, `src/types/`, `src/contexts/`, `src/config/` — hooks, tipos, contexto React e config estática (navegação, marca), cada um compartilhado entre rotas.

## Onde colocar um arquivo novo

Componente usado só por uma rota fica junto dela, em `<rota>/components/` (ex.: `library/components/LibraryContent.tsx`). Usado por mais de uma rota vai em `src/components/<área>/`. `src/utils/` hoje só tem `get-system-asset.ts` — o cliente Supabase que morava lá (`@/utils/supabase/client`, `createClient()`) foi apagado na Seção 5; utilitário novo vai em `src/lib/`, não em `src/utils/`.

## Onde moram as coisas da Seção 5

`src/features/<dominio>/` (hoje: `library/`, `account/`), cada um com `api.ts`, `hooks.ts`, `types.ts` e, quando o domínio tem filtro próprio, `filters.ts`. `src/lib/api/` é o cliente HTTP único:

- `core.ts` — a fábrica `criarCliente()`. Recebe `resolverToken` por parâmetro, para ser testável sem rede e sem Supabase.
- `client.ts` — `export const api` (browser), usa `getAccessToken()` de `auth.ts`.
- `server.ts` — `export const apiServer` (Server Component / Route Handler), usa `getServerAccessToken()` de `auth.server.ts`.
- `auth.ts` / `auth.server.ts` — os dois arquivos que sabem que o Supabase existe **para autenticação** (ver "Desvio da spec" em "Autenticação da chamada"). Isto não cobre Storage: `src/components/ui/image-upload.tsx:30,38` chama `supabase.storage` (via `supabaseBrowser()` de `auth.ts`) — medido, `grep -rn "\.storage\b" src` → 2 ocorrências, 1 arquivo. Uma frase como "o único arquivo que sabe que Supabase existe" descreve autenticação, não a superfície toda; trocar Supabase por outro provedor de auth reescreveria `auth.ts`/`auth.server.ts`, mas trocar o backend de Storage é trabalho à parte, ainda não mapeado.
- `errors.ts` — traduz a resposta HTTP em `ApiError` tipado, discriminando por formato de `detail` (ver "O que a Seção 4 mudou na API", abaixo).

`src/lib/query/keys.ts` tem as chaves hierárquicas (`queryKeys.products.*`, `queryKeys.projects.*`, `queryKeys.account.*`) e a política de cache por natureza do dado (`cachePolicy.referencia`/`conta`/`transacional`); `hydration.ts` tem `tentarPrefetch()`, usado pelo prefetch no servidor da Biblioteca.

Essas pastas existem e têm dono — não as recrie, e não monte um segundo cliente HTTP ou uma segunda tabela de chaves em paralelo.

## Busca de dados

Hook de domínio vem de `features/<dominio>/hooks.ts`, nunca `useQuery` direto na tela nem `useEffect` + `fetch`. Chave de cache nova entra em `lib/query/keys.ts`, dentro da hierarquia de `queryKeys` — nunca uma chave inline no componente: é por prefixo de chave que o React Query invalida, e uma chave criada fora da hierarquia (uma tupla solta dentro do componente) não é alcançada por `invalidateQueries({ queryKey: queryKeys.products.all })` quando outro hook precisar invalidar o mesmo dado.

O `QueryProvider` continua montado em `src/app/(dashboard)/layout.tsx`, com o default global de `staleTime` 30 s / `gcTime` 5 min; cada hook de domínio sobrescreve esse default espalhando `cachePolicy.referencia`/`conta`/`transacional` (`lib/query/keys.ts`) conforme a natureza do dado. URL base sempre de `getApiUrl()` em `src/lib/api-url.ts`; nunca escreva `http://localhost:8000` ou qualquer host na tela (Art. 4).

## O que a Seção 4 mudou na API que este front consome

A Seção 4 fechou em 06/09/2026 e está implantada em staging. Três coisas mudaram no contrato, e a Seção 5 é escrita contra elas.

**O `/me` ganhou `entitlements`, e ele fica em `/api/users/me`.** A spec pedia `GET /api/v1/me`; não existe prefixo `/api/v1` nesta aplicação e criar um para uma rota só foi recusado — [ADR 0008](../docs/dev/decisoes/0008-me-em-api-users-me.md). O corpo hoje traz `id`, `full_name`, `email`, `avatar_url`, `role`, `account` e:

```json
"entitlements": { "project_limit": 2, "can_use_ai": true, "can_use_portal": true }
```

É dicionário aberto de propósito (um entitlement novo não deve exigir deploy casado de API e front), então **o front não tem lista de chaves para tipar contra** — vale a Seção 5 declarar o seu próprio tipo parcial. `PUT /api/users/profile` devolve o mesmo schema e também carrega `entitlements`; preencher só um dos dois faz o campo sumir depois que o usuário salva o perfil.

**A violação do Art. 3 que estava aberta aqui foi corrigida nesta seção.** `data?.plan_limit ?? 2` saiu de `src/app/(dashboard)/dashboard/page.tsx` e `src/app/(dashboard)/projects/page.tsx`; as duas telas leem `entitlements.project_limit` do `/me` (via `useMe()` em `features/account/hooks.ts`), nunca mais um número fixo no front. O nome duplo no backend **não** foi unificado: a resposta paginada de `/api/projects` continua devolvendo o campo como `plan_limit`, e o `/me` como `entitlements.project_limit` — dois nomes para o mesmo conceito. O front só lê o segundo; unificar o nome de fio no backend é trabalho de outra seção, registrado em aberto no `PROGRESS.md`.

**Dez rotas mudaram de status: 400→422 e 500→422.** A tabela com arquivo, função e antes/depois está na nota da Seção 4 no `PROGRESS.md`. O que importa para o cliente: **existem duas formas de 422 na mesma API.** A do Pydantic traz `detail` como **lista** de erros de validação; a de domínio (`ValidacaoDeDominio`) traz `detail` como **string** em pt-BR pronta para exibir.

**A taxonomia foi decidida em 06/09/2026, nesta seção** (registrado em `../CLAUDE.md`, "O que a Seção 4 deixou em aberto", item 3): o cliente discrimina o erro pelo **formato** de `detail`, nunca pelo status HTTP — um cliente que ramificasse em "400 = mostro a mensagem, 422 = renderizo `detail[].msg`" quebraria nessas dez, e status sozinho nunca diz qual dos dois formatos veio. `lib/api/errors.ts` implementa a regra: `detail` string é sentença de domínio, pronta para exibir; `detail` array é erro de schema do Pydantic — mensagem genérica para o usuário (`MENSAGEM_GENERICA`), detalhe completo só no `console.error`. Nenhum branch por `status === 422` em lugar nenhum do cliente.

**Erro de domínio tem forma única:** `{"detail": "<frase em pt-BR>"}` com status 404, 403, 402 ou 422. Recurso de outra conta responde **404, nunca 403** — um 403 confirmaria que o recurso existe, e o backend tem teste garantindo isso. Não trate 404 nesses caminhos como "sumiu": pode ser "não é seu".

## Autenticação da chamada

Toda chamada é `api()` de `@/lib/api/client` — num Server Component, `apiServer()` de `@/lib/api/server`. **Não** monte header à mão, não chame `getSession()`/`getAccessToken()` fora de `lib/api/`, e não crie um segundo cliente HTTP. O padrão manual (`getSession()` + `Authorization: Bearer` montado no call site) é **legado**: sobrevive em ~30 telas fora do piloto migrado (Biblioteca), a Seção 8 é quem as migra, e `tools/catraca.py` (`fetch_fora_de_lib_api`, `supabase_fora_de_lib_api`) impede esse número de crescer enquanto isso não acontece — repetir o padrão manual numa tela nova reprova a catraca no mesmo commit.

**Desvio da spec, registrado por ser deliberado:** a spec pedia um arquivo só sabendo que o Supabase existe; são dois — `auth.ts` (browser) e `auth.server.ts` (servidor) — porque `auth.server.ts` importa `cookies` de `next/headers`, que não pode ser alcançado por um bundle de cliente; juntar os dois quebraria o build do Next, não é questão de estilo. Pelo mesmo motivo, `lib/api/core.ts` (a fábrica `criarCliente()`, sem `"use client"`) existe separado de `client.ts`/`server.ts`: a fábrica não pode arrastar um módulo `"use client"` para dentro de código de servidor.

## O que está medido — não piore

Comparado com `develop` (antes da Seção 5), medido em 06/09/2026 (`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`):

| Medida | `develop` | esta branch |
|---|---|---|
| `createClient(`/`createBrowserClient(`/`createServerClient(` — chamadas reais | 62 | **0** (a única ocorrência restante é comentário em `lib/api/auth.ts:18`) |
| `getSession()` — chamadas reais | 56 | **2**, ambas dentro de `lib/api/` |
| `Authorization` montado à mão em telas/componentes (exclui `lib/api/` e `__tests__/`) | 73 | **63** |
| `fetch(` com fronteira de palavra | 87 | **75** — idêntico ao `fetch_fora_de_lib_api` da catraca (medido em 06/09/2026 como 76; a revisão final da Seção 5 reescreveu um comentário que continha um `fetch(` literal falso-positivo e a medida caiu para 75 — ver a nota de correção em `docs/dev/medicoes/2026-09-06-biblioteca-depois.md`) |
| Testes de frontend | 7 | **63**, em 11 arquivos |
| Catraca | — | `eslint_erros` 85 (era 93), `fetch_fora_de_lib_api` 75, `supabase_fora_de_lib_api` 0 |

Uma tela nova que soma outro `createClient()`/`getSession()`/header manual fora de `lib/api/`, ou um `fetch(` fora de `lib/api/` numa tela que a catraca já contava como migrada, piora esses números — meça antes de assumir que não piorou. **O ganho de tempo/latência que a spec exigia como confirmação não foi medido** — falta credencial de usuário real e checagem de hidratação ao vivo; ver `PROGRESS.md`, nota da Seção 5, e `docs/dev/medicoes/2026-09-06-biblioteca-depois.md`.

## Acessibilidade (Art. 6)

Todo `<label>` ligado por `htmlFor`/`id`. Tudo clicável é focável e visível ao foco — proibido `tabIndex={-1}` em controle interativo (**3 ocorrências hoje**, nenhuma para imitar; eram 5 até a Tarefa 9 da Seção 8 tirar os dois da Biblioteca — `python tools/catraca.py`, medida `tabindex_negativo`). Contraste AA (4.5:1 texto, 3:1 elemento gráfico) nos dois temas.

> Um controle que sai de `tabIndex={-1}` entra na ordem de tabulação e passa a
> precisar de **nome acessível**: os dois `TooltipTrigger` da Biblioteca tinham
> como único filho um ícone, e sem `aria-label` virariam violação `button-name`
> do axe no lugar da violação que o `tabIndex` causava. Tirar o `tabIndex={-1}`
> e dar nome ao controle são o mesmo conserto, não dois.

## Cor (Art. 7)

Token semântico sempre. Tokens que existem hoje em `globals.css`: `--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`, `--card`, `--popover` (cada um com seu `-foreground`), mais `--border`, `--input` e `--ring` (sem par `-foreground`).

> **Correção em 11/09/2026, na Tarefa 9 da Seção 8.** Este parágrafo dizia
> "**não existem `--success`, `--warning` nem `--info`** — a Seção 6 os cria", e
> isso envelheceu: a Seção 6 os criou mesmo, nos **dois** temas, e eles estão
> ligados a nome de classe utilitária no `tailwind.config.ts`. Então
> `text-success`, `bg-warning/15` e afins renderizam hoje. Medido com:
>
> ```
> grep -nE "^\s*--(success|warning|info)(-foreground)?:" ArchSmart-web/src/app/globals.css   # 12 linhas, 6 por tema
> grep -n "success\|warning\|info" ArchSmart-web/tailwind.config.ts                          # 9 linhas
> ```
>
> ### ⚠️ `--warning` não serve como cor de texto. Use chip preenchido.
>
> **Regra, decidida na Tarefa 9 da Seção 8 e medida com `tools/contraste.py`** —
> a própria ferramenta que a catraca usa, no tema claro sobre `--background`:
>
> | Uso | Contraste (claro) | Art. 6 |
> |---|---|---|
> | `text-warning` como cor de texto | **1,99:1** | reprova |
> | `-amber-600` literal, que existia antes | 3,19:1 | reprova |
> | **`bg-warning` + `text-warning-foreground`** | **4,91:1** | **passa** |
>
> No tema escuro o par do chip dá 10,83:1. Então **aviso é chip preenchido**
> (`bg-warning` com `text-warning-foreground`), nunca `text-warning` sobre o
> fundo da tela. O exemplo vivo está em
> `src/components/library/BatchNormalizeRow.tsx` — copie de lá.
>
> **E não "conserte" escurecendo `--warning`:** `--warning-foreground` é escuro,
> então um `--warning` escuro quebraria o par do chip nos dois temas, e mexeria em
> toda superfície de aviso do produto.
>
> `--success` **não** tem esse problema como cor de texto: **5,07:1** no claro
> (contra 5,02:1 do `-green-700` que substituiu), e passa.
>
> **A catraca não protege isso.** `contraste_reprovado` mede só pares
> (cor, cor-foreground) de `globals.css` — nunca um token de **texto** sobre
> `--background`. Quem escrever `text-warning` numa tela nova não vai ser
> reprovado por ferramenta nenhuma; é esta regra escrita que segura.

Se a tela precisa de um estado que nenhum token cobre, reaproveite o token semanticamente mais próximo (`--destructive` para negativo, `--accent` para neutro) em vez de escrever a classe: `border-warning` sem token não renderiza nada, e o passo seguinte costuma ser um hex ou um literal de paleta — o desvio que esta regra existe para evitar. Hoje há 510 classes de cor nomeada (`bg-emerald-600`, `bg-slate-100` e afins) em 39 arquivos, mais 11 hex arbitrário (`bg-[#F88379]` e afins) fora do padrão. Não acrescente o 511º.

## Convenções

Componentes `PascalCase.tsx`, tipos `PascalCase`, instâncias e métodos `camelCase` (Art. 5). Dado vem de TanStack Query e valida com Zod onde já houver o padrão estabelecido no domínio.

## Testes

`npm test` (que roda `vitest run`) e `npm run typecheck` (que roda
`tsc --noEmit`). Os dois são o que o job **Frontend** do CI executa; rode-os
antes de abrir PR.

A suíte sai limpa: `Test Files 11 passed (11)` e `Tests 63 passed (63)` (a Seção 5 acrescentou os testes de `lib/api/`, `lib/query/` e `features/*`; eram 4 arquivos/7 testes antes dela). **Um
`failed` em qualquer das duas linhas é um teste realmente quebrado.** Até a
Seção 3, o `vitest.config.ts` não excluía `e2e/` e o Vitest tentava coletar
dois specs do Playwright, reportando `2 failed` de forma permanente — a
orientação de então era ignorar. Não ignore mais.

## Onde ler mais

`docs/dev/arquitetura.md` e `docs/dev/convencoes.md`.
