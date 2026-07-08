import pytest
from unittest.mock import MagicMock

def test_create_environment(client, db_session_mock):
    mock_project = MagicMock()
    mock_project.id = "123e4567-e89b-12d3-a456-426614174000"
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_project
    
    mock_dna = MagicMock()
    mock_dna.id = "123e4567-e89b-12d3-a456-426614174002"
    mock_dna.environment_id = "123e4567-e89b-12d3-a456-426614174001"
    mock_dna.floor_area = 0.0
    mock_dna.wall_area = 0.0
    mock_dna.ceiling_area = 0.0
    mock_dna.is_complete = False

    def mock_refresh(obj):
        obj.id = "123e4567-e89b-12d3-a456-426614174001"
        obj.project_id = "123e4567-e89b-12d3-a456-426614174000"
        obj.name = "Living Room"
        obj.type = "LIVING"
        obj.dna = mock_dna
        obj.created_at = "2026-07-04T09:00:00Z"
    db_session_mock.refresh = mock_refresh
    
    response = client.post(
        "/api/projects/123e4567-e89b-12d3-a456-426614174000/environments",
        json={"name": "Living Room", "type": "LIVING"}
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Living Room"

def test_create_environment_project_not_found(client, db_session_mock):
    db_session_mock.query.return_value.filter.return_value.first.return_value = None
    response = client.post(
        "/api/projects/123e4567-e89b-12d3-a456-426614174000/environments",
        json={"name": "Living Room", "type": "LIVING"}
    )
    assert response.status_code == 404

def test_get_environments(client, db_session_mock):
    mock_project = MagicMock()
    
    mock_dna = MagicMock()
    mock_dna.id = "123e4567-e89b-12d3-a456-426614174002"
    mock_dna.environment_id = "123e4567-e89b-12d3-a456-426614174001"
    mock_dna.floor_area = 0.0
    mock_dna.wall_area = 0.0
    mock_dna.ceiling_area = 0.0
    mock_dna.is_complete = False

    mock_env = MagicMock()
    mock_env.id = "123e4567-e89b-12d3-a456-426614174001"
    mock_env.name = "Kitchen"
    mock_env.type = "KITCHEN"
    mock_env.project_id = "123e4567-e89b-12d3-a456-426614174000"
    mock_env.dna = mock_dna
    mock_env.created_at = "2026-07-04T09:00:00Z"
    
    def mock_first_or_all():
        class MockQuery:
            def filter(self, *args, **kwargs):
                return self
            def first(self):
                return mock_project
            def all(self):
                return [mock_env]
        return MockQuery()
        
    db_session_mock.query.return_value = mock_first_or_all()
    
    response = client.get("/api/projects/123e4567-e89b-12d3-a456-426614174000/environments")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Kitchen"

def test_get_environments_project_not_found(client, db_session_mock):
    def mock_first_or_all():
        class MockQuery:
            def filter(self, *args, **kwargs):
                return self
            def first(self):
                return None
            def all(self):
                return []
        return MockQuery()
    db_session_mock.query.return_value = mock_first_or_all()
    response = client.get("/api/projects/123e4567-e89b-12d3-a456-426614174000/environments")
    assert response.status_code == 404

def test_update_environment_dna(client, db_session_mock):
    mock_env = MagicMock()
    
    mock_dna = MagicMock()
    mock_dna.id = "123e4567-e89b-12d3-a456-426614174002"
    mock_dna.environment_id = "123e4567-e89b-12d3-a456-426614174001"
    mock_dna.floor_area = 10.0
    mock_dna.wall_area = 20.0
    mock_dna.ceiling_area = 10.0
    mock_dna.is_complete = True
    
    def mock_first_or_all(*args):
        class MockQuery:
            def join(self, *args):
                return self
            def filter(self, *args, **kwargs):
                return self
            def first(self):
                if "EnvironmentDNA" in str(args[0]):
                    return mock_dna
                return mock_env
        return MockQuery()
        
    db_session_mock.query.side_effect = mock_first_or_all
    
    def mock_refresh(obj):
        obj.floor_area = 10.0
        obj.wall_area = 20.0
        obj.ceiling_area = 10.0
        obj.is_complete = True
    db_session_mock.refresh = mock_refresh
    
    response = client.put(
        "/api/environments/123e4567-e89b-12d3-a456-426614174001/dna",
        json={"floor_area": 10.0, "wall_area": 20.0, "ceiling_area": 10.0}
    )
    assert response.status_code == 200
    assert response.json()["floor_area"] == 10.0
    assert response.json()["is_complete"] == True

def test_update_environment_dna_not_found(client, db_session_mock):
    def mock_first_or_all(*args):
        class MockQuery:
            def join(self, *args):
                return self
            def filter(self, *args, **kwargs):
                return self
            def first(self):
                return None
        return MockQuery()
    db_session_mock.query.side_effect = mock_first_or_all
    response = client.put(
        "/api/environments/123e4567-e89b-12d3-a456-426614174001/dna",
        json={"floor_area": 10.0, "wall_area": 20.0, "ceiling_area": 10.0}
    )
    assert response.status_code == 404

def test_delete_environment(client, db_session_mock):
    mock_env = MagicMock()
    
    def mock_first_or_all(*args):
        class MockQuery:
            def join(self, *args):
                return self
            def filter(self, *args, **kwargs):
                return self
            def first(self):
                return mock_env
        return MockQuery()
    db_session_mock.query.side_effect = mock_first_or_all
    
    response = client.delete("/api/environments/123e4567-e89b-12d3-a456-426614174001")
    assert response.status_code == 204
    db_session_mock.delete.assert_called_once_with(mock_env)

def test_delete_environment_not_found(client, db_session_mock):
    def mock_first_or_all(*args):
        class MockQuery:
            def join(self, *args):
                return self
            def filter(self, *args, **kwargs):
                return self
            def first(self):
                return None
        return MockQuery()
    db_session_mock.query.side_effect = mock_first_or_all
    
    response = client.delete("/api/environments/123e4567-e89b-12d3-a456-426614174001")
    assert response.status_code == 404
