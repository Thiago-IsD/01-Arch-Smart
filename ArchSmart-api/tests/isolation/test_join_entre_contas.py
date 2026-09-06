"""
Join que traz coluna de OUTRO model nao herda o escopo do repositorio.

`ScopedRepository.query(Model)` filtra `Model.account_id`, e so isso. O
proprio docstring de `repository.py` nomeia `.join(Outro).with_entities(
Outro)` como a saida da garantia: as colunas de `Outro` vem sem filtro
nenhum, e vao para a resposta.

Nao ha constraint no banco proibindo um FK entre contas — nem `projects
.client_id -> clients.id`, nem `events.project_id -> projects.id` — entao a
unica coisa que impede o vazamento e o ON do join carregar a conta. Este
arquivo grava esse FK cruzado a mao e prova que ele NAO chega na resposta.

Medido em 05/09/2026, com o ON sem a condicao de conta (como estava antes):
`GET /api/dashboard/lean` devolvia o `client_name` do cliente da conta B em
`recent_projects`, e `project_name` do projeto da conta B em
`upcoming_events`; `GET /api/events` devolvia o mesmo `project_name`. Este
teste falhava nas tres.
"""
from datetime import datetime

from app.models.all_models import Client, Event, Project

# Nomes que nao aparecem em nenhum outro lugar da suite: a asercao e
# "esta string nao esta no corpo da resposta", e um nome generico daria
# falso vermelho ao casar com outro dado.
CLIENTE_DE_B = "CLIENTE-SO-DA-CONTA-B"
PROJETO_DE_B = "PROJETO-SO-DA-CONTA-B"


def _fk_cruzado(db, conta_a, conta_b):
    """
    Monta o estado que nenhuma rota consegue criar hoje (todo caminho que
    grava esses FKs resolve o pai por `repo.obter`/`repo.get` antes), mas
    que o banco aceita: dado da conta A apontando para dado da conta B.
    """
    cliente_b = Client(account_id=conta_b.id, name=CLIENTE_DE_B)
    db.add(cliente_b)
    db.flush()

    projeto_b = Project(
        account_id=conta_b.id,
        client_id=cliente_b.id,
        name=PROJETO_DE_B,
        status="ACTIVE",
    )
    db.add(projeto_b)
    db.flush()

    # Projeto da conta A com client_id da conta B.
    projeto_a = Project(
        account_id=conta_a.id,
        client_id=cliente_b.id,
        name="Projeto da conta A",
        status="ACTIVE",
    )
    # Evento da conta A com project_id da conta B.
    evento_a = Event(
        account_id=conta_a.id,
        project_id=projeto_b.id,
        title="Visita",
        start_time=datetime(2099, 1, 1, 10, 0),
        end_time=datetime(2099, 1, 1, 11, 0),
    )
    db.add_all([projeto_a, evento_a])
    db.flush()


def test_dashboard_nao_devolve_cliente_nem_projeto_de_outra_conta(
    db, client_a, conta_a, conta_b
):
    _fk_cruzado(db, conta_a[0], conta_b[0])

    resposta = client_a.get("/api/dashboard/lean")

    assert resposta.status_code == 200, resposta.text
    assert CLIENTE_DE_B not in resposta.text, (
        "o join de Client em /dashboard/lean devolveu o nome do cliente de "
        "outra conta — a condicao de conta sumiu do ON."
    )
    assert PROJETO_DE_B not in resposta.text, (
        "o outerjoin de Project em /dashboard/lean devolveu o nome do "
        "projeto de outra conta — a condicao de conta sumiu do ON."
    )


def test_agenda_nao_devolve_nome_de_projeto_de_outra_conta(
    db, client_a, conta_a, conta_b
):
    _fk_cruzado(db, conta_a[0], conta_b[0])

    resposta = client_a.get(
        "/api/events",
        params={"start_date": "2099-01-01", "end_date": "2099-12-31"},
    )

    assert resposta.status_code == 200, resposta.text
    assert PROJETO_DE_B not in resposta.text, (
        "o outerjoin de Project em GET /api/events devolveu o nome do "
        "projeto de outra conta — a condicao de conta sumiu do ON."
    )
    # A semantica de OUTER JOIN tem que sobreviver a correcao: o evento
    # continua na lista, so que com project_name nulo. Se a condicao de
    # conta tivesse ido para um `.filter()` em vez do ON, o outerjoin
    # viraria INNER e o evento sumiria — um bug diferente, e silencioso.
    assert len(resposta.json()) == 1, (
        "o evento sumiu da agenda: a condicao de conta foi parar no WHERE, "
        "e o outerjoin virou inner join."
    )
    assert resposta.json()[0]["project_name"] is None
