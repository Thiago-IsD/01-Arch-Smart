# Deploy

Onde a Arq Smart roda hoje, como uma mudança chega lá, e como desfazer uma
mudança ruim. Descreve o **estado atual**, 24/08/2026 — a Seção 3 muda boa
parte disto (branch `staging`, CI, banco de produção novo); cada mudança
futura está marcada como tal, nunca descrita como já existindo.

## Onde cada peça roda hoje

| Peça | Onde | Como foi confirmado |
|---|---|---|
| `ArchSmart-web` (frontend) | Vercel | Decisão da constitution (Art. 14). O domínio de produção, `https://www.archsmart.com.br`, está confirmado em `extension/popup.js` (`ENVIRONMENTS.prod.web`). **Não confirmado por arquivo**: este repositório não tem `vercel.json` nem outra config que prove a hospedagem exata — ver a mesma ressalva em [`arquitetura.md`](arquitetura.md). Se precisar confirmar como o projeto está configurado na Vercel (build command, variáveis de ambiente, domínio custom), pergunte ao time em vez de assumir. |
| `ArchSmart-api` (backend) | Render, tier gratuito | URL de produção `https://arch-smart-api.onrender.com`, pingada a cada 10 min por `.github/workflows/keep-alive.yml` (o tier gratuito do Render dorme após ~15 min sem tráfego, cold start de ~20s). |
| Banco (Postgres) | Supabase, projeto do time, região São Paulo (`aws-1-sa-east-1.pooler.supabase.com`) | Host confirmado em `spec-kit-2/auditoria-codigo-2026-08-23.md` (`ArchSmart-api/.env.example` traz só um placeholder desde a Seção 2); `.github/workflows/keep-db-alive.yml` toca o banco 2x ao dia (o tier gratuito do Supabase pausa o projeto após ~7 dias sem uso). O mesmo projeto Supabase também é o Auth — não há banco de aplicação separado do banco de autenticação hoje. |

Não existe hoje um ambiente de staging: **todo `git push`/merge para `main` é o caminho direto para produção**, tanto no Vercel quanto no Render (comportamento assumido a partir da configuração de deploy contínuo de cada plataforma — não confirmado por um arquivo de config neste repositório, mesma ressalva da tabela acima).

## A esteira hoje: nada além de dois workflows de keep-alive

`.github/workflows/` tem exatamente dois arquivos, e nenhum dos dois faz build, teste ou deploy:

- **`keep-alive.yml`** — `curl` em `/health` a cada 10 minutos, só para evitar o cold start do Render.
- **`keep-db-alive.yml`** — `curl` em `/health/db` (que executa `SELECT 1`) 2x ao dia, só para evitar a pausa do Supabase.

**Não existe CI que rode teste, lint ou build antes de mergear.** Não existe branch protegida. Não existe ambiente de staging. Um merge para `main` vai para produção sem nenhum portão automático no meio — a Seção 3 é quem constrói isso (ver "O que a Seção 3 muda", abaixo).

## Variáveis de ambiente e segredos

Backend e frontend usam `.env`/`.env.local`, nunca versionados — ver
[`ambiente.md`](ambiente.md) para a lista completa de cada um. Em produção,
essas variáveis são configuradas direto no painel do Render e da Vercel (não
verificado por acesso a esses painéis nesta sessão — se precisar confirmar
os valores exatos configurados hoje em produção, peça a alguém do time).

## Migração de banco

O Dockerfile de `ArchSmart-api` (`CMD python -m uvicorn app.main:app ...`)
**não roda `alembic upgrade` automaticamente**. Hoje, aplicar uma migração em
produção é um passo manual: alguém roda `alembic upgrade head` com a
`DATABASE_URL` de produção antes ou depois do deploy do código que a
introduziu, coordenando o momento à mão. Isso muda na Seção 3 (migração
automática no deploy de staging).

### Mudança de schema simples (uma migração)

```
cd ArchSmart-api
.\venv\Scripts\Activate.ps1
alembic revision --autogenerate -m "descricao_da_mudanca"
```

Revise o arquivo gerado em `alembic/versions/` antes de aplicar —
`--autogenerate` erra em rename de coluna e em `Enum`. Aplique local/staging
antes de produção:

```
alembic upgrade head
```

### Mudança de schema grande, em passos separados

Para qualquer mudança que não possa ser uma única migração "big bang" contra
um banco com dado real — o caso concreto é a migração de `account_id` em 10
tabelas que a Seção 4 vai escrever — o procedimento é sempre em passos
separados, cada um sua própria migração, cada um verificado antes do
próximo:

1. **Adicionar a coluna nula.** `ALTER TABLE ... ADD COLUMN account_id UUID NULL` — nula de propósito: uma coluna `NOT NULL` numa tabela com linhas existentes falha na hora, ou trava a tabela inteira enquanto preenche um valor default.
2. **Backfill em lotes.** Um script (`ArchSmart-api/tools/`, nunca uma migração do Alembic rodando lógica de negócio) preenche a coluna nova em lotes pequenos (paginado por `id`, não a tabela inteira de uma vez) — evita travar a tabela inteira numa única transação longa contra um banco de produção em uso.
3. **Verificar zero nulos.** `SELECT count(*) FROM tabela WHERE account_id IS NULL` — só avança para o próximo passo se o resultado for `0`. Se não for, o backfill não terminou; não force o próximo passo.
4. **`NOT NULL` + FK + índice, numa migração separada.** Só depois do passo 3 confirmar zero nulos: `ALTER COLUMN account_id SET NOT NULL`, a constraint de chave estrangeira e o índice, todos numa migração que só roda depois que as anteriores já rodaram e foram verificadas.

Cada um dos quatro passos é commitado e aplicado separadamente — nunca os
quatro numa migração só. Se o passo 2 (backfill) falhar ou for interrompido
no meio, os passos 1 e 3 continuam válidos; recomeçar o backfill não exige
desfazer nada.

## Como reverter em 5 minutos

Comandos, na ordem. Rode o smoke test (último bloco) depois de qualquer
reversão, antes de considerar resolvido.

### 1. Reverter o código (frontend e/ou backend)

```
git log --oneline -5 main
git revert --no-edit <sha-do-commit-ou-merge-problematico>
git push origin main
```

Isso desfaz a mudança e sobe um novo commit em `main` — **assumindo que
Vercel e Render fazem deploy automático a partir de `main`** (comportamento
assumido, não confirmado por arquivo de config neste repositório, ver
"Onde cada peça roda hoje" acima). Se o deploy automático não disparar
sozinho em 1–2 minutos, o próximo passo é o painel de cada plataforma:

- **Vercel** — **procedimento esperado, não verificado** (sem acesso ao
  painel nesta sessão): Dashboard do projeto → aba *Deployments* → localizar
  o deployment anterior ao problema → **Promote to Production**.
- **Render** — **procedimento esperado, não verificado** (sem acesso ao
  painel nesta sessão): Dashboard do serviço → aba *Events*/*Deploys* →
  localizar o deploy anterior ao problema → **Rollback** (ou **Manual
  Deploy** apontando para o commit anterior, se não houver botão de
  rollback direto).

### 2. Reverter uma migração de banco

```
cd ArchSmart-api
.\venv\Scripts\Activate.ps1
alembic current
alembic downgrade -1
```

Confirme antes que `DATABASE_URL` no ambiente aponta para o banco certo
(produção, staging ou local) — `alembic current` mostra a revisão aplicada
agora, compare com o que você espera antes de rodar `downgrade`.
**Verificado em 24/08/2026** (Seção 3, Tarefa 2, após a receita de migrações
voltar a criar o banco do zero): 26 das 27 migrações em `alembic/versions/`
têm `downgrade()` com corpo não vazio — checado percorrendo a AST de cada
arquivo e comparando o corpo da função `downgrade` com um `pass` isolado
(`grep` sozinho não distingue um `pass` real de um `downgrade()` com só
comentário e `pass`). A exceção é `737128c96b28_remove_legacy_auth.py`, cujo
`upgrade()` também é vazio (revisão no-op, sem risco operacional).
**Não verificado**: se
a lógica de cada `downgrade()` reverte o dado sem perda — não auditamos
migração por migração. Se a migração revertida fez backfill de dado (passo
2 do procedimento acima), o `downgrade` de schema não desfaz o backfill
sozinho.

**Nunca** rode `downgrade` de uma migração que já rodou o passo 4
(`NOT NULL` + FK + índice) do procedimento em passos separados sem
primeiro confirmar que nenhuma linha nova depende da coluna já não ser
nula — reverter o schema não reverte o comportamento da aplicação que
passou a exigir a coluna preenchida.

### 3. Smoke test pós-reversão

Comandos abaixo escritos para Git Bash — é o shell em que a saída colada nesta
seção foi obtida. No PowerShell 5.1 (shell de referência do repositório, ver
[`ambiente.md`](ambiente.md)), `curl` é um alias de `Invoke-WebRequest` e não
aceita `-o`/`-w` nesse formato; use `curl.exe` e `NUL` no lugar de
`/dev/null`:

```
curl https://arch-smart-api.onrender.com/health
curl https://arch-smart-api.onrender.com/health/db
curl -o /dev/null -w "%{http_code}\n" https://www.archsmart.com.br
```

No PowerShell 5.1:

```
curl.exe https://arch-smart-api.onrender.com/health
curl.exe https://arch-smart-api.onrender.com/health/db
curl.exe -o NUL -w "%{http_code}`n" https://www.archsmart.com.br
```

Espera-se `{"status":"ok"}` no primeiro, confirmação de banco vivo no
segundo, `200` no terceiro. Nenhum dos três foi executado nesta sessão
contra produção — são os mesmos endpoints já documentados em
[`ambiente.md`](ambiente.md) para o ambiente local; contra produção, o
comportamento esperado é o mesmo, não confirmado aqui.

## O que a Seção 3 muda

Nada do que está descrito acima como "hoje" continua igual depois da Seção
3. Ela entrega:

- **CI que barra merge** — lint, tipos, testes contra Postgres em Docker,
  teste de isolamento entre contas, varredura de literais proibidos,
  validador de contraste, verificação de doc de módulo, consistência do
  `PROGRESS.md`. Hoje nenhum desses portões existe.
- **Branch `staging`, com ambiente online** — API de staging separada no
  Render, projeto Supabase de staging separado, preview automático da
  Vercel (recurso já disponível na plataforma, não usado hoje). Fluxo passa
  a ser `feature/xyz → develop → staging → main` (ver
  [`decisoes/0005-tres-branches-develop-staging-main.md`](decisoes/0005-tres-branches-develop-staging-main.md)).
  Migração passa a rodar automaticamente no deploy de staging; produção só
  recebe depois de validado lá.
- **Postgres local em Docker com a stack Supabase completa** (Auth, Storage,
  Studio, via CLI do Supabase) — hoje o Postgres em Docker existe só para a
  suíte de testes do backend, sem Auth nem Storage.
- **Banco de produção novo**, criado do zero pela receita de migrações do
  Alembic — ver
  [`decisoes/0003-descartar-banco-atual-criar-novo.md`](decisoes/0003-descartar-banco-atual-criar-novo.md).
- **Seed com volume realista** (`tools/seed.py`) — hoje qualquer teste manual
  usa o dado que já existir no banco, sem volume padronizado.

## Onde ler mais

- [`ambiente.md`](ambiente.md) — como subir cada peça localmente.
- [`arquitetura.md`](arquitetura.md) — o que roda onde e como a identidade é
  resolvida.
- [`decisoes/`](decisoes/) — por que a infraestrutura e as branches são como
  são.
- [`../../CLAUDE.md`](../../CLAUDE.md) — estado geral da reestruturação.
