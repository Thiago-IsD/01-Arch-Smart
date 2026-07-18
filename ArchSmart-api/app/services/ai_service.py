import json
import logging
import httpx
from typing import Any, Dict, Tuple
from app.core.config import settings
from pydantic import BaseModel, ValidationError
from google import genai
from google.genai import errors as genai_errors, types as genai_types
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_TIMEOUT_MS = 30_000
SCRAPE_TIMEOUT_S = 10.0
MAX_PAGE_CHARS = 45000


class AIServiceError(Exception):
    """Base de todas as falhas de extração por IA."""


class AIConfigError(AIServiceError):
    """Chave de API ausente ou inválida."""


class AIQuotaError(AIServiceError):
    """Quota/rate limit da API do Gemini atingido."""


class AITimeoutError(AIServiceError):
    """A IA não respondeu dentro do tempo limite."""


class AIResponseError(AIServiceError):
    """A IA respondeu, mas fora do formato esperado."""


class ExtractionSchema(BaseModel):
    # Todos os campos são opcionais e podem vir ausentes: o SYSTEM_PROMPT instrui o modelo
    # a retornar null quando o dado é inconclusivo (comum quando a loja bloqueia o scraping).
    name: str | None = None
    category: str | None = None
    price: float | None = None
    yield_factor: float | None = None
    dimensions: Dict[str, float | None] | None = None

SYSTEM_PROMPT = """Você é um assistente técnico de arquitetura. Sua missão é extrair dados de produtos a partir de textos brutos e metadados JSON-LD de lojas. Retorne APENAS um JSON válido e estruturado.
Extraia:
- 'name'
- 'category' (Piso, Revestimento, Iluminação, Mobiliário, Marcenaria, Paisagismo ou Outros)
- 'price' (apenas números floats. ATENÇÃO: Encontre o preço ORIGINAL cheio do produto (ListPrice/De). IGNORE descontos PIX ou à vista.)
- 'yield_factor' (apenas floats. Quantos metros quadrados (m²) ou lineares a caixa/unidade deste produto cobre de rendimento. Ex: Se a caixa faz 2.5m², retorne 2.5. Se não houver, retorne null)
- 'dimensions' (width, height, depth em centimetros - converta qualquer unidade)

Se você não achar algum dos dados ou ele for inconclusivo, retorne null para esse campo."""

# Reforço do formato para a chamada com url_context: nesse caminho o JSON mode não pode ser
# usado (só modelos Gemini 3 combinam tools com response_mime_type), então pedimos no prompt.
JSON_ONLY_SUFFIX = "\n\nResponda com o objeto JSON puro, sem cercas de markdown e sem texto antes ou depois."

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    """Cria o client uma única vez por processo (o SDK reaproveita o pool de conexões)."""
    global _client
    api_key = getattr(settings, "GEMINI_API_KEY", None)
    if not api_key:
        raise AIConfigError("GEMINI_API_KEY não configurada.")
    if _client is None:
        _client = genai.Client(
            api_key=api_key,
            http_options=genai_types.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
        )
    return _client


async def _scrape_page(source_url: str) -> str | None:
    """
    Baixa a página do produto e devolve o texto relevante, ou None se a loja bloqueou.

    Lojas como a Leroy Merlin devolvem 403 para IPs de datacenter (ex.: Render), embora
    funcionem de um IP residencial. Nesse caso quem chama recorre ao url_context do Gemini.
    """
    # User-Agent de Chrome moderno para reduzir bloqueios de sistemas anti-bot
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    }
    try:
        async with httpx.AsyncClient(verify=False, http2=False, timeout=SCRAPE_TIMEOUT_S, follow_redirects=True) as client:
            resp = await client.get(source_url, headers=headers)

            if resp.status_code != 200:
                logger.warning(f"Store returned {resp.status_code} for URL {source_url}. Falling back to Gemini url_context.")
                return None

            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, 'html.parser')

            # O JSON-LD normalmente traz o preço exato e as dimensões
            json_lds = soup.find_all('script', type='application/ld+json')
            ld_content = "\n".join(ld.get_text(strip=True) for ld in json_lds)

            for script in soup(["script", "style"]):
                script.decompose()
            page_text = soup.get_text(separator=' ', strip=True)

            return (
                f"\n\n[METADADOS JSON-LD DA PÁGINA]\n{ld_content}"
                f"\n\n[CONTEÚDO DA PÁGINA: {source_url}]\n{page_text[:MAX_PAGE_CHARS]}"
            )
    except Exception as e:
        logger.warning(f"Failed to scrape URL {source_url}, falling back to Gemini url_context: {e}")
        return None


def _classify(exc: Exception) -> AIServiceError:
    """Traduz erros do SDK para a taxonomia do serviço, preservando a causa original."""
    if isinstance(exc, genai_errors.APIError):
        if exc.code == 429:
            return AIQuotaError(str(exc))
        if exc.code in (401, 403):
            return AIConfigError(str(exc))
        # Chave inválida chega como 400 INVALID_ARGUMENT, não 401 — sem este caso,
        # um erro de credencial se disfarçaria de erro de formato.
        if exc.code == 400 and "api key not valid" in str(exc).lower():
            return AIConfigError(str(exc))
        if exc.code == 504:
            return AITimeoutError(str(exc))
        if exc.code and exc.code >= 500:
            return AIQuotaError(str(exc))  # 5xx é transitório: elegível a retry
    if isinstance(exc, (httpx.TimeoutException, TimeoutError)):
        return AITimeoutError(str(exc))
    return AIResponseError(str(exc))


@retry(
    # Só re-tenta o que é transitório. Erro de parse ou de credencial não melhora com retry,
    # e insistir num 429 em lote só amplifica o problema.
    retry=retry_if_exception_type((AIQuotaError, AITimeoutError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=1, max=8),
    reraise=True,
)
async def _generate(prompt: str, use_url_context: bool) -> Tuple[str, bool]:
    """
    Chama o Gemini e devolve (texto, source_blocked).

    Com use_url_context, o próprio Google busca a URL — o que contorna bloqueios ao nosso IP.
    Esse caminho não pode usar JSON mode: combinar tools com response_mime_type exige um
    modelo Gemini 3 (todos em preview hoje), então o formato é pedido via prompt.
    """
    client = _get_client()

    if use_url_context:
        config = genai_types.GenerateContentConfig(
            temperature=0.1,
            system_instruction=SYSTEM_PROMPT + JSON_ONLY_SUFFIX,
            tools=[genai_types.Tool(url_context=genai_types.UrlContext())],
        )
    else:
        config = genai_types.GenerateContentConfig(
            temperature=0.1,
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
        )

    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=config,
        )
    except AIServiceError:
        raise
    except Exception as e:
        raise _classify(e) from e

    return response.text or "", _url_retrieval_failed(response) if use_url_context else False


def _url_retrieval_failed(response: Any) -> bool:
    """True se o Google também não conseguiu ler a URL (loja bloqueia todo mundo)."""
    try:
        metadata = response.candidates[0].url_context_metadata
        if not metadata or not metadata.url_metadata:
            return True
        return not any(
            m.url_retrieval_status == genai_types.UrlRetrievalStatus.URL_RETRIEVAL_STATUS_SUCCESS
            for m in metadata.url_metadata
        )
    except (AttributeError, IndexError, TypeError):
        return True


def _extract_json_object(text: str) -> Dict[str, Any]:
    """
    Encontra o objeto JSON dentro da resposta do modelo.

    No caminho url_context não há JSON mode, e o modelo costuma narrar o raciocínio
    antes de emitir o JSON ("I have browsed the URL and now I will extract..."), então
    não basta tirar as cercas de markdown: é preciso localizar o objeto no meio do texto.
    """
    text = text.strip()
    if text.startswith("```json"):
        text = text.removeprefix("```json").removesuffix("```").strip()
    elif text.startswith("```"):
        text = text.removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Varre da direita para a esquerda: o JSON final é o que interessa, e assim
    # ignoramos chaves soltas que apareçam na narrativa do modelo.
    decoder = json.JSONDecoder()
    for start in reversed([i for i, c in enumerate(text) if c == "{"]):
        try:
            candidate, _ = decoder.raw_decode(text[start:])
        except json.JSONDecodeError:
            continue
        if isinstance(candidate, dict) and candidate.keys() & ExtractionSchema.model_fields.keys():
            return candidate

    raise AIResponseError("Não foi encontrado um objeto JSON na resposta da IA.")


def _parse(response_text: str) -> Dict[str, Any]:
    """Converte a resposta do modelo no dict final."""
    try:
        validated = ExtractionSchema(**_extract_json_object(response_text))
    except AIResponseError:
        raise
    except (ValidationError, TypeError) as e:
        raise AIResponseError(f"Resposta da IA fora do formato esperado: {e}") from e

    result = validated.model_dump(exclude_none=True)

    # exclude_none só limpa o nível raiz: remove também as medidas nulas de dentro
    # de 'dimensions' e descarta a chave se nenhuma medida foi identificada.
    dimensions = {k: v for k, v in (result.get("dimensions") or {}).items() if v is not None}
    if dimensions:
        result["dimensions"] = dimensions
    else:
        result.pop("dimensions", None)

    return result


async def extract_product_data(raw_text: str, source_url: str | None = None) -> Dict[str, Any]:
    """
    Extrai dados estruturados de um produto a partir de texto bruto e/ou da URL da loja.

    Tenta primeiro baixar a página diretamente (mais rápido e barato). Se a loja bloquear,
    delega a busca ao url_context do Gemini. Levanta AIServiceError em caso de falha.
    """
    if not isinstance(raw_text, str) or len(raw_text.strip()) == 0:
        if not source_url:
            return {}

    scraped = await _scrape_page(source_url) if source_url else None
    use_url_context = source_url is not None and scraped is None

    prompt = f"Texto Bruto:\n{raw_text}"
    if scraped:
        prompt += scraped
    elif use_url_context:
        prompt += f"\n\nExtraia os dados do produto a partir desta página: {source_url}"

    try:
        response_text, source_blocked = await _generate(prompt, use_url_context)
    except AIServiceError:
        raise
    except Exception as e:
        logger.error(f"Unexpected failure extracting product data: {e}")
        raise _classify(e) from e

    result = _parse(response_text)
    if source_blocked:
        logger.warning(f"Gemini url_context could not retrieve {source_url}; returning name-only extraction.")
        result["source_blocked"] = True
    return result
