import pytest
from typing import Generator
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import get_db
from app.api.users import get_current_user

# Mocked database session
@pytest.fixture
def db_session_mock():
    mock = MagicMock()
    # You can add default return values for mock queries here if needed
    return mock

# Mocked current user
@pytest.fixture
def current_user_mock():
    mock_user = MagicMock()
    mock_user.id = "123e4567-e89b-12d3-a456-426614174000"
    mock_user.email = "test@example.com"
    mock_user.supabase_id = "mocked-supabase-id-123"
    mock_user.full_name = "Test User"
    return mock_user

@pytest.fixture
def client(db_session_mock, current_user_mock) -> Generator:
    # Override dependencies
    def override_get_db():
        try:
            yield db_session_mock
        finally:
            pass

    def override_get_current_user():
        return current_user_mock

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app) as c:
        yield c

    # Clear overrides after the test
    app.dependency_overrides.clear()
