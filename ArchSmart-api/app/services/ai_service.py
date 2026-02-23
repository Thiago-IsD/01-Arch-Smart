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
    name: str | None
    category: str | None
    price: float | None
    dimensions: Dict[str, float] | None

SYSTEM_PROMPT = """Você é um assistente técnico de arquitetura. Sua missão é extrair dados de produtos a partir de textos brutos e metadados JSON-LD de lojas. Retorne APENAS um JSON válido e estruturado.
Extraia:
- 'name'
- 'category' (Piso, Revestimento, Iluminação, Mobiliário, Marcenaria, Paisagismo ou Outros)
- 'price' (apenas números floats. ATENÇÃO: Encontre o preço ORIGINAL cheio do produto (ListPrice/De). IGNORE preços promocionais limitados, descontos para PIX ou pagamentos à vista. Queremos o valor cheio original.)
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
                    
                    # Extract structured JSON-LD data which usually contains the exact price and dimensions
                    json_lds = soup.find_all('script', type='application/ld+json')
                    ld_texts = [ld.get_text(strip=True) for ld in json_lds]
                    ld_content = "\n".join(ld_texts)
                    
                    for script in soup(["script", "style"]):
                        script.decompose()
                    page_text = soup.get_text(separator=' ', strip=True)
                    raw_text = f"{raw_text}\n\n[METADADOS JSON-LD DA PÁGINA]\n{ld_content}\n\n[CONTEÚDO DA PÁGINA: {source_url}]\n{page_text[:45000]}"
        except Exception as e:
            logger.warning(f"Failed to scrape URL {source_url}, proceeding with raw_text only: {e}")
        
    api_key = getattr(settings, "GEMINI_API_KEY", None)
    if not api_key:
        logger.warning("GEMINI_API_KEY not configured. AI extraction will fail.")
        return {}
        
    try:
        # Use the correct REST URL structure for generateContent
        import google.generativeai as genai
        
        genai.configure(api_key=api_key)
        
        # Generation config to force JSON
        generation_config = genai.types.GenerationConfig(
            temperature=0.1,
            response_mime_type="application/json"
        )
        
        # Using the standard SDK resolves region alias issues
        model = genai.GenerativeModel("gemini-2.5-flash", system_instruction=SYSTEM_PROMPT)
        
        response = model.generate_content(
            f"Texto Bruto:\n{raw_text}",
            generation_config=generation_config,
            request_options={"timeout": 15.0}
        )
        
        response_text = response.text.strip()
        
        # Clean potential markdown wrappers
        if response_text.startswith("```json"):
            response_text = response_text.removeprefix("```json").removesuffix("```").strip()
        elif response_text.startswith("```"):
            response_text = response_text.removeprefix("```").removesuffix("```").strip()
            
        json_data = json.loads(response_text)
        
        # Validate through Pydantic
        validated = ExtractionSchema(**json_data)
        return validated.dict(exclude_none=True)

    except Exception as e:
        logger.error(f"Failed to extract product data using SDK: {e}")
        raise Exception(f"Erro de conexão com IA: {e}")
