import json
import logging
import httpx
from typing import Dict, Any
from app.core.config import settings
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

# Output schema definition map for raw REST JSON Schema
GEMINI_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "name": {"type": "STRING", "description": "Nome do produto", "nullable": True},
        "category": {"type": "STRING", "description": "Categoria", "nullable": True},
        "price": {"type": "NUMBER", "description": "Preço numérico. Exemplo: 1500.50", "nullable": True},
        "dimensions": {
            "type": "OBJECT",
            "nullable": True,
            "properties": {
                "width": {"type": "NUMBER", "description": "Largura em cm", "nullable": True},
                "height": {"type": "NUMBER", "description": "Altura em cm", "nullable": True},
                "depth": {"type": "NUMBER", "description": "Profundidade em cm", "nullable": True}
            }
        }
    }
}

class ExtractionSchema(BaseModel):
    name: str | None = None
    category: str | None = None
    price: float | None = None
    dimensions: Dict[str, float] | None = None

SYSTEM_PROMPT = """Você é um assistente técnico de arquitetura. Sua missão é extrair dados de produtos a partir de textos brutos de lojas. Retorne APENAS um JSON válido e estruturado.
Extraia:
- 'name'
- 'category' (Piso, Revestimento, Iluminação, Mobiliário, Marcenaria, Paisagismo ou Outros)
- 'price' (apenas números floats)
- 'dimensions' (width, height, depth em centimetros - converta qualquer unidade)

Se você não achar algum dos dados ou ele for inconclusivo, retorne null para esse campo."""

async def extract_product_data(raw_text: str, source_url: str | None = None) -> Dict[str, Any]:
    """
    Given raw text from a product page, uses Gemini REST API to extract structured JSON data.
    Runs asynchronously with a strict 15-second HTTPX timeout locally bypassing Windows library locks.
    """
    if not isinstance(raw_text, str) or len(raw_text.strip()) == 0:
        if not source_url:
            return {}
            
    if source_url:
        try:
            from bs4 import BeautifulSoup
            # Using a modern Chrome User-Agent to prevent 403 blocks from store anti-bot systems
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            }
            async with httpx.AsyncClient(verify=False, http2=False, timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(source_url, headers=headers)
                
                # If store completely blocks us, just log and allow Gemini to guess based on name alone rather than throwing 500
                if resp.status_code != 200:
                    logger.warning(f"Store returned {resp.status_code} for URL {source_url}. Falling back to name-only AI extraction.")
                else:
                    soup = BeautifulSoup(resp.text, 'html.parser')
                    for script in soup(["script", "style"]):
                        script.decompose()
                    page_text = soup.get_text(separator=' ', strip=True)
                    raw_text = f"{raw_text}\n\n[CONTEÚDO DA PÁGINA: {source_url}]\n{page_text[:15000]}"
        except Exception as e:
            logger.warning(f"Failed to scrape URL {source_url}, proceeding with raw_text only: {e}")
        
    api_key = getattr(settings, "GEMINI_API_KEY", None)
    if not api_key:
        logger.warning("GEMINI_API_KEY not configured. AI extraction will fail.")
        return {}
        
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "contents": [{
                "parts": [{"text": f"Texto Bruto:\n{raw_text}"}]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
                "responseSchema": GEMINI_SCHEMA
            }
        }
        
        headers = {'Content-Type': 'application/json'}

        # Raw REST call specifying tight limits and forcing SSL bypass for windows networking
        async with httpx.AsyncClient(verify=False, http2=False, timeout=12.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            
            resp_data = response.json()
            
            # Navigate nested REST Gemini Response
            candidates = resp_data.get("candidates", [])
            if not candidates:
                logger.error("No candidates returned from Gemini.")
                return {}
                
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if not parts:
                return {}
                
            # The model is forced to return JSON text matching the schema
            response_text = parts[0].get("text", "{}").strip()
            
            json_data = json.loads(response_text)
            
            # Validate
            validated = ExtractionSchema(**json_data)
            return validated.dict(exclude_none=True)

    except httpx.TimeoutException:
        logger.error("Gemini API REST request timed out after 12 seconds.")
        raise Exception("O seviço de IA não respondeu a tempo (Timeout). Verifique sua conexão.")
    except httpx.HTTPError as he:
        logger.error(f"Gemini API HTTP Error: {he}")
        raise Exception(f"Erro de conexão com IA: {he}")
    except Exception as e:
        logger.error(f"Failed to extract product data: {e}")
        raise e
