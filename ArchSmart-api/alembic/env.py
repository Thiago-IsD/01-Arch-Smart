from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

from app.core.config import settings
from app.db.base import Base
from app.models import * # Import all models to register them with Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.

def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.DATABASE_URL
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # lock_timeout de SESSAO, aplicado antes da primeira migracao: se
        # QUALQUER lock demorar mais que isto para ser adquirido, o comando
        # falha com "canceling statement due to lock timeout", a transacao
        # inteira desfaz e o container sai com erro visivel no log do deploy.
        #
        # Por que precisa existir. Sem lock_timeout o padrao do Postgres e 0
        # — esperar para sempre. As migracoes tomam ACCESS EXCLUSIVE, que
        # bloqueia ate LEITURA, e sao aplicadas com o container ANTIGO ainda
        # servindo trafego (ADR 0007: a migracao roda no CMD do Dockerfile,
        # antes do uvicorn). Uma transacao aberta la, ou um SELECT longo,
        # segura a tabela; sem timeout o container novo fica pendurado sem
        # dizer nada, o health check do Render acaba matando o deploy, e o
        # sintoma que sobra no log e um timeout de health check — que nao
        # aponta para o lock que causou. Com timeout, a falha e a frase certa.
        #
        # Por que 10 segundos. Um deploy normal nao chega perto: cada DDL
        # destas 30 migracoes pega o lock em milissegundos quando ninguem
        # esta segurando a tabela — 10s ja e ordens de grandeza de folga
        # para variacao de rede e para o Supabase sob carga. E curto o
        # bastante para o deploy travado morrer rapido, em vez de consumir
        # a janela do health check em silencio. Nao ha valor "certo" aqui, e
        # sim uma escolha entre falso positivo (curto demais, deploy
        # saudavel reprova) e diagnostico ruim (longo demais, volta a
        # parecer que o container travou): 10s erra para o lado de falhar
        # legivel.
        #
        # **Por que um SET, e nao `connect_args={"options": "-c
        # lock_timeout=10s"}`.** A primeira versao disto usava connect_args,
        # e foi trocada antes de subir. `options` e um PARAMETRO DE STARTUP,
        # negociado no handshake da conexao — e a `DATABASE_URL` de staging e
        # de producao aponta para o POOLER do Supabase (Supavisor, porta
        # 5432; ver o CLAUDE.md da raiz). Um pooler pode repassar, ignorar
        # ou RECUSAR um parametro de startup, e a recusa nao e um degrade
        # elegante: a conexao morre antes da primeira migracao, e como a
        # migracao roda no CMD do container (ADR 0007), TODO deploy morre —
        # staging e producao — sem passo manual no meio para segurar.
        # `SET lock_timeout` e um comando comum, na sessao ja estabelecida:
        # o pooler nao tem o que negociar. Nao troque de volta por parecer
        # mais enxuto; o que se ganharia em linhas se paga na primeira vez
        # que o Supavisor nao gostar do parametro.
        #
        # O `commit()` e necessario: `SET` (sem LOCAL) e de sessao, mas
        # desfaz junto se a transacao implicita que o SQLAlchemy 2.0 abriu
        # for revertida. Commitando aqui, o valor sobrevive para a
        # transacao das migracoes — e fecha a transacao implicita antes de
        # `context.begin_transaction()`, que abriria outra e reclamaria.
        connection.exec_driver_sql("SET lock_timeout = '10s'")
        connection.commit()

        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        # Transacao unica para as 30 migracoes, de proposito. `env.py` NAO
        # passa `transaction_per_migration`: as 30 commitam juntas ou
        # nenhuma commita — e o que faz um container morto no meio do
        # upgrade desfazer tudo limpo, e o que torna seguros os `add_column`
        # nao idempotentes que estas migracoes usam. O custo dessa escolha e
        # justamente segurar o ACCESS EXCLUSIVE ate o fim do upgrade; o
        # lock_timeout acima limita a espera POR lock, nao a duracao da
        # transacao. Ver ADR 0007.
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
