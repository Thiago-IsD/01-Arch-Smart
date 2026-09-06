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

export interface PayloadDeProduto {
    name: string
    store?: string | null
    price?: number | null
    category?: string | null
    image_url?: string | null
    dimensions?: { width?: number | null; height?: number | null; depth?: number | null; unit: string } | null
    yield_factor?: number | null
}

export function criarProduto(payload: PayloadDeProduto): Promise<Product> {
    return api<Product>("/api/products/", { method: "POST", body: payload })
}

export function atualizarProduto(id: string, payload: PayloadDeProduto): Promise<Product> {
    return api<Product>(`/api/products/${id}`, { method: "PUT", body: payload })
}

/**
 * Soft delete (o backend move para o estado INACTIVE).
 *
 * Antes da Secao 5 esta chamada ia sem `Authorization` — o header e
 * obrigatorio em `get_context`, entao ela respondia 422 e a exclusao nunca
 * funcionou. Passando por `api()`, esquecer o header deixa de ser possivel.
 */
export function excluirProduto(id: string): Promise<void> {
    return api<void>(`/api/products/${id}`, {
        method: "DELETE",
        fallbackDeErro: "Não foi possível excluir o produto.",
    })
}

export function aprovarProduto(id: string, payload: PayloadDeProduto): Promise<Product> {
    return api<Product>(`/api/products/${id}/approve`, {
        method: "PATCH",
        body: payload,
        fallbackDeErro: "Falha ao aprovar produto.",
    })
}

export function aprovarEmLote(payload: { items: unknown[] }): Promise<{ approved?: string[] }> {
    return api<{ approved?: string[] }>("/api/products/batch-approve", {
        method: "PATCH",
        body: payload,
        fallbackDeErro: "Falha ao aprovar em lote.",
    })
}

export function moverParaProjeto(payload: {
    project_id: string
    environment_id: string
    product_id: string
    rule_type: string
}): Promise<unknown> {
    return api("/api/budgets/items", {
        method: "POST",
        body: payload,
        fallbackDeErro: "Não foi possível enviar para o orçamento.",
    })
}

export function listarProjetos(signal?: AbortSignal) {
    return api<{ items: { id: string; name: string }[] }>("/api/projects", {
        signal,
        // A chave de cache (`queryKeys.projects.list(1, 100)`) afirma essa
        // paginacao — sem mandar `page`/`size` de verdade, o servidor aplicava
        // o proprio default e a chave mentia sobre o que a resposta era.
        query: { page: 1, size: 100 },
    })
}

export function listarAmbientes(projectId: string, signal?: AbortSignal) {
    return api<{ id: string; name: string }[]>(`/api/projects/${projectId}/environments`, { signal })
}

/**
 * O inbox pode ter mais produtos do que a API aceita numa pagina (`size` tem
 * teto de 100, `le=100`). Pagina ate esgotar para trazer o inbox inteiro de
 * uma vez — o BatchNormalizeModal edita a planilha inteira, nao uma pagina.
 */
export async function listarInboxCompleto(signal?: AbortSignal): Promise<Product[]> {
    const size = 100
    let page = 1
    let totalPages = 1
    const items: Product[] = []
    do {
        const resposta = await listarProdutos({ tab: "inbox", page, size }, signal)
        items.push(...resposta.items)
        totalPages = resposta.pages || 1
        page++
    } while (page <= totalPages)
    return items
}
