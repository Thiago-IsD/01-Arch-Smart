"""
Testes do calculador de progresso.

Rode com: cd tools; python -m unittest test_progresso -v

Usa `unittest` da biblioteca padrao de proposito: o script nao tem dependencia
externa, e o teste dele nao deve introduzir uma. Assim roda em qualquer Python,
sem venv nem instalacao — inclusive no CI da Secao 3.
"""
import unittest

from progresso import contar, renderizar_barra, secoes_sem_resumo


class TestContagem(unittest.TestCase):
    def test_conta_caixas_marcadas_e_totais(self):
        texto = """
## Seção 1 · Segurança
- [x] T1.1 feito
- [x] T1.2 feito
## Seção 2 · Estrutura
- [ ] T2.1 pendente
- [x] T2.2 feito
"""
        self.assertEqual(
            contar(texto),
            {"Seção 1 · Segurança": (2, 2), "Seção 2 · Estrutura": (1, 2)},
        )

    def test_ignora_caixas_fora_de_secao(self):
        texto = "- [x] solta\n## Seção 1 · A\n- [x] dentro\n"
        self.assertEqual(contar(texto), {"Seção 1 · A": (1, 1)})

    def test_conta_caixa_x_maiuscula(self):
        texto = "## Seção 1 · A\n- [X] feito\n- [ ] pendente\n"
        self.assertEqual(contar(texto), {"Seção 1 · A": (1, 2)})


class TestBarra(unittest.TestCase):
    def test_barra_reflete_a_proporcao(self):
        self.assertEqual(renderizar_barra(0, 4).count("█"), 0)
        self.assertEqual(renderizar_barra(4, 4).count("█"), 20)
        self.assertEqual(renderizar_barra(2, 4).count("█"), 10)

    def test_secao_vazia_nao_divide_por_zero(self):
        self.assertEqual(renderizar_barra(0, 0).count("█"), 0)


class TestFormatoDeResumo(unittest.TestCase):
    """Um resumo ("**F/T (P%)** `barra`") fora do lugar não pode sumir em
    silêncio da conferência — precisa aparecer como formato quebrado."""

    def test_secao_com_linha_em_branco_antes_do_resumo(self):
        texto = (
            "## Seção 1 · A\n"
            "\n"
            "**1/1 (100%)** `████████████████████`\n"
            "- [x] feito\n"
        )
        self.assertEqual(secoes_sem_resumo(texto), ["Seção 1 · A"])

    def test_secao_sem_linha_de_resumo_nenhuma(self):
        texto = "## Seção 1 · A\n- [x] feito\n"
        self.assertEqual(secoes_sem_resumo(texto), ["Seção 1 · A"])

    def test_secao_com_resumo_no_formato_certo_nao_acusa_nada(self):
        texto = "## Seção 1 · A\n**1/1 (100%)** `████████████████████`\n- [x] feito\n"
        self.assertEqual(secoes_sem_resumo(texto), [])


if __name__ == "__main__":
    unittest.main()
