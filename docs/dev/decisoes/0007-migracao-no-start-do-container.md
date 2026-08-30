# ADR 0007 — Migração roda no start do contêiner

**Data:** 2026-08-30 · **Status:** aceita

## Contexto

A [ADR 0004](0004-alembic-fonte-unica-do-schema.md) põe o Alembic como fonte
única do schema em todo ambiente, e a
[ADR 0003](0003-descartar-banco-atual-criar-novo.md) define o sinal de que o
descarte do banco antigo funcionou: um `alembic upgrade head` contra um
Postgres vazio recria o schema inteiro **"sem nenhum passo manual fora do
Alembic"**. Coerente com isso,
[`../ambientes-online.md`](../ambientes-online.md) §4.3 escrevia, em letras
próprias, *"não rode `alembic upgrade head` à mão contra este banco"*.

O mecanismo que faria as duas coisas serem verdade ao mesmo tempo era o
**Pre-Deploy Command** do Render, prescrito em `ambientes-online.md` §1.7. Em
30/08/2026 Thiago verificou no painel que **esse campo é recurso de instância
paga**. Os dois serviços — `arqsmart-staging` e `arqsmart-prod` — rodam no
free tier.

O efeito disso foi medido, não suposto. Em 29/08/2026, com os dois serviços
já no ar e respondendo:

```
arqsmart-staging  /health  200 {"status":"ok"}   /health/db  200 {"status":"ok","db":"up"}
arqsmart-prod     /health  200 {"status":"ok"}   /health/db  200 {"status":"ok","db":"up"}

sonda somente-leitura nos dois projetos Supabase:
  tabelas em public: 0
  alembic_version: (tabela nao existe)
```

Ou seja: deploy verde, `/health/db` verde, **e nenhuma tabela**. O
`/health/db` só executa `SELECT 1` (`app/main.py:67`), então ele fica verde
contra um banco completamente vazio — não prova schema nenhum.

Restavam três caminhos, e o único proibido por escrito era justamente o
manual.

## Decisão

A migração roda no `CMD` do `Dockerfile`, antes do uvicorn, ligada a ele por
`&&`:

```dockerfile
CMD ["sh", "-c", "alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

## Alternativas rejeitadas

- **Pre-Deploy Command do Render.** Rejeitada por indisponibilidade, não por
  mérito: é recurso de instância paga e os dois serviços estão no free tier.
  Se um dia o plano mudar, esta decisão pode ser revisitada — mas note que o
  `CMD` tem uma vantagem que o Pre-Deploy não tinha: fica **versionado neste
  repositório e revisável em PR**, em vez de existir só num campo de painel
  que ninguém enxerga a partir do código.
- **Rodar a migração num workflow do GitHub Actions após o push.** Rejeitada
  por duas razões. Exigiria a `DATABASE_URL` de produção nos Secrets do
  GitHub — superfície de segredo nova, para um repositório que hoje não tem
  nenhum segredo de produção no CI (ver `.github/workflows/ci.yml`, que usa
  só chaves inválidas de propósito). E o workflow corre solto em relação ao
  build do Render: não há ordenação garantida entre "a migração terminou" e
  "o código novo começou a servir", o que reintroduz exatamente a janela de
  schema desatualizado que a migração no start elimina.
- **Rodar `alembic upgrade head` à mão antes de cada deploy.** Rejeitada: é o
  sinal que a ADR 0003 nomeia como prova de que o descarte do banco não
  eliminou a causa da divergência original. Um passo manual que alguém
  esquece uma vez recria o `add_column.py`.
- **Migrar num `@app.on_event("startup")` do FastAPI.** Rejeitada: roda dentro
  do processo que já está aceitando conexão, então existe uma janela em que a
  aplicação está de pé com o schema pela metade. O `CMD` garante que o uvicorn
  só existe depois que a migração terminou.

## Como saberemos se foi certo

Um Postgres vazio mais um `docker run` da imagem produz o schema completo, e
um banco inalcançável derruba o contêiner em vez de servir. Ambos verificados
em 30/08/2026, com a imagem construída a partir deste `Dockerfile`:

```
$ docker run ... -e DATABASE_URL=<postgres vazio> arqsmart-api-verificacao
INFO  [alembic.runtime.migration] Running upgrade c9f1a2b3d4e5 -> b77a9b5656c2, reconcilia products com os models
INFO:     Uvicorn running on http://0.0.0.0:8000

$ (no banco, depois)
tabelas em public: 27
alembic_version: ['b77a9b5656c2']
extensao vector: habilitada

$ docker run ... -e DATABASE_URL=<host inalcancavel> arqsmart-api-verificacao
estado: Exited (1)      exit code: 1
curl /health -> HTTP 000 (sem resposta)
```

O sinal de refutação é o inverso de qualquer um dos dois: um deploy verde com
`alembic_version` diferente do head do repositório, ou uma API respondendo
`/health` enquanto a migração falhou. `tests/test_migracao_no_start.py` guarda
as três propriedades do `CMD` (a migração acontece, vem antes do uvicorn, e
está ligada por `&&` e não por `;`) e roda no job `Backend` de todo PR.

## Consequências

Fica mais fácil: qualquer ambiente que rode esta imagem — staging, produção,
ou um `docker run` local — chega ao head sozinho, sem passo de painel e sem
passo manual, que é literalmente o critério de sucesso da ADR 0003. E o
mecanismo passa a ser legível no código, não só no painel do Render.

Fica mais difícil, e é o custo que se aceita: **banco fora do ar no momento do
start passa a impedir a API de subir**. Antes, com o banco caído, a API subia e
o `/health` respondia `ok` (só o `/health/db` caía); agora nada responde. É
deliberado — servir contra um schema errado é pior do que não servir —, mas
muda o que se vê durante uma indisponibilidade do Supabase: o sintoma deixa de
ser "um endpoint vermelho" e passa a ser "o serviço não sobe".

Segundo efeito: o free tier do Render reinicia o contêiner ao acordar do sono,
então o `alembic upgrade head` roda a cada despertar, não só a cada deploy.
Quando já está no head ele é no-op — lê `alembic_version` e sai — e desaparece
dentro dos ~31 s de cold start já medidos. Como efeito colateral útil, toca o
banco a cada start, o que ajuda a manter o projeto Supabase fora da pausa por
inatividade.
