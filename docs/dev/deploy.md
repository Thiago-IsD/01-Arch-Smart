# Deploy

Onde a Arq Smart roda hoje, como uma mudança chega lá, e como desfazer uma
mudança ruim. Descreve o **estado atual**, 30/08/2026.

## Onde cada peça roda hoje

Toda a infraestrutura foi recriada do zero em 29–30/08/2026: projeto novo na
Vercel, dois serviços novos no Render, dois projetos Supabase novos. O
provisionamento e o estado medido de cada peça estão em
[`ambientes-online.md`](ambientes-online.md).

| Peça | Onde | Como foi confirmado |
|---|---|---|
| `ArchSmart-web` (frontend) | Vercel, projeto `arqsmart` | Domínio de produção `https://www.arqsmart.com.br`. Medido em 30/08/2026: `curl -I` devolve `Server: Vercel`. **Ainda sem deployment de produção** (`X-Vercel-Error: NOT_FOUND`). Este repositório não tem `vercel.json`, então build command e variáveis de ambiente só são verificáveis no painel — mesma ressalva de [`arquitetura.md`](arquitetura.md). |
| `ArchSmart-api` (staging) | Render, tier gratuito, branch `staging` | `https://arqsmart-staging.onrender.com` — `/health` → `{"status":"ok"}`, cold start de 31 s (medido 29/08/2026). |
| `ArchSmart-api` (produção) | Render, tier gratuito, branch `main` | `https://arqsmart-prod.onrender.com`, pingada a cada 10 min por `.github/workflows/keep-alive.yml`. |
| Banco de staging | Supabase `ipbhtqzybgdltewwnvnl`, `aws-0-sa-east-1`, **Postgres 17.6** | `SHOW server_version` por conexão direta, 29/08/2026. |
| Banco de produção | Supabase `wokgnojyrpzndtxzvfcz`, `aws-0-sa-east-1`, **Postgres 17.6** | idem. Cada projeto Supabase também é o Auth do seu ambiente — não há banco de aplicação separado do de autenticação. |

> **Os dois bancos ainda estão vazios** (`0` tabelas, sem `alembic_version`,
> medido em 29 e 30/08/2026), porque nenhum dos dois serviços recebeu ainda o
> código que carrega a receita de migrações. `main` está 81 commits atrás de
> `develop` e `staging`, 26 — os dois anteriores à Seção 3.

O deploy de cada plataforma sai da branch correspondente (`staging` → serviço
de staging; `main` → produção), comportamento assumido a partir da
configuração de deploy contínuo de cada painel e **confirmado por fingerprint**
em 29/08/2026: o `/openapi.json` de produção expõe uma rota
(`/api/products/seed-captured`) que existe só na branch `main`, e o de staging
não a expõe.

## A esteira hoje

`.github/workflows/` tem três arquivos:

- **`ci.yml`** — três jobs em todo PR contra `develop`, `staging` e `main`:
  `Backend — testes contra Postgres real`, `Frontend — tipos, testes e catraca`
  e `Repositorio — progresso, links e sincronia`. Entregue pela Seção 3.
- **`keep-alive.yml`** — `curl` em `/health` **de produção** a cada 10 minutos,
  para evitar o cold start do Render.
- **`keep-db-alive.yml`** — `curl` em `/health/db` (que executa `SELECT 1`):
  produção 2x ao dia, staging 1x ao dia, para evitar a pausa do Supabase.

> A cadência assimétrica dos dois keep-alive é orçamento, não descuido: o tier
> gratuito do Render dá **750 horas de instância por mês na conta inteira**, não
> por serviço. Produção acordada 24/7 já consome ~730 h; manter staging junto
> pediria ~1460 h e derrubaria os dois. Os arquivos explicam a conta.

**O CI reprova, mas não bloqueia.** Branch protection não está disponível
(repositório privado em plano Free) — a decisão de manter assim e o roteiro
para ligar o bloqueio estão em
[`ambientes-online.md`](ambientes-online.md), seção 5.

## Variáveis de ambiente e segredos

Backend e frontend usam `.env`/`.env.local`, nunca versionados — ver
[`ambiente.md`](ambiente.md) para a lista completa de cada um. Em produção,
essas variáveis são configuradas direto no painel do Render e da Vercel (não
verificado por acesso a esses painéis nesta sessão — se precisar confirmar
os valores exatos configurados hoje em produção, peça a alguém do time).

## Migração de banco

**A migração é automática, e roda no start do contêiner.** O `CMD` do
`ArchSmart-api/Dockerfile` executa `alembic upgrade head` antes do uvicorn,
ligado a ele por `&&`:

```dockerfile
CMD ["sh", "-c", "alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

Não há passo manual, e não há campo de painel: o *Pre-Deploy Command* do Render
é recurso de instância paga, e os dois serviços rodam no free tier. O porquê
completo, as alternativas rejeitadas e a verificação estão na
[ADR 0007](decisoes/0007-migracao-no-start-do-container.md).

Duas consequências operacionais:

- **Migração vermelha = serviço não sobe.** O `&&` é deliberado. Se você vir um
  deploy falhando logo no start, leia o log do contêiner antes de suspeitar do
  Render: é provavelmente a migração avisando.
- **Banco fora do ar no start = serviço não sobe.** Antes, com o banco caído, a
  API subia e só o `/health/db` ficava vermelho. Agora nada responde.

**Nunca rode `alembic upgrade head` à mão contra staging ou produção.** É o
sinal que a [ADR 0003](decisoes/0003-descartar-banco-atual-criar-novo.md) usa
como prova de que o descarte do banco antigo não eliminou a causa da
divergência original.

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
têm `downgrade()` com corpo não vazio. Comando (rodado a partir de `ArchSmart-api/`):

```bash
python - <<'EOF'
import ast, glob, os
vazios = []
files = sorted(glob.glob('alembic/versions/*.py'))
for f in files:
    t = ast.parse(open(f, encoding='utf-8').read())
    for n in t.body:
        if isinstance(n, ast.FunctionDef) and n.name == 'downgrade':
            b = n.body
            if b and isinstance(b[0], ast.Expr) and isinstance(b[0].value, ast.Constant):
                b = b[1:]
            if not [x for x in b if not isinstance(x, ast.Pass)]:
                vazios.append(os.path.basename(f))
print(len(files) - len(vazios), "de", len(files), "| vazios:", vazios)
EOF
```

Saída:

```
26 de 27 | vazios: ['737128c96b28_remove_legacy_auth.py']
```

É AST, não `grep`: `grep` confunde um `downgrade()` que só tem docstring + `pass`
com um que tem corpo real — foi assim que a afirmação anterior ("checado por grep")
ficou errada. A exceção é `737128c96b28_remove_legacy_auth.py`, cujo
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
curl https://arqsmart-prod.onrender.com/health
curl https://arqsmart-prod.onrender.com/health/db
curl -o /dev/null -w "%{http_code}\n" https://www.arqsmart.com.br
```

No PowerShell 5.1:

```
curl.exe https://arqsmart-prod.onrender.com/health
curl.exe https://arqsmart-prod.onrender.com/health/db
curl.exe -o NUL -w "%{http_code}`n" https://www.arqsmart.com.br
```

Espera-se `{"status":"ok"}` no primeiro, confirmação de banco vivo no
segundo, `200` no terceiro. Os dois primeiros **foram executados em
29/08/2026** e devolveram `200` (com ~31 s de cold start no `/health`). O
terceiro devolvia `404` naquela data, porque a Vercel ainda não tinha
deployment de produção.

> ⚠️ **O `/health/db` verde não prova schema.** Ele só faz `SELECT 1`
> (`app/main.py:67`) e responde `{"db":"up"}` contra um banco vazio — foi
> literalmente o estado dos dois ambientes em 29/08/2026. Depois de uma
> reversão que envolveu migração, a confirmação que vale é `alembic current`
> devolvendo a revisão esperada. Como bônus do `&&` no `CMD`
> ([ADR 0007](decisoes/0007-migracao-no-start-do-container.md)), um `/health`
> que responde já implica que a migração daquele start passou.

## O que a Seção 3 entregou, e o que falta

Entregue e no repositório: o **CI de três jobs** (`ci.yml`), a **branch
`staging`**, o **Postgres local com a stack Supabase completa**, o **seed com
volume realista** (`ArchSmart-api/tools/seed.py`) e a **migração automática no
start do contêiner** ([ADR 0007](decisoes/0007-migracao-no-start-do-container.md)).
O fluxo é `feature/xyz → develop → staging → main`
([ADR 0005](decisoes/0005-tres-branches-develop-staging-main.md)).

Duas ressalvas sobre o que "entregue" quer dizer:

- O CI **reprova mas não bloqueia** — branch protection exige plano pago, e a
  decisão registrada é manter assim. A esteira é conselheiro; quem mergeia é o
  portão.
- Os ambientes online **existem mas ainda rodam código antigo**. `main` e
  `staging` estão atrás de `develop`, e os dois bancos novos continuam vazios
  até a primeira carga chegar. Estado medido, peça a peça, em
  [`ambientes-online.md`](ambientes-online.md).

## Onde ler mais

- [`ambientes-online.md`](ambientes-online.md) — roteiro de painel para
  ligar staging e recriar produção (Render, Vercel, Supabase, branch
  protection), com o estado medido de cada peça.
- [`ambiente.md`](ambiente.md) — como subir cada peça localmente.
- [`arquitetura.md`](arquitetura.md) — o que roda onde e como a identidade é
  resolvida.
- [`decisoes/`](decisoes/) — por que a infraestrutura e as branches são como
  são.
- [`../../CLAUDE.md`](../../CLAUDE.md) — estado geral da reestruturação.
