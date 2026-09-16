"""Testes do validador de contraste. Só biblioteca padrão, como todo tools/."""
import tempfile
import unittest
from pathlib import Path

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
        # `secondary` tem o mesmo valor HSL em `:root` e em `.dark` (e a cor
        # da marca, nao muda entre temas) -- o teste confirma que
        # tokens_dos_temas() devolve os dois iguais. (`--radius` nao serviria
        # de exemplo aqui: seu valor, "0.375rem", nao bate no formato
        # "H S% L%" que RE_TOKEN espera, entao nunca chega a ser um token.)
        self.assertIn("secondary", escuro)
        self.assertEqual(claro["secondary"], escuro["secondary"])

    def test_o_par_fundo_texto_geral_entra(self):
        claro, _ = contraste.tokens_dos_temas()
        nomes = [nome for nome, _, _ in contraste.pares(claro)]
        self.assertIn("background", nomes)


class TestReprovados(unittest.TestCase):
    def test_lista_os_tres_pares_reprovados_de_hoje(self):
        # Eram quatro ate 15/09/2026: destructive no claro saiu com o token
        # novo (spec de Projetos, decisao 5).
        self.assertEqual(
            contraste.reprovados(),
            ["claro:muted", "claro:secondary", "escuro:secondary"],
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


class TestTokensDeEstado(unittest.TestCase):
    ESTADOS = ("success", "warning", "info")

    def test_existem_nos_dois_temas_com_foreground(self):
        claro, escuro = contraste.tokens_dos_temas()
        for tema, nome in ((claro, "claro"), (escuro, "escuro")):
            for estado in self.ESTADOS:
                self.assertIn(estado, tema, f"--{estado} ausente no tema {nome}")
                self.assertIn(f"{estado}-foreground", tema,
                              f"--{estado}-foreground ausente no tema {nome}")

    def test_nascem_aprovados(self):
        fora = contraste.reprovados()
        for estado in self.ESTADOS:
            self.assertNotIn(f"claro:{estado}", fora)
            self.assertNotIn(f"escuro:{estado}", fora)

    def test_nao_pioram_o_que_ja_existia(self):
        # Eram quatro ate 15/09/2026: destructive no claro saiu com o token
        # novo (spec de Projetos, decisao 5).
        self.assertEqual(
            contraste.reprovados(),
            ["claro:muted", "claro:secondary", "escuro:secondary"],
        )


CSS_DE_HOJE = """
:root {
  --background: 0 0% 100%; --foreground: 222.2 84% 4.9%;
  --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 40% 98%;
  --muted: 210 40% 96.1%; --muted-foreground: 215.4 16.3% 46.9%;
}
.dark {
  --background: 222.2 84% 4.9%; --foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 40% 98%;
}
"""

CSS_NOVO = CSS_DE_HOJE.replace("--destructive: 0 84.2% 60.2%", "--destructive: 0 84.2% 40%").replace(
    "--destructive: 0 62.8% 30.6%; --destructive-foreground: 210 40% 98%",
    "--destructive: 0 84.2% 60%; --destructive-foreground: 222.2 84% 4.9%",
)


class TestTextoSobreFundo(unittest.TestCase):
    def test_destructive_como_texto_reprova_nos_dois_temas_hoje(self):
        # 3,76:1 no claro e 2,00:1 no escuro (medido em 15/09/2026, spec de
        # Projetos, decisao 5). A catraca antiga so media o par com o
        # foreground (3,59 no claro, 9,56 no escuro) e nunca viu o 2,00.
        fora = contraste.texto_sobre_fundo_reprovados(CSS_DE_HOJE, usados={"destructive"})
        self.assertEqual(fora, ["claro:destructive", "escuro:destructive"])

    def test_os_valores_novos_passam_como_texto_e_como_par(self):
        self.assertEqual(contraste.texto_sobre_fundo_reprovados(CSS_NOVO, usados={"destructive"}), [])
        self.assertNotIn("claro:destructive", contraste.reprovados(CSS_NOVO))
        self.assertNotIn("escuro:destructive", contraste.reprovados(CSS_NOVO))

    def test_foreground_de_par_e_background_nao_sao_medidos_sobre_o_fundo(self):
        # `destructive-foreground` e texto SOBRE destructive, nao sobre o fundo;
        # `background` sobre ele mesmo daria 1:1. Os dois ficam de fora.
        fora = contraste.texto_sobre_fundo_reprovados(
            CSS_DE_HOJE, usados={"destructive-foreground", "background"}
        )
        self.assertEqual(fora, [])

    def test_tokens_usados_como_texto_le_o_codigo_e_cruza_com_os_tokens(self):
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                'const x = <p className="hover:text-destructive text-muted-foreground text-lg context-menu">oi</p>',
                encoding="utf-8",
            )
            Path(pasta, "b.css").write_text(".x { color: text-primary }", encoding="utf-8")
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(Path(pasta), claro)
        # `text-lg` nao e token; `context-menu` nao e classe de texto; `.css` nao e lido.
        self.assertEqual(usados, {"destructive", "muted-foreground"})

    def test_token_so_em_comentario_de_linha_nao_conta(self):
        # Caso real: BatchNormalizeRow.tsx:67 cita `text-warning` numa nota em
        # prosa dizendo que ele REPROVA como texto -- isso nao e uso.
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                "// Medido: text-warning da 1,99:1 e reprova o 4.5:1\n"
                'const x = <p className="text-warning-foreground">oi</p>',
                encoding="utf-8",
            )
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(
                Path(pasta), {**claro, "warning": (0, 0, 0), "warning-foreground": (0, 0, 0)}
            )
        self.assertNotIn("warning", usados)
        self.assertIn("warning-foreground", usados)

    def test_token_so_em_comentario_de_bloco_nao_conta(self):
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                "/* nao use text-destructive aqui, ele reprova */\n"
                'const x = <p className="text-muted-foreground">oi</p>',
                encoding="utf-8",
            )
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(Path(pasta), claro)
        self.assertNotIn("destructive", usados)
        self.assertIn("muted-foreground", usados)

    def test_comentario_de_bloco_multilinha_some_inteiro(self):
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                "/*\n"
                " * text-destructive so passa como fundo, nao como texto\n"
                " */\n"
                'const x = <p className="text-muted-foreground">oi</p>',
                encoding="utf-8",
            )
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(Path(pasta), claro)
        self.assertNotIn("destructive", usados)

    def test_uso_real_em_classname_continua_contando(self):
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                "// comentario qualquer, sem mencionar token\n"
                'const x = <p className="text-destructive">oi</p>',
                encoding="utf-8",
            )
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(Path(pasta), claro)
        self.assertIn("destructive", usados)

    def test_url_com_barra_dupla_nao_apaga_o_resto_da_linha(self):
        # O cuidado classico de "tirar comentario com regex": uma URL com //
        # no meio de uma string nao pode fazer o resto da linha sumir. Como o
        # que vem ANTES do // aqui e a abertura da string, nao espaco vazio, a
        # linha inteira sobrevive.
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                'const url = "https://exemplo.com"; const x = <p className="text-destructive">oi</p>',
                encoding="utf-8",
            )
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(Path(pasta), claro)
        self.assertIn("destructive", usados)

    def test_variante_com_prefixo_continua_contando(self):
        # dark:/hover:/group-hover/opt: continuam contando -- so comentario e
        # descartado, nao prefixo de variante do Tailwind.
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                'const x = <p className="dark:text-destructive hover:text-destructive">oi</p>',
                encoding="utf-8",
            )
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(Path(pasta), claro)
        self.assertIn("destructive", usados)

    def test_image_asterisco_nao_abre_comentario_e_engole_o_codigo(self):
        # Real em quatro arquivos (image-upload.tsx, profile/page.tsx,
        # EnvironmentAccordion.tsx, BuilderClient.tsx): `accept="image/*"`
        # pareava com o `*/` de um comentario de bloco de verdade mais
        # adiante e apagava o codigo do meio em silencio -- falso NEGATIVO,
        # pior que o falso positivo que este modulo ja corrigiu. O `/*` de
        # "image/*" e precedido por "e" (letra), nao espaco/`{`, entao nao
        # pode abrir bloco.
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                'accept="image/*"\n'
                'const x = <p className="text-destructive">oi</p>\n'
                "/* comentario real, bem depois */\n",
                encoding="utf-8",
            )
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(Path(pasta), claro)
        self.assertIn("destructive", usados)

    def test_comentario_jsx_na_mesma_linha_de_classname_ainda_e_descartado(self):
        # `{/* ... */}` e o idioma de comentario do JSX e pode aparecer na
        # MESMA linha de uma className real, nao so sozinho na linha. O `/*`
        # ali e precedido por `{`, entao continua abrindo bloco -- e se esse
        # comentario citasse outro token, ele nao podia contar.
        with tempfile.TemporaryDirectory() as pasta:
            Path(pasta, "a.tsx").write_text(
                'const x = <div className="text-destructive">{/* nao use text-warning aqui */}</div>',
                encoding="utf-8",
            )
            claro, _ = contraste.tokens_dos_temas(CSS_DE_HOJE)
            usados = contraste.tokens_usados_como_texto(
                Path(pasta), {**claro, "warning": (0, 0, 0)}
            )
        self.assertIn("destructive", usados)
        self.assertNotIn("warning", usados)


if __name__ == "__main__":
    unittest.main()
