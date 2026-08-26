import os
import sys

from dotenv import load_dotenv

# Load env file first
load_dotenv(".env")

# Faz "python tools/init_db.py" achar o pacote `app` e o pacote `tools`.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.guarda_banco import (  # noqa: E402
    descrever_destino,
    recusar_se_nao_descartavel,
    resolver_url_e_origem,
)


def init_db(forcado: bool = False):
    # Ate a Secao 3 este script nao tinha guarda: ele resolve a URL do mesmo
    # settings que, sem DATABASE_URL exportada, cai no .env — que na maquina de
    # desenvolvimento aponta para o Supabase de producao. create_all nao apaga
    # dado, mas cria tabela em banco alheio, que tambem nao e para acontecer
    # por acidente.
    url, origem = resolver_url_e_origem()
    recusar_se_nao_descartavel(
        url,
        origem=origem,
        forcado=forcado,
        acao="criar todas as tabelas dos models (create_all) neste banco",
    )

    from app.db.session import engine
    from app.models.all_models import Base

    print(f"Creating mock database tables in: {descrever_destino(url)}  (origem: {origem})")
    Base.metadata.create_all(bind=engine)
    print("Done!")


if __name__ == "__main__":
    init_db(forcado="--eu-sei-o-que-estou-fazendo" in sys.argv)
