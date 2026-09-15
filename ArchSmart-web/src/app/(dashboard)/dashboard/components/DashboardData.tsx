import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { apiServer } from "@/lib/api/server"
import { clienteComSinal, criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { queryDoDashboard } from "@/features/dashboard/queries"

import { DashboardContent } from "./DashboardContent"

/**
 * Busca no servidor e entrega hidratado, dentro do <Suspense> de page.tsx —
 * o desenho da ADR 0009. Uma query so: o card de limite le `plan_limit` da
 * propria resposta (decisao 5 da spec do Dashboard), entao nao ha `useMe` a
 * prefetchar.
 */
export async function DashboardData() {
    const queryClient = criarQueryClientDoServidor()

    await tentarPrefetch((signal) =>
        queryClient.prefetchQuery(queryDoDashboard(clienteComSinal(apiServer, signal))),
    )

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <DashboardContent />
        </HydrationBoundary>
    )
}
