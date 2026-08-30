# Ambientes online — roteiro de painel

## Estado (30/08/2026)

**A infraestrutura foi criada; falta a primeira carga de código chegar nela.**
Thiago provisionou, do zero, dois serviços no Render, dois projetos Supabase e
um projeto novo na Vercel. Os passos que restam exigem acesso administrativo a
esses painéis — só o dono das contas consegue executá-los; nenhum agente de IA
tem esse acesso.

O que existe hoje, **medido em 29–30/08/2026** e não apenas afirmado:

| Peça | Estado medido | Como foi medido |
|---|---|---|
| API de staging | no ar, respondendo | `curl https://arqsmart-staging.onrender.com/health` → `{"status":"ok"}` (cold start de 31 s) |
| API de produção | no ar, respondendo | `curl https://arqsmart-prod.onrender.com/health` → `{"status":"ok"}` (cold start de 31 s) |
| Supabase staging (`ipbhtqzybgdltewwnvnl`) | **virgem** — Postgres 17.6 | sonda somente-leitura: `tabelas em public: 0`, `alembic_version` inexistente, `auth.users: 0` |
| Supabase produção (`wokgnojyrpzndtxzvfcz`) | **virgem** — Postgres 17.6 | idem |
| Vercel (projeto `arqsmart`) | **produção no ar** | `curl https://www.arqsmart.com.br` → `200`, `title: Arch Smart`, 69 KB com `/_next/`; o apex redireciona (`308`) |
| Domínio antigo | desativado | `https://www.archsmart.com.br` → `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` |

**O código no ar ainda é o antigo, nos dois serviços.** Fingerprint por
`/openapi.json` em 29/08/2026: staging expõe 57 rotas, produção 58, e a rota a
mais em produção é `/api/products/seed-captured` — que existe **só** na branch
`main` (`git show origin/main:ArchSmart-api/app/api/routers/product_router.py`
→ 1 ocorrência; `staging` e `develop` → 0). Confirma que cada serviço está
ligado à branch certa, e que o conteúdo dessas branches é anterior à Seção 3:

```
main     4f5046c  2026-07-18   81 commits atrás de develop   26 migrações
staging  6226ed9  2026-08-24   26 commits atrás de develop   26 migrações, sem ci.yml
develop  dc41de2  2026-08-26                                 27 migrações
```

> ⚠️ Enquanto produção rodar o código de `main`, ela expõe
> `GET /api/products/seed-captured` — **sem autenticação e gravando no banco**
> (cria `Account`, `ProductState` e `ProductOrigin`). É um dos dois endpoints
> sem autenticação que a Seção 1 fechou. Sai do ar no primeiro deploy do código
> novo; até lá, é mais uma razão para a ordem `develop → staging → main` não
> ser negociável.

Depois de cada seção executada, volte aqui e atualize a linha correspondente na
tabela final — é o registro de que aquele pedaço passou de alvo para realidade
(ver a regra "documento afirma só o que é verdade hoje" em
[`../README.md`](../README.md)).

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
     (`ipbhtqzybgdltewwnvnl`), criado na seção 3 deste documento.

     > **Host pooler, porta 5432.** Os dois pedaços têm motivos diferentes, e
     > os dois foram medidos em 30/08/2026.
     >
     > **O host: nunca a conexão direta.**
     >
     > ```
     > aws-0-sa-east-1.pooler.supabase.com   IPv4 15.229.150.166   IPv6 nao resolve
     > db.<ref>.supabase.co                  IPv4 nao resolve      IPv6 2600:1f1e:...
     > ```
     >
     > A conexão direta é **IPv6-only** no tier gratuito: numa rede sem IPv6 ela
     > nem resolve o nome. É essa a causa dos conflitos que aparecem ao seguir
     > tutoriais que mandam usar `db.<ref>.supabase.co:5432` — ali o problema é
     > o **host**, não a porta.
     >
     > **A porta: 5432 (*session*), não 6543 (*transaction*).** No modo
     > transaction o Supavisor multiplexa vários clientes sobre a mesma conexão
     > de servidor, e **um `SET` feito por um cliente sobrevive ao disconnect
     > dele e vale para os próximos**. Não é teórico: em 30/08/2026 uma sonda
     > deste repositório abriu conexão na 6543 com
     > `psycopg2.set_session(readonly=True)`, e o
     > `default_transaction_read_only = on` ficou grudado no backend
     > compartilhado. O deploy seguinte de staging pegou esse backend e morreu:
     >
     > ```
     > psycopg2.errors.ReadOnlySqlTransaction:
     >   cannot execute CREATE TABLE in a read-only transaction
     > [SQL: CREATE TABLE alembic_version (...)]
     > ==> Exited with status 1
     > ```
     >
     > Diagnóstico, para reconhecer o padrão de novo:
     >
     > ```
     > pg_settings -> setting='on'  source='session'  reset_val='off'
     >
     > 8 conexoes novas na 6543:  on,  todas backend_pid=98513
     > 8 conexoes novas na 5432:  off, backend limpo
     > ```
     >
     > `source='session'` com `reset_val='off'` é a assinatura: não veio de
     > config nem do painel, veio de um `SET` que vazou. Na 5432 cada cliente
     > tem sua própria sessão e nada disso acontece.
     >
     > A armadilha mais citada do transaction pooler — *prepared statements* do
     > lado do servidor — de fato **não** afeta esta API, que usa
     > `psycopg2-binary` síncrono (`requirements.txt:51`). Foi por olhar só para
     > essa armadilha que a orientação anterior aqui dizia "6543", e estava
     > errada: o vazamento de estado de sessão é outro eixo, e é o que quebra.
   - `FRONTEND_URL` → `https://www.arqsmart.com.br` em produção. Para staging,
     a URL do ambiente de preview da Vercel (seção 2).

   As demais variáveis (`SUPABASE_JWT_SECRET`, `GEMINI_API_KEY`) também
   precisam apontar para o projeto Supabase de staging, não para o de
   produção — peça os valores a quem tiver acesso ao painel do projeto
   novo, o mesmo fluxo que `.env.example` já descreve para desenvolvimento
   local.
7. **Comando de deploy: nada a configurar — e isso é decisão registrada, não
   esquecimento.** Este passo pedia o *Pre-Deploy Command* do Render rodando
   `alembic upgrade head` antes de subir a API. Em 30/08/2026 Thiago verificou
   no painel que **esse campo é recurso de instância paga**, e os dois serviços
   rodam no free tier.

   A migração passou a rodar no `CMD` do `ArchSmart-api/Dockerfile`, antes do
   uvicorn e ligada a ele por `&&` — ver
   [ADR 0007](decisoes/0007-migracao-no-start-do-container.md). Não há campo de
   painel para preencher aqui: o mecanismo vive no repositório e chega junto com
   o código, o que é uma melhora sobre o plano original (era configuração de
   painel, invisível a partir do código).

   Consequência que vale saber antes do primeiro deploy: **se a migração falhar,
   o serviço não sobe.** É deliberado. Um deploy vermelho aqui é a migração
   avisando, não o Render quebrando.
8. Salvar e disparar o primeiro deploy.
9. URL resultante:

   ```
   URL da API de staging: https://arqsmart-staging.onrender.com
   ```

## 2. Preview automático da Vercel

Recurso já disponível no plano atual da Vercel. Não requer plano novo nem
serviço novo, só habilitar uma opção existente no projeto do frontend.

> **Estado em 30/08/2026:** o projeto na Vercel se chama **`arqsmart`**, o
> domínio **`www.arqsmart.com.br`** está anexado e **produção está no ar** —
> `curl` devolve `200`, `title: Arch Smart`, 69 KB com referências a `/_next/`.
> O apex `arqsmart.com.br` redireciona para o www (`308`).
>
> ⚠️ **Chegar aqui exigiu recriar o projeto na Vercel, e o motivo vale
> registrar.** O primeiro projeto tinha tudo aparentemente certo — Root
> Directory `ArchSmart-web`, Framework Preset `Next.js`, domínio atribuído a um
> deployment `Ready` — e mesmo assim **todo build produzia zero arquivos**:
>
> ```
> Running "vercel build"
> Vercel CLI 59.3.0
>                        <- o log terminava aqui. Duração: 2–3 s.
> ```
>
> Sem `npm install`, sem `next build`, sem "Build Completed". Um build real
> desse projeto leva 41–45 s. Não adiantou desligar *Skip deployments*, nem
> redeployar sem cache, nem reatribuir o domínio. **Recriar o projeto
> resolveu.**
>
> Como diagnosticar isso rápido da próxima vez: **teste a URL própria do
> deployment**, não só o domínio custom. Se `https://<projeto>-<hash>-<time>.vercel.app`
> também dá 404, o problema é o build, não o domínio — e nenhuma quantidade de
> mexida em DNS ou alias vai resolver. Aqui isso custou várias horas
> investigando domínio à toa.
>
> Vale distinguir os dois erros da Vercel: **`NOT_FOUND`** é domínio ligado
> servindo um deployment vazio; **`DEPLOYMENT_NOT_FOUND`** é não existir
> deployment nenhum para aquele hostname — é o que uma branch sem push desde a
> criação do projeto devolve.

1. No painel da Vercel, abrir o projeto do frontend (`arqsmart`).
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

   > **Feito.** O projeto de staging é `ipbhtqzybgdltewwnvnl`, em
   > `aws-0-sa-east-1`, **Postgres 17.6**.
2. **Nada a fazer para a extensão `vector`.** Este passo dizia para habilitá-la
   no painel, afirmando que "sem a extensão, a migração que cria essa tabela
   falha". **Isso é falso**, e foi corrigido em 30/08/2026: a própria migração
   se encarrega —

   ```
   alembic/versions/9f8a3b2c1d4e_add_documents_table.py:30
       op.execute("CREATE EXTENSION IF NOT EXISTS vector")
   ```

   Verificado na prática: um `docker run` da imagem da API contra um Postgres
   vazio terminou com `extensao vector: habilitada` sem passo de painel nenhum
   (ver [ADR 0007](decisoes/0007-migracao-no-start-do-container.md), "Como
   saberemos se foi certo"). Habilitar à mão é inofensivo, mas desnecessário.
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
   [ADR 0004](decisoes/0004-alembic-fonte-unica-do-schema.md). O `CMD` do
   `Dockerfile` já cobre isso a cada start do contêiner
   ([ADR 0007](decisoes/0007-migracao-no-start-do-container.md)); não rode
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

   > **Feito.** O projeto de produção é `wokgnojyrpzndtxzvfcz`, em
   > `aws-0-sa-east-1`, **Postgres 17.6**.
2. Aponte a `DATABASE_URL` (e as demais chaves Supabase) do serviço Render
   de produção (`arqsmart-prod`) para o projeto novo. Vale aqui a mesma
   ressalva da seção 1, item 6: **host pooler na 5432**, nunca a 6543 (estado
   de sessão vaza entre clientes) nem a conexão direta
   `db.<ref>.supabase.co` (IPv6-only).
3. **A migração roda no start do contêiner**, pelo `CMD` do `Dockerfile`
   ([ADR 0007](decisoes/0007-migracao-no-start-do-container.md)) — **não rode
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

5. **Versão de Postgres de cada ambiente** — medida em 29/08/2026 com
   `SHOW server_version` via conexão direta aos dois projetos:

   | Ambiente | Postgres | Como foi obtido |
   |---|---|---|
   | Banco de teste (`docker-compose.test.yml`) | **16** | imagem `pgvector/pgvector:pg16` |
   | Stack Supabase local (`supabase start`) | **17** | a CLI rejeita 16; ver `supabase/config.toml` |
   | Staging (`ipbhtqzybgdltewwnvnl`) | **17.6** | `SHOW server_version` |
   | Produção (`wokgnojyrpzndtxzvfcz`) | **17.6** | `SHOW server_version` |

   Isso não é burocracia, e a previsão que estava escrita aqui se confirmou:
   **quem diverge agora é o banco de teste**, sozinho num major mais velho, já
   que os dois projetos novos nasceram em 17. Vale alinhar o
   `docker-compose.test.yml` — **numa tarefa dedicada**, não de passagem,
   porque trocar a imagem do Postgres dos testes é exatamente o tipo de mudança
   que precisa ser medida sozinha.

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

> ⚠️ **`/health/db` não prova schema — só conectividade.** Ele executa
> `SELECT 1` (`ArchSmart-api/app/main.py:67`) e responde
> `{"status":"ok","db":"up"}` contra um banco **completamente vazio**. Foi
> exatamente o que aconteceu em 29/08/2026: os dois serviços verdes nesse
> endpoint, e os dois bancos com `0` tabelas. A prova de schema é
> `alembic_version` bater com o head do repositório — nunca este `curl`.

| Seção | O que confirma | Comando ou tela |
|---|---|---|
| 1. Render (staging) | API de staging responde | `curl https://arqsmart-staging.onrender.com/health` → `{"status":"ok"}` |
| 2. Vercel (preview) | Preview é gerado a partir de PR contra `staging` | Abrir um PR contra `staging` e conferir, na aba *Checks* do PR ou no painel da Vercel, o link do deployment de preview |
| 3. Supabase (staging) | Projeto novo, **schema correto**, e-mail confirmado | `alembic current` (com a `DATABASE_URL` de staging) devolvendo `b77a9b5656c2`, que é o head único do repositório; em *Authentication → Providers → Email* do painel, "Confirm email" ligada |
| 4. Banco de produção novo | API de produção servindo o **schema novo** | Duas coisas, nesta ordem: `curl https://arqsmart-prod.onrender.com/health` → `{"status":"ok"}` (prova que a migração passou, porque o `&&` do `CMD` impede o uvicorn de subir se ela falhar — [ADR 0007](decisoes/0007-migracao-no-start-do-container.md)); e `alembic current` com a `DATABASE_URL` de produção devolvendo `b77a9b5656c2`. **Não use `/health/db` para isto** — ver o aviso acima |
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
