"""
/api/dashboard/lean: os valores que a tela mostra, e quantas idas custam.

O primeiro teste e CARACTERIZACAO — escrito e verde contra o codigo anterior a
Task 3 do plano do Dashboard. Ele existe porque a task troca duas agregacoes
por uma com soma condicional, e agregacao errada nao da erro: da numero. Ele
tambem prende conteudo e ordem de `recent_projects` (o `with_entities` desta
branch mudou a ordem da tupla, e um teste que so contava `len()` nao pegaria
uma coluna trocada de lugar).

Os demais testes prendem casos que o primeiro nao cobre: o teste de contagem
de lancamentos prende que "vazio" nao se confunde com "soma zero" (lancamentos
que se anulam), o de conta vazia prende o ramo `else 0` da agregacao
financeira e a lista vazia em cada campo, e o ultimo prende o custo — cada
consulta e uma ida a rede, 0,17 s na API implantada
(docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md).
"""
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.all_models import Event, FinancialEntry, Product
from tests.conftest import criar_projeto
from tests.contador_de_queries import ContadorDeQueries, contexto_de_verdade


def _lancamento(db, conta, valor, tipo, status, vencimento):
    db.add(
        FinancialEntry(
            account_id=conta.id,
            description="Lancamento",
            amount=valor,
            type=tipo,
            status=status,
            due_date=vencimento,
        )
    )
    db.flush()


def _cenario(db: Session, conta, usuario, projetos: int) -> None:
    hoje = date.today()
    # 40 dias antes do dia 1 cai, no minimo, dois meses atras: nunca no mes
    # corrente, em qualquer dia em que o teste rodar.
    fora_do_mes = hoje.replace(day=1) - timedelta(days=40)
    _lancamento(db, conta, 1000.0, "INCOME", "REALIZED", hoje)
    _lancamento(db, conta, 300.0, "EXPENSE", "REALIZED", hoje)
    _lancamento(db, conta, 200.0, "INCOME", "PREDICTED", hoje)
    _lancamento(db, conta, 50.0, "EXPENSE", "REALIZED", fora_do_mes)
    for indice in range(projetos):
        criar_projeto(db, conta, f"Projeto {indice}", usuario)  # status default ACTIVE
    db.add(Product(account_id=conta.id, created_by=usuario.id, name="Cadeira", price=10.0))
    inicio = datetime.now() + timedelta(days=1)
    db.add(
        Event(account_id=conta.id, title="Reuniao", start_time=inicio, end_time=inicio + timedelta(hours=1))
    )
    db.flush()


def test_lean_devolve_os_mesmos_valores(db: Session, client_a, conta_a):
    conta, usuario = conta_a
    _cenario(db, conta, usuario, projetos=6)

    corpo = client_a.get("/api/dashboard/lean").json()

    # saldo = receitas realizadas - despesas realizadas, de qualquer mes
    assert corpo["financial_balance"] == 1000.0 - 300.0 - 50.0
    # entradas e saidas do MES, previstas e realizadas
    assert corpo["financial_income"] == 1000.0 + 200.0
    assert corpo["financial_expense"] == 300.0
    # a contagem e de todos os ativos; a lista para em 4
    assert corpo["active_projects_count"] == 6
    assert len(corpo["recent_projects"]) == 4
    assert len(corpo["recent_products"]) == 1
    assert len(corpo["upcoming_events"]) == 1
    # ordem: desc(Project.created_at) -- o ultimo criado ("Projeto 5") vem
    # primeiro. `criar_projeto` da a cada projeto um Client proprio chamado
    # "Cliente de <nome>", entao nome e client_name sao distinguiveis.
    assert corpo["recent_projects"][0]["name"] == "Projeto 5"
    assert corpo["recent_projects"][0]["client_name"] == "Cliente de Projeto 5"


def test_lean_conta_vazia_devolve_zeros(db: Session, client_a, conta_a):
    """
    Conta sem projeto, produto, evento ou lancamento nenhum -- exercita o ramo
    `else 0` da agregacao financeira (nenhuma linha por FinancialEntry.type) e
    o loop de listas sem linha nenhuma. Nao chama `_cenario`: e o estado de
    conta recem-criada que a decisao 3 da spec do Dashboard chama de vazia.
    """
    corpo = client_a.get("/api/dashboard/lean").json()

    assert corpo["active_projects_count"] == 0
    assert corpo["financial_entries_count"] == 0
    assert corpo["recent_projects"] == []
    assert corpo["recent_products"] == []
    assert corpo["upcoming_events"] == []
    assert corpo["financial_balance"] == 0.0
    assert corpo["financial_income"] == 0.0
    assert corpo["financial_expense"] == 0.0


def test_lean_conta_os_lancamentos(db: Session, client_a, conta_a):
    """
    "Dashboard vazio" (decisao 3 da spec) inclui zero lancamentos, e isso nao
    se deduz de somas zeradas: lancamentos que se anulam somam zero.
    """
    conta, usuario = conta_a
    _cenario(db, conta, usuario, projetos=1)

    corpo = client_a.get("/api/dashboard/lean").json()

    assert corpo["financial_entries_count"] == 4


def test_lean_nao_cresce_com_os_projetos_e_gasta_no_maximo_cinco(
    db: Session, client_a, conta_a, monkeypatch
):
    conta, usuario = conta_a

    def consultas() -> tuple[int, str]:
        with contexto_de_verdade(client_a, db, usuario, monkeypatch) as headers:
            with ContadorDeQueries(db.connection()) as contador:
                r = client_a.get("/api/dashboard/lean", headers=headers)
        assert r.status_code == 200, r.text
        return len(contador), contador.resumo()

    _cenario(db, conta, usuario, projetos=1)
    com_um, _ = consultas()
    for indice in range(5):
        criar_projeto(db, conta, f"Mais {indice}", usuario)
    com_seis, resumo = consultas()

    assert com_um == com_seis, f"cresceu com os projetos: {com_um} -> {com_seis}"
    # 1 caminho compartilhado + projetos com contagem + produtos + financeiro + eventos
    assert com_seis <= 5, f"{com_seis} consultas:\n  {resumo}"
