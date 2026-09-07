# Convenções

Duas metades: o que é **obrigatório** escrever assim, e o que é **proibido**
escrever de jeito nenhum. A metade proibida é a que importa mais — cada item
tem três partes: a regra, o artigo da [constitution](../../spec-kit-2/memory/constitution.md)
que a sustenta, e o defeito concreto que ela existe para evitar. Essa
terceira parte é o que faz a regra ser levada a sério em vez de contornada, e
é também a fonte das regras de lint que a Seção 3 vai escrever — se uma regra
aqui não for precisa o bastante para virar um `grep`/AST check automático, ela
está mal escrita e deve ser corrigida, não deixada vaga.

Os números abaixo foram medidos em 24/08/2026, neste checkout. Eles crescem
ou encolhem com o tempo; se divergirem muito da realidade quando você ler
isto, é sinal de que o documento ficou para trás — corrija-o.

## Obrigatório

### Nomenclatura

| Camada | Regra | Exemplo |
|---|---|---|
| Tabelas PostgreSQL | `snake_case`, **plural** | `projects`, `budget_items`, `ai_usage_logs` |
| Colunas PostgreSQL | `snake_case`; toda tabela com dado de cliente carrega `account_id` | `account_id`, `created_by`, `updated_at` |
| Chave primária | sempre `id UUID` | `id = Column(UUID(as_uuid=True), primary_key=True, ...)` |
| Modelos SQLAlchemy | `PascalCase`, singular | `class Project(Base):`, `class BudgetItem(Base):` |
| Schemas Pydantic | nome do modelo + sufixo do que representam | `ProjectCreate`, `ProjectRead`, `ProjectUpdate` |
| Funções e variáveis Python | `snake_case` | `get_current_user`, `budget_calculator` |
| Componentes React | `PascalCase.tsx`, um componente por arquivo | `LibraryContent.tsx`, `BudgetSummaryFooter.tsx` |
| Tipos/interfaces TypeScript | `PascalCase` | `interface ProjectSummary` |
| Instâncias e métodos TypeScript | `camelCase` | `getApiUrl()`, `activeProjectsCount` |
| Eventos de telemetria (Art. 10 — ainda não existe, ver Seção 7) | `objeto_verbo_no_passado`, `snake_case`, propriedades também `snake_case` | `project_created`, `budget_exported` |

Referência normativa: Art. 5 da constitution.

### Commits

Formato `tipo: descrição`, mensagem em português. Tipos observados no
histórico deste repositório: `feat`, `fix`, `docs`, `merge`, `correção`. Use o
tipo em inglês (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`) para
manter o prefixo pesquisável; a descrição que segue os dois pontos é livre,
em português.

### Erros na API

Mensagem em português para quem usa o produto; detalhe técnico (stack trace,
mensagem de exceção) só no log do servidor, nunca no corpo da resposta HTTP.

### Testes de isolamento

Todo endpoint novo que lê ou grava dado de conta ganha um teste em
`ArchSmart-api/tests/isolation/` que autentica como conta A e prova que o
dado da conta B não retorna. Roda contra Postgres real em Docker
(`docker-compose.test.yml`), nunca contra sessão de banco mockada.

## Proibido

| Proibido | Art. | Por quê |
|---|---|---|
| `account_id` (ou qualquer id de usuário/tenant) literal, hardcoded, ou recebido como parâmetro de rota, query string ou corpo da requisição, em vez de resolvido a partir do token da sessão no servidor | 1 | A auditoria de 23/08/2026 encontrou 14 endpoints vazando dado entre contas dessa forma — 6 endpoints de orçamento sem filtro por conta, 5 ações do portal do cliente sem verificar o token de acesso, 2 endpoints sem autenticação nenhuma e 1 (`financial.py`) gravando o `project_id` enviado pelo cliente sem validar a conta dona. Corrigido na Seção 1 (merge `f190a07`); a regra existe para que não volte a acontecer. |
| URL, chave de API ou host escrito diretamente no código (`http://localhost:8000`, `https://algumacoisa.onrender.com`, chave do Supabase ou do Gemini em texto) em vez de `process.env.NEXT_PUBLIC_API_URL` (frontend) ou `app/core/config.py` (backend) | 4 | `extension/manifest.json` publica `http://localhost:3000/*` e `http://127.0.0.1:8000/*` em `host_permissions`, e `extension/popup.js` tem um mapa `ENVIRONMENTS` com as URLs de dev e produção escritas no código, trocadas manualmente antes de cada publicação — nenhum dos dois é para imitar. |
| Classe utilitária de cor nomeada da paleta do Tailwind (`bg-emerald-600`, `bg-slate-100`, `text-amber-600`, `border-red-500` e afins) ou hex arbitrário (`bg-[#F88379]`) em vez de um token semântico do tema (`bg-primary`, `text-destructive`, `border-muted`) | 7 | Hoje há **510** classes de paleta Tailwind em **39 arquivos** de `ArchSmart-web/src`, mais **11** ocorrências de hex arbitrário. A identidade visual vai mudar (rebranding assumido); cor espalhada em classe estática transforma isso numa varredura manual de dias em vez de uma troca de variável CSS. |
| `ArchSmart`, `Ark Smart` ou `Ecowe` em texto visível ao usuário, copy, e-mail, título de página, seed ou comentário — a grafia correta é **Arq Smart**, duas palavras, com Q | 8 | Levantamento de 23/08/2026 encontrou cerca de 60 arquivos com a grafia errada, incluindo o `<title>` da aplicação hoje ("Arch Smart", com H) — a correção completa é da Seção 9; até lá, texto novo não pode aumentar essa lista. `ArchSmart-api`/`ArchSmart-web` como caminho de diretório não conta como grafia da marca. |
| `tabIndex={-1}` em qualquer controle interativo (botão, link, item de menu, campo) | 6 | 5 ocorrências hoje tornam o controle correspondente inalcançável por teclado — um arquiteto trabalhando 8h/dia numa tela é usuário de acessibilidade mesmo sem se declarar como tal (Art. 6). Nenhuma das 5 é para imitar. |
| `opacity-0` combinado com `group-hover:opacity-100` (ou variante nomeada, `group-hover/nome:opacity-100`) sem também incluir `focus-within` (ou `group-focus-within`) na mesma classe | 6 | 9 ocorrências hoje escondem a única forma de acionar a ação de quem navega por teclado — a ação só aparece ao passar o mouse, nunca ao tabular até o elemento. Um contraexemplo correto já existe no próprio código, em `src/components/projects/environments/EnvironmentCard.tsx`, que combina `opacity-0 group-hover:opacity-100` com `group-focus-within:opacity-100` e `focus-visible:opacity-100` — é esse padrão que deve ser seguido. |
| Limite de plano, cota ou preço decidido/calculado no componente React em vez de vir da resposta da API | 3 | `GET /api/users/me` devolve `entitlements.project_limit`; o front lê isso por `useEntitlements()`/`useMe()` (`src/features/account/hooks.ts`) e nunca inventa um número. `undefined` (dado ainda não chegou, ou chave nova que o backend não mandou) significa "não sei ainda" — renderiza o skeleton, nunca um fallback numérico como `?? 2`. Essa violação existia em `src/app/(dashboard)/dashboard/page.tsx` e `src/app/(dashboard)/projects/page.tsx` e foi corrigida na Seção 5; a regra continua valendo para qualquer tela nova. |
| `detail=str(e)` (ou qualquer variação que devolva a mensagem da exceção Python direto no corpo da resposta HTTP) | — | Vaza detalhe de implementação interna (nome de tabela, driver de banco, caminho de arquivo) para quem chama a API — inclusive um client não autenticado, em endpoints públicos. Zero ocorrências hoje (`grep -rn "detail=str(e)" ArchSmart-api/app --include=*.py`) — a Seção 4 fechou as 5 que existiam; a regra fica para que não volte. |
| Teste que substitui a sessão de banco por `MagicMock`/mock equivalente para validar comportamento que depende de dado real (isolamento entre contas, filtro por `account_id`, contagem de linhas) | 1 | A suíte antiga (`app/tests/`, 83 testes) usa exatamente esse padrão e não detectou nenhum dos 14 vazamentos entre contas encontrados na auditoria de 23/08/2026 — porque um mock não tem conceito de "linha de outra conta" para vazar. Foi **apagada** na Seção 4 (Tarefa 17), e nada novo deve seguir esse padrão. Teste que prova isolamento roda contra Postgres real: a suíte `tests/` tem hoje **308** testes coletados, **77** deles em `tests/isolation/` (`pytest --collect-only -q` em `ArchSmart-api`) — eram 29 e 27 quando esta linha foi escrita, na Seção 2. |
| Montar header `Authorization` à mão, chamar `getSession()`/`getAccessToken()` fora de `src/lib/api/`, ou usar `fetch`/`createBrowserClient()`/`createServerClient()` fora de `src/lib/api/` | — | Toda chamada é `api()` de `@/lib/api/client` (Client Component) ou `apiServer` de `@/lib/api/server` (Server Component/Route Handler) — a Seção 5 entregou esse cliente único, resolvendo token, header, query, `AbortSignal` e erro tipado num só lugar. `fetch` cru e o cliente Supabase só existem dentro de `src/lib/api/` (e `src/proxy.ts`, para o Supabase); `tools/catraca.py` conta as duas coisas fora dali (`fetch_fora_de_lib_api`, `supabase_fora_de_lib_api`) e só deixa o número descer. Isto substitui a regra anterior desta linha, que proibia criar essa abstração enquanto o padrão manual era o certo a copiar — esse período acabou. |
| `useEffect` + `fetch` para buscar dado numa tela nova do dashboard | 5 | Dado vem de um hook de domínio em `features/<domínio>/hooks.ts` (`useProducts`, `useMe`, etc.), nunca de `useQuery` solto na tela nem de `useEffect` + `fetch`. `QueryProvider` já está montado (`src/app/(dashboard)/layout.tsx`) e cada hook aplica a `cachePolicy` (`lib/query/keys.ts`) da natureza do dado — tela nova que ignora isso e refaz a chamada a cada navegação piora os tempos já medidos (ver `arquitetura.md`) em vez de usar o cache disponível. |
| Mover ou renomear arquivo de `ArchSmart-api/` ou `extension/` para a estrutura alvo (`app/api/v1/routes/`) antes da tarefa dedicada da respectiva seção | — | Migração parcial mistura mudança estrutural com mudança de comportamento observável e torna impossível saber o que causou uma regressão — ver `../../CLAUDE.md`. `app/api/v1/routes/` não existe hoje (ver [ADR 0008](decisoes/0008-me-em-api-users-me.md)); a citação aqui é só para deixar claro o que não deve ser antecipado. No frontend esta linha já não se aplica do mesmo jeito: `features/`, `lib/api/` e `lib/query/` **existem** desde a Seção 5 — `lib/api/` tem o cliente HTTP e a autenticação (`client.ts`/`server.ts`, `auth.ts`/`auth.server.ts`), `lib/query/` tem as chaves de cache e a hidratação (`keys.ts`, `hydration.ts`), e cada domínio mora em `features/<domínio>/` com `api.ts`/`hooks.ts`/`types.ts` (hoje: `library/`, `account/`). Criar `features/<domínio>/` novo exige `docs/dev/modulos/<domínio>.md` no mesmo commit (Art. 13) — sem isso a catraca (`modulos_sem_doc`) falha. |

## Onde estas regras se aplicam hoje

Nem toda regra tem uma camada pronta para aplicá-la automaticamente ainda:

- **Cor, `tabIndex`, `opacity-0 group-hover`, `ArchSmart`/marca** — hoje é revisão manual em code review. A Seção 3 traz o CI que barra merge com literais proibidos e validador de contraste; a Seção 6 traz o lint específico de `tabIndex`/`focus-within`.
- **`account_id` literal, `detail=str(e)`, teste com banco mockado** — hoje é revisão manual mais o teste de isolamento (Art. 1). A Seção 4 traz `ScopedRepository`/`RequestContext`, que torna o erro estruturalmente mais difícil de cometer.
- **URL/host fixo** — hoje é revisão manual; a extensão (`extension/manifest.json`, `extension/popup.js`) é exceção conhecida e documentada em `extension/CLAUDE.md`, corrigida só na reescrita da extensão.
- **`fetch`/cliente Supabase fora de `lib/api/`, `useEffect` + `fetch` numa tela nova** — desde a Seção 5, `tools/catraca.py` mede automaticamente (`fetch_fora_de_lib_api`, `supabase_fora_de_lib_api`) e só deixa o número descer; não depende mais só de revisão manual. Continua valendo revisão manual para a intenção por trás do número (hook certo, chave de cache no lugar certo), que o grep não vê.

## Onde ler mais

- [`../../CLAUDE.md`](../../CLAUDE.md) — as regras curtas, no nível do repositório inteiro.
- [`../../spec-kit-2/memory/constitution.md`](../../spec-kit-2/memory/constitution.md) — os 15 artigos, na íntegra.
- [`../../ArchSmart-api/CLAUDE.md`](../../ArchSmart-api/CLAUDE.md) e [`../../ArchSmart-web/CLAUDE.md`](../../ArchSmart-web/CLAUDE.md) — regras específicas de cada camada, incluindo os mesmos números medidos aqui.
- [`arquitetura.md`](arquitetura.md) — como as peças se encaixam e onde mora a regra de negócio.
