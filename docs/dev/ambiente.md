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

Além disso, para **rodar a aplicação de verdade** (não só os testes) você
precisa de credenciais de um projeto Supabase e de uma chave do Google Gemini:

- **Projeto Supabase do time**: `SUPABASE_URL`, `SUPABASE_KEY` (anon),
  `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_JWT_SECRET`, mais a `DATABASE_URL`
  do Postgres desse mesmo projeto (ele tem a extensão `pgvector` habilitada).
  Isso **não é autoatendimento** — peça a alguém do time. Não existe hoje um
  projeto Supabase "de desenvolvimento local" separado do projeto real.
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

**Sinal de sucesso:** abrir <http://localhost:3000> carrega a página inicial
do Arq Smart.

> **Nota de execução:** este comando específico (`npm run dev`) não foi
> verificado ponta a ponta na sessão em que este documento foi escrito, porque
> já havia outro processo `next dev` ativo nesta mesma máquina segurando o
> lock de `.next/dev/lock` (um lock por checkout, não por porta). Em vez
> disso, `npm run build` foi executado com sucesso contra o mesmo
> `.env.local` real — compila as 30 rotas da aplicação e exercita a mesma
> validação de variáveis de ambiente (`src/lib/env.ts`) que o `next dev` usa,
> o que dá confiança razoável de que `npm run dev` funciona igual. Se alguém
> encontrar um caso em que `next build` passa e `next dev` não sobe, isso é
> uma lacuna real deste documento — avise.

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
.............................                                            [100%]
29 passed in 11.66s
```

**Sinal de sucesso:** todos os testes em verde, `N passed` sem `failed` (o
número exato de testes cresce com o tempo; hoje é 29).

**Frontend:**

```
cd ArchSmart-web
npx vitest run
```

Saída real:

```
❯ e2e/auth.spec.ts (0 test)
❯ e2e/dashboard.spec.ts (0 test)
...
 Test Files  2 failed | 4 passed (6)
      Tests  7 passed (7)
```

**Isso é esperado hoje** — ver "Problemas conhecidos" abaixo, item 1.
**Sinal de sucesso:** `Tests 7 passed (7)` na última linha, mesmo com
`2 failed` nos *Test Files* (são os dois arquivos do Playwright, não testes
de verdade quebrando).

## Problemas conhecidos

Documentar aqui vale mais que esconder — quem travar num destes à noite, sem
aviso, perde a sessão de trabalho.

1. **`npx vitest run` sempre reporta 2 arquivos falhos.** O `vitest.config.ts`
   não exclui a pasta `e2e/`, então o Vitest tenta coletar
   `e2e/auth.spec.ts` e `e2e/dashboard.spec.ts` — specs do Playwright, com
   `test.describe` de outra biblioteca — e cada um estoura com
   `Playwright Test did not expect test.describe() to be called here`.
   **O que fazer:** ignore os dois `Failed Suites`; olhe a linha `Tests` — se
   ela disser `N passed (N)` sem nenhum falho, a suíte de verdade está ok.
   Defeito de configuração conhecido, correção prevista para a Seção 3 da
   reestruturação. Não tente corrigi-lo por conta própria fora dessa tarefa.

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

## Como saber que deu certo

Checklist final — se todos os itens abaixo baterem, o ambiente está pronto:

- [ ] `http://localhost:8000/health` devolve `{"status":"ok"}` (API rodando)
- [ ] `http://localhost:3000` carrega a página inicial (frontend rodando)
- [ ] `docker compose -f ArchSmart-api/docker-compose.test.yml up -d --wait`
      termina com o container em `Healthy`
- [ ] `pytest -q` (dentro de `ArchSmart-api`, venv ativado) termina em
      `N passed` sem nenhum `failed`
- [ ] `npx vitest run` (dentro de `ArchSmart-web`) termina com a linha
      `Tests N passed (N)` — os `2 failed` em *Test Files* são esperados
      (problema conhecido 1, acima)
