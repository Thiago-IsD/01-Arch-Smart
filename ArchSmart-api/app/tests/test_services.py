import pytest
from unittest.mock import MagicMock
from app.services.budget_calculator import calculate_budget_item_quantity
from app.models.all_models import RuleType

def test_calculate_budget_item_unit():
    db_mock = MagicMock()
    
    budget_item = MagicMock()
    budget_item.rule_type = RuleType.UNIT
    budget_item.manual_quantity = 5
    
    result = calculate_budget_item_quantity(db_mock, budget_item)
    
    assert result["base_area"] == 0.0
    assert result["calculated_quantity"] == 5
    assert result["has_yield_alert"] is False

def test_calculate_budget_item_floor_no_yield():
    db_mock = MagicMock()
    
    budget_item = MagicMock()
    budget_item.rule_type = RuleType.FLOOR
    budget_item.manual_quantity = None
    budget_item.loss_factor = 10.0 # 10% loss
    budget_item.options = []
    
    # Mock DNA
    mock_dna = MagicMock()
    mock_dna.floor_area = 100.0 # 100 sqm
    
    # Configure db mock to return dna
    def mock_filter(*args, **kwargs):
        query_mock = MagicMock()
        if "environment_id" in str(args[0]):
            query_mock.first.return_value = mock_dna
        else:
            query_mock.first.return_value = None
        return query_mock
        
    db_mock.query.return_value.filter = mock_filter
    
    result = calculate_budget_item_quantity(db_mock, budget_item)
    
    assert result["base_area"] == 100.0
    # Qtd Base = 100 * 1.1 = 110. Yield factor default is 1.0, so 110/1 = 110.
    assert result["calculated_quantity"] == 110
    assert result["has_yield_alert"] is True

def test_calculate_budget_item_with_yield():
    db_mock = MagicMock()
    
    budget_item = MagicMock()
    budget_item.rule_type = RuleType.WALL
    budget_item.manual_quantity = None
    budget_item.loss_factor = 10.0
    
    mock_product = MagicMock()
    mock_product.yield_factor = 2.5 # 1 unit covers 2.5 sqm
    
    mock_option = MagicMock()
    mock_option.is_selected = True
    mock_option.product = mock_product
    
    budget_item.options = [mock_option]
    
    mock_dna = MagicMock()
    mock_dna.wall_area = 50.0
    
    def mock_filter(*args, **kwargs):
        query_mock = MagicMock()
        if "environment_id" in str(args[0]):
            query_mock.first.return_value = mock_dna
        else:
            query_mock.first.return_value = None
        return query_mock
        
    db_mock.query.return_value.filter = mock_filter
    
    result = calculate_budget_item_quantity(db_mock, budget_item)
    
    assert result["base_area"] == 50.0
    assert result["has_yield_alert"] is False
    
    # Base = 50 * 1.1 = 55
    # Qtd = 55 / 2.5 = 22
    assert result["calculated_quantity"] == 22
