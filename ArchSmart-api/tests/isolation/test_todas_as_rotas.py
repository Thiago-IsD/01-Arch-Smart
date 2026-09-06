"""
Toda rota registrada isola por conta — inclusive a que ainda nao existe.

tests/isolation/ ja cobre 27 casos escritos a mao, na Secao 1. Esta lista nao
cresce sozinha: uma rota nova nao entra nela. Este arquivo percorre
`app.routes`, entao a rota nova aparece no dia em que e registrada — e se
ninguem tiver dito que recurso o id dela endereca, o teste FALHA em vez de
ignorar.

Como quebrar de proposito, para ver que funciona: apague o filtro por conta de
um endpoint qualquer e rode. Se ele continuar verde, este arquivo esta mentindo.

**A garantia, em uma frase.** Uma rota com nome de parametro NOVO falha
alto (`assert fabrica is not None` em `_preencher_url`): ninguem disse que
recurso aquele id endereca, e o teste recusa adivinhar. Uma rota que REUSA
um nome ja registrado para enderecar OUTRO model e o caso que o nome
sozinho nao pega — e quem o fecha e o CONTROLE POSITIVO
(`_controle_positivo`), que exige que a conta DONA alcance o proprio
recurso antes de o 404 da conta A valer como prova. Os dois juntos cobrem
a classe, nao so as instancias que alguem lembrou de registrar.

**Todos os 35 casos de CASOS_FORTES sao load-bearing hoje** — cada um
exige 404 e SO fica verde porque o filtro por conta funciona, nao por
coincidencia de dado ou de validacao. Isso exigiu tres cuidados, cada um
medido quebrando o codigo de proposito e vendo o teste acusar (nao so
supor):

1. **Corpo minimo para POST.** GET e DELETE nao tem corpo — 404 e exigivel
   sempre. PUT e PATCH, medido, tambem chegam no handler com `json={}`
   (nenhum tem campo obrigatorio sem default). Mas as 6 rotas POST
   coletadas rejeitariam `json={}` pelo Pydantic ANTES do endpoint rodar —
   um 422 que passaria mesmo se a conta nao fosse filtrada, decorativo.
   CORPOS_MINIMOS da a cada uma um corpo que passa da validacao (e, para
   `/projects/{project_id}/presentations`, um corpo cujo `project_id`
   CITA o mesmo id que foi para a URL — ver o comentario de CORPOS_MINIMOS
   sobre por que um valor fixo mascararia a quebra atras de um 400 em vez
   de acusar o 201 de verdade). Uma rota POST sem entrada em CORPOS_MINIMOS
   falha dentro do proprio teste, mesma logica do `assert fabrica is not
   None` do RECURSOS — nao cai numa asercao fraca por omissao. A lista de
   casos se divide em CASOS_FORTES (exige 404) e CASOS_FRACOS (rotas cujo
   corpo minimo so seria possivel citando dado de OUTRA conta — nenhuma
   hoje; ver POSTS_SEM_CORPO_MINIMO_POSSIVEL).

2. **Recurso certo para `env_id`.** Duas rotas (`PUT` e `POST` em
   `.../presentations/{presentation_id}/environments/{env_id}[...]`) usam
   `env_id` para endereçar `PresentationEnvironment`, nao `Environment` —
   RECURSOS_POR_ROTA da a elas uma fabrica que cria o model certo, filho da
   MESMA apresentacao que `{presentation_id}` carrega. Sem isso, medido: as
   duas rotas eram 404 sempre, para QUALQUER conta, porque o `env_id`
   fabricado nunca batia com nenhum `PresentationEnvironment` de verdade —
   apagar o filtro por conta de proposito nessas duas rotas nao mudava o
   resultado. Ver o comentario de `_criar_ambiente_de_apresentacao` para a
   medicao completa, inclusive uma descoberta lateral: em
   `upload_environment_image`, o `repo.obter(Presentation, presentation_id)`
   sozinho NAO e o unico gate — `repo.query(PresentationEnvironment)`
   tambem filtra por conta (e o que `ScopedRepository.query()` sempre
   faz), entao remover so aquela linha nao vaza. A quebra que vaza de
   verdade e desescopar o `repo.query(PresentationEnvironment)` em si.

3. **Controle positivo, contra a vacuidade por nome de parametro
   reusado.** O item 2 acima corrigiu DUAS rotas; nao corrigiu a classe.
   `RECURSOS` e indexado por NOME de parametro, entao qualquer rota futura
   que reuse um nome registrado para outro model recebe o objeto errado,
   404 para TODA conta, e passa sem exercitar filtro nenhum. Medido em
   05/09/2026 com a rota abaixo acrescentada a `app/main.py` — que vaza
   `cost_price` e `markup` de todas as contas:

       @app.get("/api/vazamento/{project_id}")
       def rota_de_vazamento(project_id: str, db=Depends(get_db)):
           produto = db.query(Product).filter(
               Product.id == project_id).first()
           if produto is None:
               raise HTTPException(status_code=404, ...)
           return {"cost_price": produto.cost_price, ...}

   Com este arquivo na versao anterior: `47 passed, 1 skipped`. Com o
   controle positivo: `1 failed, 46 passed, 1 skipped`, com a mensagem
   "CASO VACUO: GET /api/vazamento/{project_id} devolveu 404 para a conta
   DONA do recurso". Ver `_controle_positivo` para por que a asercao e
   `!= 404` e nao algo mais forte.

**Gap conhecido, fora do que este arquivo cobre.** Rotas cujo id vem do BODY,
nao da URL — `PATCH /api/products/batch-approve`
(`app/api/routers/product_router.py:231`), que recebe uma lista de ids num
payload — nao aparecem em `_rotas_com_recurso` (sem `{...}` na URL, nada para
substituir) nem na rede de fumaca abaixo (so cobre GET). Medido em
05/09/2026: 27 rotas de `/api` sem parametro de caminho, das quais 9 sao GET
(cobertas pela rede) e as outras 18 (POST/PUT/PATCH/DELETE, `/api/auth/*`,
`/api/leads`, `/api/projects`, `/api/events`, `/api/financial`,
`/api/budgets/items`, `/api/products/`, `/api/products/clipper/capture`,
`/api/products/normalize`, `/api/products/batch-approve`, `/api/account`,
`/api/account/branding`, `/api/users/profile`) nao sao tocadas por nenhum
teste novo desta tarefa. Isso nao e um vazamento conhecido — `batch-approve`,
por exemplo, resolve cada id por conta propria e devolve os alheios em
`not_found` em vez de vazar — mas e uma classe de rota que nem o teste
generico nem a rede de fumaca alcancam, e por isso fica registrada aqui em
vez de descoberta depois.
"""
import re
from typing import Callable

import pytest

from app.main import app
from app.models.all_models import PresentationEnvironment
from tests.conftest import (
    criar_ambiente,
    criar_apresentacao,
    criar_evento,
    criar_item_de_orcamento,
    criar_lancamento,
    criar_notificacao,
    criar_opcao,
    criar_orcamento,
    criar_produto,
    criar_projeto,
)

# Parametro de caminho -> como fabricar um recurso daquele tipo numa conta.
# TODA rota com id na URL precisa de entrada aqui (ou em RECURSOS_POR_ROTA,
# abaixo). E de proposito que a falta de uma entrada seja falha, e nao pulo:
# rota nova sem isolamento tem que quebrar o build no dia em que e escrita.
RECURSOS = {
    "project_id": lambda db, conta, usuario: criar_projeto(
        db, conta, "Alheio", usuario
    ),
    "env_id": criar_ambiente,
    "budget_id": criar_orcamento,
    "item_id": criar_item_de_orcamento,
    "option_id": criar_opcao,
    "product_id": criar_produto,
    "presentation_id": criar_apresentacao,
    "entry_id": criar_lancamento,
    "event_id": criar_evento,
    "notification_id": criar_notificacao,
}


def _criar_ambiente_de_apresentacao(db, conta, usuario, ja_criados: dict):
    """
    Fabrica de override para `env_id` nas DUAS rotas onde ele nao endereca
    `Environment` (o que `RECURSOS["env_id"]` cria), e sim
    `PresentationEnvironment` — um model diferente, mesmo nome de parametro:
    `PUT .../presentations/{presentation_id}/environments/{env_id}` e
    `POST .../presentations/{presentation_id}/environments/{env_id}/images`.

    Isto nao e hipotetico: com `RECURSOS["env_id"]` (um `Environment`) usado
    aqui, o `env_id` da URL nunca bate com nenhum `PresentationEnvironment.id`
    de propósito nenhum — o segundo filtro do handler (`.filter(
    PresentationEnvironment.id == env_id, ...)`) sempre devolve None, e a
    rota sempre 404, INDEPENDENTE do primeiro filtro (`repo.obter(
    Presentation, presentation_id)`) estar la ou nao. Medido: apagar
    `repo.obter(Presentation, presentation_id)` de proposito em
    `update_presentation_environment_detail` e rodar so esse caso continuava
    verde — o teste nunca provou isolamento nessas duas rotas, so provava
    que um id de tabela errada nunca bate.

    O `PresentationEnvironment` fabricado aqui pertence a MESMA
    `Presentation` que `{presentation_id}` vai carregar na URL —
    `ja_criados["presentation_id"]`, que `_preencher_url` ja resolveu antes
    de chegar em `env_id` (a ordem dos parametros na URL importa: nas duas
    rotas, presentation_id vem primeiro). Um `PresentationEnvironment` preso
    a uma apresentacao diferente ainda seria "da conta B", mas os dois ids
    na URL nunca apareceriam juntos assim numa chamada de verdade — e o
    segundo filtro do handler voltaria a mascarar o primeiro.

    **Com a fabrica certa, uma descoberta lateral em `upload_environment_image`
    (a rota POST).** Apagar so `repo.obter(Presentation, presentation_id)`
    (linha 329) e rodar o caso NAO acusa — continua 404. Isso NAO e o mesmo
    defeito de antes: agora o `env_id` bate com um `PresentationEnvironment`
    de verdade, mas `repo.query(PresentationEnvironment)`, logo abaixo,
    filtra por `account_id` sozinho (e o que `ScopedRepository.query()`
    sempre faz — ver `app/db/repository.py`), entao a rota continua segura
    mesmo sem aquela linha. Quebrar de verdade exige desescopar o PROPRIO
    `repo.query(PresentationEnvironment)` (trocar por `repo.db.query(...)`)
    — aí sim o caso acusa 200, um vazamento de verdade. Isso e defesa em
    profundidade, nao um teste fraco: `repo.obter(Presentation,
    presentation_id)` ainda vale por dar um 404 com mensagem melhor
    ("Apresentação não encontrada" em vez de "Ambiente da apresentação não
    encontrado") e por evitar tocar a tabela errada quando a apresentacao
    nem existe — so nao e o UNICO gate de conta nesta rota especifica. Nao
    quebrei esse segundo gate na rehearsal registrada no relatorio da
    tarefa: o caminho de sucesso dali em diante chama o Supabase Storage de
    verdade (`get_storage_client()`, credenciais de `.env`), e a rehearsal
    usou um `return` antecipado antes do upload para nao bater na rede.
    """
    apresentacao = ja_criados["presentation_id"]
    ambiente = criar_ambiente(db, conta, usuario)
    presentation_environment = PresentationEnvironment(
        account_id=conta.id,
        created_by=usuario.id,
        presentation_id=apresentacao.id,
        environment_id=ambiente.id,
        is_visible=True,
    )
    db.add(presentation_environment)
    db.flush()
    return presentation_environment


# Override por ROTA, consultado ANTES de RECURSOS: o mesmo nome de parametro
# nem sempre endereca o mesmo model — `env_id` e o caso medido. Chave e
# (caminho, parametro); valor e uma fabrica de 4 argumentos
# `(db, conta, usuario, ja_criados)`, onde `ja_criados` e um dict
# {parametro: objeto} dos parametros MAIS A ESQUERDA na mesma URL, ja
# resolvidos — permite construir um recurso FILHO do pai correto (aqui, o
# PresentationEnvironment sob a MESMA Presentation que a URL vai carregar)
# em vez de um pai solto que nunca bateria com o outro id da mesma URL.
RECURSOS_POR_ROTA: dict[tuple[str, str], Callable] = {
    (
        "/api/presentations/{presentation_id}/environments/{env_id}",
        "env_id",
    ): _criar_ambiente_de_apresentacao,
    (
        "/api/presentations/{presentation_id}/environments/{env_id}/images",
        "env_id",
    ): _criar_ambiente_de_apresentacao,
}

# O portal publico. Quem chama nao tem conta: e o cliente final do arquiteto,
# autorizado por token de portal (app/core/portal_security.py). "Conta A
# tentando alcancar recurso da conta B" nao descreve esse caminho, e testa-lo
# aqui daria falso verde. Coberto por tests/isolation/test_portal_access.py.
PARAMETROS_FORA_DO_ESCOPO = {"presentation_uuid"}

# Prefixos que nao sao rota de aplicacao.
CAMINHOS_DE_INFRAESTRUTURA = ("/docs", "/redoc", "/openapi.json")


def _rotas_com_recurso():
    for rota in app.routes:
        if not hasattr(rota, "methods"):
            continue
        if rota.path.startswith(CAMINHOS_DE_INFRAESTRUTURA):
            continue
        parametros = re.findall(r"{(\w+)}", rota.path)
        if not parametros:
            continue
        if any(p in PARAMETROS_FORA_DO_ESCOPO for p in parametros):
            continue
        for metodo in sorted(rota.methods - {"HEAD", "OPTIONS"}):
            yield metodo, rota.path, tuple(parametros)


CASOS = sorted(set(_rotas_com_recurso()))


def test_ha_rotas_para_percorrer():
    """
    Rede contra o pior modo de falha deste arquivo: um `_rotas_com_recurso`
    que devolve lista vazia deixa a suite verde sem testar nada.
    """
    assert len(CASOS) >= 30, f"so {len(CASOS)} rotas coletadas; algo filtrou demais"


# Corpo minimo que faz uma rota POST passar da validacao do Pydantic/FastAPI
# e chegar no handler. Sem isso, `json={}` pode receber 422 ANTES do endpoint
# rodar — a rota nunca e exercitada de verdade, e o teste fica verde por um
# motivo errado. Essa e exatamente a forma de teste decorativo que a Tarefa 2
# ja pegou uma vez (um 401 que passava contra codigo que vazaria).
#
# Todo id citado num corpo daqui aponta para um recurso de VERDADE da conta
# B. Um UUID inexistente CHEGA no handler (a checagem de posse do recurso da
# URL roda antes), entao ele bastaria para o 404 da conta A — mas nao basta
# para o controle positivo, e nao basta para a quebra deliberada: se o
# handler tem uma SEGUNDA checagem sobre o id do corpo, o UUID inexistente
# faz ela devolver 404 sozinha, e apagar o portao de conta da URL nao muda o
# resultado. Ver o comentario logo acima de CORPOS_MINIMOS.
#
# DUAS rotas ilustram, cada uma de um jeito: `/projects/{project_id}/presentations` tambem valida
# `presentation_in.project_id != project_id` (o da URL) e devolve 400 se
# divergirem — um gate DEPOIS do `repo.obter(Project, project_id)`, mas que
# ainda mascara: se alguem apagar o `repo.obter` de proposito (ou por
# acidente), um corpo com project_id FIXO e diferente da URL ainda produziria
# 400 em vez de 404, o teste ainda ficaria vermelho, mas por coincidencia de
# validacao — nao porque detectou o vazamento. Por isso este corpo e uma
# FUNCAO de `ja_criados`, nao um dict fixo: usa o MESMO project_id que foi
# parar na URL, entao o unico jeito de a rota nao vazar e o
# `repo.obter(Project, project_id)` estar la — se sumir, o corpo bate, o
# handler cria a apresentacao no projeto da conta B, e o teste acusa 201
# ("vazamento entre contas"), a mensagem certa para o defeito certo.
#
# Uma entrada callable recebe `(ja_criados, db, conta, usuario)` — os quatro,
# e nao so `ja_criados`, porque um corpo pode precisar FABRICAR um recurso da
# conta B em vez de so citar um id que ja foi para a URL. Foi o que o controle
# positivo cobrou de `/budgets/items/{item_id}/options`: com um product_id
# inexistente, a conta B (a DONA do item) tambem levava 404 — "Produto nao
# encontrado na biblioteca" — e o caso era vacuo dos dois lados. Pior: com o
# produto inexistente, apagar o `repo.get(BudgetItem, item_id)` de proposito
# NAO acusava, porque a checagem seguinte devolvia 404 sozinha. Com um
# produto de verdade da conta B, o unico 404 possivel vem do portao de conta.
CORPOS_MINIMOS: dict[str, dict | Callable[..., dict]] = {
    "/api/budgets/items/{item_id}/options": (
        lambda ja_criados, db, conta, usuario: {
            "json": {"product_id": str(criar_produto(db, conta, usuario).id)},
        }
    ),
    "/api/presentations/{presentation_id}/comments": {
        "json": {"text": "Comentario minimo"},
    },
    "/api/projects/{project_id}/environments": {
        "json": {"name": "Ambiente minimo"},
    },
    "/api/projects/{project_id}/presentations": (
        lambda ja_criados, db, conta, usuario: {
            "json": {
                "name": "Apresentacao minima",
                "project_id": str(ja_criados["project_id"].id),
            },
        }
    ),
    # Estas duas nao tem corpo JSON: o endpoint declara `file: UploadFile =
    # File(...)`, entao `json={}` nem chega a ser o motivo do 422 — o
    # FastAPI exige multipart/form-data com um campo "file".
    "/api/presentations/{presentation_id}/assets": {
        "files": {"file": ("teste.png", b"conteudo-fake", "image/png")},
    },
    "/api/presentations/{presentation_id}/environments/{env_id}/images": {
        "files": {"file": ("teste.png", b"conteudo-fake", "image/png")},
    },
}

# POSTs cujo corpo minimo so seria possivel citando um recurso de OUTRA
# conta — o que a propria rota existe para provar que nao vaza, entao pedir
# isso na fabrica do corpo seria circular. Vazio hoje: as 6 rotas POST
# coletadas conseguem corpo minimo sem citar nada da conta B (ver
# CORPOS_MINIMOS). Existe para o dia em que uma rota realmente nao consiga:
# entra aqui com o motivo, o caso migra para CASOS_FRACOS (asercao mais
# fraca: nunca 2xx, nunca 403) e NAO precisa de entrada em CORPOS_MINIMOS.
POSTS_SEM_CORPO_MINIMO_POSSIVEL: dict[str, str] = {}

# So o METODO e o CAMINHO juntos decidem — nao so o caminho. Varios caminhos
# desta lista respondem a mais de um metodo (GET e POST em
# /projects/{project_id}/presentations, por exemplo); um `caso[1] in
# POSTS_SEM_CORPO_MINIMO_POSSIVEL` sozinho rebaixaria o GET junto so por
# compartilhar caminho com um POST fraco.
CASOS_FRACOS = [
    caso
    for caso in CASOS
    if caso[0] == "POST" and caso[1] in POSTS_SEM_CORPO_MINIMO_POSSIVEL
]
CASOS_FORTES = [caso for caso in CASOS if caso not in CASOS_FRACOS]


@pytest.fixture(autouse=True)
def storage_sem_rede(monkeypatch):
    """
    O controle positivo (conta B alcancando o PROPRIO recurso) percorre o
    caminho de SUCESSO das duas rotas de upload, e o caminho de sucesso
    delas chama o Supabase Storage de verdade (`get_storage_client()`, com
    credenciais do `.env`, timeout de 30s). Um teste de isolamento nao pode
    depender de rede nem gravar num bucket real, entao o cliente e trocado
    por um dublê que devolve uma URL e nao sai da maquina.

    Isto NAO enfraquece nada: o que o controle positivo precisa provar e que
    a requisicao ATRAVESSOU o portao de conta e chegou no corpo do handler.
    O upload em si nao e o assunto deste arquivo.
    """

    class _StorageFalso:
        async def upload_file(self, bucket, path, file_bytes, content_type=None):
            return self.get_public_url(bucket, path)

        def get_public_url(self, bucket, path):
            return f"https://storage.invalido.local/{bucket}/{path}"

    monkeypatch.setattr(
        "app.api.endpoints.presentations.get_storage_client",
        lambda: _StorageFalso(),
    )


def _preencher_url(
    caminho: str, parametros: tuple[str, ...], db, conta, usuario
) -> tuple[str, dict]:
    """
    Substitui cada `{parametro}` do caminho pelo id de um recurso fabricado
    para a conta B, na ordem em que os parametros aparecem na URL (a ordem
    IMPORTA: e o que permite `_criar_ambiente_de_apresentacao` olhar
    `ja_criados["presentation_id"]` quando chega a vez de `env_id`).

    Devolve `(url, ja_criados)` — `ja_criados` e o dict {parametro: objeto}
    completo, usado pelas rotas POST cujo corpo minimo precisa referenciar o
    MESMO id que acabou de ir para a URL (ver CORPOS_MINIMOS callable).
    """
    url = caminho
    ja_criados: dict = {}
    for parametro in parametros:
        fabrica_da_rota = RECURSOS_POR_ROTA.get((caminho, parametro))
        if fabrica_da_rota is not None:
            recurso = fabrica_da_rota(db, conta, usuario, ja_criados)
        else:
            fabrica = RECURSOS.get(parametro)
            assert fabrica is not None, (
                f"a rota {caminho} tem o parametro {{{parametro}}} e ninguem "
                "disse que recurso ele endereca. Acrescente uma entrada em "
                "RECURSOS (ou, se o MESMO nome de parametro enderecar um "
                "model diferente NESSA rota, em RECURSOS_POR_ROTA) — ou, se "
                "for rota de portal publico, em PARAMETROS_FORA_DO_ESCOPO, "
                "com o motivo)."
            )
            recurso = fabrica(db, conta, usuario)
        ja_criados[parametro] = recurso
        url = url.replace("{" + parametro + "}", str(recurso.id))
    return url, ja_criados


def _controle_positivo(client_b, metodo: str, caminho: str, url: str, corpo: dict):
    """
    Prova que o recurso fabricado e ALCANCAVEL por esta rota — sem isso, o
    404 exigido da conta A nao prova nada.

    O buraco que isto fecha: `RECURSOS` e indexado por NOME DE PARAMETRO. Um
    nome novo falha alto (`assert fabrica is not None`), mas um nome JA
    REGISTRADO reusado para enderecar OUTRO model recebe o objeto errado — o
    id nunca bate com nada, a rota 404 para TODA conta, e o caso fica verde
    sem nunca ter exercitado filtro de conta nenhum. Foi o defeito medido em
    `env_id` (ver `_criar_ambiente_de_apresentacao`), e RECURSOS_POR_ROTA
    corrigiu as DUAS instancias conhecidas — nao a classe. Medido em
    05/09/2026, antes deste controle: uma rota `GET /api/vazamento/
    {project_id}` acrescentada a `app/main.py` que consultava `Product` sem
    filtro de conta — vazando `cost_price` e `markup` de todas as contas —
    passava, porque `project_id` ja estava em RECURSOS e o `Project`
    fabricado nunca batia com nenhum `Product.id`.

    **A asercao e `!= 404`, e nao algo mais forte, de proposito.** "B
    alcancou o proprio recurso" nao quer dizer "B recebeu 200": o corpo
    minimo dos POST e o `json={}` dos PUT/PATCH sao o suficiente para
    ATRAVESSAR o portao de conta, nao para satisfazer toda regra de negocio
    do handler — B pode legitimamente receber 400 (limite atingido, campo
    incoerente), 422 (validacao de dominio), 200/201/204. Qualquer um desses
    prova o que precisa ser provado: a requisicao passou do `repo.obter(...)`
    e chegou no corpo do handler, entao o 404 que a conta A recebeu veio do
    filtro por conta e nao de um id que nao endereca nada. Exigir 2xx aqui
    tornaria o controle refem de regra de negocio e transformaria "regra
    mudou" em "isolamento quebrou".
    """
    resposta_b = client_b.request(metodo, url, **corpo)

    assert resposta_b.status_code != 404, (
        f"CASO VACUO: {metodo} {caminho} devolveu 404 para a conta DONA do "
        f"recurso ({url}). Entao o 404 da conta A nao provou isolamento — "
        "provou so que este id nao endereca nada nesta rota. Quase sempre a "
        "causa e a fabrica errada: o parametro de caminho esta em RECURSOS "
        "com um model, e ESTA rota o usa para enderecar outro. Registre a "
        "fabrica certa em RECURSOS_POR_ROTA, com a chave (caminho, "
        f"parametro). Resposta da conta B: {resposta_b.text[:400]}"
    )


@pytest.mark.parametrize("metodo,caminho,parametros", CASOS_FORTES, ids=lambda v: str(v))
def test_toda_rota_forte_isola_por_conta_com_404(
    db, client_a, client_b, conta_b, metodo, caminho, parametros
):
    """
    Casos FORTES: GET/DELETE (sem corpo, 404 sempre exigivel) e PUT/PATCH
    (medido: os 8+5 casos coletados chegam no handler com `json={}`, sem
    campo obrigatorio faltando) alem dos POST com corpo minimo registrado.

    Para POST, o corpo minimo e OBRIGATORIO aqui dentro — mesma logica do
    `assert fabrica is not None` em `_preencher_url`: uma rota POST nova sem
    entrada em CORPOS_MINIMOS FALHA, em vez de silenciosamente virar `{}` e
    arriscar um 422 decorativo.
    """
    conta, usuario = conta_b
    url, ja_criados = _preencher_url(caminho, parametros, db, conta, usuario)

    if metodo == "POST":
        registro = CORPOS_MINIMOS.get(caminho)
        assert registro is not None, (
            f"a rota POST {caminho} esta em CASOS_FORTES mas nao tem corpo "
            "minimo em CORPOS_MINIMOS. Acrescente um corpo que passe da "
            "validacao do Pydantic, ou declare em "
            "POSTS_SEM_CORPO_MINIMO_POSSIVEL (com o motivo) se ele so puder "
            "ser montado citando dado de outra conta — nesse caso o caso "
            "migra sozinho para CASOS_FRACOS."
        )
        # Uma entrada pode ser um dict fixo ou uma funcao de
        # `(ja_criados, db, conta, usuario)`, para o corpo poder citar o
        # MESMO id que foi parar na URL ou fabricar um recurso novo da conta
        # B (ver o comentario de CORPOS_MINIMOS acima).
        corpo = (
            registro(ja_criados, db, conta, usuario)
            if callable(registro)
            else registro
        )
    else:
        corpo = {"json": {}}

    # Controle NEGATIVO primeiro, e de proposito: varias destas rotas sao
    # DELETE ou mutacao, e o controle positivo abaixo executa o caminho de
    # sucesso da conta B. Se ele rodasse antes, o recurso poderia ja estar
    # apagado quando a conta A tentasse alcanca-lo, e o 404 de A seria "nao
    # existe mais" em vez de "nao e seu" — vacuidade nova no lugar da antiga.
    resposta = client_a.request(metodo, url, **corpo)

    assert resposta.status_code not in (200, 201, 202, 204), (
        f"{metodo} {caminho} devolveu {resposta.status_code} para recurso da "
        "conta B — vazamento entre contas."
    )
    assert resposta.status_code != 403, (
        f"{metodo} {caminho} devolveu 403, que CONFIRMA a existencia do "
        "recurso alheio. Use 404."
    )
    assert resposta.status_code == 404, (
        f"{metodo} {caminho} devolveu {resposta.status_code}; esperado 404. "
        f"Corpo enviado: {corpo}. Resposta: {resposta.text[:400]}"
    )

    _controle_positivo(client_b, metodo, caminho, url, corpo)


@pytest.mark.parametrize("metodo,caminho,parametros", CASOS_FRACOS, ids=lambda v: str(v))
def test_toda_rota_fraca_isola_por_conta_sem_vazamento(
    db, client_a, client_b, conta_b, metodo, caminho, parametros
):
    """
    Casos FRACOS: hoje nenhum — POSTS_SEM_CORPO_MINIMO_POSSIVEL esta vazio,
    entao este teste coleta 0 casos e nao roda. O esqueleto fica pronto para
    o dia em que uma rota POST legitimamente nao possa ganhar corpo minimo
    sem citar dado de outra conta: `json={}` pode receber 422 do Pydantic
    antes do endpoint rodar, entao 404 nao e exigivel — mas vazamento
    (2xx/403) continua sendo, e e o que esta asercao ainda prova.
    """
    conta, usuario = conta_b
    url, _ = _preencher_url(caminho, parametros, db, conta, usuario)

    resposta = client_a.request(metodo, url, json={})

    assert resposta.status_code not in (200, 201, 202, 204), (
        f"{metodo} {caminho} devolveu {resposta.status_code} para recurso da "
        "conta B — vazamento entre contas."
    )
    assert resposta.status_code != 403, (
        f"{metodo} {caminho} devolveu 403, que CONFIRMA a existencia do "
        "recurso alheio. Use 404."
    )

    _controle_positivo(client_b, metodo, caminho, url, {"json": {}})


# Rotas GET sem parametro de caminho. O teste de isolamento acima nao as
# alcanca — ele existe para tentar chegar no recurso de OUTRA conta, e sem id
# na URL nao ha o que tentar. Mas uma rota que estoura 500 em toda requisicao
# tambem passa despercebida por ele, e foi o que aconteceu com
# /api/dashboard/lean entre as Tarefas 11 e 14: a assinatura de um helper
# mudou num arquivo, quem importava nao foi atualizado, e nenhum teste batia
# na rota. Esta rede e barata e teria pego.
GETS_SEM_PARAMETRO = sorted(
    {
        rota.path
        for rota in app.routes
        if hasattr(rota, "methods")
        and "GET" in rota.methods
        and "{" not in rota.path
        and rota.path.startswith("/api")
    }
)


def test_ha_gets_sem_parametro_para_percorrer():
    assert len(GETS_SEM_PARAMETRO) >= 8, (
        f"so {len(GETS_SEM_PARAMETRO)} rotas coletadas; algo filtrou demais"
    )


# Query params minimos para as rotas GET que os exigem. Sem isso o FastAPI
# devolve 422 antes do handler rodar — a mesma vacuidade dos POSTs acima,
# so que aqui o teste nem percebia, porque a asercao antiga (`< 500`) deixa
# 422 passar em silencio. `/api/events` exige `start_date`/`end_date`;
# `/api/financial` e `/api/financial/summary` exigem `month`/`year`.
PARAMS_MINIMOS: dict[str, dict] = {
    "/api/events": {"start_date": "2026-01-01", "end_date": "2026-12-31"},
    "/api/financial": {"month": 9, "year": 2026},
    "/api/financial/summary": {"month": 9, "year": 2026},
}


@pytest.mark.parametrize("caminho", GETS_SEM_PARAMETRO)
def test_get_sem_parametro_nao_estoura(db, client_a, caminho):
    """
    Fumaca, nao contrato: so exige que a rota RESPONDA e que a resposta nao
    seja vazia por FALTA DE PARAMETRO. Nao afirma status 200, porque varias
    dependem de dado que a conta de teste nao tem — o que se afirma e que
    ela nao morre (`< 500`) e que a chamada de fato ALCANCOU o handler
    (`!= 422`): uma rota com query param obrigatorio sem entrada em
    PARAMS_MINIMOS devolveria 422 sem nunca rodar o handler, e a rede ficaria
    vazia sem ninguem notar — a mesma classe de vacuidade do corpo dos POSTs
    acima, so que em query string.
    """
    resposta = client_a.get(caminho, params=PARAMS_MINIMOS.get(caminho, {}))

    assert resposta.status_code < 500, (
        f"GET {caminho} devolveu {resposta.status_code}. "
        f"Corpo: {resposta.text[:400]}"
    )
    assert resposta.status_code != 422, (
        f"GET {caminho} devolveu 422 — provavelmente um query param "
        "obrigatorio sem entrada em PARAMS_MINIMOS. Acrescente um valor "
        f"minimo la; sem isso a rota nunca chega no handler. Resposta: "
        f"{resposta.text[:400]}"
    )
