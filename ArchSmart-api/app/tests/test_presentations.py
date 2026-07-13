import pytest
from unittest.mock import MagicMock

def test_get_presentations(client, db_session_mock, current_user_mock):
    mock_pres = MagicMock()
    mock_pres.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_pres.name = "Concept A"
    mock_pres.project_id = "123e4567-e89b-12d3-a456-426614174000"
    mock_pres.created_at = "2026-07-04T09:00:00Z"
    mock_pres.status = "DRAFT"
    mock_pres.environments = []
    mock_pres.description = None
    mock_pres.project = None
    
    db_session_mock.query.return_value.join.return_value.filter.return_value.options.return_value.all.return_value = [mock_pres]
    
    response = client.get("/api/presentations")
    if response.status_code != 200:
        print("GET", response.json())
    assert response.status_code == 200

def test_create_presentation(client, db_session_mock, current_user_mock):
    db_session_mock.add = MagicMock()
    db_session_mock.flush = MagicMock()
    db_session_mock.commit = MagicMock()
    
    mock_project = MagicMock()
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_project
    db_session_mock.query.return_value.filter.return_value.all.return_value = []
    
    def mock_refresh(obj):
        obj.id = "123e4567-e89b-12d3-a456-426614174000"
        obj.created_at = "2026-07-04T09:00:00Z"
        obj.status = "DRAFT"
        obj.environments = []
    db_session_mock.refresh = mock_refresh
    
    response = client.post(
        "/api/projects/123e4567-e89b-12d3-a456-426614174000/presentations",
        json={
            "project_id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "Concept B",
            "description": "A test concept"
        }
    )
    if response.status_code not in [200, 201]:
        print("POST", response.json())
    assert response.status_code in [200, 201]
