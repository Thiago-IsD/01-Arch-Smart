import os
from jose import jwt
import base64

# Simulating Supabase JWT Secret
secret = "mrSz+trisBuDXWoxf4eiDKFnrtvP0Juu/ylzN+Niu8zIgq8SK9TUduRdsJGfiAXu97U4Mx6CEz8KxyOTMtHnlQ=="

payload = {"sub": "123", "email": "test@test.com", "aud": "authenticated", "role": "authenticated"}

# Encode
print("Testing plain string secret...")
try:
    token1 = jwt.encode(payload, secret, algorithm="HS256")
    decoded1 = jwt.decode(token1, secret, algorithms=["HS256"], options={"verify_aud": False})
    print("Plain string decode success!")
except Exception as e:
    print(f"Plain string error: {e}")

print("\nTesting base64 decoded secret...")
try:
    # Supabase uses base64 encoded secrets sometimes? No, generally it's just the string itself.
    # Let's see if decoding it fails or works
    b64_secret = base64.b64decode(secret)
    token2 = jwt.encode(payload, b64_secret, algorithm="HS256")
    decoded2 = jwt.decode(token2, b64_secret, algorithms=["HS256"], options={"verify_aud": False})
    print("b64 decoded secret decode success!")
except Exception as e:
    print(f"b64 string error: {e}")

