# Scripts utilitários

Scripts operacionais que não fazem parte da aplicação. **Nenhum deles é importado por `app/`** — se você precisar de algo daqui em tempo de execução, o lugar certo é `app/services/`.

| Script | Para quê |
|---|---|
| `guarda_banco.py` | a guarda de produção que os três abaixo usam — não é executável |
| `init_db.py` | cria o schema num banco vazio |
| `reset_db.py` | derruba e recria o schema — **destrói dados** |
| `seed.py` | popula uma conta com volume realista — `python tools/seed.py --projetos 5 --ambientes 25 --biblioteca 300 --itens 500` (defaults iguais aos do exemplo) |

## A guarda

Estes scripts resolvem `DATABASE_URL` do jeito que `app/core/config.py` resolve — não só do ambiente: **variável de ambiente OU, se ela não estiver exportada, o arquivo `.env`** (`SettingsConfigDict(env_file=".env")`). Rodar sem exportar nada não é "sem banco configurado" — é o `.env` local decidindo por você, silenciosamente. E o `.env` aponta para um projeto Supabase **hospedado**, nunca para um banco descartável: qual dos projetos depende de quem configurou a máquina e de quando. Quando o defeito que originou esta guarda foi encontrado, o projeto ativo era o de **produção**.

> O alvo, a partir da Seção 3, é outro: a máquina de desenvolvimento passa a rodar a [stack Supabase local em Docker](../../docs/dev/ambiente.md), e aí a `DATABASE_URL` do `.env` aponta para `127.0.0.1`. Enquanto essa migração não acontece, é a guarda que separa um comando distraído de um banco de verdade.

Por isso os três scripts passam pela mesma guarda, em [`guarda_banco.py`](guarda_banco.py), antes de abrir qualquer conexão. Ela julga a URL **resolvida** — a mesma que `app/db/session.py` usa para criar o engine — e nunca `os.environ["DATABASE_URL"]` direto.

A regra é uma **lista de permissão**, não de proibição. O banco só é aceito se:

1. o host for local (`localhost`, `127.0.0.1`, `::1` — comparados por igualdade, então `localhost.evil.com` não passa); **ou**
2. o nome do banco terminar em `_test` ou `_seed`.

Qualquer outra coisa é recusada, com saída 1 e sem escrever nada — inclusive hospedagens que uma lista de proibição não anteciparia (Neon, Railway, ou o IP cru de uma máquina de produção).

**A guarda não lê a URL: ela pergunta ao driver onde a conexão vai parar.** O host e o nome do banco vêm de `PGDialect_psycopg2().create_connect_args(make_url(url))` — o mesmo caminho que o engine percorre — e é esse destino efetivo que é julgado.

Isso importa porque o libpq aceita parâmetros de query que **vencem** o que está escrito na URL (`?host=`, `?dbname=`, `?hostaddr=`), e porque `urlsplit` e o parser do SQLAlchemy discordam sobre o fragmento `#`. Uma versão anterior desta guarda tentou enumerar esses parâmetros e recusar quem os trouxesse; a lista foi afirmada como completa, não incluía `dbname`, e o furo passou por uma revisão. Perguntar ao driver dispensa a lista — e é por isso que estas duas URLs recebem vereditos opostos, os dois corretos:

```
postgresql://u:s@prod.supabase.co/appdb?host=localhost      → ACEITA  (a conexão vai para localhost)
postgresql://u:s@localhost/arqsmart_test#?host=prod.supabase.co  → recusa  (a conexão vai para o Supabase)
```

O que a guarda recusa de saída é o que ela **não consegue interpretar com segurança**: `hostaddr` (que redireciona o endereço real mantendo o host só para autenticação), URL que não seja de Postgres, e caminho composto. Fail-closed.

A mensagem diz o motivo, de qual das duas fontes a URL veio, e o destino como `host:porta/banco` — **nunca a URL inteira**. Houve uma versão que imprimia a URL com a senha apagada por expressão regular; ela errava em três formas legítimas de libpq, e cada erro desses é uma credencial de produção num log de build arquivado. Montar `host:porta/banco` a partir dos campos não tem como errar.

Mandar um script para um staging remoto de propósito continua possível, com `--eu-sei-o-que-estou-fazendo`. É o ponto: vira uma decisão, não um acidente.

> Até a Seção 3, `reset_db.py` e `init_db.py` não tinham guarda **nenhuma** — e `reset_db.py` faz `DROP SCHEMA public CASCADE`. A suíte e o `seed.py` tinham cada um a sua, com listas de hosts diferentes, e nenhuma das duas era superconjunto da outra. A regra agora é uma só, com testes (`tests/test_guarda_banco.py`).

A suíte de testes é **mais** estrita que a guarda, nos **dois** eixos — ela chama `motivo_de_recusa(..., exigir_host_local=True)`:

- **host:** para os scripts, um banco chamado `arqsmart_test` num Supabase ou RDS compartilhado é aceitável — é o critério 2, e é o que permite semear um staging sem flag. Para a suíte não é: a fixture `engine` roda `drop_all`, e um servidor compartilhado continua compartilhado por mais descartável que o nome do banco pareça.
- **nome:** o sufixo `_test` é obrigatório mesmo em host local. O `localhost/postgres` da stack Supabase local passa pela guarda comum e **não** passa aqui.

Nenhum dos dois é opcional, e nenhum é mais fraco do que a regra que a suíte tinha antes de a guarda ser unificada — o que foi verificado depois de uma primeira tentativa em que o eixo do host tinha, sim, afrouxado.

## `seed.py`

Substituiu os quatro scripts antigos (`seed_clipper.py`, `seed_mock.py`, `seed_products.py`, `seed_tokstok.py`) por um único script parametrizado. Cria (ou reaproveita, por nome) a conta `Seed — volume realista` e escreve tudo dentro dela; `--ambientes` e `--itens` são **totais**, distribuídos entre os projetos, não valores por projeto. Determinístico (`random.seed(42)`) e idempotente por conta — rodar duas vezes produz os mesmos números, lidos do banco com `SELECT count(*)` ao final, não de um contador em memória. O resumo traz duas colunas: o total da tabela e o total **desta conta**. É a segunda que precisa bater entre duas execuções; a primeira só coincide num banco onde mais nada existe. A reescrita cobre também o que **outra pessoa** cria em cima dos projetos/ambientes do seed no staging (apresentação, lançamento financeiro, evento, slot de projeto) — sem isso, rodar o seed de novo depois de alguém clicar no staging quebraria com `ForeignKeyViolation`.

É contra o volume gerado aqui que o orçamento de performance de cada tela é medido nas Seções 6 e 8.
