# Usuário de teste E2E — onde a credencial vive

Criado em 10/09/2026, na Tarefa 1 da Seção 6, para fechar o portão de
validação da Seção 5 (medição de tempo da Biblioteca e verificação viva de
hidratação) — ver `PROGRESS.md`, nota da Seção 5, e
[`2026-09-06-biblioteca-depois.md`](2026-09-06-biblioteca-depois.md).

## Quem é

- **E-mail:** `ana.arquiteta@seed.arqsmart.local`
- **Projeto Supabase:** staging (`ipbhtqzybgdltewwnvnl`,
  `https://ipbhtqzybgdltewwnvnl.supabase.co`)
- **Conta de aplicação:** `"Seed — volume realista"`, no banco de staging
  (`ipbhtqzybgdltewwnvnl`, Postgres 17.6), criada por
  `ArchSmart-api/tools/seed.py` (a primeira entrada de `USUARIOS_SEED`)
- **`supabase_id`:** vinculado explicitamente na tabela `users` (coluna
  `users.supabase_id`, `ArchSmart-api/app/models/all_models.py:72`) — **não**
  pelo auto-link por e-mail de `POST /api/auth/complete-register` (pendência
  2 da Seção 4, aberta em `CLAUDE.md`; usar aquele caminho aqui seria
  exercitar exatamente o padrão inseguro que está registrado como pendência)
- **Senha:** gerada aleatoriamente nesta tarefa. **Não é versionada** — não
  está em nenhum arquivo deste repositório, `.env` incluído. Fica só com
  quem executou a tarefa e com Thiago (repassada fora do controle de
  versão). Quem precisar dela para rodar a medição de novo, peça a um dos
  dois ou recrie o usuário do zero (roteiro abaixo).

## Como recriar do zero

Os três passos abaixo são os Passos 3–5 do brief da Tarefa 1
(`.superpowers/sdd/2026-09-09-secao-6-camada-de-ui/task-1-brief.md`).
**Confirme antes de cada um que o `.env` da API aponta para staging**
(`grep -n "^DATABASE_URL" ArchSmart-api/.env | grep -o "postgres\.[a-z]*"` →
`postgres.ipbhtqzybgdltewwnvnl`) — nunca rode isto contra produção
(`wokgnojyrpzndtxzvfcz`).

### 1. Semear o volume (determinístico, idempotente)

```bash
cd ArchSmart-api
.\venv\Scripts\Activate.ps1
python tools/seed.py --projetos 5 --ambientes 25 --biblioteca 300 --itens 500 --eu-sei-o-que-estou-fazendo
```

`--eu-sei-o-que-estou-fazendo` é obrigatório porque o script recusa por
padrão rodar contra um host `*.supabase.co` — a guarda existe para não
apagar dados de staging/produção por engano. `random.seed(42)` fixo: rodar
de novo produz os mesmos volumes, não duplica. Isto **apaga e reescreve**
todos os dados de volume da conta `"Seed — volume realista"` — só dela,
nenhuma outra conta é tocada.

### 2. Criar (ou recriar) o usuário de auth no Supabase de staging

```bash
cd ArchSmart-api
set -a; . ./.env; set +a
curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"ana.arquiteta@seed.arqsmart.local","password":"<gere uma senha forte>","email_confirm":true}' \
  | python -c "import json,sys; print(json.load(sys.stdin)['id'])"
```

`email_confirm: true` é necessário porque o domínio `.local` não recebe
e-mail de confirmação de verdade. Guarde o `id` devolvido — é o
`supabase_id` do próximo passo.

### 3. Vincular o `supabase_id` ao usuário de aplicação

```bash
cd ArchSmart-api
set -a; . ./.env; set +a
export SUPABASE_ID_E2E='<id devolvido no passo anterior>'
python - <<'PY'
import os
from sqlalchemy import create_engine, text
url = os.environ["DATABASE_URL"]
assert "ipbhtqzybgdltewwnvnl" in url, f"NAO e staging: {url[:40]}"
sup = os.environ["SUPABASE_ID_E2E"]
with create_engine(url).begin() as c:
    n = c.execute(text(
        "UPDATE users SET supabase_id = :sup "
        "WHERE email = 'ana.arquiteta@seed.arqsmart.local'"
    ), {"sup": sup}).rowcount
print("linhas atualizadas:", n)
PY
```

Esperado: `linhas atualizadas: 1`. Se sair `0`, rode o Passo 1 (`seed.py`)
primeiro — o usuário de aplicação ainda não existe.

## Como usar

```bash
cd ArchSmart-web
E2E_EMAIL=ana.arquiteta@seed.arqsmart.local E2E_PASSWORD=<senha> \
  npx playwright test e2e/medicao-biblioteca.spec.ts --reporter=line

E2E_EMAIL=ana.arquiteta@seed.arqsmart.local E2E_PASSWORD=<senha> \
  npx playwright test e2e/hidratacao-biblioteca.spec.ts --reporter=line
```

As duas variáveis também têm um par vazio, com comentário, em
`ArchSmart-web/.env.example` — preencha localmente em `.env.local` (que é
git-ignored) se preferir não exportar no shell a cada execução.

**Topologia necessária para rodar as duas medições** (ver
`ArchSmart-web/playwright.config.ts` e `ArchSmart-web/.env.local`): o
Playwright sobe o Next em `localhost:3000` sozinho; a API em `localhost:8000`
precisa estar rodando à parte (`cd ArchSmart-api && uvicorn app.main:app
--port 8000`), apontando para o banco de staging, e o front local
(`NEXT_PUBLIC_SUPABASE_URL`) precisa apontar para o mesmo projeto Supabase de
staging que a API valida — os dois lados fora de sincronia fazem o login
autenticar num projeto e a API ler de outro, e a medição não roda.
