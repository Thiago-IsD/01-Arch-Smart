# Arquitetura

Como o Arq Smart está montado hoje, 24/08/2026, para quem chega e precisa
saber onde tocar antes de tocar. Este documento descreve o **estado atual**,
não o alvo da reestruturação — cada seção que muda algo aqui está anotada
como tal; se você chegou depois de uma dessas seções ser concluída e o texto
não bater mais, o documento ficou para trás e precisa ser corrigido no mesmo
commit que mudou o comportamento (regra do `docs/dev/README.md`).

## As peças e como conversam

```
extension/  (Chrome, não empacotado)
     |  captura produto ao clique do usuário
     v
ArchSmart-web/  (Next.js 16, App Router)  <-- www.archsmart.com.br em produção
     |  fetch() com header Authorization: Bearer <access_token>
     v
ArchSmart-api/  (FastAPI)  <-- https://arch-smart-api.onrender.com em produção
     |  SQLAlchemy, filtro manual por account_id
     v
Postgres do projeto Supabase do time  (também back-end de Auth)
```

- **`extension/`** — extensão de navegador (`manifest.json`, `content.js`,
  `popup.js`). Só lê a página aberta e envia o produto capturado direto para
  `ArchSmart-api` (`/api/products/clipper/capture`); não fala com
  `ArchSmart-web`. Regras próprias, inclusive as 4 diretrizes de compliance
  do parecer jurídico (Art. 11), em [`../../extension/CLAUDE.md`](../../extension/CLAUDE.md).
- **`ArchSmart-web/`** — a aplicação que o arquiteto usa. App Router do
  Next.js; toda chamada à API é feita do lado do cliente (não há prefetch no
  servidor hoje — isso é alvo da Seção 5), levando o token da sessão no
  header.
- **`ArchSmart-api/`** — FastAPI + SQLAlchemy. Recebe o token, resolve a
  identidade, filtra por conta, fala com o Postgres. Lógica de negócio mora
  em `app/services/` (`ai_service.py`, `auth_service.py`,
  `budget_calculator.py`, `financial_service.py`); os módulos de rota em
  `app/api/` (arquivos soltos, `api/endpoints/` e `api/routers/` — três
  convenções coexistindo, ver `../../ArchSmart-api/CLAUDE.md`) só devem
  orquestrar.
- **Postgres do Supabase** — um único banco, o mesmo projeto usado para
  autenticação (Supabase Auth) e para dado de aplicação. Não existe hoje um
  Postgres "de desenvolvimento" separado do projeto real (ver
  `docs/dev/ambiente.md`); o Postgres local em Docker existe só para a suíte
  de testes do backend, com dados efêmeros.

## O que roda onde

Confirmado neste repositório (não é plano, é o que está de pé):

- **API em produção**: Render, em `https://arch-smart-api.onrender.com` —
  confirmado por `.github/workflows/keep-alive.yml`, que pinga `/health` a
  cada 10 minutos para evitar o cold start do tier gratuito do Render (~20s
  depois de ~15 min sem tráfego).
- **Banco em produção**: o Postgres do projeto Supabase do time — confirmado
  pelos comentários de `ArchSmart-api/.env.example` (`DATABASE_URL` aponta
  para esse projeto) e por `.github/workflows/keep-db-alive.yml`, que toca o
  banco 2x ao dia para evitar a pausa automática do tier gratuito do Supabase
  (~7 dias sem uso).
- **Web em produção**: `https://www.archsmart.com.br` — confirmado em
  `extension/popup.js` (`ENVIRONMENTS.prod.web`, usado pela extensão para
  saber para onde mandar o usuário).
- **Decisão de infraestrutura do beta** (Art. 14 da constitution): Vercel
  (frontend) + Render (backend) + Supabase (auth/banco), com AWS fora de
  cogitação até perto da aquisição de clientes. Este repositório não tem
  hoje um `vercel.json` nem outra config que prove a hospedagem do frontend
  na Vercel diretamente — a decisão está na constitution e o domínio de
  produção está confirmado acima; se você precisar confirmar o provedor
  exato do frontend, pergunte ao time em vez de assumir.
- **Ambiente de staging**: não existe hoje. Todo `git push` para `main` é o
  caminho para produção. A Seção 3 entrega branch `staging` com ambiente
  próprio (API de staging no Render + preview automático da Vercel) e CI que
  barra merge.

## Como a identidade é resolvida

Fluxo de ponta a ponta, hoje:

1. O usuário autentica no Supabase Auth (login, magic link, etc.) e recebe um
   JWT.
2. `ArchSmart-web` guarda a sessão via `@supabase/ssr` e manda o
   `access_token` em todo `fetch()` para a API, como
   `Authorization: Bearer <token>` — montado à mão em cada call site (62
   `createClient()`, 56 `getSession()`, 70 headers montados manualmente em
   `src/`, hoje sem um cliente HTTP único; ver `convencoes.md`).
3. `ArchSmart-web/src/proxy.ts` roda antes de qualquer rota não-pública: ele
   chama `supabase.auth.getUser()` a cada requisição para decidir se
   redireciona para `/auth/login`. Essa chamada de rede ao Supabase é o que
   custa os ~83ms medidos em toda requisição feita por um usuário já logado.
4. Na API, `get_context` (`ArchSmart-api/app/core/security.py`) — dependência
   de todo endpoint autenticado — recebe o header, valida o JWT (localmente
   com `SUPABASE_JWT_SECRET` quando presente; senão, com uma chamada de rede
   ao Supabase, mais lenta — ver "Problema conhecido" no `ambiente.md`) e
   extrai `sub` (o `supabase_id`) do payload. `get_current_user`
   (`ArchSmart-api/app/api/users.py`), a casca de compatibilidade que existia
   sobre `get_context` para os endpoints ainda não convertidos, **foi apagada
   na Tarefa 15 da Seção 4** — hoje todo endpoint autenticado depende de
   `get_context`/`RequestContext` diretamente, ou de `get_repo`
   (`ArchSmart-api/app/db/repository.py`), que embrulha os dois.
5. Busca a linha de `User` cujo `supabase_id` bate com o do token, **e só
   pelo `supabase_id`**: o e-mail do payload nunca é critério de busca. Essa
   linha já carrega o `account_id` — é dali, e só dali, que o resto do
   request sabe de qual conta é o dado.
6. Cada endpoint acessa dado pelo `ScopedRepository` (`repo: ScopedRepository
   = Depends(get_repo)`), que aplica o filtro por `account_id` sozinho —
   `repo.query(Model)`/`repo.get(Model, id)` já vêm filtrados, e
   `repo.create(Model, **campos)` injeta `account_id`/`created_by` e
   descarta o que vier do cliente nessas duas chaves. Isso é o que a
   Seção 4 entregou; antes dela cada endpoint filtrava a query manualmente
   (`db.query(Model).filter(Model.account_id == current_user.account_id)`),
   sem verificação automática. `app/api/v1/routes/` continua não existindo
   — a reorganização por versão que uma versão anterior deste documento
   previa não aconteceu; as rotas continuam sob `/api/...`, sem
   versionamento (ver `ArchSmart-api/CLAUDE.md`, seção "Sobre `app/api/v1/`").

### Resolvido em 05/09/2026: o auto-link por e-mail em `app/api/users.py`

Até a Seção 4, `get_current_user` procurava usuário pelo **e-mail** do token
quando o `supabase_id` não batia com nada, e gravava o `supabase_id` do
portador naquela linha — entregando a conta a quem tivesse um token do
Supabase com aquele e-mail no payload. A mesma função também **criava** conta
e usuário novos quando nada batia.

O risco real dependia da opção *Authentication → Providers → Email → "Confirm
email"* do painel do Supabase, verificada ligada por Thiago em 24/08/2026 — ou
seja, a proteção morava fora do repositório.

**A Tarefa 2 da Seção 4 removeu os dois caminhos do resolvedor de
identidade** — o que cobre toda requisição autenticada. A resolução vive em
`app/core/security.py` e decide **só** pelo `supabase_id`; token que não
aponta para usuário existente é `401`. Provisionamento continua tendo rota
própria (`POST /api/auth/signup`, `POST /api/auth/complete-register`).

**O mesmo padrão continua vivo em `POST /api/auth/complete-register`**
(função `complete_register` em `ArchSmart-api/app/api/auth.py`, linhas
73-92 em 05/09/2026, terminando no `db.commit()` — cite a função, não só o
número, a Tarefa 15 já moveu esse bloco uma vez): quando o `supabase_id` não bate com
nada, o endpoint busca por e-mail e, se achar, vincula o `supabase_id` do
portador **e sobrescreve o `full_name`** da linha encontrada — guardado hoje
só pela mesma configuração de painel citada acima. Isso é um item de
segurança pendente, registrado aqui, não algo que esta tarefa fechou; o que
fazer com o caminho legado de migração é decisão de Thiago, não de uma
rodada de correção.

A regressão do resolvedor de identidade está coberta por
`ArchSmart-api/tests/api/test_identidade.py::test_nao_vincula_conta_alheia_por_email`
e `::test_nao_cria_conta_sozinho`.

## Onde mora a regra de negócio

Hoje, majoritariamente em `ArchSmart-api/app/services/`:

- `budget_calculator.py` — cálculo de quantidade e valores de orçamento.
- `financial_service.py` — lançamentos financeiros.
- `ai_service.py` — integração com o Gemini (extração de dado de produto).
- `auth_service.py` — validação remota de token quando a validação local
  falha ou `SUPABASE_JWT_SECRET` está ausente.

Isso é o alvo do Art. 5 e já é seguido na maior parte do código — mas não em
toda parte: o frontend hoje decide, sozinho, o limite de projetos do plano
quando a API não devolve o campo esperado (`const planLimit = data?.plan_limit ?? 2`,
em `src/app/(dashboard)/dashboard/page.tsx` e
`src/app/(dashboard)/projects/page.tsx`) e mostra o texto fixo "Plano Solo"
independente do plano real da conta — violação registrada do Art. 3, listada
em `convencoes.md`, ainda não corrigida.

## Escopo por conta — o que a Seção 4 mudou

Antes da Seção 4, cada endpoint filtrava manualmente por `account_id` — não
existia verificação automática nem um lugar único onde esse filtro fosse
garantido. A disciplina da época era: toda query nova filtra por
`account_id` explicitamente, e todo endpoint novo ganhava um teste em
`ArchSmart-api/tests/isolation/` que provava que a conta B não via o dado da
conta A. Isso vinha de uma correção anterior: uma auditoria de 23/08/2026
encontrou 14 endpoints vazando dado entre contas — 6 de orçamento sem filtro
por conta, 5 ações do portal do cliente sem verificar o token de acesso, 2
sem autenticação nenhuma, e 1 em `financial.py` gravando o `project_id`
enviado pelo cliente sem validar a conta dona. As 14 falhas foram corrigidas
na Seção 1 (merge `f190a07`, 24/08/2026); a suíte de testes contra Postgres
real veio junto, substituindo a confiança que a suíte antiga (`app/tests/`,
baseada em `MagicMock` como sessão de banco, 83 testes) dava sem merecer —
um mock não tem "linha de outra conta" para vazar, então nunca teria pego
essas 14 falhas.

Por que a disciplina manual não bastava: nada impedia um endpoint novo de
esquecer o filtro — foi exatamente esse esquecimento que causou as 14 falhas
de 23/08/2026. Uma lista de testes escrita à mão cobre as rotas que existiam
quando alguém lembrou de escrever o teste, não as que vierem depois.

**A Seção 4 entregou os dois pedaços que faltavam.** `RequestContext`
(`ArchSmart-api/app/core/security.py`) resolve a identidade uma vez por
request; `ScopedRepository` (`ArchSmart-api/app/db/repository.py`) é a
camada de acesso a dado que aplica o filtro por `account_id`
automaticamente — `repo.query(Model)`/`repo.get(Model, id)` já vêm
filtrados, e um model sem `account_id` levanta `EscopoImpossivel` em vez de
devolver linha de outra conta por engano. `tests/isolation/test_todas_as_rotas.py`
substituiu a lista escrita à mão: ele percorre as rotas registradas em
`app/main.py` e testa cada uma automaticamente, então uma rota nova com id
na URL sem entrada em `RECURSOS` falha, em vez de simplesmente não ter
teste. A suíte de isolamento tem hoje 74 testes
(`pytest tests/isolation -q --collect-only` em `ArchSmart-api`), contra os
29 de antes da Seção 4.

As 30 chamadas de `db.query(` que restam em `app/` (29 delas de verdade — a
trigésima é uma docstring citando o número antigo) são exceção documentada,
não esquecimento: portal público (`public.py`, justificado pelo docstring do
módulo), catálogo global ou tabela sem `account_id` (`product_router.py`,
`users.py`), pré-sessão (`auth.py`, `leads.py`, `security.py`), ou a própria
definição do `ScopedRepository` (`repository.py`). A contagem completa, com
o motivo de cada grupo, está na nota da Seção 4 em `PROGRESS.md`.

## Busca de dado no frontend — o que existe e o que não existe

TanStack Query **está** instalado, configurado e montado — não é um alvo
futuro. `QueryProvider` (`src/components/providers/QueryProvider.tsx`) fica
em `src/app/(dashboard)/layout.tsx`, com `staleTime` de 30s e `gcTime` de 5
min. Hoje 3 dos 144 arquivos `.ts`/`.tsx` de `src/` o usam
(`LibraryContent.tsx` e `PresentationsTab.tsx` com `useQuery`,
`BatchNormalizeModal.tsx` com `useQueryClient` para invalidar cache após uma
mutação). Os outros 141 arquivos de `src/` (componentes, hooks e páginas que
não usam TanStack Query) buscam dado de outra forma — tipicamente
`useEffect` + `fetch` manual — e refazem a chamada a cada navegação: cache
"quase inexistente", não "inexistente".

O que **não** existe ainda é a pasta `lib/query/` com convenção de
`queryKeys` padronizada, nem `lib/api/` com um cliente HTTP único — ambos são
alvo da **Seção 5**. Até lá, tela nova segue o padrão manual do arquivo
vizinho mais parecido (ver `../../ArchSmart-web/CLAUDE.md`), mas busca dado
via `useQuery`, nunca `useEffect` + `fetch`.

## O que está medido e é problema conhecido

Do clique até os dados na tela, com sessão real, medido em navegador:
**Projetos 3,0s · Biblioteca 3,6s · Financeiro 4,3s.** Contribuintes
identificados:

- `proxy.ts` chama `supabase.auth.getUser()` a cada requisição de um usuário
  logado — cerca de 83ms por requisição, mesmo em páginas que não precisam
  de dado fresco de sessão.
- Zero uso de `next/dynamic`/`React.lazy` em `src/` — toda tela carrega o
  bundle inteiro de suas dependências de uma vez.
- Cache quase inexistente (seção anterior) — a maioria das telas refaz a
  chamada de rede a cada navegação, mesmo para dado que não mudou.

No backend, `app/models/all_models.py` (26 tabelas, um arquivo único) tem só
4 colunas com `index=True` hoje, nenhuma delas `account_id` — a coluna mais
consultada em praticamente toda query do sistema (todo filtro por conta faz
um full scan, não um lookup indexado). `app/` como um todo tem 117 chamadas
diretas a `db.query()` (acesso a dado espalhado pelos módulos de rota, sem
camada intermediária) e 58 `print()` (nenhum logger estruturado). Índices
derivados das queries reais são alvo da Seção 4.

Nenhum destes é hipotético — são os números por trás de cada proibição
correspondente em `convencoes.md`.

## Onde ler mais

- [`convencoes.md`](convencoes.md) — o que é obrigatório e proibido, com o
  porquê de cada proibição.
- [`ambiente.md`](ambiente.md) — como subir cada peça localmente.
- [`../../CLAUDE.md`](../../CLAUDE.md), [`../../ArchSmart-api/CLAUDE.md`](../../ArchSmart-api/CLAUDE.md),
  [`../../ArchSmart-web/CLAUDE.md`](../../ArchSmart-web/CLAUDE.md),
  [`../../extension/CLAUDE.md`](../../extension/CLAUDE.md) — regras por
  camada.
- [`../../spec-kit-2/memory/constitution.md`](../../spec-kit-2/memory/constitution.md) —
  os 15 artigos.
- [`../../PROGRESS.md`](../../PROGRESS.md) — o que cada seção da
  reestruturação entrega e o estado atual de cada uma.
