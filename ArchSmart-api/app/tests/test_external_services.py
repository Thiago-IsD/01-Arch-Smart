import httpx
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from google.genai import errors as genai_errors, types as genai_types

from app.services.ai_service import (
    AIConfigError,
    AIQuotaError,
    AIResponseError,
    AITimeoutError,
    extract_product_data,
)

LEROY_URL = "https://www.leroymerlin.com.br/piso-laminado-click-new-evidence_92453711"


def _gemini_response(text, url_status=None):
    """Monta uma resposta do SDK. url_status simula o resultado do url_context."""
    response = MagicMock()
    response.text = text
    if url_status is None:
        response.candidates = []
    else:
        meta = MagicMock()
        meta.url_metadata = [MagicMock(retrieved_url=LEROY_URL, url_retrieval_status=url_status)]
        response.candidates = [MagicMock(url_context_metadata=meta)]
    return response


@pytest.fixture
def gemini():
    """Substitui a chamada ao Gemini e injeta uma chave de API fictícia."""
    with patch("app.services.ai_service._get_client") as get_client, \
         patch("app.services.ai_service.settings") as settings:
        settings.GEMINI_API_KEY = "dummy"
        client = MagicMock()
        client.aio.models.generate_content = AsyncMock()
        get_client.return_value = client
        yield client.aio.models.generate_content


@pytest.fixture
def blocked_store():
    """Simula a loja devolvendo 403 (comportamento visto no IP do Render)."""
    with patch("app.services.ai_service.httpx.AsyncClient") as client_cls:
        client = client_cls.return_value.__aenter__.return_value
        client.get = AsyncMock(return_value=MagicMock(status_code=403))
        yield


@pytest.mark.asyncio
async def test_extract_product_data(gemini):
    gemini.return_value = _gemini_response(
        '{"name": "Sofa", "price": 1000.0, "category": "Mobiliário", "yield_factor": null, "dimensions": null}'
    )
    result = await extract_product_data("Um sofa legal por 1000")
    assert result["name"] == "Sofa"
    assert result["price"] == 1000.0
    # exclude_none: campos nulos não chegam ao cliente
    assert "yield_factor" not in result
    assert "dimensions" not in result


@pytest.mark.asyncio
async def test_null_depth_does_not_break(gemini):
    """Regressão: o caso exato que derrubava /normalize com 500 em produção."""
    gemini.return_value = _gemini_response(
        '{"name": "Piso Laminado", "category": "Piso", "price": 89.9, "yield_factor": 2.5,'
        ' "dimensions": {"width": 29.2, "height": 135.7, "depth": null}}'
    )
    result = await extract_product_data("Piso laminado")
    # A medida nula é descartada, as demais são preservadas
    assert result["dimensions"] == {"width": 29.2, "height": 135.7}


@pytest.mark.asyncio
async def test_all_dimensions_null_drops_the_key(gemini):
    gemini.return_value = _gemini_response(
        '{"name": "X", "dimensions": {"width": null, "height": null, "depth": null}}'
    )
    result = await extract_product_data("X")
    assert "dimensions" not in result


@pytest.mark.asyncio
async def test_missing_keys_are_tolerated(gemini):
    """O modelo pode omitir campos inteiros em vez de mandar null."""
    gemini.return_value = _gemini_response('{"name": "Z"}')
    result = await extract_product_data("Z")
    assert result == {"name": "Z"}


@pytest.mark.asyncio
async def test_markdown_fenced_json_is_parsed(gemini):
    gemini.return_value = _gemini_response('```json\n{"name": "Cadeira", "price": 50.0}\n```')
    result = await extract_product_data("Cadeira")
    assert result["name"] == "Cadeira"


@pytest.mark.asyncio
async def test_json_after_prose_is_parsed(gemini):
    """
    Sem JSON mode (caminho url_context), o modelo narra o raciocínio antes do JSON.
    Texto observado em chamada real à API.
    """
    gemini.return_value = _gemini_response(
        'I have browsed the URL and now I will extract the requested information.\n'
        '- **name**: "Piso Laminado Click"\n'
        '- **price**: The price per box is R$ 221,32 {não é isto}\n\n'
        '```json\n{"name": "Piso Laminado Click", "price": 79.9, "yield_factor": 2.77}\n```'
    )
    result = await extract_product_data("Piso laminado")
    assert result["price"] == 79.9
    assert result["yield_factor"] == 2.77


@pytest.mark.asyncio
async def test_response_without_json_raises(gemini):
    gemini.return_value = _gemini_response("Não consegui acessar a página do produto.")
    with pytest.raises(AIResponseError):
        await extract_product_data("Piso laminado")


@pytest.mark.asyncio
async def test_invalid_api_key_400_is_config_error(gemini):
    """A API do Gemini devolve 400 INVALID_ARGUMENT para chave inválida, não 401."""
    gemini.side_effect = genai_errors.ClientError(
        400, {"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT"}}
    )
    with pytest.raises(AIConfigError):
        await extract_product_data("Sofa")
    assert gemini.await_count == 1


@pytest.mark.asyncio
async def test_blocked_store_falls_back_to_url_context(gemini, blocked_store):
    """403 na loja deve acionar o url_context, não estourar erro."""
    gemini.return_value = _gemini_response(
        '{"name": "Piso Laminado", "category": "Piso", "price": 89.9}',
        url_status=genai_types.UrlRetrievalStatus.URL_RETRIEVAL_STATUS_SUCCESS,
    )
    result = await extract_product_data("Piso laminado", LEROY_URL)

    assert result["price"] == 89.9
    assert result.get("source_blocked") is not True

    config = gemini.call_args.kwargs["config"]
    assert config.tools and config.tools[0].url_context is not None
    # JSON mode é incompatível com tools fora dos modelos Gemini 3
    assert config.response_mime_type is None


@pytest.mark.asyncio
async def test_url_context_failure_flags_source_blocked(gemini, blocked_store):
    """Quando nem o Google consegue ler a página, devolve parcial sinalizado."""
    gemini.return_value = _gemini_response(
        '{"name": "Piso Laminado", "category": "Piso"}',
        url_status=genai_types.UrlRetrievalStatus.URL_RETRIEVAL_STATUS_ERROR,
    )
    result = await extract_product_data("Piso laminado", LEROY_URL)
    assert result["source_blocked"] is True
    assert result["name"] == "Piso Laminado"


@pytest.mark.asyncio
async def test_successful_scrape_uses_json_mode(gemini):
    """Com a página acessível, usa o caminho barato: HTML + JSON mode, sem tools."""
    html = '<html><script type="application/ld+json">{"price": 10}</script><body>Piso bonito</body></html>'
    with patch("app.services.ai_service.httpx.AsyncClient") as client_cls:
        client = client_cls.return_value.__aenter__.return_value
        client.get = AsyncMock(return_value=MagicMock(status_code=200, text=html))
        gemini.return_value = _gemini_response('{"name": "Piso", "price": 10.0}')
        result = await extract_product_data("Piso", "https://loja.com/p")

    assert result["price"] == 10.0
    config = gemini.call_args.kwargs["config"]
    assert config.response_mime_type == "application/json"
    assert not config.tools
    assert "Piso bonito" in gemini.call_args.kwargs["contents"]


@pytest.mark.asyncio
async def test_quota_error_is_classified(gemini):
    gemini.side_effect = genai_errors.ClientError(429, {"error": {"message": "quota"}})
    with pytest.raises(AIQuotaError):
        await extract_product_data("Sofa")
    # 3 tentativas: transitório é elegível a retry
    assert gemini.await_count == 3


@pytest.mark.asyncio
async def test_invalid_key_is_not_retried(gemini):
    gemini.side_effect = genai_errors.ClientError(403, {"error": {"message": "invalid key"}})
    with pytest.raises(AIConfigError):
        await extract_product_data("Sofa")
    # Credencial inválida não melhora com retry
    assert gemini.await_count == 1


@pytest.mark.asyncio
async def test_timeout_is_classified(gemini):
    gemini.side_effect = httpx.TimeoutException("timed out")
    with pytest.raises(AITimeoutError):
        await extract_product_data("Sofa")


@pytest.mark.asyncio
async def test_malformed_json_raises_response_error(gemini):
    gemini.side_effect = None
    gemini.return_value = _gemini_response("desculpe, não consegui extrair os dados")
    with pytest.raises(AIResponseError):
        await extract_product_data("Sofa")


@pytest.mark.asyncio
async def test_missing_api_key_raises_config_error():
    with patch("app.services.ai_service.settings") as settings:
        settings.GEMINI_API_KEY = None
        with patch("app.services.ai_service._client", None):
            with pytest.raises(AIConfigError):
                await extract_product_data("Sofa")


@pytest.mark.asyncio
async def test_upload_file_to_supabase():
    with patch("app.utils.supabase_client.SupabaseStorageClient.upload_file") as mock_upload:
        mock_upload.return_value = "https://mocked.url/test.jpg"

        from app.utils.supabase_client import get_storage_client
        client = get_storage_client()
        result = await client.upload_file("bucket", "path", b"dummy")

        assert result == "https://mocked.url/test.jpg"
