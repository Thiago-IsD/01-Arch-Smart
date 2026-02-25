from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.models.all_models import Budget, BudgetItem, ItemOption, Project, User, Environment, Product
from app.schemas.budget_schema import BudgetResponse, BudgetItemCreate, BudgetItemResponse
from app.api.users import get_current_user

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

    return budget_item
