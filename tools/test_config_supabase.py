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
        if not CONFIG.exists():
            self.skipTest(
                f"{CONFIG.relative_to(RAIZ)} nao existe — rode `supabase init` na "
                "raiz do repositorio (ver docs/dev/ambiente.md, 'Stack Supabase local')"
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
