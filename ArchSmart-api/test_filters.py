import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api/products"

def test_filters():
    print("Testing Filters and Sorting...")
    
    # 1. Get All
    try:
        response = requests.get(BASE_URL)
        data = response.json()
        products = data["items"]
        print(f"Total products: {data['total']}")
        if len(products) == 0:
            print("No products found. Run seed_products.py first.")
            return
        
        # Verify structure
        p1 = products[0]
        if 'state' in p1 and isinstance(p1['state'], dict) and 'name' in p1['state']:
            print("✅ ProductState is an object with name.")
        else:
            print(f"❌ ProductState check failed: {p1.get('state')}")

        if 'origin' in p1 and isinstance(p1['origin'], dict) and 'name' in p1['origin']:
            print("✅ ProductOrigin is an object with name.")
        else:
            print(f"❌ ProductOrigin check failed: {p1.get('origin')}")

    except Exception as e:
        print(f"❌ Failed to reach API: {e}")
        return

    # 2. Sort by Price ASC
    res = requests.get(f"{BASE_URL}?sort_by=price_asc")
    products = res.json()["items"]
    prices = [p['price'] for p in products]
    if prices == sorted(prices):
        print("✅ Sort by Price ASC: Passed")
    else:
        print(f"❌ Sort by Price ASC: Failed. Got {prices}")

    # 3. Sort by Name DESC
    res = requests.get(f"{BASE_URL}?sort_by=name_desc")
    products = res.json()["items"]
    names = [p['name'] for p in products]
    if names == sorted(names, reverse=True):
        print("✅ Sort by Name DESC: Passed")
    else:
        print(f"❌ Sort by Name DESC: Failed. Got {names}")

    # 4. Filter by Category
    category = "Cadeiras"
    res = requests.get(f"{BASE_URL}?categories={category}")
    products = res.json()["items"]
    if all(p['category'] == category for p in products) and len(products) > 0:
        print(f"✅ Filter by Category '{category}': Passed ({len(products)} found)")
    else:
        print(f"❌ Filter by Category '{category}': Failed. Got {[p['category'] for p in products]}")

    # 5. Filter by Origin
    origin = "Web Clipper"
    res = requests.get(f"{BASE_URL}?origins={origin}")
    products = res.json()["items"]
    # Note: Origin input is Name ("Web Clipper"), but backend match might be tricky if I didn't handle name vs type correctly in router.
    # In router I used: query.join(ProductOrigin).filter(ProductOrigin.name.in_(origins))
    # In seed: name="Web Clipper". So should match.
    if all(p['origin']['name'] == origin for p in products) and len(products) > 0:
        print(f"✅ Filter by Origin '{origin}': Passed ({len(products)} found)")
    else:
        print(f"❌ Filter by Origin '{origin}': Failed. Got {[p.get('origin', {}).get('name') for p in products]}")

if __name__ == "__main__":
    test_filters()
