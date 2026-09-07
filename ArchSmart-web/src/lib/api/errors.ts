/**
 * Como um erro da API vira frase para o usuario.
 *
 * REGRA, decidida em 06/09/2026: discriminamos por FORMATO do `detail`, nunca
 * por status HTTP.
 *
 *   detail: string  -> erro de dominio. Frase em pt-BR pronta para exibir.
 *   detail: array   -> 422 de schema do Pydantic. E defeito nosso (o cliente
 *                      mandou o corpo errado, ou esqueceu um header), nao algo
 *                      que o usuario possa corrigir: mensagem generica + log.
 *
 * Por que nao por status: a Secao 4 mudou dez rotas de 400->422 e 500->422, e
 * `ValidacaoDeDominio` (status 422) devolve `detail` string igual a qualquer
 * outro erro de dominio. Um cliente que fizesse `if (status === 422)` para
 * renderizar `detail[].msg` quebraria nessas dez. O formato nao mente; o
 * status, para este fim, mente.
 *
 * Ver `ArchSmart-api/app/core/errors.py`: todo `DomainError` responde
 * `{"detail": "<frase>"}` nos status 404, 403, 402 e 422.
 */

export const MENSAGEM_GENERICA = "Não foi possível completar a ação. Tente novamente."

export class ApiError extends Error {
    readonly status: number
    readonly detail: unknown
    /** `true` quando o corpo e o 422 de schema do Pydantic, nao erro de dominio. */
    readonly ehDeSchema: boolean

    constructor(status: number, mensagem: string, detail: unknown, ehDeSchema: boolean) {
        super(mensagem)
        this.name = "ApiError"
        this.status = status
        this.detail = detail
        this.ehDeSchema = ehDeSchema
    }
}

function detailDe(corpo: unknown): unknown {
    if (corpo === null || typeof corpo !== "object") return undefined
    return (corpo as { detail?: unknown }).detail
}

export function mensagemDoCorpo(corpo: unknown, fallback: string = MENSAGEM_GENERICA): string {
    const detail = detailDe(corpo)
    return typeof detail === "string" && detail.trim() !== "" ? detail : fallback
}

export async function erroDaResposta(res: Response, fallback?: string): Promise<ApiError> {
    let corpo: unknown = null
    try {
        corpo = await res.json()
    } catch {
        // Resposta sem corpo JSON (502 do proxy, 504, HTML de erro do Render).
        // Nao e caso excepcional: e o que se ve quando a infra falha.
    }

    const detail = detailDe(corpo)
    const ehDeSchema = Array.isArray(detail)

    if (ehDeSchema) {
        // Log, nao exibicao: o array traz `loc`/`msg`/`type`, que descrevem o
        // NOSSO payload — util para quem depura, ruido para quem usa.
        console.error("[api] 422 de schema em", res.url, detail)
    }

    return new ApiError(res.status, mensagemDoCorpo(corpo, fallback), detail, ehDeSchema)
}
