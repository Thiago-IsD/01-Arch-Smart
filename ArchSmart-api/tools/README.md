# Scripts utilitários

Scripts operacionais que não fazem parte da aplicação. **Nenhum deles é importado por `app/`** — se você precisar de algo daqui em tempo de execução, o lugar certo é `app/services/`.

| Script | Para quê |
|---|---|
| `guarda_banco.py` | a guarda de produção que os três abaixo usam — não é executável |
| `init_db.py` | cria o schema num banco vazio |
| `reset_db.py` | derruba e recria o schema — **destrói dados** |
| `seed.py` | popula uma conta com volume realista — `python tools/seed.py --projetos 5 --ambientes 25 --biblioteca 300 --itens 500` (defaults iguais aos do exemplo) |

## A guarda

Estes scripts resolvem `DATABASE_URL` do jeito que `app/core/config.py` resolve — não só do ambiente: **variável de ambiente OU, se ela não estiver exportada, o arquivo `.env`** (`SettingsConfigDict(env_file=".env")`). Rodar sem exportar nada não é "sem banco configurado" — é o `.env` local decidindo por você, silenciosamente. E o `.env` da máquina de desenvolvimento aponta para o Supabase **de produção**.

Por isso os três scripts passam pela mesma guarda, em [`guarda_banco.py`](guarda_banco.py), antes de abrir qualquer conexão. Ela julga a URL **resolvida** — a mesma que `app/db/session.py` usa para criar o engine — e nunca `os.environ["DATABASE_URL"]` direto.

A regra é uma **lista de permissão**, não de proibição. O banco só é aceito se:

1. o host for local (`localhost`, `127.0.0.1`, `::1`); **ou**
2. o nome do banco terminar em `_test` ou `_seed`.

Qualquer outra coisa é recusada, com saída 1 e sem escrever nada — inclusive hospedagens que uma lista de proibição não anteciparia (Neon, Railway, ou o IP cru de uma máquina de produção). A mensagem diz o motivo, de qual das duas fontes a URL veio, e **redige a senha**.

Mandar um script para um staging remoto de propósito continua possível, com `--eu-sei-o-que-estou-fazendo`. É o ponto: vira uma decisão, não um acidente.

> Até a Seção 3, `reset_db.py` e `init_db.py` não tinham guarda **nenhuma** — e `reset_db.py` faz `DROP SCHEMA public CASCADE`. A suíte e o `seed.py` tinham cada um a sua, com listas de hosts diferentes, e nenhuma das duas era superconjunto da outra. A regra agora é uma só, com testes (`tests/test_guarda_banco.py`).

A suíte de testes continua sendo **mais** estrita que a guarda: em `tests/conftest.py`, o sufixo `_test` é obrigatório mesmo num banco local, porque ela apaga e recria o schema inteiro a cada execução.

## `seed.py`

Substituiu os quatro scripts antigos (`seed_clipper.py`, `seed_mock.py`, `seed_products.py`, `seed_tokstok.py`) por um único script parametrizado. Cria (ou reaproveita, por nome) a conta `Seed — volume realista` e escreve tudo dentro dela; `--ambientes` e `--itens` são **totais**, distribuídos entre os projetos, não valores por projeto. Determinístico (`random.seed(42)`) e idempotente por conta — rodar duas vezes produz os mesmos números, lidos do banco com `SELECT count(*)` ao final, não de um contador em memória. O resumo traz duas colunas: o total da tabela e o total **desta conta**. É a segunda que precisa bater entre duas execuções; a primeira só coincide num banco onde mais nada existe. A reescrita cobre também o que **outra pessoa** cria em cima dos projetos/ambientes do seed no staging (apresentação, lançamento financeiro, evento, slot de projeto) — sem isso, rodar o seed de novo depois de alguém clicar no staging quebraria com `ForeignKeyViolation`.

É contra o volume gerado aqui que o orçamento de performance de cada tela é medido nas Seções 6 e 8.
