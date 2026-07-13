import pytest
from unittest.mock import MagicMock

def test_get_dashboard_lean(client, db_session_mock):
    mock_proj = MagicMock()
    mock_proj.id = "123e4567-e89b-42d3-a456-426614174000"
    mock_proj.name = "Project A"
    mock_client = MagicMock()
    mock_client.name = "Client A"
    
    mock_prod = MagicMock()
    mock_prod.id = "123e4567-e89b-42d3-a456-426614174001"
    mock_prod.name = "Prod A"
    mock_prod.image_url = "http"
    mock_prod.price = 10.0
    mock_prod.store = "Store"
    
    mock_event = MagicMock()
    mock_event.id = "123e4567-e89b-42d3-a456-426614174002"
    mock_event.title = "Event A"
    mock_event.start_time = "2026-07-04T10:00:00Z"
    mock_event.end_time = "2026-07-04T11:00:00Z"
    mock_event.meet_link = "http"
    
    db_session_mock.query.return_value.join.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [(mock_proj, mock_client)]
    db_session_mock.query.return_value.filter.return_value.count.return_value = 1
    db_session_mock.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [mock_prod]
    
    def side_effect_query(*args, **kwargs):
        mock_q = MagicMock()
        if "Project" in str(args) and "Client" in str(args):
            mock_q.join.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [(mock_proj, mock_client)]
            return mock_q
        if "Project" in str(args) and "Client" not in str(args) and "Event" not in str(args):
             mock_q.filter.return_value.count.return_value = 1
             return mock_q
        if "Product" in str(args):
            mock_q.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [mock_prod]
            return mock_q
        if "Event" in str(args) and "Project" in str(args):
            mock_q.outerjoin.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [(mock_event, "Project A")]
            return mock_q
        if "FinancialEntry" in str(args):
            mock_q.filter.return_value.group_by.return_value.all.return_value = [(1000.0, "INCOME"), (500.0, "EXPENSE")]
            return mock_q
        return mock_q

    db_session_mock.query.side_effect = side_effect_query
    
    response = client.get("/api/dashboard/lean")
    assert response.status_code == 200
    assert response.json()["active_projects_count"] == 1

def test_get_events(client, db_session_mock):
    mock_event = MagicMock()
    mock_event.id = "123e4567-e89b-42d3-a456-426614174000"
    mock_event.account_id = "123e4567-e89b-42d3-a456-426614174000"
    mock_event.title = "Test Event"
    mock_event.start_time = "2026-07-04T10:00:00Z"
    mock_event.end_time = "2026-07-04T11:00:00Z"
    mock_event.created_at = "2026-07-04T09:00:00Z"
    mock_event.updated_at = "2026-07-04T09:00:00Z"
    mock_event.project_id = None
    mock_event.meet_link = None
    mock_event.description = None
    mock_event.google_event_id = None
    
    db_session_mock.query.return_value.filter.return_value.all.return_value = [mock_event]
    
    response = client.get("/api/events/?start_date=2026-07-01&end_date=2026-07-31")
    assert response.status_code == 200
    
def test_create_event(client, db_session_mock):
    db_session_mock.add = MagicMock()
    db_session_mock.commit = MagicMock()
    
    def mock_refresh(obj):
        obj.id = "123e4567-e89b-42d3-a456-426614174000"
        obj.account_id = "123e4567-e89b-42d3-a456-426614174000"
        obj.created_at = "2026-07-04T09:00:00Z"
        obj.updated_at = "2026-07-04T09:00:00Z"
        obj.google_event_id = None
    
    db_session_mock.refresh = mock_refresh
    
    response = client.post("/api/events/", json={
        "title": "Meeting",
        "start_time": "2026-07-04T10:00:00",
        "end_time": "2026-07-04T11:00:00"
    })
    assert response.status_code == 201

def test_update_event(client, db_session_mock):
    mock_event = MagicMock()
    mock_event.id = "123e4567-e89b-42d3-a456-426614174000"
    mock_event.account_id = "123e4567-e89b-42d3-a456-426614174000"
    mock_event.title = "Test Event"
    mock_event.start_time = "2026-07-04T10:00:00"
    mock_event.end_time = "2026-07-04T11:00:00"
    mock_event.created_at = "2026-07-04T09:00:00"
    mock_event.updated_at = "2026-07-04T09:00:00"
    mock_event.project_id = None
    mock_event.meet_link = None
    mock_event.description = None
    mock_event.google_event_id = None
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_event
    
    response = client.put("/api/events/123e4567-e89b-42d3-a456-426614174000", json={
        "title": "Updated Meeting"
    })
    assert response.status_code == 200
    
def test_delete_event(client, db_session_mock):
    mock_event = MagicMock()
    mock_event.id = "123e4567-e89b-42d3-a456-426614174000"
    mock_event.account_id = "123e4567-e89b-42d3-a456-426614174000"
    
    db_session_mock.query.return_value.filter.return_value.first.return_value = mock_event
    
    response = client.delete("/api/events/123e4567-e89b-42d3-a456-426614174000")
    assert response.status_code == 204
