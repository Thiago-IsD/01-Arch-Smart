import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { apiServer } from "@/lib/api/server"
import { queryKeys, type FiltrosDeProduto } from "@/lib/query/keys"
import { criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { stateDaAba } from "@/features/library/api"
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

    await tentarPrefetch(() =>
        queryClient.prefetchQuery({
            queryKey: queryKeys.products.list(filtros),
            queryFn: () =>
                apiServer<ProductsResponse>("/api/products", {
                    query: {
                        page: filtros.page,
                        size: filtros.size,
                        q: filtros.q,
                        sort_by: filtros.sortBy,
                        state: stateDaAba(filtros.tab),
                        categories: filtros.categories,
                        origins: filtros.origins,
                    },
                }),
        }),
    )

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <LibraryContent />
        </HydrationBoundary>
    )
}
