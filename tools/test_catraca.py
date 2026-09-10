"""
Testes da catraca.

Rode com: cd tools; python -m unittest test_catraca -v

Usa `unittest` da biblioteca padrao pelo mesmo motivo de test_progresso.py: o
script nao tem dependencia externa, e o teste dele nao deve introduzir uma.
"""
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import catraca
from catraca import (
    DiretorioMedidoSumiu,
    comparar,
    contar_cores,
    decidir_atualizacao,
    medidas_pioradas,
    medir,
    modulos_sem_doc,
)


class TestContagemDeCores(unittest.TestCase):
    def _escrever(self, conteudo, nome="Componente.tsx"):
        dir_temp = Path(tempfile.mkdtemp())
        (dir_temp / nome).write_text(conteudo, encoding="utf-8")
        return dir_temp

    def test_conta_classe_de_paleta(self):
        raiz = self._escrever('<div className="bg-emerald-600 text-slate-50" />')
        self.assertEqual(contar_cores(raiz), 2)

    def test_conta_cor_arbitraria(self):
        raiz = self._escrever('<div className="bg-[#F88379]" />')
        self.assertEqual(contar_cores(raiz), 1)

    def test_ignora_token_semantico(self):
        raiz = self._escrever('<div className="bg-primary text-muted-foreground" />')
        self.assertEqual(contar_cores(raiz), 0)

    def test_ignora_arquivo_que_nao_e_ts_nem_tsx(self):
        raiz = self._escrever("bg-emerald-600", nome="LEIAME.md")
        self.assertEqual(contar_cores(raiz), 0)


class TestModulosSemDoc(unittest.TestCase):
    def _base(self):
        base = Path(tempfile.mkdtemp())
        (base / "services").mkdir()
        (base / "modulos").mkdir()
        return base

    def test_service_sem_doc_aparece(self):
        base = self._base()
        (base / "services" / "cobranca_service.py").write_text("", encoding="utf-8")
        self.assertEqual(
            modulos_sem_doc(base / "services", None, base / "modulos"),
            ["cobranca_service"],
        )

    def test_service_com_doc_nao_aparece(self):
        base = self._base()
        (base / "services" / "cobranca_service.py").write_text("", encoding="utf-8")
        (base / "modulos" / "cobranca_service.md").write_text("# doc", encoding="utf-8")
        self.assertEqual(modulos_sem_doc(base / "services", None, base / "modulos"), [])

    def test_diretorio_de_services_inexistente_falha(self):
        """
        Fail-closed, e este teste antes consagrava o contrario.

        Devolver lista vazia faz a catraca anunciar "baixou" quando o que houve
        foi o diretorio mudar de nome. Tem data marcada: a Secao 9 renomeia
        ArchSmart-api/ e ArchSmart-web/. No dia do rename as duas medidas
        zerariam, o portao ficaria verde e convidaria a gravar 0 no baseline.
        """
        base = self._base()
        with self.assertRaises(DiretorioMedidoSumiu):
            modulos_sem_doc(base / "nao_existe", None, base / "modulos")

    def test_features_inexistente_continua_tolerado(self):
        """
        `src/features/` e a excecao deliberada: ele so passa a existir na Secao
        5. Ausencia dele e o estado esperado hoje, nao um rename.
        """
        base = self._base()
        (base / "services").mkdir(parents=True, exist_ok=True)
        self.assertEqual(
            modulos_sem_doc(base / "services", base / "features_que_nao_existe", base / "modulos"),
            [],
        )

    def test_diretorio_de_cores_inexistente_falha(self):
        base = self._base()
        with self.assertRaises(DiretorioMedidoSumiu):
            contar_cores(base / "src_que_nao_existe")


class TestBaselineAusente(unittest.TestCase):
    """
    Apagar uma chave numerica do catraca.json desligava a medida em silencio, e
    um --atualizar seguinte gravava o numero novo sem nenhum aviso. A recusa do
    --atualizar guarda a ferramenta; estes testes guardam o arquivo.
    """

    def test_chave_numerica_ausente_falha_a_comparacao(self):
        ok, linhas = comparar({}, {"cores_literais": 524})
        self.assertFalse(ok)
        self.assertIn("SEM BASELINE", "\n".join(linhas))

    def test_chave_numerica_ausente_conta_como_piora(self):
        pioras = medidas_pioradas({}, {"cores_literais": 524})
        self.assertEqual(len(pioras), 1)
        self.assertIn("sem baseline", pioras[0])

    def test_atualizar_recusa_quando_a_chave_sumiu(self):
        gravar, avisos = decidir_atualizacao({}, {"cores_literais": 524}, aceitar_piora=False)
        self.assertFalse(gravar)
        self.assertIn("recusou", "\n".join(avisos))

    def test_chave_em_lista_ausente_falha_mesmo_medindo_vazio(self):
        # `set(valor) - set(base or [])` da vazio quando os dois lados sao
        # vazios, e o ramo de lista nunca passava pelo "SEM BASELINE" (que so
        # existia para escalar) -- uma medida em lista nova que meca zero
        # itens hoje passava em silencio. `contraste_reprovado` escapou disso
        # por sorte: nasceu com 4 itens, nao com 0.
        ok, linhas = comparar({}, {"modulos_sem_doc": []})
        self.assertFalse(ok)
        self.assertIn("SEM BASELINE", "\n".join(linhas))

    def test_chave_em_lista_presente_e_vazia_e_legitima(self):
        # Distinto do caso acima: chave presente no baseline com lista vazia
        # e uma catraca no piso (como supabase_fora_de_lib_api) e tem que
        # continuar passando.
        ok, linhas = comparar({"modulos_sem_doc": []}, {"modulos_sem_doc": []})
        self.assertTrue(ok)
        self.assertNotIn("SEM BASELINE", "\n".join(linhas))


class TestComparacao(unittest.TestCase):
    def test_subir_falha(self):
        ok, linhas = comparar({"cores_literais": 521}, {"cores_literais": 522})
        self.assertFalse(ok)
        self.assertIn("SUBIU", "\n".join(linhas))

    def test_manter_passa(self):
        ok, _ = comparar({"cores_literais": 521}, {"cores_literais": 521})
        self.assertTrue(ok)

    def test_descer_passa_e_avisa(self):
        ok, linhas = comparar({"cores_literais": 521}, {"cores_literais": 500})
        self.assertTrue(ok)
        self.assertIn("baixou", "\n".join(linhas))

    def test_modulo_novo_sem_doc_falha(self):
        ok, linhas = comparar(
            {"modulos_sem_doc": ["ai_service"]},
            {"modulos_sem_doc": ["ai_service", "cobranca_service"]},
        )
        self.assertFalse(ok)
        self.assertIn("cobranca_service", "\n".join(linhas))


class TestMedidasPioradas(unittest.TestCase):
    def test_nada_piora_nao_lista_nada(self):
        self.assertEqual(
            medidas_pioradas({"cores_literais": 521}, {"cores_literais": 521}), []
        )
        self.assertEqual(
            medidas_pioradas({"cores_literais": 521}, {"cores_literais": 500}), []
        )

    def test_numero_que_sobe_aparece(self):
        pioras = medidas_pioradas({"cores_literais": 521}, {"cores_literais": 522})
        self.assertEqual(pioras, ["cores_literais: 521 -> 522"])

    def test_modulo_novo_sem_doc_conta_como_piora(self):
        pioras = medidas_pioradas(
            {"modulos_sem_doc": ["ai_service"]},
            {"modulos_sem_doc": ["ai_service", "cobranca_service"]},
        )
        self.assertEqual(len(pioras), 1)
        self.assertIn("cobranca_service", pioras[0])


class TestDecidirAtualizacao(unittest.TestCase):
    def test_nada_piorou_deixa_gravar_sem_avisos(self):
        grava, avisos = decidir_atualizacao(
            {"cores_literais": 521}, {"cores_literais": 521}, aceitar_piora=False
        )
        self.assertTrue(grava)
        self.assertEqual(avisos, [])

    def test_piorou_sem_flag_recusa_gravar(self):
        grava, avisos = decidir_atualizacao(
            {"cores_literais": 521}, {"cores_literais": 522}, aceitar_piora=False
        )
        self.assertFalse(grava)
        self.assertIn("521 -> 522", "\n".join(avisos))

    def test_piorou_com_flag_grava_e_avisa(self):
        grava, avisos = decidir_atualizacao(
            {"cores_literais": 521}, {"cores_literais": 522}, aceitar_piora=True
        )
        self.assertTrue(grava)
        self.assertIn("521 -> 522", "\n".join(avisos))

    def test_modulo_novo_sem_doc_conta_como_piora_e_recusa(self):
        grava, avisos = decidir_atualizacao(
            {"modulos_sem_doc": ["ai_service"]},
            {"modulos_sem_doc": ["ai_service", "cobranca_service"]},
            aceitar_piora=False,
        )
        self.assertFalse(grava)
        self.assertIn("cobranca_service", "\n".join(avisos))


class TestMainAtualizarIgnoraChaveDeDocumentacao(unittest.TestCase):
    """`_leia-me` documenta o catraca.json; `medir()` nunca a devolve.

    `decidir_atualizacao`, chamado com o baseline cru, tratava a ausencia de
    `_leia-me` em `medido` como "a chave sumiu" — uma piora — e isso reprovava
    TODO `--atualizar` sem `--aceitar-piora`, mesmo sem nenhuma medida real
    ter piorado. So nao apareceu antes porque todo teste de
    `decidir_atualizacao`/`medidas_pioradas` neste arquivo usa dicts sem
    `_leia-me`; o defeito só existia no caminho de `main()` contra o
    catraca.json de verdade, que sempre tem essa chave.
    """

    def test_atualizar_grava_mesmo_sem_flag_quando_nada_piorou(self):
        medido_real = medir(None)
        baseline_sem_regressao = {"_leia-me": "comentario, nao e medida", **medido_real}
        with tempfile.TemporaryDirectory() as diretorio:
            baseline_temp = Path(diretorio) / "catraca.json"
            baseline_temp.write_text(json.dumps(baseline_sem_regressao), encoding="utf-8")
            with mock.patch.object(catraca, "BASELINE", baseline_temp):
                codigo = catraca.main(["--atualizar"])
            self.assertEqual(codigo, 0)
            gravado = json.loads(baseline_temp.read_text(encoding="utf-8"))
            self.assertEqual(gravado["_leia-me"], "comentario, nao e medida")


class TestMedidasDeAcessibilidade(unittest.TestCase):
    def test_conta_tabindex_negativo(self):
        self.assertEqual(catraca.medir(None)["tabindex_negativo"], 5)

    def test_conta_hover_sem_focus(self):
        # O brief da Tarefa 7 previa 8, medido com grep de substring simples.
        # O regex real so casa `group-hover:` literal, nao o grupo nomeado do
        # Tailwind (`group-hover/nome:`); 3 das 8 linhas usam grupo nomeado
        # (MainBudgetArea.tsx), entao o medido e 5. Ver tools/catraca.py e
        # task-7-report.md.
        self.assertEqual(catraca.medir(None)["hover_sem_focus"], 5)

    def test_linha_com_focus_within_nao_conta(self):
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="opacity-0 group-hover:opacity-100 focus-within:opacity-100"'
            ),
            0,
        )

    def test_linha_com_focus_proprio_tambem_nao_conta(self):
        # O elemento aparece quando ELE recebe foco. E acessivel por teclado —
        # contar isso seria medir um defeito que nao existe (ver toast.tsx:80).
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="opacity-0 group-hover:opacity-100 focus:opacity-100"'
            ),
            0,
        )

    def test_linha_sem_nenhum_foco_conta(self):
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="opacity-0 group-hover:opacity-100"'
            ),
            1,
        )


if __name__ == "__main__":
    unittest.main()
