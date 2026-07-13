import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

def test_get_project_budget(client, db_session_mock):
    mock_project = MagicMock()
    mock_project.id = "123e4567-e89b-12d3-a456-426614174000"
    
    mock_budget = MagicMock()
    mock_budget.id = "123e4567-e89b-12d3-a456-426614174001"
    mock_budget.project_id = "123e4567-e89b-12d3-a456-426614174000"
    mock_budget.total_value = 0.0
    mock_budget.items = []
    
    def mock_first(*args, **kwargs):
        if "Project" in str(db_session_mock.query.call_args):
            return mock_project
        return mock_budget
        
    db_session_mock.query.return_value.filter.return_value.first.side_effect = [mock_project, mock_budget]
    
    response = client.get("/api/projects/123e4567-e89b-12d3-a456-426614174000/budget")
    assert response.status_code == 200
    assert response.json()["total_value"] == 0.0

def test_add_item_to_budget(client, db_session_mock):
    mock_project = MagicMock()
    mock_project.id = "123e4567-e89b-12d3-a456-426614174000"
    
    mock_env = MagicMock()
    mock_env.id = "123e4567-e89b-12d3-a456-426614174001"
    
    mock_prod = MagicMock()
    mock_prod.id = "123e4567-e89b-12d3-a456-426614174002"
    
    mock_budget = MagicMock()
    mock_budget.id = "123e4567-e89b-12d3-a456-426614174003"
    
    db_session_mock.query.return_value.filter.return_value.first.side_effect = [
        mock_project, mock_env, mock_prod, mock_budget
    ]
    
    def mock_refresh(obj):
        obj.id = "123e4567-e89b-12d3-a456-426614174004"
        obj.budget_id = "123e4567-e89b-12d3-a456-426614174003"
        obj.environment_id = "123e4567-e89b-12d3-a456-426614174001"
        obj.rule_type = "UNIT"
        obj.manual_quantity = 1
        obj.options = []
    db_session_mock.refresh = mock_refresh
    
    with patch("app.api.routers.budgets_router.calculate_budget_item_quantity") as mock_calc:
        mock_calc.return_value = {"calculated_quantity": 1, "base_area": 0.0, "has_yield_alert": False}
        
        response = client.post(
            "/api/budgets/items",
            json={
                "project_id": "123e4567-e89b-12d3-a456-426614174000",
                "environment_id": "123e4567-e89b-12d3-a456-426614174001",
                "product_id": "123e4567-e89b-12d3-a456-426614174002",
                "rule_type": "UNIT"
            }
        )
        assert response.status_code == 201

def test_delete_budget_item(client, db_session_mock):
    mock_item = MagicMock()
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_item
    
    response = client.delete("/api/budgets/items/123e4567-e89b-12d3-a456-426614174000")
    assert response.status_code == 200
    assert response.json()["ok"] == True

def test_update_budget_item(client, db_session_mock):
    mock_env = MagicMock()
    mock_env.id = "123e4567-e89b-12d3-a456-426614174001"
    mock_env.name = "Kitchen"
    mock_env.type = "KITCHEN"
    
    mock_item = MagicMock()
    mock_item.id = "123e4567-e89b-12d3-a456-426614174004"
    mock_item.budget_id = "123e4567-e89b-12d3-a456-426614174003"
    mock_item.environment_id = "123e4567-e89b-12d3-a456-426614174001"
    mock_item.rule_type = "UNIT"
    mock_item.manual_quantity = 1
    mock_item.options = []
    mock_item.environment = mock_env
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_item
    
    with patch("app.api.routers.budgets_router.calculate_budget_item_quantity") as mock_calc:
        mock_calc.return_value = {"calculated_quantity": 2, "base_area": 0.0, "has_yield_alert": False}
        
        response = client.patch(
            "/api/budgets/items/123e4567-e89b-12d3-a456-426614174004",
            json={"manual_quantity": 2}
        )
        assert response.status_code == 200

def test_create_budget_item_option(client, db_session_mock):
    mock_item = MagicMock()
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_item
    
    def mock_refresh(obj):
        obj.id = "123e4567-e89b-12d3-a456-426614174005"
    db_session_mock.refresh = mock_refresh
    
    response = client.post(
        "/api/budgets/items/123e4567-e89b-12d3-a456-426614174004/options",
        json={"product_id": "123e4567-e89b-12d3-a456-426614174002"}
    )
    assert response.status_code == 200
    assert response.json()["ok"] == True
    assert "option_id" in response.json()

def test_select_budget_item_option(client, db_session_mock):
    mock_option = MagicMock()
    mock_option.budget_item_id = "123e4567-e89b-12d3-a456-426614174004"
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_option
    
    response = client.patch("/api/budgets/options/123e4567-e89b-12d3-a456-426614174005/select")
    assert response.status_code == 200
    assert response.json()["ok"] == True

def test_delete_budget_item_option(client, db_session_mock):
    mock_option = MagicMock()
    mock_option.budget_item_id = "123e4567-e89b-12d3-a456-426614174004"
    mock_option.is_selected = True
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_option
    
    mock_remaining = MagicMock()
    db_session_mock.query.return_value.filter.return_value.all.return_value = [mock_remaining]
    
    response = client.delete("/api/budgets/options/123e4567-e89b-12d3-a456-426614174005")
    assert response.status_code == 200
    assert response.json()["ok"] == True
    assert mock_remaining.is_selected == True

def test_get_budget_summary(client, db_session_mock):
    mock_budget = MagicMock()
    mock_budget.id = "123e4567-e89b-12d3-a456-426614174003"
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_budget
    
    mock_item = MagicMock()
    mock_item.budget_id = "123e4567-e89b-12d3-a456-426614174003"
    mock_item.environment_id = "123e4567-e89b-12d3-a456-426614174001"
    
    rule_type_mock = MagicMock()
    rule_type_mock.value = "UNIT"
    mock_item.rule_type = rule_type_mock
    mock_item.manual_quantity = 2
    
    mock_option = MagicMock()
    mock_option.is_selected = True
    mock_option.product.price = 50.0
    mock_item.options = [mock_option]
    
    db_session_mock.query.return_value.filter.return_value.all.return_value = [mock_item]
    
    with patch("app.api.routers.budgets_router.calculate_budget_item_quantity") as mock_calc:
        mock_calc.return_value = {"calculated_quantity": 2, "base_area": 0.0, "has_yield_alert": False}
        
        response = client.get("/api/budgets/123e4567-e89b-12d3-a456-426614174003/summary")
        assert response.status_code == 200
        assert response.json()["total_project"] == 100.0

