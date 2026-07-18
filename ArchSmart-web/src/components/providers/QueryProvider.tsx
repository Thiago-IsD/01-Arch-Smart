"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * Provider do React Query.
 *
 * Fica no layout do dashboard para que o QueryClient (e portanto o cache)
 * sobreviva às navegações entre telas — trocar de aba/tela e voltar serve
 * dados do cache instantaneamente e revalida em background.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [client] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Dentro desse tempo os dados são considerados "frescos"
                        // e não há refetch ao revisitar — troca de aba instantânea.
                        staleTime: 30_000,
                        // Mantém o cache em memória por 5 min após ficar sem uso.
                        gcTime: 5 * 60_000,
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                },
            })
    )

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
