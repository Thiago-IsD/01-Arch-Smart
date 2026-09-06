import { api } from "@/lib/api/client"
import type { FiltrosDeProduto } from "@/lib/query/keys"
import type { Product, ProductsResponse } from "./types"

/**
 * Chamadas do dominio Biblioteca. Nenhuma monta header nem resolve sessao —
 * quem faz isso e `lib/api/client.ts`.
 *
 * O `state` do filtro nao vem da aba direto: a aba "inbox" mostra CAPTURED e
 * a "library" mostra NORMALIZED. Traduzir isso aqui, e nao na tela, e o que
 * impede a proxima tela de inventar outra traducao.
 */
export function stateDaAba(tab: string | undefined): "CAPTURED" | "NORMALIZED" {
    return tab === "inbox" ? "CAPTURED" : "NORMALIZED"
}

export function listarProdutos(
    filtros: FiltrosDeProduto,
    signal?: AbortSignal,
): Promise<ProductsResponse> {
    return api<ProductsResponse>("/api/products", {
        signal,
        query: {
            page: filtros.page,
            size: filtros.size,
            q: filtros.q,
            sort_by: filtros.sortBy,
            state: stateDaAba(filtros.tab),
            categories: filtros.categories,
            origins: filtros.origins,
        },
    })
}

export function contarInbox(signal?: AbortSignal): Promise<ProductsResponse> {
    return api<ProductsResponse>("/api/products", {
        signal,
        query: { page: 1, size: 1, state: "CAPTURED" },
    })
}

export function obterProduto(id: string, signal?: AbortSignal): Promise<Product> {
    return api<Product>(`/api/products/${id}`, { signal })
}
