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
4. Na API, `Depends(get_current_user)` — definida em `ArchSmart-api/app/api/users.py`
   — recebe o header, valida o JWT (localmente com `SUPABASE_JWT_SECRET`
   quando presente; senão, com uma chamada de rede ao Supabase, mais lenta —
   ver "Problema conhecido" no `ambiente.md`) e extrai `sub` (o
   `supabase_id`) e o e-mail do payload.
5. Busca a linha de `User` cujo `supabase_id` bate com o do token. Essa linha
   já carrega o `account_id` — é dali, e só dali, que o resto do request
   sabe de qual conta é o dado.
6. Cada endpoint usa esse `account_id` para filtrar a query manualmente
   (`db.query(Model).filter(Model.account_id == current_user.account_id)`).
   Não existe hoje uma camada que torne esse filtro automático ou que
   detecte a ausência dele — é isso que a Seção 4 entrega com
   `ScopedRepository`/`RequestContext` (`app/api/v1/routes/` também não
   existe ainda; as rotas de hoje vivem sob `/api/...`, sem versionamento).

### Advertência: pendência de segurança conhecida em `app/api/users.py`

Antes de mexer em autenticação, leia esta seção inteira. Não é alarmismo —
é o comportamento real do código hoje, com linha exata.

Dentro de `get_current_user` (`ArchSmart-api/app/api/users.py`, função que
resolve a identidade em toda a API), quando **nenhum** usuário tem o
`supabase_id` do token:

```python
# If not found and we have email, try to find by email (Legacy/Migration)
if email:
    user = db.query(User).filter(User.email == email).first()
    if user:
        # Auto-link: Update supabase_id for this user
        print(f"[WARN] User found by email, linking supabase_id")
        user.supabase_id = supabase_id
        db.commit()
        db.refresh(user)
        return user
```

O código busca um usuário pelo **e-mail** do token e, se encontrar, grava o
`supabase_id` do portador do token naquela linha — entregando a conta a quem
quer que tenha um token do Supabase com aquele e-mail no payload. A extensão
de risco real (se um atacante consegue emitir um JWT com e-mail arbitrário,
ou se depende de o provedor de e-mail do Supabase estar configurado para
exigir verificação antes de aceitar login) depende de uma configuração do
projeto Supabase que só o dono do projeto pode checar — por isso isto está
registrado como pendência, não corrigido às pressas aqui.

A mesma função, um pouco abaixo, também **cria** usuário e conta novos do
zero quando nem `supabase_id` nem e-mail batem com nada — outro caminho que
depende da mesma configuração para ter o efeito esperado.

Isto tem tarefa própria; não está coberto por nenhuma das nove seções desta
reestruturação. Quem for tocar em `app/api/users.py` por qualquer outro
motivo precisa saber que este comportamento existe **antes** de editar o
arquivo, para não o esconder dentro de uma mudança não relacionada nem
assumir que o arquivo já está seguro.

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

## Escopo por conta hoje, e o que a Seção 4 muda

Hoje: cada endpoint filtra manualmente por `account_id` — não existe
verificação automática nem um lugar único onde esse filtro é garantido. A
disciplina atual é: toda query nova filtra por `account_id` explicitamente, e
todo endpoint novo ganha um teste em `ArchSmart-api/tests/isolation/` que
prova que a conta B não vê o dado da conta A. Hoje esses testes existem e
passam — 29 testes ao todo (`pytest -q` na raiz de `ArchSmart-api`), rodando
contra Postgres real em Docker, não contra sessão mockada.

Isso é o resultado de uma correção recente: uma auditoria de 23/08/2026
encontrou 14 endpoints vazando dado entre contas — 6 de orçamento sem filtro
por conta, 5 ações do portal do cliente sem verificar o token de acesso, 2
sem autenticação nenhuma, e 1 em `financial.py` gravando o `project_id`
enviado pelo cliente sem validar a conta dona. As 14 falhas foram corrigidas
na Seção 1 (merge `f190a07`, 24/08/2026); a suíte de 29 testes contra
Postgres real veio junto, substituindo a confiança que a suíte antiga
(`app/tests/`, baseada em `MagicMock` como sessão de banco, 83 testes) dava
sem merecer — um mock não tem "linha de outra conta" para vazar, então nunca
teria pego essas 14 falhas.

O que falta, e é alvo da **Seção 4**: `RequestContext` (identidade resolvida
uma vez por request) e `ScopedRepository` (camada de acesso a dado que aplica
o filtro por `account_id` automaticamente, tornando o erro estruturalmente
difícil em vez de apenas disciplinado). Nenhum dos dois existe hoje no
código.

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
