import pytest
from unittest.mock import patch, AsyncMock
from app.services.ai_service import extract_product_data

@pytest.mark.asyncio
async def test_extract_product_data():
    with patch("google.generativeai.GenerativeModel.generate_content") as mock_generate:
        mock_response = AsyncMock()
        mock_response.text = '{"name": "Sofa", "price": 1000.0, "category": "Mobiliário", "yield_factor": null, "dimensions": null}'
        mock_generate.return_value = mock_response
        
        # mock settings so it doesn't return early
        with patch("app.services.ai_service.settings") as mock_settings:
            mock_settings.GEMINI_API_KEY = "dummy"
            result = await extract_product_data("Um sofa legal por 1000")
            assert "name" in result
            assert result["name"] == "Sofa"

@pytest.mark.asyncio
async def test_upload_file_to_supabase():
    with patch("app.utils.supabase_client.SupabaseStorageClient.upload_file") as mock_upload:
        mock_upload.return_value = "https://mocked.url/test.jpg"
        
        from app.utils.supabase_client import get_storage_client
        client = get_storage_client()
        result = await client.upload_file("bucket", "path", b"dummy")
        
        assert result == "https://mocked.url/test.jpg"
