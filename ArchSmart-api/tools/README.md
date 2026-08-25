# Scripts utilitários

Scripts operacionais que não fazem parte da aplicação. **Nenhum deles é importado por `app/`** — se você precisar de algo daqui em tempo de execução, o lugar certo é `app/services/`.

| Script | Para quê |
|---|---|
| `init_db.py` | cria o schema num banco vazio |
| `reset_db.py` | derruba e recria o schema — **destrói dados** |
| `seed.py` | popula uma conta com volume realista — `python tools/seed.py --projetos 5 --ambientes 25 --biblioteca 300 --itens 500` (defaults iguais aos do exemplo) |

## Aviso

Estes scripts leem `DATABASE_URL` do ambiente. **Confira para onde ela aponta antes de rodar qualquer um** — `reset_db.py` apagado contra produção é irreversível. A suíte de testes tem uma guarda para isso (`tests/conftest.py`); `reset_db.py` e `init_db.py` **não têm**.

`seed.py` tem guarda própria: recusa rodar contra qualquer `DATABASE_URL` que contenha um host gerenciado (`supabase.co`, `pooler.supabase.com`, `render.com`, `amazonaws.com`), a menos que `--eu-sei-o-que-estou-fazendo` seja passado.

## `seed.py`

Substituiu os quatro scripts antigos (`seed_clipper.py`, `seed_mock.py`, `seed_products.py`, `seed_tokstok.py`) por um único script parametrizado. Cria (ou reaproveita, por nome) a conta `Seed — volume realista` e escreve tudo dentro dela; `--ambientes` e `--itens` são **totais**, distribuídos entre os projetos, não valores por projeto. Determinístico (`random.seed(42)`) e idempotente por conta — rodar duas vezes produz os mesmos números, lidos do banco com `SELECT count(*)` ao final, não de um contador em memória.

É contra o volume gerado aqui que o orçamento de performance de cada tela é medido nas Seções 6 e 8.
