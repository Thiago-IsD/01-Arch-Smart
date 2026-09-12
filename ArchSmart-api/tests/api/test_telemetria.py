"""
Endpoint de telemetria: escopo, lote e identidade.

O teste do account_id forjado e o que fecha a tarefa. Ele prova a garantia
DE FORA, do ponto de vista de quem chama a API: a conta gravada e a da
SESSAO, mesmo quando o corpo pede outra (Art. 1).

Isso e so metade da defesa, e o teste nao prova a outra metade. Aqui quem
barra o valor forjado e o SCHEMA: `EventoRecebido` (app/schemas/
telemetry_schema.py) nao declara `account_id`, e o Pydantic v2 descarta o
campo com `extra="ignore"` (o padrao do model_config) antes mesmo de o
endpoint rodar — o valor nunca chega a `track()` nem a
`ScopedRepository.create()`. A segunda camada, `ScopedRepository.create()`
descartando `account_id`/`created_by` recebido em kwargs, tem teste proprio
e direto contra o repositorio em tests/api/test_repositorio.py:
`test_create_ignora_account_id_vindo_do_cliente`,
`test_create_ignora_relacionamento_account_vindo_do_cliente` e
`test_create_ignora_created_by_vindo_do_cliente` (Secao 4). Nao ha lacuna
de comportamento — sao duas camadas, cada uma com seu teste —, mas um
leitor que so olhasse este arquivo poderia achar que ele sozinho cobre as
duas.
"""
from sqlalchemy.orm import Session

from app.models.all_models import ProductEvent
from app.schemas.telemetry_schema import LoteDeEventos


def test_evento_e_gravado_na_conta_da_sessao(db: Session, client_a, conta_a):
    conta, usuario = conta_a

    r = client_a.post(
        "/api/telemetry/events",
        json={"eventos": [{"name": "screen_viewed", "properties": {"screen": "/library"}}]},
    )

    assert r.status_code == 204
    evento = db.query(ProductEvent).one()
    assert evento.name == "screen_viewed"
    assert evento.account_id == conta.id
    assert evento.created_by == usuario.id


def test_account_id_forjado_no_corpo_e_ignorado(db: Session, client_a, conta_a, conta_b):
    """
    Prova a garantia de fora (Art. 1): a conta gravada e a da sessao, mesmo
    quando o corpo pede outra. Nao prova a defesa do `ScopedRepository.
    create()` — o mecanismo exercitado aqui e o schema: `EventoRecebido` nao
    declara `account_id`, entao o Pydantic descarta o campo forjado antes de
    o endpoint sequer rodar, e o valor nunca chega perto do repositorio. A
    defesa de `create()` descartando `account_id`/`created_by` de kwargs tem
    teste direto em tests/api/test_repositorio.py
    (`test_create_ignora_account_id_vindo_do_cliente`,
    `test_create_ignora_relacionamento_account_vindo_do_cliente`,
    `test_create_ignora_created_by_vindo_do_cliente`) — duas camadas, dois
    testes, sem lacuna.
    """
    minha_conta, _ = conta_a
    conta_alheia, _ = conta_b

    r = client_a.post(
        "/api/telemetry/events",
        json={
            "eventos": [
                {
                    "name": "screen_viewed",
                    "properties": {"screen": "/library"},
                    "account_id": str(conta_alheia.id),
                }
            ]
        },
    )

    assert r.status_code == 204
    evento = db.query(ProductEvent).one()
    assert evento.account_id == minha_conta.id
    assert evento.account_id != conta_alheia.id


def test_lote_grava_todos_os_eventos(db: Session, client_a):
    r = client_a.post(
        "/api/telemetry/events",
        json={
            "eventos": [
                {"name": "screen_viewed", "properties": {"screen": "/library"}},
                {"name": "screen_viewed", "properties": {"screen": "/dashboard"}},
            ]
        },
    )

    assert r.status_code == 204
    assert db.query(ProductEvent).count() == 2


def test_lote_vazio_nao_grava_nada(db: Session, client_a):
    r = client_a.post("/api/telemetry/events", json={"eventos": []})

    assert r.status_code == 204
    assert db.query(ProductEvent).count() == 0


def test_anonimo_nao_grava(db: Session, client_anon):
    """
    O status certo aqui e 422, nao 401/403: o FastAPI rejeita a requisicao
    por falta do header `authorization` antes mesmo do Depends(get_repo)
    (que resolve `get_context`) rodar — o mesmo motivo documentado em
    tests/isolation/test_public_endpoints.py::test_normalize_exige_autenticacao.
    Afirmar so o status deixaria passar despercebida uma mudanca que
    trocasse o motivo do 422 (por exemplo, um schema de corpo alterado) sem
    que a autenticacao continuasse exigida — por isso o teste tambem checa
    que o corpo do erro aponta para o header ausente.
    """
    r = client_anon.post(
        "/api/telemetry/events",
        json={"eventos": [{"name": "screen_viewed", "properties": {}}]},
    )

    assert r.status_code == 422
    assert "authorization" in str(r.json()["detail"]).lower()
    assert db.query(ProductEvent).count() == 0


# O cliente descarrega a fila quando ela chega a `TAMANHO_MAXIMO = 20`
# (ArchSmart-web/src/features/telemetry/fila.ts). O servidor aceita
# `max_length=50` (app/schemas/telemetry_schema.py). Hoje ha folga de 30, e
# nada ligava os dois numeros — os dois testes abaixo ligam.
TAMANHO_DO_LOTE_DO_CLIENTE = 20


def test_aceita_o_lote_cheio_do_cliente(db: Session, client_a):
    """
    O maior lote que o cliente chega a mandar tem de passar.

    Isto prende uma relacao entre dois arquivos de repositorios diferentes:
    baixar o `max_length` do schema abaixo de `TAMANHO_MAXIMO` da fila do
    cliente faria o Pydantic rejeitar o lote INTEIRO com 422 — e, desde que a
    Secao 8 pos os eventos em lote, o lote e a unidade de perda: `enviarEventos`
    engole o erro de proposito, entao os 20 eventos sumiriam calados, sem erro
    no console de ninguem e indistinguivel de "ninguem navegou".

    Por que um teste, e nao um comentario nos dois arquivos: comentario nao
    reprova. Quem baixar o teto do servidor para 10 vai ver esta linha
    vermelha em vez de descobrir pela ausencia de dado semanas depois.
    """
    lote = [
        {"name": "screen_viewed", "properties": {"screen": f"/tela-{i}"}}
        for i in range(TAMANHO_DO_LOTE_DO_CLIENTE)
    ]

    r = client_a.post("/api/telemetry/events", json={"eventos": lote})

    assert r.status_code == 204, (
        f"o servidor recusou um lote de {TAMANHO_DO_LOTE_DO_CLIENTE} eventos, que e "
        "exatamente o tamanho em que a fila do cliente descarrega "
        "(TAMANHO_MAXIMO em ArchSmart-web/src/features/telemetry/fila.ts). "
        f"Resposta: {r.text}"
    )
    assert db.query(ProductEvent).count() == TAMANHO_DO_LOTE_DO_CLIENTE


def test_lote_acima_do_teto_e_recusado_inteiro(db: Session, client_a):
    """
    O teto existe, e recusar passa o lote inteiro para o chao.

    O numero do teto (50) nao esta escrito aqui de proposito: o que o teste
    afirma e a forma — existe um teto acima do lote do cliente, e quem o
    estoura nao grava NADA, nem os eventos validos do comeco do lote. E a
    metade incomoda da folga medida no teste acima: a recusa e total, e o
    cliente a engole.
    """
    teto_declarado = LoteDeEventos.model_fields["eventos"].metadata
    limites = [m.max_length for m in teto_declarado if hasattr(m, "max_length")]
    assert limites, "LoteDeEventos.eventos perdeu o max_length: o lote ficou sem teto"
    teto = limites[0]
    assert teto > TAMANHO_DO_LOTE_DO_CLIENTE, (
        f"o teto do servidor ({teto}) nao cobre o lote do cliente "
        f"({TAMANHO_DO_LOTE_DO_CLIENTE}): todo lote cheio seria recusado inteiro"
    )

    lote = [
        {"name": "screen_viewed", "properties": {"screen": f"/tela-{i}"}}
        for i in range(teto + 1)
    ]

    r = client_a.post("/api/telemetry/events", json={"eventos": lote})

    assert r.status_code == 422
    assert db.query(ProductEvent).count() == 0
