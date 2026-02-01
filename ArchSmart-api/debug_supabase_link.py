import sys
import os
import json
import httpx

# Add current directory to path
sys.path.append(os.getcwd())

from app.core.config import settings

def test_supabase_link_gen():
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY
    
    if not url or not key:
        print("Missing Supabase credentials in environment.")
        return

    endpoint = f"{url}/auth/v1/otp"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    
    # Payload matching exactly what auth.py does
    payload = {
        "email": "inovarte.sd@gmail.com",
        "type": "magiclink",
        "options": {
            "email_redirect_to": "http://localhost:3000/auth/verify"
        }
    }

    print(f"Sending request to: {endpoint}")
    print(f"Payload: {payload}")

    try:
        response = httpx.post(endpoint, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("\nSUCCESS: Supabase accepted the request.")
            print("Check the email for 'testuser_debug@example.com'.")
            print("The link in that email MUST contain 'redirect_to=...' encoded in it.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_supabase_link_gen()
