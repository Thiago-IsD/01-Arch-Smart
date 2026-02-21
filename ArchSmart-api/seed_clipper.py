import urllib.request
import json
import uuid

# Define the payload
payload = {
    "codigo": str(uuid.uuid4())[:8],
    "name": "Sofa Cama 3 Lugares Malaquita Preto",
    "store": "Tok&Stok",
    "category": "Mobiliário",
    "source_url": "https://www.tokstok.com.br/sofa-cama-3-lugares-malaquita-preto-marad/p?idsku=427782",
    "image_url": "https://tokstok.vtexassets.com/arquivos/ids/6234057-798-798",
    "status": "INACTIVE",
}

# 1. Create Product
data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/products", 
    data=data, 
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req) as response:
        resp_body = response.read().decode('utf-8')
        created_product = json.loads(resp_body)
        print("Product Created Response:", created_product)
        product_id = created_product.get("id")
        
        # 2. Update to CAPTURED
        if product_id:
            patch_data = json.dumps({"state": "CAPTURED", "origin": "WebClipper"}).encode('utf-8')
            # Since the API might not have a direct endpoint for setting arbitrary state, let's use the DB directly if needed. 
            # Wait, there's no endpoint for `PATCH /api/products/{id}/state` currently except approve!
            # Let's write the direct DB script using raw sqlite if it's sqlite, but wait, it's postgresql!
except Exception as e:
    import traceback
    traceback.print_exc()
