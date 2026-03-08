import uuid
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func, extract
from sqlalchemy import or_

from app.db.session import get_db
from app.api.users import get_current_user
from app.models.all_models import User, FinancialEntry, Project
from app.schemas.financial_schema import (
    FinancialEntryCreate,
    FinancialEntryUpdate,
    FinancialEntryResponse,
    FinancialSummaryResponse,
)

router = APIRouter()

@router.get("/summary", response_model=FinancialSummaryResponse)
def get_financial_summary(
    month: int = Query(..., description="Month (1-12)"),
    year: int = Query(..., description="Year (YYYY)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retorna o Saldo Total consolidado de tudo que foi 'REALIZED'.
    E soma os Recebimentos e Despesas APENAS do Mês/Ano filtrado (independente se REALIZED ou PREDICTED, dependendo do biz logic. Vamos assumir tudo do mês).
    """
    account_id = current_user.account_id

    # Saldo em Caixa (tudo REALIZED até agora na conta)
    balance_query = db.query(
        func.sum(FinancialEntry.amount).label("total"),
        FinancialEntry.type
    ).filter(
        FinancialEntry.account_id == account_id,
        FinancialEntry.status == "REALIZED"
    ).group_by(FinancialEntry.type).all()

    balance = 0.0
    for total, f_type in balance_query:
        if f_type == "INCOME":
            balance += (total or 0.0)
        elif f_type == "EXPENSE":
            balance -= (total or 0.0)

    # Entradas e Saídas do Mês Filtrado (qualquer status para prever fluxo de caixa do mes)
    monthly_query = db.query(
        func.sum(FinancialEntry.amount).label("total"),
        FinancialEntry.type
    ).filter(
        FinancialEntry.account_id == account_id,
        extract('month', FinancialEntry.due_date) == month,
        extract('year', FinancialEntry.due_date) == year
    ).group_by(FinancialEntry.type).all()

    total_income = 0.0
    total_expense = 0.0
    for total, f_type in monthly_query:
        if f_type == "INCOME":
            total_income = (total or 0.0)
        elif f_type == "EXPENSE":
            total_expense = (total or 0.0)

    return FinancialSummaryResponse(
        balance=balance,
        total_income=total_income,
        total_expense=total_expense
    )


@router.get("", response_model=List[FinancialEntryResponse])
def get_financial_entries(
    month: int = Query(..., description="Month (1-12)"),
    year: int = Query(..., description="Year (YYYY)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lista de movimentações financeiras no período.
    Utiliza um JOIN com Project para trazer o nome do projeto caso exista.
    """
    entries_query = db.query(FinancialEntry, Project.name.label("project_name"))\
        .outerjoin(Project, FinancialEntry.project_id == Project.id)\
        .filter(
            FinancialEntry.account_id == current_user.account_id,
            extract('month', FinancialEntry.due_date) == month,
            extract('year', FinancialEntry.due_date) == year
        ).order_by(FinancialEntry.due_date.asc()).all()
    
    results = []
    for entry, pj_name in entries_query:
        entry_dict = {
            "id": entry.id,
            "account_id": entry.account_id,
            "project_id": entry.project_id,
            "type": entry.type,
            "status": entry.status,
            "amount": entry.amount,
            "due_date": entry.due_date,
            "description": entry.description,
            "category": entry.category,
            "group_id": entry.group_id,
            "installment_number": entry.installment_number,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
            "project_name": pj_name
        }
        results.append(FinancialEntryResponse(**entry_dict))

    return results

@router.post("", response_model=FinancialEntryResponse)
def create_financial_entry(
    payload: FinancialEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ Criação de lançamento manual """
    import calendar
    
    if payload.type not in ["INCOME", "EXPENSE"]:
        raise HTTPException(status_code=400, detail="Invalid Type")
    if payload.status not in ["PREDICTED", "REALIZED"]:
        raise HTTPException(status_code=400, detail="Invalid Status")

    entries = []
    
    # 1. Generate Group ID if recurrence is requested
    group_id = str(uuid.uuid4()) if payload.recurrence in ["INSTALLMENT", "RECURRING"] else None

    if payload.recurrence == "INSTALLMENT":
        q_installments = payload.installments if payload.installments and payload.installments > 0 else 1
        parcel_amount = payload.amount / q_installments
        for i in range(q_installments):
            month = payload.due_date.month - 1 + i
            year = payload.due_date.year + month // 12
            month = month % 12 + 1
            try:
                new_date = payload.due_date.replace(year=year, month=month)
            except ValueError:
                last_day = calendar.monthrange(year, month)[1]
                new_date = payload.due_date.replace(year=year, month=month, day=last_day)
                
            e = FinancialEntry(
                account_id=current_user.account_id,
                project_id=payload.project_id,
                type=payload.type,
                status=payload.status,
                amount=parcel_amount,
                due_date=new_date,
                description=f"{payload.description} ({i+1}/{q_installments})",
                category=payload.category,
                group_id=group_id,
                installment_number=i+1
            )
            entries.append(e)
            
    elif payload.recurrence == "RECURRING":
        # Gera 24 meses (2 anos) de lançamentos recorrentes como padrão para gestão passiva
        for i in range(24):
            month = payload.due_date.month - 1 + i
            year = payload.due_date.year + month // 12
            month = month % 12 + 1
            try:
                new_date = payload.due_date.replace(year=year, month=month)
            except ValueError:
                last_day = calendar.monthrange(year, month)[1]
                new_date = payload.due_date.replace(year=year, month=month, day=last_day)
                
            e = FinancialEntry(
                account_id=current_user.account_id,
                project_id=payload.project_id,
                type=payload.type,
                status=payload.status,
                amount=payload.amount,
                due_date=new_date,
                description=payload.description,
                category=payload.category,
                group_id=group_id,
                installment_number=i+1
            )
            entries.append(e)

    else: # UNIQUE
        e = FinancialEntry(
            account_id=current_user.account_id,
            project_id=payload.project_id,
            type=payload.type,
            status=payload.status,
            amount=payload.amount,
            due_date=payload.due_date,
            description=payload.description,
            category=payload.category
        )
        entries.append(e)
    
    db.add_all(entries)
    db.commit()
    for e in entries:
        db.refresh(e)

    # Resolve return format using dict for the first mapped item
    ret = entries[0].__dict__.copy()
    ret["project_name"] = None
    return FinancialEntryResponse(**ret)

@router.patch("/{entry_id}/status", response_model=FinancialEntryResponse)
def toggle_financial_status(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ Altera o status entre PREDICTED e REALIZED (Pagamento de conta) """
    entry = db.query(FinancialEntry).filter(
        FinancialEntry.id == entry_id,
        FinancialEntry.account_id == current_user.account_id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
    
    # Toggle
    entry.status = "REALIZED" if entry.status == "PREDICTED" else "PREDICTED"
    entry.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(entry)
    
    # Busca nome do projeto se aplicavel
    pj_name = None
    if entry.project_id:
        pj = db.query(Project).filter(Project.id == entry.project_id).first()
        if pj: pj_name = pj.name

    ret = entry.__dict__.copy()
    ret["project_name"] = pj_name
    return FinancialEntryResponse(**ret)

@router.put("/{entry_id}", response_model=FinancialEntryResponse)
def update_financial_entry(
    entry_id: uuid.UUID,
    payload: FinancialEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ Edita um lançamento financeiro existente """
    entry = db.query(FinancialEntry).filter(
        FinancialEntry.id == entry_id,
        FinancialEntry.account_id == current_user.account_id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
        
    if payload.type is not None and payload.type not in ["INCOME", "EXPENSE"]:
        raise HTTPException(status_code=400, detail="Invalid Type")
    if payload.status is not None and payload.status not in ["PREDICTED", "REALIZED"]:
        raise HTTPException(status_code=400, detail="Invalid Status")

    # Update fields
    if payload.amount is not None:
        entry.amount = payload.amount
    if payload.due_date is not None:
        entry.due_date = payload.due_date
    if payload.description is not None:
        entry.description = payload.description
    if payload.category is not None:
        entry.category = payload.category
    if payload.type is not None:
        entry.type = payload.type
    if payload.status is not None:
        entry.status = payload.status
        
    entry.updated_at = datetime.utcnow()
    
    # Cascade Updates se aplicável (somente altera PREDICTED)
    if entry.group_id and payload.apply_to in ["NEXT", "ALL"]:
        query = db.query(FinancialEntry).filter(
            FinancialEntry.group_id == entry.group_id,
            FinancialEntry.account_id == current_user.account_id,
            FinancialEntry.status == "PREDICTED",
            FinancialEntry.id != entry.id # Não atualiza a si mesmo pois já foi setado
        )
        
        if payload.apply_to == "NEXT":
            query = query.filter(FinancialEntry.installment_number > entry.installment_number)
            
        siblings = query.all()
        for sib in siblings:
            if payload.amount is not None: sib.amount = payload.amount
            if payload.description is not None: 
                # Preserva o sufixo (x/y) nas parcelas editadas
                if "(/" in sib.description or payload.recurrence == "INSTALLMENT":
                     # Simplification: we might lose the perfect (2/10) if the user forces a clean description. 
                     # For now, apply raw description from payload if applying to ALL/NEXT.
                     sib.description = payload.description
            if payload.category is not None: sib.category = payload.category
            if payload.type is not None: sib.type = payload.type
            sib.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(entry)
    
    # Busca nome do projeto se aplicavel
    pj_name = None
    if entry.project_id:
        pj = db.query(Project).filter(Project.id == entry.project_id).first()
        if pj: pj_name = pj.name

    ret = entry.__dict__.copy()
    ret["project_name"] = pj_name
    return FinancialEntryResponse(**ret)

@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_financial_entry(
    entry_id: uuid.UUID,
    apply_to: str = Query("SINGLE", description="SINGLE, NEXT, ALL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ Exclui permanentemente um lançamento financeiro """
    entry = db.query(FinancialEntry).filter(
        FinancialEntry.id == entry_id,
        FinancialEntry.account_id == current_user.account_id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada")
        
    # Cascade Delete apenas de "PREDICTED" na lixeira
    if entry.group_id and apply_to in ["NEXT", "ALL"]:
        query = db.query(FinancialEntry).filter(
            FinancialEntry.group_id == entry.group_id,
            FinancialEntry.account_id == current_user.account_id,
            FinancialEntry.status == "PREDICTED",
            FinancialEntry.id != entry.id
        )
        
        if apply_to == "NEXT":
            query = query.filter(FinancialEntry.installment_number > entry.installment_number)
            
        query.delete(synchronize_session=False)

    db.delete(entry)
    db.commit()
    return None

