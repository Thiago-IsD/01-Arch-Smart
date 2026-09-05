"""
Financeiro, agenda, dashboard e notificacoes: contrato e isolamento.

O teste do dashboard e o mais importante da tarefa: agregacao que conta linha
de outra conta nao levanta erro nenhum — ela so devolve um numero errado.

As rotas abaixo foram conferidas em `app.main` antes de escrever os testes
(nenhuma tem GET por id — nem financial nem events expoe isso hoje):

    GET    /api/financial/summary
    GET    /api/financial
    POST   /api/financial
    PATCH  /api/financial/{entry_id}/status
    PUT    /api/financial/{entry_id}
    DELETE /api/financial/{entry_id}
    GET    /api/events
    POST   /api/events
    PUT    /api/events/{event_id}
    DELETE /api/events/{event_id}
    GET    /api/notifications/
    PATCH  /api/notifications/{notification_id}/read
    GET    /api/dashboard/lean
"""
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.all_models import Event, FinancialEntry, Notification


def _lancamento(
    db: Session,
    conta,
    valor: float,
    tipo: str = "EXPENSE",
    status: str = "REALIZED",
    vencimento: date | None = None,
) -> FinancialEntry:
    entrada = FinancialEntry(
        account_id=conta.id,
        description="Lancamento",
        amount=valor,
        type=tipo,
        status=status,
        due_date=vencimento or date.today(),
    )
    db.add(entrada)
    db.flush()
    return entrada


def _evento(db: Session, conta, titulo: str, inicio: datetime | None = None) -> Event:
    comeco = inicio or (datetime.utcnow() + timedelta(days=1))
    evento = Event(
        account_id=conta.id,
        title=titulo,
        start_time=comeco,
        end_time=comeco + timedelta(hours=1),
    )
    db.add(evento)
    db.flush()
    return evento


def test_extrato_so_traz_lancamentos_da_conta(db, client_a, conta_a, conta_b):
    hoje = date.today()
    _lancamento(db, conta_a[0], 100.0, vencimento=hoje)
    _lancamento(db, conta_b[0], 999.0, vencimento=hoje)

    corpo = client_a.get(
        "/api/financial", params={"month": hoje.month, "year": hoje.year}
    ).json()

    assert any(e["amount"] == 100.0 for e in corpo)
    assert all(e["amount"] != 999.0 for e in corpo)


def test_lancamento_alheio_e_404(db, client_a, conta_b):
    alheio = _lancamento(db, conta_b[0], 999.0)

    r = client_a.patch(f"/api/financial/{alheio.id}/status")

    assert r.status_code == 404


def test_evento_alheio_e_404(db, client_a, conta_b):
    alheio = _evento(db, conta_b[0], "Reuniao alheia")

    r = client_a.delete(f"/api/events/{alheio.id}")

    assert r.status_code == 404


def test_notificacao_alheia_e_404(db, client_a, conta_b):
    alheia = Notification(
        account_id=conta_b[0].id, title="Alheia", message="nao e sua"
    )
    db.add(alheia)
    db.flush()

    r = client_a.patch(f"/api/notifications/{alheia.id}/read")

    assert r.status_code == 404


def test_dashboard_nao_conta_dado_de_outra_conta(db, client_a, conta_a, conta_b):
    """
    Agregacao que esquece o WHERE nao da erro: da numero.
    """
    _evento(db, conta_a[0], "Meu")
    for indice in range(5):
        _evento(db, conta_b[0], f"Alheio {indice}")
    _lancamento(db, conta_a[0], 100.0)
    _lancamento(db, conta_b[0], 999999.0)

    corpo = client_a.get("/api/dashboard/lean").json()
    texto = str(corpo)

    assert "999999" not in texto, (
        "um valor da conta B apareceu no dashboard da conta A: " + texto
    )
    assert "Alheio" not in texto, (
        "um evento da conta B apareceu no dashboard da conta A: " + texto
    )


def test_criar_lancamento_grava_conta_e_autor(db, client_a, conta_a):
    r = client_a.post(
        "/api/financial",
        json={
            "description": "Honorarios",
            "amount": 5000.0,
            "type": "INCOME",
            "status": "PREDICTED",
            "due_date": "2026-09-05",
        },
    )

    assert r.status_code in (200, 201)
    criado = (
        db.query(FinancialEntry)
        .filter(FinancialEntry.description == "Honorarios")
        .first()
    )
    assert criado.account_id == conta_a[0].id
    assert criado.created_by == conta_a[1].id
