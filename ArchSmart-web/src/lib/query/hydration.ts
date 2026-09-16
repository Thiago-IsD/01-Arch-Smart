import { QueryClient } from "@tanstack/react-query"
import type { Query } from "@tanstack/react-query"

import type { ClienteApi } from "@/lib/api/core"

/**
 * QueryClient por requisicao, para o servidor.
 *
 * NUNCA reuse um QueryClient entre requisicoes no servidor: o cache seria
 * compartilhado entre usuarios, e dado de uma conta apareceria em outra. E o
 * mesmo risco que o `ScopedRepository` fecha no backend (Art. 1), pela outra
 * ponta.
 */
export function criarQueryClientDoServidor(): QueryClient {
    return new QueryClient({
        // `retry: false`: sem isso o padrao do React Query e 3 tentativas com
        // backoff — um prefetch abortado ou com erro seria tentado de novo
        // duas vezes, dentro (ou pior, depois) do teto de 3 s. Retry no
        // servidor dentro desse orcamento nao rende nada, so multiplica a
        // conexao pendurada que o teto existe para evitar.
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false } },
    })
}

/**
 * Teto para o prefetch do servidor.
 *
 * A API roda no free tier do Render, que hiberna: medido em 06/09/2026,
 * `/health` levou 41,9 s na primeira chamada e 0,46 s nas seguintes. Sem
 * teto, um cold start prenderia o stream ate o timeout da plataforma. Com
 * teto, o prefetch desiste, nao hidrata nada, e o cliente busca — que e
 * exatamente o comportamento de hoje. O pior caso nunca fica pior que o atual.
 */
export const TIMEOUT_DO_PREFETCH_MS = 3_000

/**
 * `tarefa` recebe o `AbortSignal` do teto e tem que repassa-lo ate o `fetch`
 * (via `clienteComSinal`). Sem isso o teto so para de *esperar* — a chamada
 * continua correndo no servidor ate a API responder (ate ~42 s num cold start).
 *
 * ## Por que recebe o `queryClient`
 *
 * `prefetchQuery` NUNCA rejeita: o erro da `queryFn` fica no estado da query.
 * Ate 15/09/2026 esta funcao so tinha um `catch`, que portanto nunca rodava —
 * prefetch que desistia era invisivel no log do servidor, nas quatro telas
 * (item 9 do bloco do Dashboard no CLAUDE.md). Agora ela olha o estado das
 * queries que a TAREFA tocou e avisa as que nao terminaram em sucesso.
 *
 * "Que a tarefa tocou" = as que nao existiam ou mudaram de `dataUpdatedAt`/
 * `errorUpdatedAt` durante a chamada. Um QueryClient de servidor nasce vazio
 * por requisicao, entao na pratica sao todas; o filtro existe para a funcao
 * nao mentir se um dia receber um cliente com historico.
 */
export async function tentarPrefetch(
    queryClient: QueryClient,
    tarefa: (signal: AbortSignal) => Promise<unknown>,
): Promise<void> {
    const cache = queryClient.getQueryCache()
    const antes = new Map(
        cache.getAll().map((q) => [q.queryHash, `${q.state.dataUpdatedAt}:${q.state.errorUpdatedAt}`]),
    )
    const tocada = (q: Query) => antes.get(q.queryHash) !== `${q.state.dataUpdatedAt}:${q.state.errorUpdatedAt}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_DO_PREFETCH_MS)
    try {
        await tarefa(controller.signal)
    } catch (erro) {
        // Tarefa que nao e `prefetchQuery` pode rejeitar de verdade. Prefetch
        // e otimizacao, nao contrato: degrada para busca no cliente.
        console.warn("[prefetch] desistiu, o cliente vai buscar:", erro)
        return
    } finally {
        clearTimeout(timer)
    }

    for (const query of cache.getAll()) {
        if (tocada(query) && query.state.status !== "success") {
            console.warn(
                "[prefetch] desistiu, o cliente vai buscar:",
                JSON.stringify(query.queryKey),
                query.state.error,
            )
        }
    }
}

/**
 * Um cliente que aborta quando o teto de `tentarPrefetch` aborta.
 *
 * Existe por causa das fabricas de `features/<dominio>/queries.ts`: la a
 * `queryFn` recebe o `signal` do REACT QUERY, nao o do teto. Antes delas o
 * `LibraryData` repassava o sinal do teto a mao para `apiServer`; sem este
 * embrulho, a fabrica perderia isso e um cold start voltaria a pendurar a
 * conexao ate a API responder — o custo que `tentarPrefetch` documenta.
 *
 * `AbortSignal.any` aborta quando QUALQUER um aborta: o teto, ou o proprio
 * React Query cancelando a query.
 */
export function clienteComSinal(cliente: ClienteApi, sinal: AbortSignal): ClienteApi {
    return (path, req = {}) =>
        cliente(path, {
            ...req,
            signal: req.signal ? AbortSignal.any([req.signal, sinal]) : sinal,
        })
}
