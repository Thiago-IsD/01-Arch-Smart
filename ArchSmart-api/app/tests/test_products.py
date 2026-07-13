import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

def setup_mock_product(mock_prod=None):
    if not mock_prod:
        mock_prod = MagicMock()
    mock_prod.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_prod.name = "Table"
    mock_prod.description = "A table"
    mock_prod.store = "Store"
    mock_prod.category = "Category"
    mock_prod.dimensions = {"w": 1, "h": 2}
    mock_prod.image_url = "http://example.com"
    mock_prod.source_url = "http://example.com"
    mock_prod.price = 120.0
    mock_prod.origin_id = "123e4567-e89b-12d3-a456-426614174002"
    mock_prod.account_id = "123e4567-e89b-12d3-a456-426614174003"
    
    mock_state = MagicMock()
    mock_state.id = "123e4567-e89b-12d3-a456-426614174001"
    mock_state.name = "Normalized"
    mock_state.status = "NORMALIZED"
    mock_prod.state = mock_state
    mock_prod.state_id = mock_state.id
    
    mock_origin = MagicMock()
    mock_origin.id = "123e4567-e89b-12d3-a456-426614174002"
    mock_origin.name = "Web Clipper"
    mock_origin.type = "WEB_CLIPPER"
    mock_prod.origin = mock_origin
    
    return mock_prod

def test_get_products(client, db_session_mock):
    mock_prod = setup_mock_product()
    db_session_mock.query.return_value.join.return_value.filter.return_value.count.return_value = 1
    db_session_mock.query.return_value.join.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [mock_prod]
    
    response = client.get("/api/products/")
    assert response.status_code == 200
    assert response.json()["total"] == 1

def test_get_product(client, db_session_mock):
    mock_prod = setup_mock_product()
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_prod
    
    response = client.get("/api/products/123e4567-e89b-12d3-a456-426614174000")
    assert response.status_code == 200
    assert response.json()["name"] == "Table"

def test_create_product(client, db_session_mock):
    mock_state = MagicMock()
    mock_state.id = "123e4567-e89b-12d3-a456-426614174001"
    
    mock_origin = MagicMock()
    mock_origin.id = "123e4567-e89b-12d3-a456-426614174002"
    
    db_session_mock.query.return_value.filter.return_value.first.side_effect = [mock_state, mock_origin]
    
    def mock_refresh(obj):
        setup_mock_product(obj)
        
    db_session_mock.refresh = mock_refresh
    
    response = client.post("/api/products/", json={
        "name": "Table",
        "price": 120.0
    })
    assert response.status_code == 200
    assert response.json()["name"] == "Table"

def test_update_product(client, db_session_mock):
    mock_prod = setup_mock_product()
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_prod
    
    response = client.put("/api/products/123e4567-e89b-12d3-a456-426614174000", json={
        "name": "Chair"
    })
    assert response.status_code == 200
    assert mock_prod.name == "Chair"

def test_delete_product(client, db_session_mock):
    mock_prod = setup_mock_product()
    mock_state = MagicMock()
    mock_state.id = "123e4567-e89b-12d3-a456-426614174001"
    
    db_session_mock.query.return_value.filter.return_value.first.side_effect = [mock_prod, mock_state]
    
    response = client.delete("/api/products/123e4567-e89b-12d3-a456-426614174000")
    assert response.status_code == 200
    assert mock_prod.state_id == mock_state.id

def test_approve_product(client, db_session_mock):
    mock_prod = setup_mock_product()
    mock_state = MagicMock()
    mock_state.id = "123e4567-e89b-12d3-a456-426614174001"
    
    db_session_mock.query.return_value.filter.return_value.first.side_effect = [mock_prod, mock_state]
    
    response = client.patch("/api/products/123e4567-e89b-12d3-a456-426614174000/approve", json={"name": "Approved"})
    assert response.status_code == 200
    assert mock_prod.state_id == mock_state.id

def test_clipper_capture(client, db_session_mock):
    mock_state = MagicMock()
    mock_state.id = "123e4567-e89b-12d3-a456-426614174001"
    
    mock_origin = MagicMock()
    mock_origin.id = "123e4567-e89b-12d3-a456-426614174002"
    
    db_session_mock.query.return_value.filter.return_value.first.side_effect = [mock_state, mock_origin]
    
    def mock_refresh(obj):
        obj.id = "123e4567-e89b-12d3-a456-426614174000"
    db_session_mock.refresh = mock_refresh
    
    response = client.post("/api/products/clipper/capture", json={"name": "Test"})
    assert response.status_code == 201
