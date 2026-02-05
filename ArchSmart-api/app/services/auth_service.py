import os
import httpx
from fastapi import HTTPException
from dotenv import load_dotenv
from app.core.config import settings

# Force load .env
load_dotenv()

class SupabaseAuthService:
    def __init__(self):
        self.base_url = os.getenv("SUPABASE_URL")
        self.api_key = os.getenv("SUPABASE_KEY")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        # Guard Clause
        if not self.base_url or not self.api_key:
             raise ValueError("CRÍTICO: SUPABASE_URL ou SUPABASE_KEY não encontrados no .env")

        # Ensure base URL points to auth/v1
        if self.base_url and not self.base_url.endswith("/auth/v1"):
            self.auth_url = f"{self.base_url.rstrip('/')}/auth/v1"
        else:
            self.auth_url = self.base_url
            
        # Standard Headers (Anon)
        self.headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    # --- Admin Methods ---
    async def admin_update_user(self, user_id: str, attributes: dict):
        """
        Update User as Admin (Bypasses RLS/Scopes).
        Endpoint: PUT /admin/users/{id}
        """
        if not self.service_role_key:
            raise Exception("Service Role Key not configured")
            
        url = f"{self.auth_url}/admin/users/{user_id}"
        
        headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json"
        }
        
        # DEBUG PRINTS
        print(f"\n🚀 DEBUG ADMIN UPDATE:")
        print(f"URL: {url}")
        
        async with httpx.AsyncClient() as client:
            response = await client.put(url, json=attributes, headers=headers)
            
            print(f"⬅️ ADMIN RESPONSE: {response.status_code}")
            if response.status_code not in [200, 201]:
                 raise Exception(f"Admin Update Error: {response.text}")
            return response.json()

    async def _post(self, endpoint: str, json_data: dict, headers: dict = None):
        """Helper for POST requests"""
        url = f"{self.auth_url}{endpoint}"
        merged_headers = self.headers.copy()
        if headers:
            merged_headers.update(headers)
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=json_data, headers=merged_headers)
                if response.status_code not in [200, 201]:
                    # Try to parse error
                    try:
                        error_data = response.json()
                        detail = error_data.get("msg") or error_data.get("error_description") or response.text
                    except:
                        detail = response.text
                    raise Exception(f"Supabase Error ({response.status_code}): {detail}")
                return response.json()
            except httpx.RequestError as e:
                raise Exception(f"Connection Error: {str(e)}")

    async def _put(self, endpoint: str, json_data: dict, headers: dict = None):
        """Helper for PUT requests"""
        url = f"{self.auth_url}{endpoint}"
        
        # Start with default headers
        merged_headers = self.headers.copy()
        
        # If custom headers have Authorization, it should overwrite the default one (Service Key/Anon Key)
        # Because we need the USER Token to update the user.
        if headers:
            merged_headers.update(headers)
            
        # DEBUG PRINTS
        print(f"\n🚀 DEBUG PUT REQUEST:")
        print(f"URL: {url}")
        print(f"Headers: {merged_headers}")
        print(f"Payload: {json_data}")

        async with httpx.AsyncClient() as client:
            try:
                response = await client.put(url, json=json_data, headers=merged_headers)
                
                print(f"⬅️ DEBUG RESPONSE: {response.status_code}")
                try:
                    print(f"Body: {response.json()}")
                except:
                    print(f"Text: {response.text}")
                    
                if response.status_code not in [200, 201]:
                    try:
                        error_data = response.json()
                        detail = error_data.get("msg") or error_data.get("error_description") or response.text
                    except:
                        detail = response.text
                    raise Exception(f"Supabase Error ({response.status_code}): {detail}")
                return response.json()
            except httpx.RequestError as e:
                raise Exception(f"Connection Error: {str(e)}")

    async def _get(self, endpoint: str, headers: dict = None):
        """Helper for GET requests"""
        url = f"{self.auth_url}{endpoint}"
        merged_headers = self.headers.copy()
        if headers:
            merged_headers.update(headers)
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=merged_headers)
                if response.status_code != 200:
                   try:
                        error_data = response.json()
                        detail = error_data.get("msg") or error_data.get("error_description") or response.text
                   except:
                        detail = response.text
                   raise Exception(f"Supabase GET Error ({response.status_code}): {detail}")
                return response.json()
            except httpx.RequestError as e:
                 raise Exception(f"Connection Error: {str(e)}")

    # --- Public Methods ---

    async def sign_up_with_email_confirmation(self, email: str, redirect_to: str = None):
        """
        Creates a new user with email confirmation.
        Endpoint: POST /signup
        The user will receive a confirmation email based on Supabase dashboard settings.
        """
        # Generate a temporary password (will be changed after email confirmation)
        import secrets
        temp_password = secrets.token_urlsafe(32)
        
        payload = {
            "email": email,
            "password": temp_password,
            "data": {
                "temp_signup": True  # Mark as temporary signup
            },
            "options": {}
        }
        
        if redirect_to:
            payload["options"]["email_redirect_to"] = redirect_to
        
        print(f"📧 SIGNUP PAYLOAD: {payload}")
        
        return await self._post("/signup", payload)

    async def sign_in_with_otp(self, email: str, redirect_to: str = None):
        """
        Sends Magic Link with PKCE flow.
        Endpoint: POST /otp
        Payload: { email, should_create_user: true, options: { email_redirect_to: ..., data: {} } }
        Type: "magiclink"
        """
        payload = {
            "email": email,
            "type": "magiclink",
            "should_create_user": True,  # Changed from create_user
            "options": {}
        }
        
        if redirect_to:
            payload["options"]["email_redirect_to"] = redirect_to
        
        # Add empty data object to ensure proper PKCE flow
        payload["options"]["data"] = {}
        
        # Usually needs Service Key or Anon Key. headers has it.
        return await self._post("/otp", payload)

    async def sign_up(self, email: str, password: str, full_name: str, cpf: str = None):
        """
        Standard Signup (Password).
        Endpoint: POST /signup
        """
        payload = {
            "email": email,
            "password": password,
            "data": {
                "full_name": full_name
            }
        }
        if cpf:
            payload["data"]["cpf"] = cpf
            
        # Redirect option for confirmation email
        payload["options"] = {"email_redirect_to": f"{settings.FRONTEND_URL}/auth/verify"}

        return await self._post("/signup", payload)

    async def sign_in_with_password(self, email: str, password: str):
        """
        Login.
        Endpoint: POST /token?grant_type=password
        """
        payload = {
            "email": email,
            "password": password
        }
        return await self._post("/token?grant_type=password", payload)

    async def update_user(self, access_token: str, attributes: dict):
        """
        Update User (Profile/Password).
        Endpoint: PUT /user
        Headers: Authorization: Bearer <access_token>
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        return await self._put("/user", attributes, headers=headers)

    async def get_user(self, access_token: str):
        """
        Get User Details.
        Endpoint: GET /user
        Headers: Authorization: Bearer <access_token>
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        return await self._get("/user", headers=headers)

    async def reset_password_email(self, email: str):
        """
        Send Password Recovery Email.
        Endpoint: POST /recover
        """
        payload = {
            "email": email,
            "email_redirect_to": f"{settings.FRONTEND_URL}/auth/reset-password"
        }
        return await self._post("/recover", payload)

# Singleton Instance
auth_service = SupabaseAuthService()
