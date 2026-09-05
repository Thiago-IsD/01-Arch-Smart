from fastapi import APIRouter, Depends, status
from uuid import UUID
from pydantic import BaseModel

from app.core.errors import NotFound
from app.db.repository import ScopedRepository, get_repo
from app.models.all_models import Budget, BudgetItem, ItemOption, Project, Environment, Product
from app.schemas.budget_schema import (
    BudgetResponse,
    BudgetItemCreate,
    BudgetItemResponse,
    BudgetItemUpdate,
)
from app.services.budget_calculator import (
    calculate_quantity,
    carregar_orcamento,
    popular_relacionamento_de_itens,
    produto_selecionado,
)

router = APIRouter()

@router.get("/projects/{project_id}/budget", response_model=BudgetResponse)
def get_project_budget(
    project_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Returns the entire budget tree for a given project.
    """
    # 1. Validation
    project = repo.obter(Project, project_id)

    # 2. Get or Create Budget placeholder
    budget = repo.query(Budget).filter(Budget.project_id == project_id).first()

    if not budget:
        budget = repo.create(Budget, project_id=project_id, total_value=0.0)
        repo.db.commit()
        repo.db.refresh(budget)

    # 3. Inject calculated values on the fly and compute correct real-time total
    itens, dnas = carregar_orcamento(
        repo.query(BudgetItem).filter(BudgetItem.budget_id == budget.id)
    )
    real_total = 0.0
    for item in itens:
        produto = produto_selecionado(item)
        calculo = calculate_quantity(item, dnas.get(item.environment_id), produto)
        item.calculated_quantity = calculo.calculated_quantity
        item.base_area = calculo.base_area
        item.has_yield_alert = calculo.has_yield_alert

        # Calculate row total based ONLY on selected option
        if produto:
            price = produto.price or 0.0
            qty = item.manual_quantity if item.rule_type.value == "UNIT" else item.calculated_quantity
            if qty is None: qty = 1
            real_total += price * qty

    budget.total_value = real_total
    # Sem isto, BudgetResponse.items dispara sua PROPRIA leitura de
    # budget.items na serializacao — uma query redundante com a que acabou
    # de carregar `itens` acima, e sem o joinedload de environment/options
    # que carregar_orcamento ja pagou (ver popular_relacionamento_de_itens).
    popular_relacionamento_de_itens(budget, itens)

    return budget

@router.post("/budgets/items", response_model=BudgetItemResponse, status_code=status.HTTP_201_CREATED)
def add_item_to_budget(
    data: BudgetItemCreate,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Adds a product to an environment's budget. Creates the Budget and BudgetItems implicitly.
    """
    # 1. Validation constraints
    repo.obter(Project, data.project_id)

    environment = repo.query(Environment).filter(
        Environment.id == data.environment_id, Environment.project_id == data.project_id
    ).first()
    if not environment:
        raise NotFound("Ambiente não encontrado neste projeto")

    produto = repo.get(Product, data.product_id)
    if not produto:
        raise NotFound("Produto não encontrado na biblioteca")

    # 2. Ensure Budget exists
    budget = repo.query(Budget).filter(Budget.project_id == data.project_id).first()
    if not budget:
        budget = repo.create(Budget, project_id=data.project_id, total_value=0.0)
        repo.db.flush()

    # 3. Create BudgetItem (for the Environment + RuleType logic locus)
    # Default manual_quantity is 1 for UNITs, None for area-based rules
    manual_qtd = 1 if data.rule_type.value == "UNIT" else None

    budget_item = repo.create(
        BudgetItem,
        budget_id=budget.id,
        environment_id=data.environment_id,
        rule_type=data.rule_type,
        manual_quantity=manual_qtd,
    )
    repo.db.flush() # get ID

    # 4. Create ItemOption (attaches Product to the context)
    repo.create(
        ItemOption,
        budget_item_id=budget_item.id,
        product_id=data.product_id,
        is_selected=True,
    )
    repo.db.commit()
    repo.db.refresh(budget_item)

    # Attach calculated fields for the response
    itens, dnas = carregar_orcamento(
        repo.query(BudgetItem).filter(BudgetItem.id == budget_item.id)
    )
    item = itens[0]
    calculo = calculate_quantity(
        item, dnas.get(item.environment_id), produto_selecionado(item)
    )
    item.calculated_quantity = calculo.calculated_quantity
    item.base_area = calculo.base_area
    item.has_yield_alert = calculo.has_yield_alert

    return item

@router.patch("/budgets/items/{item_id}", response_model=BudgetItemResponse)
def update_budget_item(
    item_id: UUID,
    data: BudgetItemUpdate,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Updates a budget item. Typically used for overriding manual_quantity or loss_factor.
    """
    item = repo.obter(BudgetItem, item_id)

    if data.manual_quantity is not None:
        item.manual_quantity = data.manual_quantity

    # Allows setting manual_quantity to null if user clears it (front-end can map negative or 0 to None if needed later)

    if data.loss_factor is not None:
        item.loss_factor = data.loss_factor

    repo.db.commit()
    repo.db.refresh(item)

    # Re-calculate to return the fresh state
    itens, dnas = carregar_orcamento(
        repo.query(BudgetItem).filter(BudgetItem.id == item.id)
    )
    item = itens[0]
    calculo = calculate_quantity(
        item, dnas.get(item.environment_id), produto_selecionado(item)
    )
    item.calculated_quantity = calculo.calculated_quantity
    item.base_area = calculo.base_area
    item.has_yield_alert = calculo.has_yield_alert

    return item

@router.delete("/budgets/items/{item_id}")
def delete_budget_item(
    item_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Deletes a budget item permanently (or soft delete based on design rule).
    """
    item = repo.obter(BudgetItem, item_id)

    # Hard-delete cascade will remove ItemOption thanks to SQLAlchemy relationship setup.
    repo.remover(item)
    repo.db.commit()
    return {"ok": True}

class OptionCreate(BaseModel):
    product_id: UUID

@router.post("/budgets/items/{item_id}/options")
def create_budget_item_option(
    item_id: UUID,
    data: OptionCreate,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Adds a new Product Option to a Budget Item (A/B Logic).
    """
    # Mensagens preservadas ao pe da letra: tests/isolation/test_budgets_isolation.py
    # discrimina qual checagem disparou o 404 pelo texto exato de `detail`.
    item = repo.get(BudgetItem, item_id)
    if item is None:
        raise NotFound("Item de orçamento não encontrado")

    produto = repo.get(Product, data.product_id)
    if produto is None:
        raise NotFound("Produto não encontrado na biblioteca")

    # Add as unselected option by default
    new_option = repo.create(
        ItemOption,
        budget_item_id=item_id,
        product_id=data.product_id,
        is_selected=False,
    )
    repo.db.commit()
    repo.db.refresh(new_option)

    return {"ok": True, "option_id": new_option.id}


@router.patch("/budgets/options/{option_id}/select")
def select_budget_item_option(
    option_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Selects this option and deselects all other options for the same Budget Item.
    """
    option = repo.obter(ItemOption, option_id)

    # Unselect others
    repo.query(ItemOption).filter(
        ItemOption.budget_item_id == option.budget_item_id,
        ItemOption.id != option_id
    ).update({"is_selected": False})

    # Select this one
    option.is_selected = True
    repo.db.commit()

    return {"ok": True}

@router.delete("/budgets/options/{option_id}")
def delete_budget_item_option(
    option_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Deletes an ItemOption (Variant A/B). If it's the only one, deletes the parent BudgetItem.
    If the deleted option was the selected one, automatically selects the next available one.
    """
    option = repo.obter(ItemOption, option_id)

    budget_item_id = option.budget_item_id
    was_selected = option.is_selected

    repo.remover(option)
    repo.db.commit()

    # After deletion, check remaining options for the parent item
    remaining_options = repo.query(ItemOption).filter(ItemOption.budget_item_id == budget_item_id).all()

    if len(remaining_options) == 0:
        # No more variants, item makes no sense. Delete the entire budget item.
        item = repo.query(BudgetItem).filter(BudgetItem.id == budget_item_id).first()
        if item:
            repo.remover(item)
            repo.db.commit()
    elif was_selected:
        # We deleted the active one, so we must activate another one
        remaining_options[0].is_selected = True
        repo.db.commit()

    return {"ok": True}

@router.get("/budgets/{budget_id}/summary")
def get_budget_summary(
    budget_id: UUID,
    repo: ScopedRepository = Depends(get_repo),
):
    """
    Returns the consolidated financial total for the budget and per-environment totals,
    based strictly on 'is_selected=True' ItemOptions.
    """
    budget = repo.obter(Budget, budget_id)

    itens, dnas = carregar_orcamento(
        repo.query(BudgetItem).filter(BudgetItem.budget_id == budget_id)
    )

    total_project = 0.0
    environment_totals = {}

    for item in itens:
        # Re-run calc in memory just to ensure accuracy for summary
        produto = produto_selecionado(item)
        calc = calculate_quantity(item, dnas.get(item.environment_id), produto)
        qty = item.manual_quantity if item.rule_type.value == "UNIT" else calc.calculated_quantity
        if qty is None:
            qty = 1 # fallback

        # Find selected option cost
        if produto:
            cost = (produto.price or 0.0) * qty
            total_project += cost

            env_id_str = str(item.environment_id)
            if env_id_str not in environment_totals:
                environment_totals[env_id_str] = 0.0
            environment_totals[env_id_str] += cost

    return {
        "budget_id": str(budget.id),
        "total_project": total_project,
        "total_by_environment": environment_totals
    }
