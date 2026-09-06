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

## O que a Seção 4 mudou na API que este front consome

A Seção 4 fechou em 06/09/2026 e está implantada em staging. Três coisas mudaram no contrato, e a Seção 5 é escrita contra elas.

**O `/me` ganhou `entitlements`, e ele fica em `/api/users/me`.** A spec pedia `GET /api/v1/me`; não existe prefixo `/api/v1` nesta aplicação e criar um para uma rota só foi recusado — [ADR 0008](../docs/dev/decisoes/0008-me-em-api-users-me.md). O corpo hoje traz `id`, `full_name`, `email`, `avatar_url`, `role`, `account` e:

```json
"entitlements": { "project_limit": 2, "can_use_ai": true, "can_use_portal": true }
```

É dicionário aberto de propósito (um entitlement novo não deve exigir deploy casado de API e front), então **o front não tem lista de chaves para tipar contra** — vale a Seção 5 declarar o seu próprio tipo parcial. `PUT /api/users/profile` devolve o mesmo schema e também carrega `entitlements`; preencher só um dos dois faz o campo sumir depois que o usuário salva o perfil.

**Isso mata a violação do Art. 3 que está aberta aqui.** `data?.plan_limit ?? 2` continua em `src/app/(dashboard)/dashboard/page.tsx:217` e `src/app/(dashboard)/projects/page.tsx:44` — agora existe fonte no servidor para substituir o número fixo. Cuidado com o nome: a resposta paginada de `/api/projects` devolve o campo como `plan_limit`, e o `/me` devolve como `entitlements.project_limit`. São o mesmo conceito com dois nomes; unificar o nome de fio é trabalho desta seção, não da 4.

**Dez rotas mudaram de status: 400→422 e 500→422.** A tabela com arquivo, função e antes/depois está na nota da Seção 4 no `PROGRESS.md`. O que importa para o cliente: **existem duas formas de 422 na mesma API.** A do Pydantic traz `detail` como **lista** de erros de validação; a de domínio (`ValidacaoDeDominio`) traz `detail` como **string** em pt-BR pronta para exibir. Um cliente que ramifica em "400 = mostro a mensagem, 422 = renderizo `detail[].msg`" quebra nessas dez. Se a taxonomia está certa é decisão em aberto — ver `../CLAUDE.md`, "O que a Seção 4 deixou em aberto".

**Erro de domínio tem forma única:** `{"detail": "<frase em pt-BR>"}` com status 404, 403, 402 ou 422. Recurso de outra conta responde **404, nunca 403** — um 403 confirmaria que o recurso existe, e o backend tem teste garantindo isso. Não trate 404 nesses caminhos como "sumiu": pode ser "não é seu".

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

`npm test` (que roda `vitest run`) e `npm run typecheck` (que roda
`tsc --noEmit`). Os dois são o que o job **Frontend** do CI executa; rode-os
antes de abrir PR.

A suíte sai limpa: `Test Files 4 passed (4)` e `Tests 7 passed (7)`. **Um
`failed` em qualquer das duas linhas é um teste realmente quebrado.** Até a
Seção 3, o `vitest.config.ts` não excluía `e2e/` e o Vitest tentava coletar
dois specs do Playwright, reportando `2 failed` de forma permanente — a
orientação de então era ignorar. Não ignore mais.

## Onde ler mais

`docs/dev/arquitetura.md` e `docs/dev/convencoes.md`.
