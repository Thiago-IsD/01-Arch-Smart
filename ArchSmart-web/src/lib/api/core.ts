import { erroDaResposta } from "@/lib/api/errors"
import { getApiUrl } from "@/lib/api-url"

/**
 * O unico lugar do front que chama `fetch`.
 *
 * Resolve sessao, monta header, serializa query, propaga AbortSignal, traduz
 * erro e tipa a resposta. Antes desta secao eram 73 linhas montando
 * `Authorization` a mao e 56 `getSession()` — e um DELETE que esquecia o
 * header e falhava calado (ProductCard.tsx:89).
 *
 * `criarCliente` recebe suas dependencias por parametro para ser testavel sem
 * rede e sem Supabase; `api` (browser) e `apiServer` (servidor, em server.ts)
 * sao as duas instancias que a aplicacao usa.
 */

export type ValorDeQuery = string | number | boolean | string[] | undefined | null

export interface Requisicao {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    body?: unknown
    signal?: AbortSignal
    query?: Record<string, ValorDeQuery>
    /** Frase a exibir quando a API nao mandar uma. Ver lib/api/errors.ts. */
    fallbackDeErro?: string
    /**
     * Deixa a requisicao sobreviver a saida da pagina. So para telemetria: o
     * navegador limita o volume total de requisicoes keepalive, entao isto nao
     * e uma opcao para chamada comum.
     */
    keepalive?: boolean
}

export type ClienteApi = <T>(path: string, req?: Requisicao) => Promise<T>

export interface OpcoesDoCliente {
    resolverToken: () => Promise<string | undefined>
    baseUrl?: () => string
    fetchImpl?: typeof fetch
}

function montarQuery(query: Record<string, ValorDeQuery> | undefined): string {
    if (!query) return ""
    const params = new URLSearchParams()
    for (const [chave, valor] of Object.entries(query)) {
        if (valor === undefined || valor === null || valor === "") continue
        if (Array.isArray(valor)) valor.forEach((v) => params.append(chave, String(v)))
        else params.set(chave, String(valor))
    }
    const texto = params.toString()
    return texto ? `?${texto}` : ""
}

export function criarCliente(opts: OpcoesDoCliente): ClienteApi {
    const base = opts.baseUrl ?? getApiUrl

    return async function requisitar<T>(path: string, req: Requisicao = {}): Promise<T> {
        // `fetch` e resolvido aqui dentro, nao guardado numa const no escopo
        // de `criarCliente` — `api`/`apiServer` sao criados uma vez, no
        // carregamento do modulo, e um `fetch` capturado naquele instante
        // fica preso a essa referencia para sempre. Em producao ninguem
        // reatribui `window.fetch` depois do load, entao nunca dava para
        // notar; em teste, `vi.stubGlobal("fetch", ...)` troca a referencia
        // global depois que o modulo ja carregou, e a const antiga continuava
        // apontando pro fetch real — a chamada saia pra rede de verdade.
        const chamar = opts.fetchImpl ?? fetch
        const token = await opts.resolverToken()

        const headers = new Headers()
        if (token) headers.set("Authorization", `Bearer ${token}`)
        if (req.body !== undefined) headers.set("Content-Type", "application/json")

        const caminho = path.startsWith("/") ? path : `/${path}`
        const url = `${base()}${caminho}${montarQuery(req.query)}`

        const res = await chamar(url, {
            method: req.method ?? "GET",
            headers,
            body: req.body === undefined ? undefined : JSON.stringify(req.body),
            signal: req.signal,
            keepalive: req.keepalive,
        })

        if (!res.ok) throw await erroDaResposta(res, req.fallbackDeErro)

        // 204, e qualquer resposta sem corpo, nao sao erro: sao o contrato de
        // DELETE nesta API. Chamar .json() aqui estouraria SyntaxError.
        if (res.status === 204 || res.headers.get("Content-Length") === "0") {
            return undefined as T
        }
        return (await res.json()) as T
    }
}
