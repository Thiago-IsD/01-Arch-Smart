from typing import Tuple, Dict, Any, Optional
import math
from sqlalchemy.orm import Session
from app.models.all_models import BudgetItem, EnvironmentDNA, Product, RuleType, ItemOption

def calculate_budget_item_quantity(db: Session, budget_item: BudgetItem) -> Dict[str, Any]:
    """
    Calculates the required quantity for a budget item based on its rule type,
    the environment's DNA matrix, the item's loss factor, and the selected product's yield.
    
    Returns a dictionary with:
    - base_area (float): The base area used for calculation (0 for UNIT)
    - calculated_quantity (int): The final computed quantity (rounded up)
    - has_yield_alert (bool): True if the product is area-based but lacks a valid yield_factor
    """
    
    # Defaults
    base_area = 0.0
    calculated_quantity = 0
    has_yield_alert = False
    
    # 1. Handle UNIT type (direct mapping)
    if budget_item.rule_type == RuleType.UNIT:
        return {
            "base_area": 0.0,
            "calculated_quantity": budget_item.manual_quantity if budget_item.manual_quantity else 1,
            "has_yield_alert": False
        }
        
    # 2. Extract Active Product (To get yield_factor)
    # Get the selected option
    active_product = None
    if budget_item.options:
        for option in budget_item.options:
            if option.is_selected:
                active_product = option.product
                break
                
    # If no product is selected or loaded, fallback to basic calculation
    if not active_product and budget_item.id:
        active_option = db.query(ItemOption).filter(
            ItemOption.budget_item_id == budget_item.id,
            ItemOption.is_selected == True
        ).first()
        if active_option and active_option.product_id:
            active_product = db.query(Product).filter(Product.id == active_option.product_id).first()
            
    yield_factor = active_product.yield_factor if active_product and active_product.yield_factor else None
    
    # Validate Yield
    if yield_factor is None or yield_factor <= 0:
        yield_factor = 1.0
        has_yield_alert = True
        
    # 3. Extract Environment DNA
    dna = db.query(EnvironmentDNA).filter(EnvironmentDNA.environment_id == budget_item.environment_id).first()
    if not dna:
        # If no DNA exists yet, assume area is 0
        return {
            "base_area": 0.0,
            "calculated_quantity": 0,
            "has_yield_alert": has_yield_alert
        }
        
    # 4. Routing the Formula by RuleType
    if budget_item.rule_type == RuleType.FLOOR:
        base_area = dna.floor_area
    elif budget_item.rule_type == RuleType.WALL:
        base_area = dna.wall_area
    elif budget_item.rule_type == RuleType.CEILING:
        base_area = dna.ceiling_area
        
    base_area = base_area or 0.0
    loss_factor = budget_item.loss_factor if budget_item.loss_factor is not None else 10.0
    
    # Formula: Qtd Base = (Area * (1 + (loss_factor / 100)))
    qtd_base = base_area * (1 + (loss_factor / 100.0))
    
    # Qtd Final = Qtd Base / Product.rendimento
    qtd_final_float = qtd_base / yield_factor
    
    # Rounding up for physical packaging
    calculated_quantity = math.ceil(qtd_final_float)
    
    # If there's a manual quantity explicitly set that overrides area rules, you could decide to use it here.
    # Currently, assuming area-based rules prioritize the dynamic calculation unless the user flips it to UNIT,
    # or manual_quantity applies. The prompt says "PATCH /budget-items/{id}: Permite atualizar manual_quantity (sobrescrevendo o cálculo)"
    # Thus, if manual is set, it overrides the engine
    if budget_item.manual_quantity is not None:
        calculated_quantity = budget_item.manual_quantity
        has_yield_alert = False # Overridden
        
    return {
        "base_area": base_area,
        "calculated_quantity": calculated_quantity,
        "has_yield_alert": has_yield_alert
    }
