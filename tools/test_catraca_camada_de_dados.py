"""Testes das duas medidas que a Secao 5 acrescentou a catraca."""
import re
import tempfile
import unittest
from pathlib import Path

from catraca import RE_FETCH, RE_SUPABASE, contar_ocorrencias


class TestContagem(unittest.TestCase):
    def _arvore(self, arquivos: dict[str, str]) -> Path:
        raiz = Path(tempfile.mkdtemp())
        for nome, conteudo in arquivos.items():
            caminho = raiz / nome
            caminho.parent.mkdir(parents=True, exist_ok=True)
            caminho.write_text(conteudo, encoding="utf-8")
        return raiz

    def test_conta_ocorrencia_e_nao_linha(self):
        raiz = self._arvore({"a.ts": "fetch(x); fetch(y)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_FETCH), 2)

    def test_nao_confunde_prefetch_com_fetch(self):
        raiz = self._arvore({"a.ts": "queryClient.prefetchQuery({})\nprefetch(url)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_FETCH), 0)

    def test_isenta_lib_api(self):
        raiz = self._arvore({"lib/api/client.ts": "fetch(url)\n", "app/tela.tsx": "fetch(url)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_FETCH, (raiz / "lib" / "api",)), 1)

    def test_isenta_arquivo_avulso_alem_de_diretorio(self):
        raiz = self._arvore({"proxy.ts": "createServerClient(a, b)\n", "app/tela.tsx": "createBrowserClient(a, b)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_SUPABASE, (raiz / "proxy.ts",)), 1)

    def test_ignora_arquivo_que_nao_e_ts(self):
        raiz = self._arvore({"leia.md": "fetch(url)\n"})
        self.assertEqual(contar_ocorrencias(raiz, RE_FETCH), 0)


if __name__ == "__main__":
    unittest.main()
