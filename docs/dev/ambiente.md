# Ambiente de desenvolvimento

Como subir o Arq Smart do zero: backend, frontend e banco de teste. Todo comando
deste documento foi executado de fato, num checkout deste repositório, antes de
ser escrito aqui — a saída real de cada um está indicada junto do comando. Se
algum comando não funcionar do jeito descrito, isso é um bug deste documento:
abra uma issue ou corrija-o, não trabalhe em volta dele.

O shell de referência é o **PowerShell 5.1** (o padrão no Windows, que é o
ambiente usado hoje pelo time). `&&` não existe nele — os comandos abaixo usam
`;` ou linhas separadas. Quem estiver num shell POSIX (bash/zsh, Linux ou
macOS) troca `;` por `&&` e `.\venv\Scripts\Activate.ps1` por
`source venv/bin/activate` — o resto é igual.

## Pré-requisitos

| Ferramenta | Versão exigida | Por quê | Testado com |
|---|---|---|---|
| Python | 3.12.x | o `venv/` do backend foi criado com esta versão (`ArchSmart-api/venv/pyvenv.cfg`) | 3.12.10 |
| Node.js | ≥ 20.9.0 | exigência do próprio Next.js 16.1.4 (`node_modules/next/package.json` → `engines.node`) | v24.18.0 |
| npm | vem com o Node | — | 11.16.0 |
| Docker Desktop (com `docker compose`) | qualquer versão recente | sobe o Postgres usado pela suíte de testes do backend | Docker 29.6.2 / Compose v5.3.1 |
| Git | qualquer versão recente | — | 2.54.0 |
| CLI do Supabase | ≥ 2.x | sobe a stack Supabase local (Auth, Storage, Studio) — **opcional**, ver "Stack Supabase local" | 2.115.0 |

Além disso, para **rodar a aplicação de verdade** (não só os testes) você
precisa de credenciais de um projeto Supabase e de uma chave do Google Gemini:

- **Projeto Supabase do time**: `SUPABASE_URL`, `SUPABASE_KEY` (anon),
  `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_JWT_SECRET`, mais a `DATABASE_URL`
  do Postgres desse mesmo projeto (ele tem a extensão `pgvector` habilitada).
  Isso **não é autoatendimento** — peça a alguém do time. Não existe hoje um
  projeto Supabase **hospedado** "de desenvolvimento" separado do projeto real;
  o que existe é a stack local em Docker, descrita em "Stack Supabase local"
  mais abaixo. Ela substitui essas credenciais para desenvolver — inclusive
  login e upload —, e a seção "Apontar a aplicação para a stack local" diz
  exatamente quais valores trocar. A chave do Gemini continua sendo necessária
  para as funções de IA: essa não tem equivalente local.
- **Chave do Google Gemini** (`GEMINI_API_KEY`): essa você mesmo gera, de
  graça, em <https://aistudio.google.com/apikey>.

Sem as credenciais do Supabase você ainda consegue instalar tudo, rodar a
suíte de testes do backend (que usa um Postgres local em Docker, não o
Supabase) e o `npx vitest run` do frontend. O que não dá para fazer é subir a
API (`uvicorn`) ou o frontend contra dados reais sem elas.

## Clonar

```
git clone https://github.com/Thiago-IsD/01-Arch-Smart.git
cd 01-Arch-Smart
```

> **Problema conhecido:** o remote é HTTPS (`https://github.com/...`), então o
> primeiro `git pull` ou `git push` pede autenticação — no Windows, o Git
> Credential Manager abre uma janela do navegador para login do GitHub. Isso é
> esperado; autentique quando pedir.

## Backend (`ArchSmart-api/`)

```
cd ArchSmart-api
```

1. **Ambiente virtual.** Se `venv/` ainda não existir, crie-o:

   ```
   python -m venv venv
   ```

   Neste checkout o `venv/` já existia, criado com Python 3.12.10 — este passo
   específico (criar do zero) não foi reexecutado para não descartar o
   ambiente já montado; o restante do backend foi verificado sobre ele.

2. **Ativar** (PowerShell):

   ```
   .\venv\Scripts\Activate.ps1
   ```

   Se o PowerShell recusar por política de execução de scripts, rode uma vez
   (não precisa de administrador): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

   Saída real, confirmando a versão do interpretador dentro do venv:

   ```
   > python --version
   Python 3.12.10
   ```

3. **Instalar as dependências:**

   ```
   pip install -r requirements.txt -r requirements-dev.txt
   ```

   Executado neste checkout — como as dependências já estavam instaladas, o
   pip só confirmou (`Requirement already satisfied: ...` em cada linha); numa
   instalação do zero o pip baixa e instala os pacotes, o que leva alguns
   minutos.

4. **Variáveis de ambiente:**

   ```
   Copy-Item .env.example .env
   ```

   Abra o `.env` recém-criado e preencha `DATABASE_URL`, `SUPABASE_URL`,
   `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (peça ao
   time) e `GEMINI_API_KEY` (gere a sua). Cada variável tem, no
   `.env.example`, um comentário dizendo o que é e onde obter.

5. **Subir a API:**

   ```
   uvicorn app.main:app --reload
   ```

   Saída real (com `.env` preenchido):

   ```
   INFO:     Started server process [7524]
   INFO:     Waiting for application startup.
   INFO:     Application startup complete.
   INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
   ```

   **Sinal de sucesso:** abrir <http://localhost:8000/health> num navegador (ou
   `Invoke-WebRequest http://localhost:8000/health`) devolve `{"status":"ok"}`
   — testado e confirmado.

## Frontend (`ArchSmart-web/`)

Em outro terminal, a partir da raiz do repositório:

```
cd ArchSmart-web
npm install
```

Executado neste checkout — `node_modules/` já existia, então o npm confirmou
`up to date` sem baixar nada; numa instalação do zero baixa as ~630 dependências
listadas, o que leva alguns minutos.

```
Copy-Item .env.example .env.local
```

Preencha `NEXT_PUBLIC_API_URL` (`http://localhost:8000` se a API estiver
rodando local, passo anterior), `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (mesmo projeto Supabase do backend).

```
npm run dev
```

**Sinal de sucesso:** abrir <http://localhost:3000> carrega a página inicial.
Confirmado também por linha de comando, sem precisar de navegador. A saída
colada abaixo foi obtida no Git Bash — no PowerShell 5.1, `curl` é um alias de
`Invoke-WebRequest` e não aceita `-o`/`-w` nesse formato; use `curl.exe`
(o executável real, não o alias) para o mesmo comando:

```
curl http://localhost:3000
# ou, no PowerShell 5.1: curl.exe http://localhost:3000
```

Retorna `200`. E para confirmar que a proteção de rota está de pé (o
`proxy.ts` redireciona quem não está autenticado):

```
curl -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard
# no PowerShell 5.1: curl.exe -o NUL -w "%{http_code}" http://localhost:3000/dashboard
```

Retorna `307`, redirecionando para `/auth/login` — sinal de que a
autenticação está funcionando, não só que o servidor responde.

## Stack Supabase local

Sobe, em Docker, um Supabase inteiro na sua máquina: Postgres, **Auth**,
**Storage** e o Studio. É **opcional** — a suíte de testes não precisa dela, e
usa o Postgres descartável da seção seguinte.

Por que não um Postgres puro: a aplicação não depende só do banco. O login vai
no Auth e o upload vai no Storage. Um Postgres puro subiria as tabelas e
deixaria **login e upload ainda batendo no projeto real na nuvem** — que é
justamente o que se quer evitar ao desenvolver.

### Instalar a CLI

O `winget` não distribui o pacote:

```
winget search supabase
```

Saída real:

```
No package found matching input criteria.
```

No Windows o caminho é o **scoop**, que não precisa de admin e instala no seu
perfil de usuário:

```
# so se voce ainda nao tiver o scoop
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

scoop install supabase
```

Saída real da última linha:

```
'supabase' (2.115.0) was installed successfully!
```

> A documentação oficial do Supabase manda adicionar um bucket
> (`scoop bucket add supabase ...`) antes de instalar. **Não é necessário**: o
> bucket `main`, que o scoop já traz, carrega o manifesto. Medido em
> 25/08/2026 com só o `main` instalado — `scoop search supabase` devolve
> `supabase 2.115.0 main`.

### Subir a stack

```
cd 01-Arch-Smart
supabase start
```

**A primeira execução baixa cerca de 8 GB de imagem** e demora. Medido com
`docker images` depois do primeiro `supabase start`, as maiores são `postgres`
(1,7 GB), `studio` (1,66 GB) e `storage-api` (1,38 GB). As execuções seguintes
sobem em segundos.

Depois, `supabase status` mostra onde tudo ficou:

Saída real de `supabase status -o env`, com as linhas de chave filtradas
(`| Select-String -NotMatch "KEY|SECRET"`):

```
Stopped services: [supabase_imgproxy_arqsmart supabase_pooler_arqsmart]
API_URL="http://127.0.0.1:54321"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
FUNCTIONS_URL="http://127.0.0.1:54321/functions/v1"
GRAPHQL_URL="http://127.0.0.1:54321/graphql/v1"
INBUCKET_URL="http://127.0.0.1:54324"
MAILPIT_URL="http://127.0.0.1:54324"
MCP_URL="http://127.0.0.1:54321/mcp"
REST_URL="http://127.0.0.1:54321/rest/v1"
S3_PROTOCOL_REGION="local"
STORAGE_S3_URL="http://127.0.0.1:54321/storage/v1/s3"
STUDIO_URL="http://127.0.0.1:54323"
```

Sem o `-o env`, num terminal interativo, o mesmo conteúdo sai como tabela.

**Sinal de sucesso:** o `supabase status` responde com essas URLs. Ele também
imprime `Stopped services: [supabase_imgproxy_arqsmart supabase_pooler_arqsmart]`
— **isso é esperado** e nenhum dos dois faz falta no desenvolvimento. O
`pooler` está desligado no `config.toml` (`[db.pooler] enabled = false`); o
`imgproxy` não tem entrada ativa lá — ele fica parado por padrão da CLI, já que
a transformação de imagem é recurso de plano pago.

As chaves que ele imprime são **locais e fixas** — as mesmas em qualquer
máquina, embutidas na CLI. Não são segredo e não vão para o `.env` de produção;
por isso não estão coladas aqui: rode `supabase status` e leia as suas.

### O schema vem do Alembic, nunca da CLI

O `supabase start` sobe a **infraestrutura**. As tabelas da aplicação são
aplicadas por cima, pelo Alembic, que é a fonte única do schema
([ADR 0004](decisoes/0004-alembic-fonte-unica-do-schema.md)). Por isso
`[db.migrations] enabled = false` no `supabase/config.toml`: duas ferramentas de
migração seriam dois históricos divergentes.

> **Exporte a `DATABASE_URL` em todo comando de Alembic, sem exceção.**
> `alembic/env.py` lê `settings.DATABASE_URL`, e `app/core/config.py` cai no
> arquivo `.env` quando a variável não está exportada — e enquanto o `.env`
> não estiver apontando para esta stack local, ele aponta para um projeto
> Supabase **hospedado**. Os scripts de `ArchSmart-api/tools/` têm uma guarda
> que recusa esse destino
> ([tools/README.md](../../ArchSmart-api/tools/README.md)); **o Alembic não
> tem**. Um `alembic upgrade head` sem a variável migra o banco hospedado.

```
cd ArchSmart-api
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
.\venv\Scripts\python.exe -m alembic upgrade head
```

Saída real da última linha:

```
INFO  [alembic.runtime.migration] Running upgrade c9f1a2b3d4e5 -> b77a9b5656c2, reconcilia products com os models
```

**Sinal de sucesso**, conferido depois:

```
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
.\venv\Scripts\python.exe -m alembic current   # -> b77a9b5656c2 (head)
docker exec supabase_db_arqsmart psql -U postgres -tAc "select count(*) from information_schema.tables where table_schema='public';"   # -> 27
docker exec supabase_db_arqsmart psql -U postgres -tAc "select extname, extversion from pg_extension where extname='vector';"          # -> vector|0.8.2
```

As 27 migrações aplicam sem erro (`ls alembic/versions/*.py | wc -l` → 27), e a
extensão `vector` é habilitada pela própria migração `9f8a3b2c1d4e`.

### Apontar a aplicação para a stack local

Subir a stack não redireciona nada sozinho: a API e o front continuam lendo o
que estiver no `.env`. Os valores vêm do `supabase status` (rode-o e leia os
seus — as chaves abaixo estão nomeadas, não coladas):

Em `ArchSmart-api/.env`:

| Variável | Valor da stack local |
|---|---|
| `DATABASE_URL` | `DB_URL` |
| `SUPABASE_URL` | `API_URL` |
| `SUPABASE_KEY` | `ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` |
| `SUPABASE_JWT_SECRET` | `JWT_SECRET` |

Em `ArchSmart-web/.env.local`:

| Variável | Valor da stack local |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY` |

> **Guarde o `.env` de nuvem antes de sobrescrever.** Ele é a única cópia das
> credenciais do projeto real nesta máquina, e não é versionado.

Dois detalhes que economizam tempo:

- **Os buckets do Storage não precisam ser criados à mão** — desde que a
  `SUPABASE_SERVICE_ROLE_KEY` da tabela acima esteja preenchida.
  `app/utils/supabase_client.py:94` só autocria o bucket se tiver a chave de
  service role; sem ela, imprime `Bucket '<nome>' missing but cannot auto-create`
  e o upload falha.
- **O e-mail sai no Mailpit**, em <http://127.0.0.1:54324>, não para a caixa de
  verdade. É lá que você lê o link de confirmação e o de recuperação de senha.

### Três diferenças que importam

1. **O Postgres local é 17; o do banco de teste é 16.** Não é descuido: a CLI
   **rejeita** 16. Medido nesta máquina trocando o valor e rodando
   `supabase status` para cada um de 11 a 20 — 13, 14, 15 e 17 são aceitos; 16
   sai com `Invalid db.major_version`. O Supabase nunca ofereceu Postgres 16, e
   17 é a versão suportada mais próxima. A versão dos bancos gerenciados
   **ainda não foi conferida** — a tabela a preencher está em
   [ambientes-online.md](ambientes-online.md), seção 4.
2. **A confirmação de e-mail vem desligada aqui, e está ligada em produção.**
   `supabase/config.toml` traz `enable_confirmations = false` na seção
   `[auth.email]`, que é o padrão da CLI (há uma segunda, independente, em
   `[auth.sms]`); no projeto real a opção *Confirm email* está **ligada**
   (confirmado no painel em 24/08/2026 — ver
   [ambientes-online.md](ambientes-online.md)). Duas consequências: um cadastro
   testado localmente entra sem confirmar, o que **não** é o comportamento real;
   e, do lado bom, esta stack passa a ser o lugar barato de reproduzir o achado
   de segurança do auto-link por e-mail em `app/api/users.py`, que só é
   explorável com a confirmação desligada.
3. **Esta stack não substitui o banco de teste.** O `docker-compose.test.yml` da
   seção seguinte, na porta `55432`, continua separado e é ele que a suíte usa.

> **Não use `supabase db reset`.** É o comando que a documentação oficial do
> Supabase ensina, e ele derruba e recria o banco — apagando o schema aplicado
> pelo Alembic junto com a tabela `alembic_version`. Para recomeçar do zero, use
> o `supabase stop --no-backup` abaixo e refaça o `upgrade head`.

### Parar

```
supabase stop
```

Os dados sobrevivem entre `stop` e `start`. Para descartar tudo e recomeçar do
zero, `supabase stop --no-backup`.

## Banco de teste em Docker

A suíte de testes do backend roda contra um Postgres **real** (não mock),
subido via Docker — separado do banco apontado por `DATABASE_URL`.

```
cd ArchSmart-api
docker compose -f docker-compose.test.yml up -d --wait
```

Saída real:

```
 Container archsmart-api-postgres-test-1  Running
 Container archsmart-api-postgres-test-1  Waiting
 Container archsmart-api-postgres-test-1  Healthy
```

Sobe a imagem `pgvector/pgvector:pg16` na porta `55432`, com dados em
`tmpfs` (efêmeros — reiniciar o container apaga tudo, de propósito). **Sinal
de sucesso:** a última linha da saída diz `Healthy`.

## Como rodar as suítes

**Backend** (com o container acima já rodando e o venv ativado):

```
cd ArchSmart-api
.\venv\Scripts\Activate.ps1
pytest -q
```

Saída real:

```
.............................................................................[100%]
78 passed, 3 warnings in 32.45s
```

**Sinal de sucesso:** todos os testes em verde, `N passed` sem `failed` (o
número exato cresce com o tempo; em 25/08/2026 são 78, dos quais 46 são da
guarda de banco em `tools/guarda_banco.py`). Os 3 `warnings` vêm do Alembic e
são esperados.

**Frontend:**

```
cd ArchSmart-web
npx vitest run
```

Saída real:

```
 Test Files  4 passed (4)
      Tests  7 passed (7)
```

**Sinal de sucesso:** `Test Files` e `Tests` os dois sem nenhum `failed`.

> Até agosto de 2026 esta suíte **sempre** reportava `2 failed` em
> *Test Files* — o `vitest.config.ts` não excluía `e2e/`, e o Vitest tentava
> coletar dois specs do Playwright. A documentação mandava ignorar. **Não
> ignore mais:** o defeito foi corrigido na Seção 3, e hoje um `failed` ali é
> um teste realmente quebrado.

## Problemas conhecidos

Documentar aqui vale mais que esconder — quem travar num destes à noite, sem
aviso, perde a sessão de trabalho.

1. ~~**`npx vitest run` sempre reporta 2 arquivos falhos.**~~ **Corrigido**
   na Seção 3 (`5fde04e`): o `vitest.config.ts` passou a excluir `e2e/`, que
   contém specs do Playwright e nunca foi para o Vitest coletar. A suíte hoje
   sai limpa. O item fica registrado porque a orientação anterior era
   *ignorar* os dois `Failed Suites`, e quem lembrar dela vai ignorar um
   vermelho de verdade.

2. **`git pull` / `git push` pedem credencial.** O remote é HTTPS. No
   Windows, o Git Credential Manager abre o navegador para login do GitHub na
   primeira vez; depois disso fica em cache. Se travar sem abrir nada, rode
   `git config --get credential.helper` e confirme que retorna `manager`.

3. **Sem `.env` preenchido, `uvicorn app.main:app` (ou qualquer import de
   `app.main`) falha com `ValidationError` do pydantic na inicialização, não
   no meio da suíte de testes** — se você rodar `pytest` sem `.env`, todos os
   testes falham juntos na *coleta*, antes de qualquer teste individual
   rodar. Isto foi reproduzido de propósito neste checkout (renomeando o
   `.env` temporariamente); saída real:

   ```
   pydantic_core._pydantic_core.ValidationError: 5 validation errors for Settings
   DATABASE_URL
     Field required [type=missing, input_value={}, input_type=dict]
   SUPABASE_URL
     Field required [type=missing, input_value={}, input_type=dict]
   SUPABASE_KEY
     Field required [type=missing, input_value={}, input_type=dict]
   SUPABASE_SERVICE_ROLE_KEY
     Field required [type=missing, input_value={}, input_type=dict]
   GEMINI_API_KEY
     Field required [type=missing, input_value={}, input_type=dict]
   ```

   **O que fazer:** confira se `ArchSmart-api/.env` existe e tem as cinco
   variáveis acima preenchidas (seção "Backend", passo 4).

4. **`SUPABASE_JWT_SECRET` ausente muda o caminho de autenticação, em
   silêncio.** Ela não está em `app/core/config.py` (não é validada por
   pydantic) — é lida direto com `os.getenv` em `app/api/users.py`. Sem ela,
   toda validação de token de sessão vira uma chamada de rede ao Supabase
   (mais lenta) em vez de validação local, e o único aviso é uma linha no log
   do backend: `[WARN] SUPABASE_JWT_SECRET missing, using slow remote
   validation`. A aplicação **funciona** sem essa variável — só que mais
   devagar, e sem avisar em lugar nenhum além do log. **O que fazer:**
   preencha `SUPABASE_JWT_SECRET` no `.env` (comentário no `.env.example` diz
   onde obter) para ter o comportamento rápido e não ficar dependendo desse
   log para saber que algo está diferente do esperado.

5. **`npm run dev` reclama de `.next/dev/lock`.** O lock é por checkout do
   projeto, não por porta — trocar a porta (`npm run dev -- -p 3123`) não
   resolve. Significa que já existe outro `next dev` rodando nesta máquina
   (seu ou de outra pessoa, se a máquina for compartilhada). **O que fazer:**
   encontre e encerre o processo `next dev` já ativo, ou continue usando o
   que já está rodando em vez de subir um segundo.

## Como saber que deu certo

Checklist final — se todos os itens abaixo baterem, o ambiente está pronto:

- [ ] `http://localhost:8000/health` devolve `{"status":"ok"}` (API rodando)
- [ ] `http://localhost:3000` carrega a página inicial (frontend rodando)
- [ ] `docker compose -f ArchSmart-api/docker-compose.test.yml up -d --wait`
      termina com o container em `Healthy`
- [ ] `pytest -q` (dentro de `ArchSmart-api`, venv ativado) termina em
      `N passed` sem nenhum `failed`
- [ ] `npx vitest run` (dentro de `ArchSmart-web`) termina com
      `Test Files N passed (N)` e `Tests N passed (N)` — **nenhum** `failed`
      em nenhuma das duas linhas
