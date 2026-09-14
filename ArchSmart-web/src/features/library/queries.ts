import { queryOptions } from "@tanstack/react-query"

import type { ClienteApi } from "@/lib/api/core"
import { cachePolicy, queryKeys, type FiltrosDeProduto } from "@/lib/query/keys"

import { queryDeProdutos, queryDoInbox } from "./api"
import type { ProductsResponse } from "./types"

/**
 * As queries que a Biblioteca prefetcha, definidas UMA vez.
 *
 * O servidor (`LibraryData`) chama com `apiServer`, o cliente (`hooks.ts`) com
 * `api`. Chave, `queryFn` e politica de cache saem daqui para os dois lados —
 * divergir deixa de ser possivel de escrever. Ate a Secao 8 os dois lados
 * montavam cada chave a mao, e o piloto errou isso uma vez: o prefetch vira
 * custo puro sem erro nenhum.
 *
 * Este arquivo NAO importa `@/lib/api/client` (que e "use client"): quem
 * escolhe o cliente e quem chama. `select`, `enabled` e `placeholderData` ficam
 * no hook — o que se prefetcha e a resposta crua.
 */
export const queryDaListaDeProdutos = (cliente: ClienteApi, filtros: FiltrosDeProduto) =>
    queryOptions({
        queryKey: queryKeys.products.list(filtros),
        queryFn: ({ signal }) =>
            cliente<ProductsResponse>("/api/products/", { signal, query: queryDeProdutos(filtros) }),
        ...cachePolicy.transacional,
    })

export const queryDoBadgeDoInbox = (cliente: ClienteApi) =>
    queryOptions({
        queryKey: queryKeys.products.inboxCount(),
        queryFn: ({ signal }) =>
            cliente<ProductsResponse>("/api/products/", { signal, query: queryDoInbox() }),
        ...cachePolicy.transacional,
    })
