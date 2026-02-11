import requests
import json

URL = "http://127.0.0.1:8000/api/auth/login"
PAYLOAD = {
    "email": "test@test.com",
    "password": "wrongpassword"
}

def test_login():
    print(f"🚀 Sending POST to {URL}")
    print(f"📦 Payload: {PAYLOAD}")
    
    try:
        response = requests.post(URL, json=PAYLOAD, timeout=10)
        print(f"⬅️ Response Status: {response.status_code}")
        print(f"📄 Response Body: {response.text}")
    except requests.exceptions.Timeout:
        print("❌ Request timed out! Backend is hanging.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_login()
