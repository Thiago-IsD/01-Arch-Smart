# ArchSmart-web — regras do frontend

Este arquivo descreve o alvo da **Seção 5** para o frontend. Leia primeiro `../CLAUDE.md` para o estado geral da reestruturação.

## Onde as coisas moram hoje

- `src/app/` — App Router (rotas, layouts, páginas).
- `src/components/ui/` — primitivos shadcn. Não editar aqui para meter regra de negócio.
- `src/components/` — componentes de domínio, por área (`budget/`, `library/`, `projects/`, `landing/`...).
- `src/lib/` — utilitários e clientes soltos (`env.ts`, `api-url.ts`, `utils.ts`).
- `src/hooks/`, `src/types/`, `src/contexts/`, `src/config/` — hooks, tipos, contexto React e config estática (navegação, marca), cada um compartilhado entre rotas.

## Onde colocar um arquivo novo

Componente usado só por uma rota fica junto dela, em `<rota>/components/` (ex.: `library/components/LibraryContent.tsx`). Usado por mais de uma rota vai em `src/components/<área>/`. `src/utils/` hoje só tem o cliente Supabase (`@/utils/supabase/client`, `createClient()`) — utilitário novo vai em `src/lib/`, não em `src/utils/`.

## Onde vão morar

`src/features/<dominio>/` reunindo `api.ts`, `hooks.ts` e `components/` do domínio, mais `lib/api/` (cliente HTTP único que injeta o header de auth) — **Seção 5**. Essas pastas ainda não existem, **não as crie agora**. Diferente: `lib/query/` (TanStack Query) **já está instalado, configurado e montado hoje** — falta só a pasta e a convenção de `queryKeys`; ver "Busca de dados" abaixo.

## Busca de dados

Tela nova no dashboard busca dado com `useQuery`. O `QueryProvider` já está montado em `src/app/(dashboard)/layout.tsx` (`staleTime` 30 s, `gcTime` 5 min) — **não** use `useEffect` + `fetch`. URL base sempre de `getApiUrl()` em `src/lib/api-url.ts`; nunca escreva `http://localhost:8000` ou qualquer host na tela (Art. 4).

## Autenticação da chamada — até a Seção 5 existir

Siga exatamente o padrão do arquivo vizinho mais parecido: `getSession()` e header `Authorization: Bearer ${session.access_token}`. **Não crie uma abstração nova** (`apiClient`, hook de fetch genérico, wrapper de sessão): a Seção 5 migra os 70 call sites de uma vez com `lib/api/client.ts`, então repetir o padrão manual custa zero a mais — uma abstração concorrente feita agora só duplicaria trabalho e seria jogada fora nesse dia.

## O que está medido — não piore

Do clique até os dados na tela, com sessão real: Projetos 3,0 s · Biblioteca 3,6 s · Financeiro 4,3 s. Cache é quase inexistente: só 3 dos 144 arquivos usam TanStack Query (`LibraryContent.tsx`, `PresentationsTab.tsx`, `BatchNormalizeModal.tsx`) — o resto refaz a chamada a cada navegação. No código hoje: 62 `createClient()`, 56 `getSession()`, 70 headers `Authorization` montados à mão, zero `next/dynamic`/`React.lazy`. Uma tela nova que soma outra chamada de rede redundante ou outro `createClient()` fora do padrão piora esse número — meça antes de assumir que não piorou.

## Acessibilidade (Art. 6)

Todo `<label>` ligado por `htmlFor`/`id`. Tudo clicável é focável e visível ao foco — proibido `tabIndex={-1}` em controle interativo (5 ocorrências hoje, nenhuma para imitar). Contraste AA (4.5:1 texto, 3:1 elemento gráfico) nos dois temas.

## Cor (Art. 7)

Token semântico sempre. Tokens que existem hoje em `globals.css`: `--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`, `--card`, `--popover` (cada um com seu `-foreground`), mais `--border`, `--input` e `--ring` (sem par `-foreground`). **Não existem `--success`, `--warning` nem `--info`** — a Seção 6 os cria. Se a tela precisa de um estado que nenhum token cobre (aviso, sucesso), reaproveite o token semanticamente mais próximo (`--destructive` para negativo, `--accent` para neutro) em vez de escrever a classe: `border-warning` sem token não renderiza nada, e o passo seguinte costuma ser um hex ou um `-amber-500` literal — o desvio que esta regra existe para evitar. Hoje há 510 classes de cor nomeada (`bg-emerald-600`, `bg-slate-100` e afins) em 39 arquivos, mais 11 hex arbitrário (`bg-[#F88379]` e afins) fora do padrão. Não acrescente o 511º.

## Convenções

Componentes `PascalCase.tsx`, tipos `PascalCase`, instâncias e métodos `camelCase` (Art. 5). Dado vem de TanStack Query e valida com Zod onde já houver o padrão estabelecido no domínio.

## Testes

`npx vitest run`. Hoje ele também coleta `e2e/auth.spec.ts` e `e2e/dashboard.spec.ts` — specs do Playwright, não do Vitest — e os reporta como 2 arquivos falhos; defeito de configuração conhecido, a ser corrigido na Seção 3. As specs reais (`*.test.ts(x)`) passam; não tente "corrigir" as duas do Playwright por conta própria.

## Onde ler mais

`docs/dev/arquitetura.md` e `docs/dev/convencoes.md`.
