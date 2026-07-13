import pytest
from unittest.mock import patch, MagicMock

def test_login_success(client):
    # Mock the auth_service response
    with patch("app.api.auth.auth_service.sign_in_with_password") as mock_signin:
        mock_signin.return_value = {"access_token": "mocked_token", "user": {"id": "123"}}
        
        response = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "securepassword"}
        )
        
        assert response.status_code == 200
        assert response.json() == {"access_token": "mocked_token", "user": {"id": "123"}}
        mock_signin.assert_called_once_with(email="test@example.com", password="securepassword")

def test_login_failure(client):
    with patch("app.api.auth.auth_service.sign_in_with_password") as mock_signin:
        mock_signin.side_effect = Exception("Invalid credentials")
        
        response = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "wrongpassword"}
        )
        
        assert response.status_code == 400
        assert "Invalid credentials" in response.json()["detail"]

def test_recover_request(client):
    with patch("app.api.auth.auth_service.reset_password_email") as mock_reset:
        mock_reset.return_value = {"message": "Email sent"}
        
        response = client.post(
            "/api/auth/recover-request",
            json={"email": "test@example.com"}
        )
        
        assert response.status_code == 200
        assert response.json() == {"message": "Email sent"}
        mock_reset.assert_called_once_with(email="test@example.com")

def test_change_password_success(client):
    # current_user is mocked in conftest.py
    with patch("app.api.auth.auth_service.sign_in_with_password") as mock_signin, \
         patch("app.api.auth.auth_service.admin_update_user") as mock_update:
        
        mock_signin.return_value = True
        mock_update.return_value = True
        
        response = client.post(
            "/api/auth/change-password",
            json={"current_password": "oldpassword", "new_password": "newpassword"}
        )
        
        assert response.status_code == 200
        assert response.json() == {"message": "Senha alterada com sucesso."}

def test_register_request(client):
    with patch("app.api.auth.auth_service.sign_in_with_otp") as mock_otp:
        mock_otp.return_value = {"message": "Magic link sent"}
        
        response = client.post(
            "/api/auth/register-request",
            json={"email": "new@example.com", "redirect_to": "http://localhost:3000"}
        )
        assert response.status_code == 200
        assert response.json() == {"message": "Magic link sent"}
        mock_otp.assert_called_once_with(email="new@example.com", redirect_to="http://localhost:3000")

def test_complete_register(client, db_session_mock):
    with patch("app.api.auth.auth_service.update_user") as mock_update, \
         patch("app.api.auth.auth_service.get_user") as mock_get_user:
        
        mock_update.return_value = {"user": {"id": "supa123"}}
        mock_get_user.return_value = {"id": "supa123", "email": "new@example.com"}
        
        db_session_mock.query.return_value.filter.return_value.first.return_value = None
        db_session_mock.add = MagicMock()
        db_session_mock.flush = MagicMock()
        db_session_mock.commit = MagicMock()
        db_session_mock.refresh = MagicMock()
        
        response = client.post(
            "/api/auth/complete-register",
            json={
                "access_token": "token123",
                "password": "secure123",
                "full_name": "New User",
                "cpf": "12345678900"
            }
        )
        assert response.status_code == 200
        assert "email" in response.json()
        assert response.json()["email"] == "new@example.com"

def test_signup(client, db_session_mock):
    with patch("app.api.auth.auth_service.sign_up") as mock_signup:
        mock_signup.return_value = {
            "user": {
                "id": "supa123",
                "email": "new2@example.com"
            }
        }
        
        db_session_mock.add = MagicMock()
        db_session_mock.flush = MagicMock()
        db_session_mock.commit = MagicMock()
        db_session_mock.refresh = MagicMock()
        
        response = client.post(
            "/api/auth/signup",
            json={
                "email": "new2@example.com",
                "password": "secure123",
                "full_name": "New User 2",
                "cpf": "12345678900"
            }
        )
        
        assert response.status_code == 200
        assert response.json()["user"]["email"] == "new2@example.com"
