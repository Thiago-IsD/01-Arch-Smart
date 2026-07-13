import pytest
from unittest.mock import MagicMock, patch

def test_get_current_user_profile(client, db_session_mock):
    # Mock Account return
    mock_account = MagicMock()
    mock_account.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_account.name = "Test Account"
    mock_account.company_name = "Test Company"
    mock_account.is_active = True
    mock_account.logo_url = None
    
    # Mock Subscription return
    mock_subscription = None
    
    # Configure DB mock to return account then subscription
    def mock_filter(*args, **kwargs):
        mock_query = MagicMock()
        query_str = str(args[0]).lower()
        if "subscription" in query_str:
            mock_query.first.return_value = mock_subscription
        elif "account" in query_str:
            mock_query.first.return_value = mock_account
        else:
            mock_query.first.return_value = None
        return mock_query
        
    db_session_mock.query.return_value.filter = mock_filter
    
    # Current user is injected via conftest override
    response = client.get("/api/users/me")
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["account"]["name"] == "Test Account"
    assert data["account"]["subscription_status"] == "BETA"

def test_update_user_profile(client, db_session_mock, current_user_mock):
    mock_account = MagicMock()
    mock_account.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_account.name = "Test Account"
    mock_account.company_name = "Test Company"
    mock_account.is_active = True
    mock_account.logo_url = None
    
    def mock_filter(*args, **kwargs):
        mock_query = MagicMock()
        query_str = str(args[0]).lower()
        if "subscription" in query_str:
            mock_query.first.return_value = None
        elif "account" in query_str:
            mock_query.first.return_value = mock_account
        else:
            mock_query.first.return_value = None
        return mock_query
        
    db_session_mock.query.return_value.filter = mock_filter

    response = client.put(
        "/api/users/profile",
        json={"full_name": "New Name Updated"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "New Name Updated"
    assert current_user_mock.full_name == "New Name Updated"

@pytest.mark.asyncio
async def test_get_current_user_success():
    from app.api.users import get_current_user
    from fastapi import HTTPException
    
    mock_db = MagicMock()
    
    with patch("os.getenv") as mock_env, patch("jose.jwt.decode") as mock_decode, patch("app.api.users.run_in_threadpool") as mock_run:
        mock_env.return_value = "dummysecret"
        mock_decode.return_value = {"sub": "supa123", "email": "test@example.com"}
        
        mock_user = MagicMock()
        mock_user.id = "user123"
        mock_run.return_value = mock_user
        
        user = await get_current_user(authorization="Bearer validtoken", db=mock_db)
        assert user.id == "user123"

@pytest.mark.asyncio
async def test_get_current_user_invalid_header():
    from app.api.users import get_current_user
    from fastapi import HTTPException
    
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Invalid", db=MagicMock())
    assert exc.value.status_code == 401

@pytest.mark.asyncio
async def test_get_current_user_not_found():
    from app.api.users import get_current_user
    from fastapi import HTTPException
    
    with patch("os.getenv") as mock_env, patch("jose.jwt.decode") as mock_decode, patch("app.api.users.run_in_threadpool") as mock_run:
        mock_env.return_value = "dummysecret"
        mock_decode.return_value = {"sub": "supa123", "email": "test@example.com"}
        mock_run.return_value = None
        
        with pytest.raises(HTTPException) as exc:
            await get_current_user(authorization="Bearer validtoken", db=MagicMock())
        assert exc.value.status_code == 401

def test_get_current_user_profile_account_not_found(client, db_session_mock):
    db_session_mock.query.return_value.filter.return_value.first.return_value = None
    
    response = client.get("/api/users/me")
    assert response.status_code == 404
