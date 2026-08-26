# Ambientes online — roteiro de painel

## Estado (25/08/2026)

**Nenhum passo deste documento foi executado ainda.** Isto é um roteiro, não
um registro do que já existe. Todos os passos abaixo exigem acesso
administrativo ao Render, à Vercel, ao Supabase ou ao GitHub — só o dono das
contas (Thiago) consegue executá-los; nenhum agente de IA tem esse acesso.

O que já existe, confirmado nesta branch:

- A branch `staging` existe no GitHub, criada a partir de `origin/develop`,
  hoje apontando para o mesmo commit que `develop`. **Nenhum ambiente está
  ligado a ela**: não há serviço no Render, não há projeto Supabase de
  staging, não há preview da Vercel configurado para ela.
- `.github/workflows/ci.yml` existe nesta branch, com três jobs cujo nome
  vira check obrigatório na seção 5 abaixo.

Depois de cada seção executada, volte aqui e apague o "não foi executado
ainda" da linha correspondente na tabela final — é o registro de que aquele
pedaço passou de alvo para realidade (ver a regra "documento afirma só o que
é verdade hoje" em [`../README.md`](../README.md)).

## 1. Serviço de staging no Render

1. No painel do Render, **New → Web Service**.
2. Conectar o mesmo repositório GitHub já usado pelo serviço de produção.
3. **Branch:** `staging`.
4. **Root Directory:** `ArchSmart-api`.
5. **Runtime:** Docker — usar o `Dockerfile` que já existe em
   `ArchSmart-api/Dockerfile`, sem criar um novo. Não preencher build/start
   command manualmente: o `CMD` do Dockerfile (linha 11) já sobe
   `python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.
6. **Variáveis de ambiente:** as mesmas chaves listadas em
   `ArchSmart-api/.env.example` (`DATABASE_URL`, `SUPABASE_URL`,
   `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`,
   `GEMINI_API_KEY`), mais `FRONTEND_URL` — que **não** está em
   `.env.example`, mas é lida por `app/core/config.py` (usada em
   redirecionamentos; sem ela, cai no default
   `http://localhost:3000`, errado para staging). Dois valores **não são os
   de produção**:
   - `DATABASE_URL` → a connection string do projeto Supabase de staging
     criado na seção 3 deste documento (ainda não existe — anote aqui
     quando existir).
   - `FRONTEND_URL` → a URL de preview da Vercel criada na seção 2 (também
     ainda não existe — anote aqui quando existir).

   As demais variáveis (`SUPABASE_JWT_SECRET`, `GEMINI_API_KEY`) também
   precisam apontar para o projeto Supabase de staging, não para o de
   produção — peça os valores a quem tiver acesso ao painel do projeto
   novo, o mesmo fluxo que `.env.example` já descreve para desenvolvimento
   local.
7. **Comando de deploy:** configurar o *Pre-Deploy Command* (ou
   equivalente — o nome exato do campo pode mudar entre planos do Render;
   confira no próprio painel) para rodar `alembic upgrade head` **antes** de
   subir a API. É esse passo que torna a migração de staging automática a
   cada deploy, em vez do procedimento manual descrito em
   [`deploy.md`](deploy.md#migração-de-banco).
8. Salvar e disparar o primeiro deploy.
9. **Registrar aqui a URL resultante quando ela existir** (formato esperado:
   `https://<algo>.onrender.com` — o nome exato só existe depois de criado o
   serviço):

   ```
   URL da API de staging: (a preencher)
   ```

## 2. Preview automático da Vercel

Recurso já disponível no plano atual da Vercel — hoje não usado. Não requer
plano novo nem serviço novo, só habilitar uma opção existente no projeto do
frontend.

1. No painel da Vercel, abrir o projeto do frontend (`ArchSmart-web`).
2. Em **Settings → Git** do projeto (o rótulo exato pode variar conforme a
   versão do painel — procure a opção de deployments automáticos por
   branch/PR), confirmar que os deployments de preview para pull requests
   estão habilitados. É o padrão da Vercel para todo projeto conectado ao
   GitHub, mas não foi verificado nesta sessão (sem acesso ao painel) —
   confirme que não foi desligado, em vez de assumir.
3. Em **Settings → Environment Variables**, adicionar (ou editar, se já
   existir para outro escopo) `NEXT_PUBLIC_API_URL` com escopo **Preview**
   apontando para a URL da API de staging registrada na seção 1 acima.
   **Produção continua saindo de `main`** com o `NEXT_PUBLIC_API_URL` de
   produção já configurado hoje (escopo Production) — este passo não altera
   isso.
4. Abrir um PR contra `staging` para confirmar que o preview é gerado e
   registrar a URL aqui quando existir (o formato muda a cada deploy —
   `https://<projeto>-git-<branch>-<time>.vercel.app` é o padrão da Vercel,
   mas o valor exato só existe depois do primeiro preview):

   ```
   URL de preview (exemplo do primeiro PR contra staging): (a preencher)
   ```

## 3. Projeto Supabase de staging

1. No painel do Supabase, criar um **projeto novo**, separado do de
   produção. **Região:** `sa-east-1` (São Paulo) — mesma região do projeto
   de produção, ver [`deploy.md`](deploy.md#onde-cada-peça-roda-hoje).
2. Depois de criado, em **Database → Extensions**, habilitar a extensão
   `vector` — a tabela `documents` depende dela (`app/models/all_models.py`);
   sem a extensão, a migração que cria essa tabela falha.
3. Em **Project Settings → API**, copiar as três chaves para as variáveis
   correspondentes do serviço Render de staging (seção 1): `Project URL` →
   `SUPABASE_URL`, `anon public` → `SUPABASE_KEY`, `service_role` →
   `SUPABASE_SERVICE_ROLE_KEY`. Em **Project Settings → API → JWT Settings**,
   copiar o `JWT Secret` para `SUPABASE_JWT_SECRET`.
4. Em **Storage**, criar o bucket `secure-files` com as mesmas políticas do
   bucket de mesmo nome no projeto de produção — abra o projeto de produção
   em outra aba e reproduza as políticas de acesso (RLS) exibidas ali; este
   documento não lista as políticas porque não temos acesso ao painel de
   produção nesta sessão para copiá-las com exatidão (mesma ressalva que
   [`deploy.md`](deploy.md#variáveis-de-ambiente-e-segredos) já registra
   para outras configurações de painel).
5. **O schema deste projeto vem de `alembic upgrade head`, nunca da CLI do
   Supabase** (`supabase migration ...`) — ver
   [ADR 0004](decisoes/0004-alembic-fonte-unica-do-schema.md). O passo de
   deploy do Render (seção 1, item 7) já cobre isso a cada deploy; não rode
   migração da CLI do Supabase contra este projeto em nenhuma circunstância.
6. Em **Authentication → Providers → Email** *deste projeto novo* (de
   staging, não o de produção), confira se **"Confirm email"** está ligada
   e ligue se não estiver — é o mesmo estado do projeto de produção,
   confirmado por **Thiago no painel do Supabase em 24/08/2026**. O que este passo garante não é o estado da
   produção (já sabido), e sim que o projeto **novo** nasça igual: confira
   no painel deste projeto, não presuma o valor.

## 4. Banco de produção novo

Mesma receita da seção 3 acima (projeto Supabase novo, extensão `vector`,
bucket `secure-files`, "Confirm email" ligada), desta vez num projeto
Supabase novo **de produção** — não o de staging. O banco de produção atual
é descartado sem migração de dado, conforme
[ADR 0003](decisoes/0003-descartar-banco-atual-criar-novo.md).

**Pré-condição: só execute este passo depois de a esteira de staging (seções
1 a 3) estar de pé e verde** — é assim que a Seção 3 valida que a receita de
migrações funciona do zero antes de apostar produção nela.

1. Repita os passos 1–6 da seção 3, num projeto Supabase novo rotulado como
   produção.
2. Aponte a `DATABASE_URL` (e as demais chaves Supabase) do serviço Render
   de produção existente para o projeto novo.
3. **A migração roda pelo deploy** (mesmo *Pre-Deploy Command* configurado
   na seção 1, replicado no serviço de produção) — **não rode
   `alembic upgrade head` à mão** contra este banco. Rodar à mão reabre
   exatamente o risco que a [ADR 0003](decisoes/0003-descartar-banco-atual-criar-novo.md)
   descreve (divergência entre schema real e histórico de migrações).
4. Depois do primeiro deploy bem-sucedido, rode o seed com volume realista
   (`ArchSmart-api/tools/seed.py`, entregue por outra tarefa desta seção)
   para popular o banco novo, **se** for necessário dado de demonstração.

   > O seed **recusa** rodar contra host gerenciado: ele só aceita banco local
   > ou com nome terminado em `_test`/`_seed`. Para um banco de produção ou de
   > staging é preciso passar `--eu-sei-o-que-estou-fazendo`, de propósito —
   > ver [`ArchSmart-api/tools/README.md`](../../ArchSmart-api/tools/README.md).
   > Confira a `DATABASE_URL` antes: a flag desliga a única proteção que existe.

5. **Anote qual versão de Postgres o projeto novo nasceu com** (no painel,
   *Project Settings → Database*, ou `SHOW server_version;`) e registre-a aqui:

   | Ambiente | Postgres | Como foi obtido |
   |---|---|---|
   | Banco de teste (`docker-compose.test.yml`) | **16** | imagem `pgvector/pgvector:pg16` |
   | Stack Supabase local (`supabase start`) | **17** | a CLI rejeita 16; ver `supabase/config.toml` |
   | Staging (seção 3) | *a preencher* | — |
   | Produção nova | *a preencher* | — |

   Isso não é burocracia: hoje o banco de teste e a stack local já divergem por
   um major, porque o Supabase nunca ofereceu Postgres 16 e a CLI recusa esse
   valor. Se os projetos novos nascerem em 17, quem diverge passa a ser o banco
   de teste, e vale alinhar o `docker-compose.test.yml` — **numa tarefa
   dedicada**, não de passagem, porque trocar a imagem do Postgres dos testes
   é exatamente o tipo de mudança que precisa ser medida sozinha.

## 5. Branch protection nas três branches

> ⛔ **Bloqueado pelo plano do GitHub, não pela falta de executar.** Medido em
> 25/08/2026: o repositório é **privado num plano Free**, e nessa configuração
> branch protection e rulesets não existem.
>
> ```
> gh api repos/:owner/:repo/branches/main/protection     → 404
> gh api repos/:owner/:repo/rulesets
>   → 403 "Upgrade to GitHub Pro or make this repository public to enable this feature."
> gh pr view 3 --json mergeable,mergeStateStatus
>   → mergeable: MERGEABLE   mergeStateStatus: UNSTABLE
> ```
>
> `UNSTABLE` quer dizer: há check não-verde **e o merge continua permitido**.
> Enquanto isso durar, a esteira é um conselheiro, não um portão.
>
> **Decisão de Thiago, 26/08/2026: fica como está.** Nem GitHub Pro, nem
> repositório público. A Seção 3 foi mergeada com a esteira funcionando como
> conselheiro, e o custo assumido é que um PR vermelho pode entrar por
> distração. **Esta seção não é mais uma pendência a executar; é um roteiro
> guardado para o dia em que o plano mudar.**
>
> As duas saídas, se esse dia chegar:
>
> 1. **Tornar o repositório público.** Libera branch protection de graça. Antes
>    de fazer, varra o histórico atrás de segredo commitado — tornar público é
>    irreversível na prática, porque o que foi lido fica lido.
> 2. **Assinar o GitHub Pro.** Mantém privado e libera a mesma coisa.
>
> Feito um dos dois, o resto desta seção passa a ser executável como escrito.

Em **Settings → Branches** do repositório no GitHub, criar três regras — uma
para `main`, uma para `staging`, uma para `develop`.

Em **todas as três**, marcar:

- **Require a pull request before merging** — ligado.
- **Require status checks to pass before merging** — ligado, com estes três
  checks marcados como obrigatórios (nome exato, copiado de
  `.github/workflows/ci.yml`, incluindo o travessão `—`):
  - `Backend — testes contra Postgres real`
  - `Frontend — tipos, testes e catraca`
  - `Repositorio — progresso, links e sincronia`

  Os três nomes só aparecem na lista de checks disponíveis depois que o
  workflow rodar pelo menos uma vez em um PR contra a branch em questão —
  se a lista vier vazia, abra um PR de teste contra a branch primeiro.

Adicionalmente, **só em `main` e `staging`**:

- **Require branches to be up to date before merging** — ligado. Em
  `develop`, deixar desligado (é onde o trabalho de duas pessoas em paralelo
  se encontra; exigir atualização constante ali multiplica retrabalho de
  rebase sem o mesmo benefício que tem perto de produção).

## O que confirmar quando terminar

| Seção | O que confirma | Comando ou tela |
|---|---|---|
| 1. Render (staging) | API de staging responde | `curl https://<api-staging>/health` devolvendo `{"status":"ok"}` (URL registrada na seção 1 acima) |
| 2. Vercel (preview) | Preview é gerado a partir de PR contra `staging` | Abrir um PR contra `staging` e conferir, na aba *Checks* do PR ou no painel da Vercel, o link do deployment de preview |
| 3. Supabase (staging) | Projeto novo, schema correto, e-mail confirmado | `alembic current` (rodado com `DATABASE_URL` do projeto de staging) mostra a revisão head; em *Authentication → Providers → Email* do painel, "Confirm email" aparece ligada |
| 4. Banco de produção novo | API de produção responde contra o banco novo | `curl https://arch-smart-api.onrender.com/health/db` devolvendo confirmação de banco vivo, **depois** de repontar o Render para o projeto novo |
| 5. Branch protection | As três branches exigem PR e os três checks | Em *Settings → Branches* do GitHub, cada uma das três regras lista os três nomes de job como *Required status checks*; tentar um push direto (sem PR) para qualquer uma das três deve ser recusado pelo GitHub |

## Onde ler mais

- [`deploy.md`](deploy.md) — onde cada peça roda hoje e como reverter um
  deploy.
- [`decisoes/0003-descartar-banco-atual-criar-novo.md`](decisoes/0003-descartar-banco-atual-criar-novo.md) —
  por que o banco de produção atual é descartado em vez de migrado.
- [`decisoes/0004-alembic-fonte-unica-do-schema.md`](decisoes/0004-alembic-fonte-unica-do-schema.md) —
  por que o schema nunca vem da CLI do Supabase.
- [`decisoes/0005-tres-branches-develop-staging-main.md`](decisoes/0005-tres-branches-develop-staging-main.md) —
  por que existem três branches e não duas.
- [`arquitetura.md`](arquitetura.md), seção "pendência de segurança
  conhecida" — por que a configuração de "Confirm email" decide a urgência
  (não o conteúdo) da correção de `app/api/users.py`, e por que o achado
  continua aberto mesmo com ela ligada.
