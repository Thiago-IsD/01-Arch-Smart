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
    arquivos_grandes,
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
        # Rodada 1 de revisao: a regua ampliada (grupo nomeado dos dois lados)
        # mede 8, batendo o numero do brief -- mas medido, nao suposto. Ver
        # tools/catraca.py (RE_GROUP_HOVER/RE_FOCUS) e task-7-report.md.
        self.assertEqual(catraca.medir(None)["hover_sem_focus"], 8)

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

    def test_grupo_nomeado_sem_foco_conta(self):
        # `group-hover/opt:` e o mesmo defeito que `group-hover:` -- e a forma
        # que escapava da regua antes da Rodada 1 de revisao (MainBudgetArea.tsx).
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="opacity-0 group-hover/opt:opacity-100"'
            ),
            1,
        )

    def test_grupo_nomeado_com_conserto_nomeado_nao_conta(self):
        # O conserto tambem pode usar a forma nomeada do Tailwind
        # (`group-focus/opt:`). Sem RE_FOCUS aceitar isso, esta linha ja
        # acessivel por teclado viraria falso positivo -- o mesmo problema que
        # toast.tsx:80 tinha antes de RE_FOCUS aceitar `focus:` puro.
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="opacity-0 group-hover/opt:opacity-100 group-focus/opt:opacity-100"'
            ),
            0,
        )

    def test_grupo_nomeado_com_focus_within_nomeado_nao_conta(self):
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="opacity-0 group-hover/opt:opacity-100 focus-within/opt:opacity-100"'
            ),
            0,
        )


class TestArquivosGrandes(unittest.TestCase):
    """A medida de tamanho de arquivo que a Tarefa 9 da Secao 6 acrescentou.

    `arquivos_grandes` devolve caminho relativo a `catraca.RAIZ`, entao todo
    teste daqui aponta a RAIZ para o diretorio temporario -- senao
    `relative_to` estoura.
    """

    def _raiz(self):
        return Path(tempfile.mkdtemp())

    def _arquivo(self, raiz, nome, linhas):
        caminho = raiz / nome
        caminho.parent.mkdir(parents=True, exist_ok=True)
        caminho.write_text("\n".join("x" for _ in range(linhas)), encoding="utf-8")
        return caminho

    def _medir(self, raiz):
        with mock.patch.object(catraca, "RAIZ", raiz):
            return arquivos_grandes(raiz)

    def test_arquivo_com_exatamente_400_linhas_nao_entra(self):
        # O criterio e "acima de", nao "a partir de": 400 esta no limite e
        # passa. Um `>=` aqui poria arquivos no baseline sem que nenhum
        # tivesse crescido.
        raiz = self._raiz()
        self._arquivo(raiz, "NoLimite.tsx", catraca.LIMITE_DE_LINHAS)
        self.assertEqual(self._medir(raiz), [])

    def test_arquivo_com_401_linhas_entra(self):
        raiz = self._raiz()
        self._arquivo(raiz, "UmaLinhaAcima.tsx", catraca.LIMITE_DE_LINHAS + 1)
        self.assertEqual(self._medir(raiz), ["UmaLinhaAcima.tsx"])

    def test_ignora_extensao_que_nao_e_ts_nem_tsx(self):
        # A medida existe para o codigo que a Secao 8 vai editar. Um .md ou um
        # .json enorme nao e o defeito que ela mede.
        raiz = self._raiz()
        self._arquivo(raiz, "LEIAME.md", 900)
        self._arquivo(raiz, "dados.json", 900)
        self.assertEqual(self._medir(raiz), [])

    def test_conta_ts_e_tsx(self):
        raiz = self._raiz()
        self._arquivo(raiz, "a.ts", 401)
        self._arquivo(raiz, "b.tsx", 401)
        self.assertEqual(self._medir(raiz), ["a.ts", "b.tsx"])

    def test_caminho_e_relativo_a_raiz_e_com_barra_posix(self):
        # O baseline versionado tem que ser igual no Windows e no runner do CI:
        # `as_posix()` e o que garante isso. Sem ele o mesmo arquivo entraria
        # com separador de Windows numa maquina e com barra na outra, e o job
        # `Repositorio` acusaria um arquivo "novo" a cada troca de sistema.
        raiz = self._raiz()
        self._arquivo(raiz, "src/telas/Grande.tsx", 500)
        self.assertEqual(self._medir(raiz), ["src/telas/Grande.tsx"])

    def test_lista_sai_ordenada(self):
        raiz = self._raiz()
        for nome in ("zebra.tsx", "abacate.tsx", "melancia.tsx"):
            self._arquivo(raiz, nome, 401)
        self.assertEqual(
            self._medir(raiz), ["abacate.tsx", "melancia.tsx", "zebra.tsx"]
        )

    def test_diretorio_sumido_falha_em_vez_de_medir_vazio(self):
        # Mesmo motivo de contar_cores: devolver [] quando o diretorio sumiu
        # faria a catraca anunciar "baixou -- agora abaixo do limite: <todos>"
        # e convidar a gravar a medida vazia. A Secao 9 renomeia
        # ArchSmart-web/ para web/; e nesse dia que isto vale.
        raiz = self._raiz()
        with self.assertRaises(DiretorioMedidoSumiu):
            arquivos_grandes(raiz / "nao_existe")

    def test_medida_real_bate_com_o_baseline(self):
        # Os 8 que restam depois da Tarefa 9: BuilderClient e PortalBudget
        # (fora do escopo da Secao 6) mais seis que nunca estiveram nela.
        self.assertEqual(len(medir(None)["arquivos_acima_de_400"]), 8)


class TestRotulosDeMedidaEmLista(unittest.TestCase):
    """O ramo de lista de `comparar` tem que dizer o que a medida quer dizer.

    Antes destes testes o ramo afirmava so "SUBIU"/"baixou", nunca o rotulo:
    uma chave errada em ROTULOS_DE_LISTA fazia a catraca imprimir a frase de
    OUTRA medida, em silencio.
    """

    def test_arquivos_acima_de_400_ao_subir_fala_de_limite_nao_de_doc(self):
        ok, linhas = comparar(
            {"arquivos_acima_de_400": ["a.tsx"]},
            {"arquivos_acima_de_400": ["a.tsx", "b.tsx"]},
        )
        texto = "\n".join(linhas)
        self.assertFalse(ok)
        self.assertIn("agora acima do limite: b.tsx", texto)
        self.assertNotIn("sem doc", texto)

    def test_arquivos_acima_de_400_ao_baixar_fala_de_limite(self):
        ok, linhas = comparar(
            {"arquivos_acima_de_400": ["a.tsx", "b.tsx"]},
            {"arquivos_acima_de_400": ["a.tsx"]},
        )
        texto = "\n".join(linhas)
        self.assertTrue(ok)
        self.assertIn("agora abaixo do limite: b.tsx", texto)
        self.assertNotIn("documentados", texto)

    def test_modulos_sem_doc_continua_com_o_rotulo_dele(self):
        _, linhas = comparar(
            {"modulos_sem_doc": ["ai_service"]},
            {"modulos_sem_doc": ["ai_service", "cobranca_service"]},
        )
        self.assertIn("sem doc e fora do baseline", "\n".join(linhas))

        _, linhas = comparar(
            {"modulos_sem_doc": ["ai_service", "cobranca_service"]},
            {"modulos_sem_doc": ["ai_service"]},
        )
        self.assertIn("agora documentados", "\n".join(linhas))

    def test_medida_de_lista_sem_rotulo_proprio_usa_o_padrao(self):
        # Uma medida em lista futura que ninguem lembrou de por no mapa nao
        # pode herdar a frase de modulos_sem_doc.
        _, linhas = comparar({"medida_nova": []}, {"medida_nova": ["x"]})
        texto = "\n".join(linhas)
        self.assertIn("entrou no baseline: x", texto)
        self.assertNotIn("sem doc", texto)

    def test_medidas_pioradas_usa_o_mesmo_rotulo(self):
        pioras = medidas_pioradas(
            {"arquivos_acima_de_400": ["a.tsx"]},
            {"arquivos_acima_de_400": ["a.tsx", "b.tsx"]},
        )
        self.assertEqual(pioras, ["arquivos_acima_de_400: agora acima do limite: b.tsx"])


if __name__ == "__main__":
    unittest.main()
