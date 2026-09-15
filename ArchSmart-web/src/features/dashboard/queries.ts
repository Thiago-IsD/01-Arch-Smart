import { queryOptions } from "@tanstack/react-query"

import type { ClienteApi } from "@/lib/api/core"
import { cachePolicy, queryKeys } from "@/lib/query/keys"

import type { DashboardLean } from "./types"

/**
 * A query do Dashboard, definida UMA vez: `DashboardData` (servidor) chama com
 * `apiServer`, `useDashboard` (cliente) com `api`. Ver
 * `features/library/queries.ts` para o porque do padrao.
 */
export const queryDoDashboard = (cliente: ClienteApi) =>
    queryOptions({
        queryKey: queryKeys.dashboard.lean(),
        queryFn: ({ signal }) => cliente<DashboardLean>("/api/dashboard/lean", { signal }),
        ...cachePolicy.transacional,
    })
