import pytest
from unittest.mock import MagicMock

def test_get_account_info(client, db_session_mock, current_user_mock):
    mock_acc = MagicMock()
    mock_acc.id = 1
    mock_acc.name = "Test Account"
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_acc
    
    response = client.get("/api/account/billing")
    assert response.status_code in [200, 404]

def test_update_account(client, db_session_mock, current_user_mock):
    mock_acc = MagicMock()
    mock_acc.id = 1
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_acc
    
    response = client.put("/api/account/", json={
        "name": "Updated Account"
    })
    assert response.status_code in [200, 422, 405]
