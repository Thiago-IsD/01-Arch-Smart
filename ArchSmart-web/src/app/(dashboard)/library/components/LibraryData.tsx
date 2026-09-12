import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { apiServer } from "@/lib/api/server"
import { queryKeys, type FiltrosDeProduto } from "@/lib/query/keys"
import { criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { queryDeProdutos } from "@/features/library/api"
import type { ProductsResponse } from "@/features/library/types"
import { LibraryContent } from "./LibraryContent"

/**
 * Busca no servidor e entrega hidratado.
 *
 * Fica dentro de um <Suspense> em page.tsx: o shell da Biblioteca faz stream
 * na hora e este bloco chega quando ficar pronto. Ver ADR 0009 — a spec pedia
 * prefetch bloqueante, e o cold start medido de 41,9 s tornaria isso uma
 * regressao do pior caso.
 */
export async function LibraryData({ filtros }: { filtros: FiltrosDeProduto }) {
    const queryClient = criarQueryClientDoServidor()

    // O badge do inbox ficou fora do prefetch na Secao 5, e por isso era a
    // UNICA requisicao que a Biblioteca disparava do navegador no primeiro
    // carregamento — foi ela que o load_ms quebrado da Secao 7 cronometrava.
    // `useInboxCount` tem `select`, entao o que se prefetcha e a resposta CRUA,
    // e o query tem de ser identico ao de `contarInbox` (features/library/api.ts):
    // divergir nao da erro, so faz o prefetch virar custo puro.
    //
    // Os dois em Promise.all, nao em sequencia: sao chamadas independentes, e em
    // serie elas somariam latencia dentro do <Suspense> — o oposto do que a
    // ADR 0009 buscava.
    await Promise.all([
        tentarPrefetch((signal) =>
            queryClient.prefetchQuery({
                queryKey: queryKeys.products.list(filtros),
                queryFn: () =>
                    apiServer<ProductsResponse>("/api/products", {
                        signal,
                        query: queryDeProdutos(filtros),
                    }),
            }),
        ),
        tentarPrefetch((signal) =>
            queryClient.prefetchQuery({
                queryKey: queryKeys.products.inboxCount(),
                queryFn: () =>
                    apiServer<ProductsResponse>("/api/products", {
                        signal,
                        query: { page: 1, size: 1, state: "CAPTURED" },
                    }),
            }),
        ),
    ])

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <LibraryContent />
        </HydrationBoundary>
    )
}
