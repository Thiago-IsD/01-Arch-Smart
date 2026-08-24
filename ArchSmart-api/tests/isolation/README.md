# Testes de isolamento entre contas

Cada teste aqui prova que um recurso da conta A não é alcançável pela conta B.
São regressões de falhas que estiveram em produção (auditoria de 23/08/2026).

## Como rodar

```bash
docker compose -f docker-compose.test.yml up -d --wait
pytest tests/isolation/ -v
```

### Variáveis de ambiente exigidas em checkout limpo

`app/core/config.py` valida `SUPABASE_URL`, `SUPABASE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` e `GEMINI_API_KEY` como obrigatórias — sem elas,
`import app.main` levanta `ValidationError` e a coleta do pytest falha antes
de qualquer teste rodar. `tests/conftest.py` só sobrescreve `DATABASE_URL`
(incondicionalmente, para apontar ao Postgres de teste); as demais precisam
existir no ambiente ou em um `.env` na raiz de `ArchSmart-api/`.

Nenhum teste de `tests/isolation/` faz chamada de rede a Supabase ou Gemini,
então **valores fictícios servem** — a única exigência é passar na validação
de formato do `pydantic-settings`:

```bash
# ArchSmart-api/.env (ou exportado no shell antes de rodar pytest)
SUPABASE_URL=https://exemplo.supabase.co
SUPABASE_KEY=chave-ficticia
SUPABASE_SERVICE_ROLE_KEY=chave-ficticia
GEMINI_API_KEY=chave-ficticia
```

Veja `ArchSmart-api/.env.example` para o arquivo completo com os demais
campos (opcionais) documentados.

## Regra

Endpoint novo que devolve ou altera dado de conta entra aqui **junto com o
endpoint**, não depois. Na Seção 4 este diretório ganha um teste genérico que
percorre todas as rotas registradas automaticamente.

Resposta correta para acesso indevido é **404**, nunca 403 — 403 confirma que
o recurso existe.
