"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys, cachePolicy } from "@/lib/query/keys"
import { obterMe } from "./api"
import type { Entitlements } from "./types"

export function useMe() {
    return useQuery({
        queryKey: queryKeys.account.me(),
        queryFn: ({ signal }) => obterMe(signal),
        ...cachePolicy.conta,
    })
}

/**
 * A fonte unica de limite de plano no front (Art. 3).
 *
 * Devolve `undefined` enquanto carrega — de proposito. O padrao anterior era
 * `data?.plan_limit ?? 2`, que decidia no front um limite que so o servidor
 * conhece: uma conta com limite 10 via "2" por um instante, e uma falha da
 * chamada fazia o "2" ficar. Quem consome trata `undefined` como "ainda nao
 * sei" e nao renderiza numero nenhum, em vez de inventar um.
 */
export function useEntitlements(): { entitlements: Entitlements | undefined; isLoading: boolean } {
    const { data, isLoading } = useMe()
    return { entitlements: data?.entitlements, isLoading }
}
