import calendar
from typing import List, Optional
from datetime import date

from app.db.repository import ScopedRepository
from app.models.all_models import Project, FinancialEntry
from app.schemas.project_schema import CustomInstallment


def sync_project_financials(
    project: Project,
    repo: ScopedRepository,
    custom_installments: Optional[List[CustomInstallment]] = None,
):
    """
    Motor de Sincronização Financeira do Projeto
    Gera/Atualiza os lançamentos (PREDICTED) de receita do projeto, protegendo as parcelas já pagas (REALIZED).

    `project` precisa ter chegado de `repo.obter(Project, ...)` — a função
    confia que `project.account_id == repo.ctx.account_id` e não confere de
    novo. `repo` substitui o `account_id` que esta função não recebe mais:
    quem chama não decide de qual conta são os lançamentos, o contexto da
    requisição decide.
    """
    total_value = project.service_value or 0.0
    total_installments = project.payment_installments or 1

    if total_value <= 0:
        return # Nada a cobrar

    # 1. Busca todas as entradas vinculadas a este projeto que são de Receita (INCOME)
    entries = repo.query(FinancialEntry).filter(
        FinancialEntry.project_id == project.id,
        FinancialEntry.type == "INCOME"
    ).all()

    # 2. Divide os status
    predicted_entries = [e for e in entries if e.status == "PREDICTED"]
    realized_entries = [e for e in entries if e.status == "REALIZED"]

    # Deleta estritamente as entradas PREDICTED antigas do projeto
    for pe in predicted_entries:
        repo.remover(pe)

    # 3. Calcula Saldo Restante
    realized_sum = sum((e.amount or 0.0) for e in realized_entries)
    remaining_balance = total_value - realized_sum

    # 4. Calcula Parcelas Restantes
    remaining_installments = total_installments - len(realized_entries)

    # 5. Se ainda houver o que cobrar e como dividir
    if getattr(project, "payment_method", "STANDARD") == "CUSTOM" and custom_installments:
        # Se for um Cronograma Personalizado recebido via UI Front-end:
        # Criamos as parcelas exatamente como formatadas no Array (Valor, Data, Desc).
        for idx, custom_inst in enumerate(custom_installments):
            current_parcel_index = len(realized_entries) + idx + 1
            desc = custom_inst.description if custom_inst.description else f"Parcela {current_parcel_index}/{total_installments} - {project.name}"

            repo.create(
                FinancialEntry,
                project_id=project.id,
                type="INCOME",
                status="PREDICTED",
                amount=custom_inst.amount,
                due_date=custom_inst.due_date,
                description=desc,
                category="Serviços de Arquitetura",
            )

    elif remaining_balance > 0 and remaining_installments > 0:
        # Fluxo Convencional (Distribuição Aritmética em Mensalidades a cada 30 dias)
        parcel_amount = remaining_balance / remaining_installments
        today = date.today()

        for i in range(remaining_installments):
            # Aritmética de meses para avançar o vencimento
            month = today.month - 1 + i
            year = today.year + month // 12
            month = month % 12 + 1

            # Ajusta dias finais (ex: 31 de abril é inválido -> 30)
            try:
                due_date = today.replace(year=year, month=month)
            except ValueError:
                last_day = calendar.monthrange(year, month)[1]
                due_date = today.replace(year=year, month=month, day=last_day)

            # Número da parcela visível ao usuário
            current_parcel_index = len(realized_entries) + i + 1

            repo.create(
                FinancialEntry,
                project_id=project.id,
                type="INCOME",
                status="PREDICTED",
                amount=parcel_amount,
                due_date=due_date,
                description=f"Parcela {current_parcel_index}/{total_installments} - {project.name}",
                category="Serviços de Arquitetura",
            )

    repo.db.commit()
