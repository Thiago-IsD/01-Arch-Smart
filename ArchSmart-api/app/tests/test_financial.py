import pytest
from unittest.mock import MagicMock
from uuid import uuid4

def test_get_financial_summary(client, db_session_mock):
    db_session_mock.query.return_value.filter.return_value.group_by.return_value.all.side_effect = [
        [(1000.0, "INCOME"), (500.0, "EXPENSE")], # balance
        [(1000.0, "INCOME"), (500.0, "EXPENSE")]  # monthly
    ]
    response = client.get("/api/financial/summary?month=7&year=2026")
    assert response.status_code == 200
    assert response.json()["balance"] == 500.0
    assert response.json()["total_income"] == 1000.0
    assert response.json()["total_expense"] == 500.0

def test_get_financial_entries(client, db_session_mock):
    mock_entry = MagicMock()
    mock_entry.id = "123e4567-e89b-42d3-a456-426614174000"
    mock_entry.account_id = "123e4567-e89b-42d3-a456-426614174000"
    mock_entry.project_id = "123e4567-e89b-42d3-a456-426614174001"
    mock_entry.type = "INCOME"
    mock_entry.status = "PREDICTED"
    mock_entry.amount = 1500.0
    mock_entry.due_date = "2026-07-04T00:00:00"
    mock_entry.description = "Test"
    mock_entry.category = "Test"
    mock_entry.group_id = None
    mock_entry.installment_number = 1
    mock_entry.created_at = "2026-07-04T00:00:00"
    mock_entry.updated_at = "2026-07-04T00:00:00"
    
    db_session_mock.query.return_value.outerjoin.return_value.filter.return_value.order_by.return_value.all.return_value = [
        (mock_entry, "Project Name")
    ]
    response = client.get("/api/financial?month=7&year=2026")
    assert response.status_code == 200
    assert len(response.json()) == 1

def test_create_financial_entry(client, db_session_mock):
    db_session_mock.add_all = MagicMock()
    db_session_mock.commit = MagicMock()
    
    def mock_refresh(obj):
        obj.id = "123e4567-e89b-42d3-a456-426614174000"
        obj.account_id = "123e4567-e89b-42d3-a456-426614174000"
        obj.created_at = "2026-07-04T09:00:00Z"
        obj.updated_at = "2026-07-04T09:00:00Z"
    
    db_session_mock.refresh = mock_refresh
    
    response = client.post("/api/financial", json={
        "amount": 1500.0,
        "type": "INCOME",
        "status": "PREDICTED",
        "description": "Payment",
        "due_date": "2026-07-04T00:00:00",
        "recurrence": "UNIQUE"
    })
    
    assert response.status_code == 200
    assert response.json()["amount"] == 1500.0

def test_toggle_financial_status(client, db_session_mock):
    mock_entry = MagicMock()
    mock_entry.id = "123e4567-e89b-42d3-a456-426614174000"
    mock_entry.account_id = "123e4567-e89b-42d3-a456-426614174000"
    mock_entry.status = "PREDICTED"
    mock_entry.project_id = None
    mock_entry.description = "Test"
    mock_entry.due_date = "2026-07-04T00:00:00"
    mock_entry.created_at = "2026-07-04T00:00:00"
    mock_entry.updated_at = "2026-07-04T00:00:00"
    mock_entry.category = "Test"
    mock_entry.type = "INCOME"
    mock_entry.amount = 1500.0
    mock_entry.group_id = None
    mock_entry.installment_number = 1
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_entry
    
    response = client.patch("/api/financial/123e4567-e89b-42d3-a456-426614174000/status")
    assert response.status_code == 200
    assert mock_entry.status == "REALIZED"

def test_update_financial_entry(client, db_session_mock):
    mock_entry = MagicMock()
    mock_entry.id = "123e4567-e89b-42d3-a456-426614174000"
    mock_entry.account_id = "123e4567-e89b-42d3-a456-426614174000"
    mock_entry.project_id = None
    mock_entry.amount = 1500.0
    mock_entry.description = "Test"
    mock_entry.due_date = "2026-07-04T00:00:00"
    mock_entry.created_at = "2026-07-04T00:00:00"
    mock_entry.updated_at = "2026-07-04T00:00:00"
    mock_entry.category = "Test"
    mock_entry.type = "INCOME"
    mock_entry.status = "PREDICTED"
    mock_entry.group_id = None
    mock_entry.installment_number = 1
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_entry
    
    response = client.put("/api/financial/123e4567-e89b-42d3-a456-426614174000", json={
        "amount": 2000.0,
        "type": "INCOME",
        "status": "REALIZED",
        "apply_to": "SINGLE"
    })
    
    assert response.status_code == 200
    assert mock_entry.amount == 2000.0

def test_delete_financial_entry(client, db_session_mock):
    mock_entry = MagicMock()
    mock_entry.id = "123e4567-e89b-42d3-a456-426614174000"
    mock_entry.account_id = "123e4567-e89b-42d3-a456-426614174000"
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_entry
    
    response = client.delete("/api/financial/123e4567-e89b-42d3-a456-426614174000")
    assert response.status_code == 204
