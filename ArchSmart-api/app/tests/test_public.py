import pytest

def test_public_presentation(client, db_session_mock):
    # Public route, no current_user needed
    response = client.get("/public/presentations/1234")
    assert response.status_code in [200, 404]

def test_public_catalog(client, db_session_mock):
    response = client.get("/public/catalogs/1234")
    assert response.status_code in [200, 404]
