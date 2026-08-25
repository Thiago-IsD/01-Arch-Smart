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
| Limite de plano, cota ou preço decidido/calculado no componente React em vez de vir da resposta da API | 3 | `src/app/(dashboard)/dashboard/page.tsx` e `src/app/(dashboard)/projects/page.tsx` hoje fazem `const planLimit = data?.plan_limit ?? 2` — se a API não devolver o campo, o front decide silenciosamente que o limite é 2 — e exibem o texto fixo "Plano Solo" na tela, independente do plano real da conta. Nenhum dos dois é para imitar. Hoje `GET /api/users/me` nem devolve um bloco de `entitlements` — a Seção 4 acrescenta isso; até lá, nenhum valor de plano tem fonte confiável e não deve ser inventado no componente. |
| `detail=str(e)` (ou qualquer variação que devolva a mensagem da exceção Python direto no corpo da resposta HTTP) | — | Vaza detalhe de implementação interna (nome de tabela, driver de banco, caminho de arquivo) para quem chama a API — inclusive um client não autenticado, em endpoints públicos. Hoje há 5 ocorrências, todas em `app/api/auth.py` (4) e `app/api/routers/product_router.py` (1), nenhuma para imitar. |
| Teste que substitui a sessão de banco por `MagicMock`/mock equivalente para validar comportamento que depende de dado real (isolamento entre contas, filtro por `account_id`, contagem de linhas) | 1 | A suíte antiga (`app/tests/`, 83 testes) usa exatamente esse padrão e não detectou nenhum dos 14 vazamentos entre contas encontrados na auditoria de 23/08/2026 — porque um mock não tem conceito de "linha de outra conta" para vazar. Está fora do `testpaths` do `pytest.ini`, será apagada na Seção 4, e nada novo deve seguir esse padrão. Teste que prova isolamento roda contra Postgres real (a suíte `tests/` tem 29 testes hoje, 27 deles em `tests/isolation/`). |
| Criar `apiClient`, hook de fetch genérico ou qualquer abstração nova sobre `fetch`/`createClient()` fora do padrão manual atual (`getSession()` + header `Authorization: Bearer` montado à mão) | — | A Seção 5 migra os 70 call sites de header manual de uma vez com `lib/api/client.ts`. Uma abstração concorrente criada antes disso não reduz os 62 `createClient()`/56 `getSession()`/70 headers manuais de hoje — só duplica trabalho e é descartada nesse dia. |
| `useEffect` + `fetch` para buscar dado numa tela nova do dashboard | 5 | `QueryProvider` já está montado (`src/app/(dashboard)/layout.tsx`), com `staleTime` de 30s — tela nova que ignora isso e refaz a chamada a cada navegação piora os tempos já medidos (ver `arquitetura.md`) em vez de usar o cache disponível. |
| Mover ou renomear arquivo de `ArchSmart-api/`, `ArchSmart-web/` ou `extension/` para a estrutura alvo (`app/api/v1/routes/`, `features/`, `lib/api/`, `lib/query/`) antes da tarefa dedicada da respectiva seção | — | Migração parcial mistura mudança estrutural com mudança de comportamento observável e torna impossível saber o que causou uma regressão — ver `../../CLAUDE.md`. As pastas citadas não existem hoje; a citação aqui é só para deixar claro o que não deve ser antecipado, não para sugerir que já existam. |

## Onde estas regras se aplicam hoje

Nem toda regra tem uma camada pronta para aplicá-la automaticamente ainda:

- **Cor, `tabIndex`, `opacity-0 group-hover`, `ArchSmart`/marca** — hoje é revisão manual em code review. A Seção 3 traz o CI que barra merge com literais proibidos e validador de contraste; a Seção 6 traz o lint específico de `tabIndex`/`focus-within`.
- **`account_id` literal, `detail=str(e)`, teste com banco mockado** — hoje é revisão manual mais o teste de isolamento (Art. 1). A Seção 4 traz `ScopedRepository`/`RequestContext`, que torna o erro estruturalmente mais difícil de cometer.
- **URL/host fixo** — hoje é revisão manual; a extensão (`extension/manifest.json`, `extension/popup.js`) é exceção conhecida e documentada em `extension/CLAUDE.md`, corrigida só na reescrita da extensão.

## Onde ler mais

- [`../../CLAUDE.md`](../../CLAUDE.md) — as regras curtas, no nível do repositório inteiro.
- [`../../spec-kit-2/memory/constitution.md`](../../spec-kit-2/memory/constitution.md) — os 15 artigos, na íntegra.
- [`../../ArchSmart-api/CLAUDE.md`](../../ArchSmart-api/CLAUDE.md) e [`../../ArchSmart-web/CLAUDE.md`](../../ArchSmart-web/CLAUDE.md) — regras específicas de cada camada, incluindo os mesmos números medidos aqui.
- [`arquitetura.md`](arquitetura.md) — como as peças se encaixam e onde mora a regra de negócio.
