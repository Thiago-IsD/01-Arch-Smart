"""Testes do validador de contraste. Só biblioteca padrão, como todo tools/."""
import unittest

import contraste


class TestMatematica(unittest.TestCase):
    def test_preto_no_branco_e_21(self):
        preto = (0.0, 0.0, 0.0)
        branco = (0.0, 0.0, 100.0)
        self.assertAlmostEqual(contraste.contraste(preto, branco), 21.0, places=1)

    def test_cor_contra_ela_mesma_e_1(self):
        cor = (180.0, 100.0, 25.1)
        self.assertAlmostEqual(contraste.contraste(cor, cor), 1.0, places=6)

    def test_e_simetrico(self):
        a, b = (0.0, 0.0, 0.0), (0.0, 0.0, 100.0)
        self.assertAlmostEqual(contraste.contraste(a, b), contraste.contraste(b, a))


class TestLeituraDoTema(unittest.TestCase):
    def test_o_tema_escuro_herda_o_que_nao_sobrescreve(self):
        claro, escuro = contraste.tokens_dos_temas()
        # `.dark` nao redefine --radius; o tema escuro tem que herda-lo de :root.
        self.assertIn("secondary", escuro)
        self.assertEqual(claro["secondary"], escuro["secondary"])

    def test_o_par_fundo_texto_geral_entra(self):
        claro, _ = contraste.tokens_dos_temas()
        nomes = [nome for nome, _, _ in contraste.pares(claro)]
        self.assertIn("background", nomes)


class TestReprovados(unittest.TestCase):
    def test_lista_os_quatro_pares_reprovados_de_hoje(self):
        self.assertEqual(
            contraste.reprovados(),
            ["claro:destructive", "claro:muted", "claro:secondary", "escuro:secondary"],
        )

    def test_par_novo_reprovado_aparece(self):
        css = """
        :root { --zzz: 0 0% 90%; --zzz-foreground: 0 0% 95%; }
        .dark { }
        """
        self.assertIn("claro:zzz", contraste.reprovados(css))

    def test_par_novo_aprovado_nao_aparece(self):
        css = """
        :root { --zzz: 0 0% 10%; --zzz-foreground: 0 0% 100%; }
        .dark { }
        """
        self.assertNotIn("claro:zzz", contraste.reprovados(css))


if __name__ == "__main__":
    unittest.main()
