import os
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

class SimpleSupabaseClient:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.key = key
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json"
        }
        
    @property
    def auth(self):
        return SupabaseAuth(self.url, self.headers)

class SupabaseAuth:
    def __init__(self, url: str, headers: Dict[str, str]):
        self.url = f"{url}/auth/v1"
        self.headers = headers

    def _request(self, method: str, path: str, json: Optional[Dict] = None, headers: Optional[Dict] = None):
        endpoint = f"{self.url}/{path}"
        req_headers = self.headers.copy()
        if headers:
            req_headers.update(headers)
            
        try:
            print(f"DEBUG: Sending to {endpoint} | JSON: {json}")
            response = httpx.request(method, endpoint, json=json, headers=req_headers)
            print(f"DEBUG: Response Status: {response.status_code}")
            print(f"DEBUG: Response Body: {response.text}")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            # Try to return the detailed error from Supabase
            print(f"DEBUG: HTTP Error: {e.response.text}")
            raise Exception(f"HTTP {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise Exception(str(e))

    def sign_in_with_otp(self, email: str, redirect_to: Optional[str] = None):
        payload = {"email": email, "type": "magiclink"}
        if redirect_to:
            payload["options"] = {"email_redirect_to": redirect_to}
        return self._request("POST", "otp", json=payload)

    def verify_otp(self, email: str, token: str, type: str = "magiclink"):
        payload = {"email": email, "token": token, "type": type}
        return self._request("POST", "verify", json=payload)
    
    def reset_password_email(self, email: str, redirect_to: Optional[str] = None):
        payload = {"email": email}
         # Standard Supabase reset flow actually uses the generic recover endpoint or magic link
        return self._request("POST", "recover", json=payload)

    def sign_in_with_password(self, credentials: Dict[str, Any]):
        return self._request("POST", "token?grant_type=password", json=credentials)

    def update_user(self, token: str, attributes: Dict[str, Any]):
        # Requires authenticated user token in Authorization header
        user_headers = {"Authorization": f"Bearer {token}"}
        return self._request("PUT", "user", json=attributes, headers=user_headers)
        
    def get_user(self, token: str):
         user_headers = {"Authorization": f"Bearer {token}"}
         return self._request("GET", "user", headers=user_headers)

# Initialize Client
# Use settings which loads from .env reliably via Pydantic
url = settings.SUPABASE_URL
key = settings.SUPABASE_KEY

if not url:
    print("WARNING: SUPABASE_URL not found in settings. Using placeholder.")
    url = "https://placeholder.supabase.co"

if not key:
     print("WARNING: SUPABASE_KEY not found in settings. Using placeholder.")
     key = "placeholder"

supabase = SimpleSupabaseClient(url, key)
