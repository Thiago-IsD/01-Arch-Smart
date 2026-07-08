import pytest
from unittest.mock import MagicMock

def test_create_lead(client, db_session_mock):
    db_session_mock.add = MagicMock()
    db_session_mock.commit = MagicMock()
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = None
    
    def mock_refresh(obj):
        obj.id = "123e4567-e89b-12d3-a456-426614174000"
    
    db_session_mock.refresh = mock_refresh
    
    response = client.post("/api/leads/", json={
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "123456789"
    })
    assert response.status_code == 201
