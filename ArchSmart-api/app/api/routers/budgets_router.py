from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel

from app.db.session import get_db
from app.models.all_models import Budget, BudgetItem, ItemOption, Project, User, Environment, Product
from app.schemas.budget_schema import (
    BudgetResponse, 
    BudgetItemCreate, 
    BudgetItemResponse, 
    BudgetItemUpdate,
)
from app.api.users import get_current_user
from app.services.budget_calculator import calculate_budget_item_quantity

router = APIRouter()

@router.get("/projects/{project_id}/budget", response_model=BudgetResponse)
def get_project_budget(
    project_id: UUID, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the entire budget tree for a given project.
    """
    # 1. Validation
    project = db.query(Project).filter(Project.id == project_id, Project.account_id == current_user.account_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Get or Create Budget placeholder
    budget = db.query(Budget).filter(Budget.project_id == project_id).first()
    
    if not budget:
        budget = Budget(project_id=project_id, total_value=0.0)
        db.add(budget)
        db.commit()
        db.refresh(budget)

    # 3. Inject calculated values on the fly and compute correct real-time total
    real_total = 0.0
    for item in budget.items:
        calc = calculate_budget_item_quantity(db, item)
        item.calculated_quantity = calc["calculated_quantity"]
        item.base_area = calc["base_area"]
        item.has_yield_alert = calc["has_yield_alert"]
        
        # Calculate row total based ONLY on selected option
        active_opt = next((o for o in item.options if o.is_selected), None)
        if active_opt and active_opt.product:
            price = active_opt.product.price or 0.0
            qty = item.manual_quantity if item.rule_type.value == "UNIT" else item.calculated_quantity
            if qty is None: qty = 1
            real_total += price * qty
            
    budget.total_value = real_total

    return budget

@router.post("/budgets/items", response_model=BudgetItemResponse, status_code=status.HTTP_201_CREATED)
def add_item_to_budget(
    data: BudgetItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Adds a product to an environment's budget. Creates the Budget and BudgetItems implicitly.
    """
    # 1. Validation constraints
    project = db.query(Project).filter(Project.id == data.project_id, Project.account_id == current_user.account_id).first()
    if not project:
         raise HTTPException(status_code=404, detail="Project not found")
         
    environment = db.query(Environment).filter(Environment.id == data.environment_id, Environment.project_id == data.project_id).first()
    if not environment:
         raise HTTPException(status_code=404, detail="Environment not found in this project")
         
    product = db.query(Product).filter(Product.id == data.product_id, Product.account_id == current_user.account_id).first()
    if not product:
         raise HTTPException(status_code=404, detail="Product not found in library")

    # 2. Ensure Budget exists
    budget = db.query(Budget).filter(Budget.project_id == data.project_id).first()
    if not budget:
        budget = Budget(project_id=data.project_id, total_value=0.0)
        db.add(budget)
        db.flush()

    # 3. Create BudgetItem (for the Environment + RuleType logic locus)
    # Default manual_quantity is 1 for UNITs, None for area-based rules
    manual_qtd = 1 if data.rule_type.value == "UNIT" else None
    
    budget_item = BudgetItem(
        budget_id=budget.id,
        environment_id=data.environment_id,
        rule_type=data.rule_type,
        manual_quantity=manual_qtd
    )
    db.add(budget_item)
    db.flush() # get ID

    # 4. Create ItemOption (attaches Product to the context)
    item_option = ItemOption(
        budget_item_id=budget_item.id,
        product_id=data.product_id,
        is_selected=True
    )
    db.add(item_option)
    db.commit()
    db.refresh(budget_item)

    # Attach calculated fields for the response
    calc = calculate_budget_item_quantity(db, budget_item)
    budget_item.calculated_quantity = calc["calculated_quantity"]
    budget_item.base_area = calc["base_area"]
    budget_item.has_yield_alert = calc["has_yield_alert"]

    return budget_item

@router.patch("/budgets/items/{item_id}", response_model=BudgetItemResponse)
def update_budget_item(
    item_id: UUID,
    data: BudgetItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates a budget item. Typically used for overriding manual_quantity or loss_factor.
    """
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Budget item not found")
        
    # TODO: Verify project constraints vs current_user

    if data.manual_quantity is not None:
        item.manual_quantity = data.manual_quantity
    
    # Allows setting manual_quantity to null if user clears it (front-end can map negative or 0 to None if needed later)

    if data.loss_factor is not None:
        item.loss_factor = data.loss_factor

    db.commit()
    db.refresh(item)
    
    # Re-calculate to return the fresh state
    calc = calculate_budget_item_quantity(db, item)
    item.calculated_quantity = calc["calculated_quantity"]
    item.base_area = calc["base_area"]
    item.has_yield_alert = calc["has_yield_alert"]

    return item

@router.delete("/budgets/items/{item_id}")
def delete_budget_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes a budget item permanently (or soft delete based on design rule).
    """
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Budget item not found")

    # Hard-delete cascade will remove ItemOption thanks to SQLAlchemy relationship setup.
    db.delete(item)
    db.commit()
    return {"ok": True}

class OptionCreate(BaseModel):
    product_id: UUID

@router.post("/budgets/items/{item_id}/options")
def create_budget_item_option(
    item_id: UUID,
    data: OptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Adds a new Product Option to a Budget Item (A/B Logic).
    """
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Budget item not found")

    # Add as unselected option by default
    new_option = ItemOption(
        budget_item_id=item_id,
        product_id=data.product_id,
        is_selected=False
    )
    db.add(new_option)
    db.commit()
    db.refresh(new_option)
    
    return {"ok": True, "option_id": new_option.id}


@router.patch("/budgets/options/{option_id}/select")
def select_budget_item_option(
    option_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Selects this option and deselects all other options for the same Budget Item.
    """
    option = db.query(ItemOption).filter(ItemOption.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")

    # Unselect others
    db.query(ItemOption).filter(
        ItemOption.budget_item_id == option.budget_item_id,
        ItemOption.id != option_id
    ).update({"is_selected": False})

    # Select this one
    option.is_selected = True
    db.commit()

    return {"ok": True}

@router.delete("/budgets/options/{option_id}")
def delete_budget_item_option(
    option_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes an ItemOption (Variant A/B). If it's the only one, deletes the parent BudgetItem.
    If the deleted option was the selected one, automatically selects the next available one.
    """
    option = db.query(ItemOption).filter(ItemOption.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")

    budget_item_id = option.budget_item_id
    was_selected = option.is_selected
    
    db.delete(option)
    db.commit()

    # After deletion, check remaining options for the parent item
    remaining_options = db.query(ItemOption).filter(ItemOption.budget_item_id == budget_item_id).all()
    
    if len(remaining_options) == 0:
        # No more variants, item makes no sense. Delete the entire budget item.
        item = db.query(BudgetItem).filter(BudgetItem.id == budget_item_id).first()
        if item:
            db.delete(item)
            db.commit()
    elif was_selected:
        # We deleted the active one, so we must activate another one
        remaining_options[0].is_selected = True
        db.commit()

    return {"ok": True}

@router.get("/budgets/{budget_id}/summary")
def get_budget_summary(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the consolidated financial total for the budget and per-environment totals,
    based strictly on 'is_selected=True' ItemOptions.
    """
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
        
    # TODO: Auth check against budget.project.account_id 

    items = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).all()
    
    total_project = 0.0
    environment_totals = {}

    for item in items:
        # Re-run calc in memory just to ensure accuracy for summary
        calc = calculate_budget_item_quantity(db, item)
        qty = item.manual_quantity if item.rule_type.value == "UNIT" else calc["calculated_quantity"]
        if qty is None:
            qty = 1 # fallback

        # Find selected option cost
        selected_option = next((o for o in item.options if o.is_selected), None)
        if selected_option and selected_option.product:
            cost = (selected_option.product.price or 0.0) * qty
            total_project += cost
            
            env_id_str = str(item.environment_id)
            if env_id_str not in environment_totals:
                environment_totals[env_id_str] = 0.0
            environment_totals[env_id_str] += cost

    return {
        "budget_id": str(budget_id),
        "total_project": total_project,
        "total_by_environment": environment_totals
    }

