"""
Testes do verificador de links.

Rode com: cd tools; python -m unittest test_checa_links -v

Usa `unittest` da biblioteca padrao pelo mesmo motivo de test_progresso.py:
o script nao tem dependencia externa, e o teste dele nao deve introduzir uma.
"""
import unittest
from pathlib import Path

from checa_links import quebrados_no_texto, remove_blocos_cercados


class TestRemoveBlocosCercados(unittest.TestCase):
    def test_apaga_conteudo_de_bloco_simples(self):
        texto = "antes\n```\nlinha dentro\n```\ndepois\n"
        resultado = remove_blocos_cercados(texto)
        self.assertNotIn("linha dentro", resultado)
        self.assertIn("antes", resultado)
        self.assertIn("depois", resultado)

    def test_bloco_com_linguagem_declarada(self):
        texto = "```markdown\n[link](nao-existe.md)\n```\n"
        resultado = remove_blocos_cercados(texto)
        self.assertNotIn("nao-existe.md", resultado)

    def test_cerca_menor_dentro_nao_fecha_cerca_maior(self):
        # Regra do CommonMark: só fecha com o mesmo caractere e comprimento
        # igual ou maior — uma cerca de 3 crases dentro de um bloco aberto
        # com 4 é conteúdo, não fechamento.
        texto = "````\n```\nainda dentro\n````\ndepois\n"
        resultado = remove_blocos_cercados(texto)
        self.assertNotIn("ainda dentro", resultado)
        self.assertIn("depois", resultado)

    def test_til_nao_fecha_cerca_de_crase(self):
        texto = "```\n~~~\nainda dentro\n```\ndepois\n"
        resultado = remove_blocos_cercados(texto)
        self.assertNotIn("ainda dentro", resultado)
        self.assertIn("depois", resultado)

    def test_texto_sem_cerca_fica_intacto(self):
        texto = "linha 1\nlinha 2\n"
        self.assertEqual(remove_blocos_cercados(texto), texto)


class TestQuebradosNoTexto(unittest.TestCase):
    def test_acusa_link_quebrado_fora_de_bloco_cercado(self):
        texto = "[link](arquivo-que-nao-existe.md)\n"
        self.assertEqual(
            quebrados_no_texto(texto, Path(".")), ["arquivo-que-nao-existe.md"]
        )

    def test_nao_acusa_link_quebrado_dentro_de_bloco_cercado(self):
        # Simula o caso real: markdown de exemplo com um link que so faria
        # sentido resolvido a partir de outro arquivo, dentro de uma cerca.
        texto_bruto = "```markdown\n[link](arquivo-que-nao-existe.md)\n```\n"
        texto = remove_blocos_cercados(texto_bruto)
        self.assertEqual(quebrados_no_texto(texto, Path(".")), [])

    def test_nao_acusa_link_existente(self):
        texto = "[link](checa_links.py)\n"
        self.assertEqual(quebrados_no_texto(texto, Path(".")), [])

    def test_ignora_url_absoluta_e_ancora(self):
        texto = "[link](https://exemplo.com)\n[ancora](#secao)\n"
        self.assertEqual(quebrados_no_texto(texto, Path(".")), [])


if __name__ == "__main__":
    unittest.main()
