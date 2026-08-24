# ArchSmart-web — regras do frontend

Este arquivo descreve o alvo da **Seção 5** para o frontend. Leia primeiro `../CLAUDE.md` para o estado geral da reestruturação.

## Onde as coisas moram hoje

- `src/app/` — App Router (rotas, layouts, páginas).
- `src/components/ui/` — primitivos shadcn. Não editar aqui para meter regra de negócio.
- `src/components/` — componentes de domínio, por área (`budget/`, `library/`, `projects/`, `landing/`...).
- `src/lib/` — utilitários e clientes soltos (`env.ts`, `api-url.ts`, `utils.ts`).
- `src/hooks/` — hooks compartilhados.

## Onde vão morar

`src/features/<dominio>/` reunindo `api.ts`, `hooks.ts` e `components/` do domínio, mais `lib/api/` (cliente HTTP único que injeta o header de auth) e `lib/query/` (TanStack Query configurado) — **Seção 5**. Nada disso existe ainda. **Não crie essas pastas agora**: uma versão feita fora da Seção 5 diverge da que ela vai entregar e é jogada fora.

## Até a Seção 5 existir

Se a tela precisa chamar a API, siga exatamente o padrão do arquivo vizinho mais parecido (`const { data: { session } } = await supabase.auth.getSession()` e header `Authorization: Bearer ${session.access_token}`). **Não crie uma abstração nova** — um `apiClient`, um hook de fetch genérico, um wrapper de sessão. Repetir o padrão manual hoje é o comportamento correto; inventar um substituto parcial é o que sai caro depois, quando `lib/api/` chegar e tiver que conviver com dois padrões.

## O que está medido — não piore

Do clique até os dados na tela, com sessão real: Projetos 3,0 s · Biblioteca 3,6 s · Financeiro 4,3 s. Nada é cacheado entre navegações. No código hoje, em 144 arquivos `.ts`/`.tsx`: 62 `createClient()`, 56 `getSession()`, 70 headers `Authorization` montados à mão, zero `next/dynamic`/`React.lazy`. Uma tela nova que soma outra chamada de rede redundante ou outro `createClient()` fora do padrão piora esse número — meça antes de assumir que não piorou.

## Acessibilidade (Art. 6)

Todo `<label>` ligado por `htmlFor`/`id`. Tudo clicável é focável e visível ao foco — proibido `tabIndex={-1}` em controle interativo (5 ocorrências hoje, nenhuma para imitar). Contraste AA (4.5:1 texto, 3:1 elemento gráfico) nos dois temas.

## Cor (Art. 7)

Token semântico sempre (`text-primary`, `bg-destructive`, `border-warning`). Nenhuma cor literal em classe utilitária. Hoje há 510 classes de cor nomeada (`bg-emerald-600`, `bg-slate-100` e afins) em 39 arquivos, mais 11 hex arbitrário (`bg-[#008080]`) fora do padrão — são desvio a corrigir, não exemplo a seguir. Não acrescente o 511º.

## Convenções

Componentes `PascalCase.tsx`, tipos `PascalCase`, instâncias e métodos `camelCase` (Art. 5). Dado vem de TanStack Query e valida com Zod onde já houver o padrão estabelecido no domínio.

## Testes

`npx vitest run`. Hoje ele também coleta `e2e/auth.spec.ts` e `e2e/dashboard.spec.ts` — specs do Playwright, não do Vitest — e os reporta como 2 arquivos falhos; defeito de configuração conhecido, a ser corrigido na Seção 3. As specs reais (`*.test.ts(x)`) passam; não tente "corrigir" as duas do Playwright por conta própria.

## Onde ler mais

`docs/dev/arquitetura.md` e `docs/dev/convencoes.md` (Task 6 desta seção).
