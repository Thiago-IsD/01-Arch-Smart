# Testes de isolamento entre contas

Cada teste aqui prova que um recurso da conta A não é alcançável pela conta B.
São regressões de falhas que estiveram em produção (auditoria de 23/08/2026).

## Como rodar

```bash
docker compose -f docker-compose.test.yml up -d --wait
pytest tests/isolation/ -v
```

## Regra

Endpoint novo que devolve ou altera dado de conta entra aqui **junto com o
endpoint**, não depois. Na Seção 4 este diretório ganha um teste genérico que
percorre todas as rotas registradas automaticamente.

Resposta correta para acesso indevido é **404**, nunca 403 — 403 confirma que
o recurso existe.
