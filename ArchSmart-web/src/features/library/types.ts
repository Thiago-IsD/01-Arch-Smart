/**
 * Tipos do dominio Biblioteca.
 *
 * `state` e `origin` vem do catalogo global (tabelas sem `account_id`, ver
 * Secao 4) e chegam como objeto com `name`, nao como string.
 */
export interface Product {
    id: string
    name: string
    store?: string | null
    price?: number | null
    image_url?: string | null
    dimensions?: { width?: number | null; height?: number | null; depth?: number | null } | null
    yield_factor?: number | null
    state?: { name: string } | null
    origin?: { name: string } | null
}

export interface ProductsResponse {
    items: Product[]
    total: number
    page: number
    size: number
    pages: number
}

export const RESPOSTA_VAZIA: ProductsResponse = {
    items: [],
    total: 0,
    page: 1,
    size: 15,
    pages: 0,
}
