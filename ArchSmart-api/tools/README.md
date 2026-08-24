# Scripts utilitários

Scripts operacionais que não fazem parte da aplicação. **Nenhum deles é importado por `app/`** — se você precisar de algo daqui em tempo de execução, o lugar certo é `app/services/`.

| Script | Para quê |
|---|---|
| `init_db.py` | cria o schema num banco vazio |
| `reset_db.py` | derruba e recria o schema — **destrói dados** |
| `seed_clipper.py` · `seed_mock.py` · `seed_products.py` · `seed_tokstok.py` | populam dados de exemplo |

## Aviso

Estes scripts leem `DATABASE_URL` do ambiente. **Confira para onde ela aponta antes de rodar qualquer um** — `reset_db.py` apagado contra produção é irreversível. A suíte de testes tem uma guarda para isso (`tests/conftest.py`); estes scripts **não têm**.

## O que muda na Seção 3

Os quatro `seed_*` serão substituídos por um `tools/seed.py` único e parametrizado, capaz de gerar o volume realista contra o qual a performance de cada tela é medida. Eles estão aqui como estão até lá.
