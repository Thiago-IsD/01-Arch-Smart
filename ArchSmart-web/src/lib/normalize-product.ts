import { apiUrl } from "@/lib/api-url"
import { createClient } from "@/utils/supabase/client"

export interface NormalizedProduct {
    name?: string | null
    category?: string | null
    price?: number | null
    yield_factor?: number | null
    dimensions?: { width?: number | null; height?: number | null; depth?: number | null } | null
    /** True quando nem nós nem o Google conseguimos ler a página: dados vieram só do nome. */
    source_blocked?: boolean
}

/** Timeout do lado do cliente: sem ele, o botão pode ficar preso em "Analisando..." para sempre. */
const NORMALIZE_TIMEOUT_MS = 45_000

/**
 * O endpoint de IA é caro e o backend chama um modelo externo com rate limit.
 * Disparar uma requisição por produto de uma vez derruba o lote inteiro com 429.
 */
export const NORMALIZE_CONCURRENCY = 4

export async function getToken(): Promise<string | undefined> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
}

/**
 * Extrai a mensagem de erro da API.
 *
 * O backend devolve mensagens específicas em `detail` (quota, timeout, formato inválido).
 * Antes o corpo era descartado e toda falha virava "não foi possível conectar com a IA",
 * o que fez um bug de schema parecer problema de rede por semanas.
 */
export async function apiErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const body = await res.json()
        if (typeof body?.detail === "string") return body.detail
    } catch {
        // resposta sem corpo JSON — usa o fallback
    }
    return fallback
}

export async function normalizeProduct(
    input: { text: string; source_url?: string | null },
    options: { token?: string; signal?: AbortSignal } = {},
): Promise<NormalizedProduct> {
    const token = options.token ?? (await getToken())

    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), NORMALIZE_TIMEOUT_MS)

    // Combina o abort do chamador (fechar o modal) com o do timeout.
    const signals = [timeout.signal, options.signal].filter(Boolean) as AbortSignal[]
    const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0]

    try {
        const res = await fetch(apiUrl("/api/products/normalize"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ text: input.text, source_url: input.source_url ?? null }),
            signal,
        })

        if (!res.ok) {
            throw new Error(await apiErrorMessage(res, "Não foi possível analisar este produto."))
        }
        return await res.json()
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            throw new Error(
                timeout.signal.aborted ? "A análise demorou demais e foi cancelada." : "Análise cancelada.",
            )
        }
        throw err
    } finally {
        clearTimeout(timer)
    }
}

/** Executa `task` sobre os itens com no máximo `limit` chamadas simultâneas, preservando a ordem. */
export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    task: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
    const results = new Array<PromiseSettledResult<R>>(items.length)
    let cursor = 0

    const worker = async () => {
        while (cursor < items.length) {
            const index = cursor++
            try {
                results[index] = { status: "fulfilled", value: await task(items[index], index) }
            } catch (reason) {
                results[index] = { status: "rejected", reason }
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
    return results
}
