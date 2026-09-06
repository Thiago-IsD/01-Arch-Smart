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
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
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

export async function tentarPrefetch(tarefa: () => Promise<unknown>): Promise<void> {
    try {
        await Promise.race([
            tarefa(),
            new Promise((_, rejeitar) =>
                setTimeout(() => rejeitar(new Error("timeout do prefetch")), TIMEOUT_DO_PREFETCH_MS),
            ),
        ])
    } catch (erro) {
        // Prefetch e otimizacao, nao contrato: falhar aqui degrada para busca
        // no cliente, e a tela funciona igual. Engolir e deliberado.
        console.warn("[prefetch] desistiu, o cliente vai buscar:", erro)
    }
}
