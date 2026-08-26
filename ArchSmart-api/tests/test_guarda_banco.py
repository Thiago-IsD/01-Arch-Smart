"""
Testes da guarda de producao (tools/guarda_banco.py).

Esta guarda e a unica coisa entre um comando distraido e o banco de producao:
tools/reset_db.py faz DROP SCHEMA public CASCADE, e tools/seed.py reescreve
centenas de linhas. Ate a revisao da Tarefa 9 ela nao tinha teste nenhum — e o
defeito que a revisao encontrou (ler os.environ em vez de settings) e
exatamente o tipo que volta num refactor distraido e passa por revisao.

Nao precisam de banco: `motivo_de_recusa` e `descrever_destino` sao puras.
Os de TestFiacaoDaConftest sao a excecao: eles rodam pytest num subprocesso,
porque a guarda da conftest dispara na importacao.
"""
import os
import subprocess
import sys
from pathlib import Path

import pytest

from tools.guarda_banco import (
    HOSTS_LOCAIS,
    descrever_destino,
    motivo_de_recusa,
    recusar_se_nao_descartavel,
    resolver_url_e_origem,
)

RAIZ_DA_API = Path(__file__).resolve().parent.parent

URL_TESTE_LOCAL = "postgresql://arqsmart:arqsmart@localhost:55432/arqsmart_test"
URL_SUPABASE_LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
URL_PRODUCAO = (
    "postgresql://postgres.hlyqxgfuhtfmxmwrcmur:senha-secreta"
    "@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"
)


class TestBancosAceitos:
    def test_aceita_o_postgres_descartavel_dos_testes(self):
        assert motivo_de_recusa(URL_TESTE_LOCAL) is None

    def test_aceita_a_stack_supabase_local(self):
        """
        O banco do `supabase start` se chama "postgres", nao "postgres_test":
        ele so passa por ser 127.0.0.1. Se este teste quebrar, a Tarefa 8
        deixou de funcionar.
        """
        assert motivo_de_recusa(URL_SUPABASE_LOCAL) is None

    def test_aceita_banco_remoto_que_se_declara_descartavel(self):
        url = "postgresql://u:s@algum-host-remoto.exemplo:5432/arqsmart_seed"
        assert motivo_de_recusa(url) is None

    @pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "::1"])
    def test_aceita_os_tres_enderecos_locais(self, host):
        hospedeiro = f"[{host}]" if host == "::1" else host
        assert motivo_de_recusa(f"postgresql://u:s@{hospedeiro}:5432/qualquer") is None


class TestBancosRecusados:
    def test_recusa_o_pooler_de_producao(self):
        motivo = motivo_de_recusa(URL_PRODUCAO)
        assert motivo is not None
        assert "supabase.co" in motivo

    def test_recusa_host_gerenciado_em_maiuscula(self):
        """
        A guarda antiga comparava a string crua, entao db.ABCDEF.SUPABASE.CO
        escapava. Hoje o host vem de campos_de_conexao(), que o normaliza
        para minuscula antes de comparar.
        """
        motivo = motivo_de_recusa("postgresql://u:s@db.ABCDEF.SUPABASE.CO:5432/postgres")
        assert motivo is not None
        assert "supabase.co" in motivo

    def test_recusa_render(self):
        motivo = motivo_de_recusa("postgresql://u:s@dpg-abc.oregon-postgres.RENDER.COM/db")
        assert motivo is not None
        assert "render.com" in motivo

    def test_recusa_host_gerenciado_que_nao_esta_em_lista_nenhuma(self):
        """
        O ponto da lista de permissao. A guarda antiga, so com lista de
        proibicao, deixava passar Neon, Railway, DigitalOcean, Azure, Cloud SQL
        e o IP cru de uma maquina de producao.
        """
        for url in (
            "postgresql://u:s@ep-cool-name-123.us-east-2.aws.neon.tech/neondb",
            "postgresql://u:s@containers-us-west-1.railway.app:6543/railway",
            "postgresql://u:s@203.0.113.10:5432/producao",
        ):
            assert motivo_de_recusa(url) is not None, url

    def test_recusa_url_vazia(self):
        assert motivo_de_recusa("") is not None

    def test_recusa_url_sem_host(self):
        assert motivo_de_recusa("postgresql:///apenas_um_banco") is not None

    def test_sufixo_descartavel_e_no_fim_do_nome_do_banco(self):
        """"_test" no meio do nome nao vale — "producao_teste_final" nao passa."""
        assert motivo_de_recusa("postgresql://u:s@host.exemplo/app_test_producao") is not None

    def test_recusa_caminho_composto(self):
        """
        ".../prod/_test" passava com `endswith` no caminho inteiro. Pegar so o
        ultimo segmento NAO resolve — o ultimo segmento e literalmente
        "_test" —, entao a guarda recusa o caminho composto: um nome de banco
        e um segmento so.
        """
        assert motivo_de_recusa("postgresql://u:s@prod.supabase.co/prod/_test") is not None

    @pytest.mark.parametrize(
        "host",
        ["localhost.evil.com", "127.0.0.1.evil.com", "my-localhost-prod.example.com"],
    )
    def test_host_local_e_comparado_por_igualdade_nao_por_substring(self, host):
        """
        O predicado de maior valor da guarda. Trocar `host in HOSTS_LOCAIS` por
        `any(h in host for h in HOSTS_LOCAIS)` deixaria estes tres passarem, e
        antes deste teste essa mutacao sobrevivia a suite inteira.
        """
        assert motivo_de_recusa(f"postgresql://u:s@{host}:5432/prod") is not None

    @pytest.mark.parametrize("parametro", ["host", "hostaddr"])
    def test_recusa_host_sobreposto_na_query_string(self, parametro):
        """
        O libpq aceita host/hostaddr como parametro de conexao e eles VENCEM o
        host da URL: o psycopg2 conecta em prod.supabase.co enquanto a guarda
        le "localhost". E a mesma classe do Critical original — julgar uma
        coisa e conectar em outra — por parsing em vez de por fonte. Formas
        reais: pgbouncer, e o socket do Cloud SQL
        (`?host=/cloudsql/proj:regiao:inst`).
        """
        url = f"postgresql://u:s@localhost/prod?{parametro}=prod.supabase.co"
        motivo = motivo_de_recusa(url)
        assert motivo is not None
        assert parametro in motivo


class TestModoEstritoDaSuite:
    """
    `exigir_host_local=True`, usado por tests/conftest.py.

    Estes testes existem por causa de uma regressao real: ao unificar as
    guardas, a suite passou a aceitar tres classes de URL que recusava antes —
    um banco "arqsmart_test" hospedado em Supabase, em RDS ou em supabase.com.
    A fixture `engine` roda `drop_all`, entao aceitar um servidor compartilhado
    porque o NOME do banco parece descartavel apaga o schema de alguem.
    """

    @pytest.mark.parametrize(
        "url",
        [
            "postgresql://u:s@db.abcdefgh.supabase.co:5432/arqsmart_test",
            "postgresql://u:s@meu-cluster.abc.us-east-1.rds.amazonaws.com/arqsmart_test",
            "postgresql://u:s@compartilhado.supabase.com:5432/arqsmart_test",
            "postgresql://u:s@ep-cool-123.aws.neon.tech/arqsmart_test",
        ],
    )
    def test_sufixo_test_nao_basta_em_host_remoto(self, url):
        motivo = motivo_de_recusa(url, exigir_host_local=True)
        assert motivo is not None, url
        assert "nao e local" in motivo
        # e a guarda dos SCRIPTS continua aceitando: e o comportamento
        # deliberado que permite semear um staging sem flag
        assert motivo_de_recusa(url) is None, url

    def test_o_banco_de_teste_local_continua_passando(self):
        assert motivo_de_recusa(URL_TESTE_LOCAL, exigir_host_local=True) is None

    def test_hosts_locais_tem_exatamente_estes_tres(self):
        """
        Fixa o conjunto, e nao so o comportamento de cada membro. Sem isto,
        acrescentar "db" ou "postgres" a HOSTS_LOCAIS mantem a suite verde — e
        e exatamente o que o comentario da constante diz que NAO pode entrar,
        porque uma producao em Docker Compose com o servico chamado "db"
        passaria pela guarda.
        """
        assert HOSTS_LOCAIS == frozenset({"localhost", "127.0.0.1", "::1"})

    def test_todos_os_hosts_locais_passam_no_modo_estrito(self):
        for host in HOSTS_LOCAIS:
            hospedeiro = f"[{host}]" if ":" in host else host
            url = f"postgresql://u:s@{hospedeiro}:5432/qualquer_test"
            assert motivo_de_recusa(url, exigir_host_local=True) is None, host


class TestDescreverDestino:
    def test_mostra_host_porta_e_banco_sem_credencial(self):
        assert descrever_destino(URL_TESTE_LOCAL) == "localhost:55432/arqsmart_test"

    def test_nao_vaza_senha(self):
        assert "senha-secreta" not in descrever_destino(URL_PRODUCAO)


class TestRecusaEncerraOProcesso:
    def test_sai_com_codigo_1_para_producao(self):
        """
        `sys.exit(str)` poe a string em `.code` e o processo encerra com 1.
        Testar `.code != 0` nao provaria nada — qualquer string nao vazia
        passa. O que prova e o codigo de saida do processo de verdade.
        """
        codigo = subprocess.call(
            [
                sys.executable,
                "-c",
                "import sys; sys.path.insert(0, sys.argv[1]);"
                "from tools.guarda_banco import recusar_se_nao_descartavel;"
                "recusar_se_nao_descartavel(sys.argv[2], origem='sonda',"
                " forcado=False, acao='apagar tudo')",
                str(RAIZ_DA_API),
                URL_PRODUCAO,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        assert codigo == 1

    def test_a_mensagem_de_recusa_nao_contem_a_senha(self):
        """
        A mensagem dispara PRECISAMENTE contra producao, e a esteira de CI
        arquiva log de build. Credencial em log de build e legivel por mais
        gente que o banco.
        """
        with pytest.raises(SystemExit) as saida:
            recusar_se_nao_descartavel(
                URL_PRODUCAO, origem="arquivo .env", forcado=False, acao="apagar tudo"
            )
        mensagem = str(saida.value.code)
        assert "senha-secreta" not in mensagem
        # nem a senha, nem a URL inteira: so host:porta/banco
        assert "postgres.hlyqxgfuhtfmxmwrcmur" not in mensagem
        # host e banco, sem fixar a pontuacao entre eles: trocar o formato de
        # descrever_destino nao e regressao de comportamento.
        assert "aws-1-sa-east-1.pooler.supabase.com" in mensagem
        assert "postgres" in mensagem

    def test_a_mensagem_diz_a_origem_e_o_estrago(self):
        with pytest.raises(SystemExit) as saida:
            recusar_se_nao_descartavel(
                URL_PRODUCAO,
                origem="arquivo .env (nenhuma DATABASE_URL exportada no ambiente)",
                forcado=False,
                acao="apagar e recriar o schema public",
            )
        mensagem = str(saida.value.code)
        assert "arquivo .env" in mensagem
        assert "apagar e recriar o schema public" in mensagem

    def test_a_flag_libera(self):
        recusar_se_nao_descartavel(
            URL_PRODUCAO, origem="arquivo .env", forcado=True, acao="apagar tudo"
        )

    def test_a_flag_deixa_rastro_em_stderr(self, capsys):
        """
        Sair calado faria "passou" e "foi forcado a passar" virarem a mesma
        linha no log de quem for entender o que aconteceu depois.
        """
        recusar_se_nao_descartavel(
            URL_PRODUCAO, origem="arquivo .env", forcado=True, acao="apagar tudo"
        )
        erro = capsys.readouterr().err
        assert "GUARDA IGNORADA" in erro
        assert "senha-secreta" not in erro

    def test_nao_imprime_nada_quando_o_banco_e_aceitavel(self, capsys):
        recusar_se_nao_descartavel(
            URL_TESTE_LOCAL, origem="variavel de ambiente", forcado=True, acao="apagar tudo"
        )
        assert capsys.readouterr().err == ""

    def test_banco_local_nao_e_barrado(self):
        recusar_se_nao_descartavel(
            URL_TESTE_LOCAL, origem="variavel de ambiente", forcado=False, acao="apagar tudo"
        )


class TestRegressaoDoCritical:
    """
    O Critical da revisao da Tarefa 9: a guarda lia os.environ["DATABASE_URL"]
    enquanto o engine lia settings.DATABASE_URL, que cai no .env quando a
    variavel nao esta exportada. Sao estes testes que quebram se alguem voltar
    a ler os.environ.
    """

    def test_resolve_a_mesma_url_que_o_engine_usa(self):
        from app.core.config import settings

        url, _ = resolver_url_e_origem()
        assert url == settings.DATABASE_URL

    def test_resolve_mesmo_sem_a_variavel_exportada(self, monkeypatch):
        """
        Com DATABASE_URL fora do ambiente, uma guarda que lesse os.environ
        devolveria vazio (ou explodiria) e aprovaria qualquer coisa. Esta le o
        settings, que ja esta resolvido, e continua devolvendo a URL — dizendo
        que ela veio do .env.
        """
        from app.core.config import settings

        monkeypatch.delenv("DATABASE_URL", raising=False)
        assert "DATABASE_URL" not in os.environ

        url, origem = resolver_url_e_origem()
        assert url == settings.DATABASE_URL
        assert url, "a URL resolvida nao pode ser vazia sem a variavel exportada"
        assert ".env" in origem

    def test_a_origem_distingue_variavel_de_env_de_arquivo(self, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql://u:s@localhost:5432/qualquer_test")
        _, origem = resolver_url_e_origem()
        assert "variavel de ambiente" in origem


class TestFiacaoDaConftest:
    """
    A conftest.py CHAMA a guarda, e e nessa chamada que o defeito morou duas
    vezes. Os 37 testes acima exercitam a funcao pura; nenhum exercitava o
    arquivo que a chama — medido: remover `exigir_host_local=True` da conftest
    deixava a suite inteira verde, e esse e literalmente o Critical da rodada
    anterior.

    Rodam `pytest --collect-only` num subprocesso, porque a guarda da conftest
    dispara na IMPORTACAO: dentro da propria suite ela ja passou.
    """

    @staticmethod
    def _coletar(url_de_teste):
        r = subprocess.run(
            [sys.executable, "-m", "pytest", "--collect-only", "-q"],
            cwd=str(RAIZ_DA_API),
            env={**os.environ, "TEST_DATABASE_URL": url_de_teste},
            capture_output=True,
            text=True,
        )
        return r.returncode, r.stdout + r.stderr

    @pytest.mark.parametrize(
        "url",
        [
            "postgresql://u:s@db.abc.supabase.co:5432/arqsmart_test",
            "postgresql://u:s@meu-cluster.us-east-1.rds.amazonaws.com/arqsmart_test",
            "postgresql://u:s@ep-123.aws.neon.tech/arqsmart_test",
        ],
    )
    def test_conftest_recusa_banco_test_em_host_remoto(self, url):
        """
        O eixo do HOST. Se este teste passar a coletar, alguem tirou o
        exigir_host_local=True da conftest e a suite voltou a poder rodar
        drop_all num servidor compartilhado.
        """
        codigo, saida = self._coletar(url)
        assert codigo != 0, f"a conftest COLETOU com {url!r} — afrouxou"
        assert "nao serve para a suite" in saida

    @pytest.mark.parametrize(
        "url",
        [
            "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
            "postgresql://u:s@localhost:5432/producao",
        ],
    )
    def test_conftest_recusa_banco_local_sem_sufixo_test(self, url):
        """
        O eixo do NOME. O primeiro caso e o banco da stack Supabase local, que
        esta rodando nesta maquina: host local, nome "postgres". A guarda comum
        aceita; a conftest nao pode aceitar, porque roda drop_all.
        """
        codigo, saida = self._coletar(url)
        assert codigo != 0, f"a conftest COLETOU com {url!r} — afrouxou"
        assert "termina em" in saida

    def test_conftest_recusa_dbname_sobreposto_na_query(self):
        """
        A URL diz "arqsmart_test" e o psycopg2 cairia em "postgres". Enquanto a
        conftest reimplementava o parsing com urlsplit, isto era aceito.
        """
        codigo, saida = self._coletar(
            "postgresql://postgres:postgres@127.0.0.1:54322/arqsmart_test?dbname=postgres"
        )
        assert codigo != 0, "a conftest COLETOU com dbname sobreposto"
        assert "postgres" in saida

    def test_conftest_usa_o_nome_do_banco_da_guarda_e_nao_um_split_proprio(self):
        """
        Discriminador de um parsing reimplementado. Aqui o banco de verdade e
        "producao" — nao termina em "_test", entao a suite tem que recusar. Mas
        a URL INTEIRA termina em "_test", entao qualquer reimplementacao
        ingenua (`url.split("/")[-1]`, `url.endswith("_test")`) aceita.

        Sem este teste, trocar `nome_do_banco()` por um split local passava com
        a suite verde — medido.
        """
        codigo, saida = self._coletar(
            "postgresql://u:s@localhost:5432/producao?application_name=x_test"
        )
        assert codigo != 0, (
            "a conftest COLETOU num banco chamado 'producao' porque a URL "
            "terminava em '_test' — o parsing do nome do banco foi reimplementado"
        )
        assert "producao" in saida

    def test_conftest_aceita_o_banco_de_teste_de_verdade(self):
        """
        O outro lado: um portao que barra o caso legitimo e desligado na
        primeira semana. Esta e a URL que o ci.yml exporta.
        """
        codigo, saida = self._coletar(
            "postgresql://arqsmart:arqsmart@localhost:55432/arqsmart_test"
        )
        assert codigo == 0, saida[-2000:]
        assert "tests collected" in saida
