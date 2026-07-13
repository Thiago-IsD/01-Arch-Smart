import pytest
from unittest.mock import MagicMock, patch

def test_get_projects_list(client, db_session_mock, current_user_mock):
    mock_project1 = MagicMock()
    mock_project1.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_project1.name = "Project Alpha"
    mock_project1.status = "DRAFT"
    mock_project1.service_type = "CONSULTING"
    mock_project1.payment_method = "CASH"
    mock_project1.client_id = "123e4567-e89b-12d3-a456-426614174000"
    mock_project1.account_id = "123e4567-e89b-12d3-a456-426614174000"
    
    mock_client = MagicMock()
    mock_client.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_client.name = "Test Client"
    mock_client.email = "test@example.com"
    mock_client.phone = "123"
    mock_client.account_id = "123e4567-e89b-12d3-a456-426614174000"
    
    mock_project1.client = mock_client
    
    mock_project2 = MagicMock()
    mock_project2.id = "123e4567-e89b-12d3-a456-426614174001"
    mock_project2.name = "Project Beta"
    mock_project2.status = "DRAFT"
    mock_project2.service_type = "CONSULTING"
    mock_project2.payment_method = "CASH"
    mock_project2.client_id = "123e4567-e89b-12d3-a456-426614174000"
    mock_project2.account_id = "123e4567-e89b-12d3-a456-426614174000"
    mock_project2.client = mock_client
    
    db_session_mock.query.return_value.filter.return_value.options.return_value.offset.return_value.limit.return_value.all.return_value = [mock_project1, mock_project2]
    db_session_mock.query.return_value.filter.return_value.count.return_value = 2
    
    response = client.get("/api/projects/")
    if response.status_code != 200:
        print("GET", response.json())
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list) or "items" in data

def test_create_project(client, db_session_mock, current_user_mock):
    db_session_mock.add = MagicMock()
    db_session_mock.commit = MagicMock()
    
    mock_client = MagicMock()
    mock_client.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_client.name = "Test Client"
    mock_client.email = "test@example.com"
    mock_client.phone = "123"
    mock_client.account_id = "123e4567-e89b-12d3-a456-426614174000"
    
    def mock_refresh(obj):
        obj.id = "123e4567-e89b-12d3-a456-426614174002"
        obj.status = "DRAFT"
        obj.client = mock_client
        obj.account_id = "123e4567-e89b-12d3-a456-426614174000"
        obj.client_id = "123e4567-e89b-12d3-a456-426614174000"
        obj.created_at = "2026-07-04T09:00:00Z"
    db_session_mock.refresh = mock_refresh
    
    db_session_mock.query.return_value.filter.return_value.count.return_value = 0
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_client
    
    response = client.post(
        "/api/projects/",
        json={
            "name": "New Test Project",
            "status": "DRAFT",
            "service_type": "CONSULTING",
            "payment_method": "CASH",
            "client_name": "Test Client"
        }
    )
    if response.status_code not in [200, 201]:
        print("POST", response.json())
    assert response.status_code in [200, 201]

def test_get_project_by_id(client, db_session_mock):
    mock_client = MagicMock()
    mock_client.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_client.name = "Test Client"
    mock_client.email = "test@example.com"
    mock_client.phone = "123"
    mock_client.account_id = "123e4567-e89b-12d3-a456-426614174000"

    mock_project = MagicMock()
    mock_project.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_project.name = "Project Alpha"
    mock_project.status = "DRAFT"
    mock_project.service_type = "CONSULTING"
    mock_project.payment_method = "CUSTOM"
    mock_project.client_id = "123e4567-e89b-12d3-a456-426614174000"
    mock_project.account_id = "123e4567-e89b-12d3-a456-426614174000"
    mock_project.client = mock_client
    
    db_session_mock.query.return_value.filter.return_value.first.side_effect = [mock_project, mock_project]
    
    mock_entry = MagicMock()
    mock_entry.amount = 100.0
    mock_entry.due_date = "2026-07-04"
    mock_entry.description = "Entry"
    db_session_mock.query.return_value.filter.return_value.order_by.return_value.all.return_value = [mock_entry]

    response = client.get("/api/projects/123e4567-e89b-12d3-a456-426614174000")
    assert response.status_code == 200
    assert response.json()["name"] == "Project Alpha"

def test_get_project_by_id_not_found(client, db_session_mock):
    db_session_mock.query.return_value.filter.return_value.first.return_value = None
    response = client.get("/api/projects/123e4567-e89b-12d3-a456-426614174000")
    assert response.status_code == 404

def test_create_project_limit_reached(client, db_session_mock):
    db_session_mock.query.return_value.filter.return_value.count.return_value = 2
    response = client.post(
        "/api/projects/",
        json={"name": "P", "status": "DRAFT", "service_type": "CONSULTING", "payment_method": "CASH", "client_name": "C"}
    )
    assert response.status_code == 403

def test_update_project(client, db_session_mock):
    mock_project = MagicMock()
    mock_project.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_project.name = "Old"
    mock_project.status = "DRAFT"
    mock_project.service_type = "CONSULTING"
    mock_project.payment_method = "CASH"
    mock_project.client_id = "123e4567-e89b-12d3-a456-426614174000"
    mock_project.account_id = "123e4567-e89b-12d3-a456-426614174000"
    
    mock_client = MagicMock()
    mock_client.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_client.name = "Old Client Name"
    mock_client.email = "test@example.com"
    mock_client.phone = "123"
    mock_client.account_id = "123e4567-e89b-12d3-a456-426614174000"
    
    mock_project.client = mock_client
    
    def mock_first(*args, **kwargs):
        if "Project" in str(db_session_mock.query.call_args):
            return mock_project
        return mock_client
        
    db_session_mock.query.return_value.filter.return_value.first.side_effect = [mock_project, mock_client]
    
    with patch("app.api.endpoints.projects.sync_project_financials"):
        response = client.put(
            "/api/projects/123e4567-e89b-12d3-a456-426614174000",
            json={"name": "New Name", "client_name": "New Client Name"}
        )
        assert response.status_code == 200
        assert mock_project.name == "New Name"
        assert mock_client.name == "New Client Name"

def test_update_project_not_found(client, db_session_mock):
    db_session_mock.query.return_value.filter.return_value.first.return_value = None
    response = client.put("/api/projects/123e4567-e89b-12d3-a456-426614174000", json={"name": "A"})
    assert response.status_code == 404

def test_delete_project(client, db_session_mock):
    mock_project = MagicMock()
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_project
    
    response = client.delete("/api/projects/123e4567-e89b-12d3-a456-426614174000")
    assert response.status_code == 204
    db_session_mock.delete.assert_called_once_with(mock_project)

def test_delete_project_not_found(client, db_session_mock):
    db_session_mock.query.return_value.filter.return_value.first.return_value = None
    response = client.delete("/api/projects/123e4567-e89b-12d3-a456-426614174000")
    assert response.status_code == 404
