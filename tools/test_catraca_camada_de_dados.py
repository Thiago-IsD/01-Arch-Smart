"""Testes das duas medidas que a Secao 5 acrescentou a catraca."""
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import catraca
from catraca import DiretorioMedidoSumiu, RE_FETCH, RE_SUPABASE, contar_ocorrencias


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

    def test_diretorio_inexistente_falha(self):
        """
        Fail-closed, no mesmo espirito de `contar_cores` (ver
        `test_catraca.py::test_diretorio_de_cores_inexistente_falha`). A
        Secao 9 renomeia ArchSmart-web/ para web/; sem isto, o dia do rename
        zeraria `fetch_fora_de_lib_api`/`supabase_fora_de_lib_api` em
        silencio, e o portao ficaria verde convidando a gravar 0 no baseline.
        """
        raiz = Path(tempfile.mkdtemp()) / "nao_existe"
        with self.assertRaises(DiretorioMedidoSumiu):
            contar_ocorrencias(raiz, RE_FETCH)


class TestAuditarBaselineComChaveNova(unittest.TestCase):
    """
    Regressao do achado do Review de Codigo na Tarefa 11: `_auditar_baseline`
    chamava `medidas_pioradas` sem distinguir "chave nova nesta branch" de
    "chave que sumiu desta branch" — as duas caiam no mesmo `base is None`, e
    uma medida nova (nascendo do zero, como as duas desta tarefa) reprovava o
    job `Repositorio` com o diagnostico invertido de "o baseline afrouxou".
    """

    def _catraca_json(self, dados: dict) -> Path:
        arquivo = Path(tempfile.mkdtemp()) / "catraca.json"
        arquivo.write_text(json.dumps(dados), encoding="utf-8")
        return arquivo

    def test_chave_nova_nesta_branch_nao_reprova(self):
        atual = self._catraca_json({"cores_literais": 521, "fetch_fora_de_lib_api": 76})
        base = self._catraca_json({"cores_literais": 521})
        with mock.patch.object(catraca, "BASELINE", atual):
            self.assertEqual(catraca._auditar_baseline(base), 0)

    def test_chave_que_sumiu_desta_branch_reprova(self):
        atual = self._catraca_json({"cores_literais": 521})
        base = self._catraca_json({"cores_literais": 521, "fetch_fora_de_lib_api": 76})
        with mock.patch.object(catraca, "BASELINE", atual):
            self.assertEqual(catraca._auditar_baseline(base), 1)

    def test_leia_me_so_no_lado_da_base_nao_reprova(self):
        """
        `_leia-me` e filtrado do lado de `atual` (comentario, nao medida) mas
        o arquivo de referencia (`base`) e lido sem filtro nenhum. Um
        `catraca.json` mais antigo com `_leia-me` e um mais novo sem ele
        pareceria "chave sumiu" se os dois lados nao forem filtrados da
        mesma forma -- foi exatamente o que a primeira versao deste conserto
        fazia, e este teste existe para nao deixar isso voltar.
        """
        atual = self._catraca_json({"cores_literais": 521})
        base = self._catraca_json({"_leia-me": "texto qualquer", "cores_literais": 521})
        with mock.patch.object(catraca, "BASELINE", atual):
            self.assertEqual(catraca._auditar_baseline(base), 0)


if __name__ == "__main__":
    unittest.main()
