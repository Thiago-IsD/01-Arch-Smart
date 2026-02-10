
import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api/products"

def test_pagination():
    print("Testing Pagination...")

    # Test Default (Page 1, Size 15)
    try:
        response = requests.get(BASE_URL)
        response.raise_for_status()
        data = response.json()
        
        print(f"✅ Default Response keys: {list(data.keys())}")
        
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "size" in data
        assert "pages" in data
        
        items = data["items"]
        total = data["total"]
        
        print(f"✅ Total Items: {total}")
        print(f"✅ Page 1 Items Count: {len(items)}")
        
        assert len(items) == 15
        assert data["page"] == 1
        assert data["size"] == 15

    except Exception as e:
        print(f"❌ Default Pagination Failed: {e}")
        return

    # Test Custom Size (Size 30)
    try:
        response = requests.get(f"{BASE_URL}?size=30")
        response.raise_for_status()
        data = response.json()
        
        items = data["items"]
        print(f"✅ Size 30 Items Count: {len(items)}")
        
        assert len(items) == 30
        assert data["size"] == 30

    except Exception as e:
        print(f"❌ Size 30 Pagination Failed: {e}")

    # Test Page 2
    try:
        response = requests.get(f"{BASE_URL}?size=15&page=2")
        response.raise_for_status()
        data = response.json()
        
        items = data["items"]
        print(f"✅ Page 2 Items Count: {len(items)}")
        
        assert len(items) == 15
        assert data["page"] == 2
        
        # Verify items are different from page 1 (basic check)
        # In a real test we would check IDs
        
    except Exception as e:
        print(f"❌ Page 2 Pagination Failed: {e}")

if __name__ == "__main__":
    test_pagination()
