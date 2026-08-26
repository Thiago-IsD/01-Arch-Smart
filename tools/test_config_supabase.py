"""
Testes do `supabase/config.toml` — a stack Supabase local.

Rode com: cd tools; python -m unittest test_config_supabase -v

Diferente dos outros testes deste diretorio, este nao testa um script: testa um
arquivo de configuracao. Ele existe porque `supabase init --force` regenera o
`config.toml` inteiro com os padroes da CLI, apagando em silencio as duas
decisoes que este repositorio tomou sobre ele. Nenhuma das duas quebra na hora:
o dano aparece semanas depois, num historico de migracao divergente ou num
container com o nome errado.

Usa `unittest` e `tomllib` da biblioteca padrao de proposito, como os demais
testes de `tools/` — sem venv, sem instalacao, para rodar no CI antes de
qualquer setup. `tomllib` entrou na stdlib no Python 3.11.
"""
import tomllib
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CONFIG = RAIZ / "supabase" / "config.toml"


class TestConfigSupabase(unittest.TestCase):
    def setUp(self):
        # Falha, nao pula. O config.toml e versionado: ausencia dele e regressao,
        # nao "ambiente sem a ferramenta". Um skipTest aqui produziria um verde
        # falso — a suite inteira sairia OK com o arquivo apagado.
        self.assertTrue(
            CONFIG.exists(),
            f"{CONFIG.relative_to(RAIZ)} nao existe. Ele e versionado; se sumiu, "
            "foi apagado por engano. Para recria-lo do zero, `supabase init` na "
            "raiz e reaplique as decisoes que este teste trava.",
        )
        with CONFIG.open("rb") as arquivo:
            self.config = tomllib.load(arquivo)

    def test_e_toml_valido(self):
        """Um config.toml quebrado so da erro na hora do `supabase start`."""
        self.assertIsInstance(self.config, dict)

    def test_migracoes_da_cli_ficam_desligadas(self):
        """
        ADR 0004: o Alembic e a fonte unica do schema. Com a migracao da CLI
        ligada passam a existir dois historicos, e o banco local deixa de ser
        reproduzivel pela receita que o CI testa.
        """
        self.assertIs(
            self.config["db"]["migrations"]["enabled"],
            False,
            "supabase/config.toml: [db.migrations] enabled precisa ser false "
            "(ADR 0004 — Alembic e a fonte unica do schema). Se voce acabou de "
            "rodar `supabase init --force`, ele reverteu esta linha.",
        )

    def test_major_version_e_um_valor_que_a_cli_aceita(self):
        """
        E a decisao mais surpreendente do arquivo, e a que um colega
        bem-intencionado "corrigiria" para 16 — batendo com o banco de teste,
        que e `pgvector/pgvector:pg16`. A CLI entao recusa subir a stack com
        "Invalid db.major_version: 16.", uma mensagem que nao explica nada.

        Os valores aceitos foram medidos nesta maquina com supabase 2.115.0,
        trocando o valor e rodando `supabase status` para cada um de 11 a 20:
        13, 14, 15 e 17 passam; 11, 16, 18, 19 e 20 saem com
        "Invalid db.major_version"; 12 sai com "unsupported".

        O teste aceita a lista medida, e nao so o 17, para nao quebrar se uma
        CLI futura mudar o padrao — mas 16 continua barrado, que e o ponto.
        """
        aceitos = (13, 14, 15, 17)
        self.assertIn(
            self.config["db"]["major_version"],
            aceitos,
            "supabase/config.toml: [db] major_version precisa ser um dos valores "
            f"que a CLI aceita {aceitos}. Em especial, 16 NAO e aceito — o "
            "Supabase nunca ofereceu Postgres 16, e por isso este Postgres local "
            "diverge do banco de teste por um major. Ver o comentario no proprio "
            "config.toml e docs/dev/ambiente.md.",
        )

    def test_project_id_nao_grafa_a_marca_errado(self):
        """
        Art. 8: a marca e "Arq Smart". O `supabase init` preenche o project_id
        com o nome do diretorio de trabalho — hoje `01-Arch-Smart` — e esse
        valor vira nome de container e de volume do Docker.
        """
        project_id = self.config["project_id"]
        for proibido in ("arch", "ark", "ecowe"):
            self.assertNotIn(
                proibido,
                project_id.lower(),
                f"supabase/config.toml: project_id {project_id!r} contem "
                f"{proibido!r}. O `supabase init` herda o nome do diretorio; "
                "fixe um valor que grafe a marca certa.",
            )


if __name__ == "__main__":
    unittest.main()
