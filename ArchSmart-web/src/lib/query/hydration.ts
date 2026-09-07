import { QueryClient } from "@tanstack/react-query"

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
 * (via `apiServer`). Sem isso o teto so para de *esperar* — a chamada
 * continua correndo no servidor, sem ninguem escutando, ate a API responder
 * (ate ~42 s num cold start) ou a plataforma cortar a conexao sozinha. Contra
 * um free tier onde o timeout e o caso esperado, e nao o raro, essa conexao
 * pendurada e o custo real do atalho de so "desistir de esperar".
 */
export async function tentarPrefetch(
    tarefa: (signal: AbortSignal) => Promise<unknown>,
): Promise<void> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_DO_PREFETCH_MS)
    try {
        await tarefa(controller.signal)
    } catch (erro) {
        // Prefetch e otimizacao, nao contrato: falhar aqui degrada para busca
        // no cliente, e a tela funciona igual. Engolir e deliberado.
        console.warn("[prefetch] desistiu, o cliente vai buscar:", erro)
    } finally {
        clearTimeout(timer)
    }
}
