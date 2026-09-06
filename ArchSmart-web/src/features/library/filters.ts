import type { FiltrosDeProduto } from "@/lib/query/keys"

/**
 * A forma canonica dos filtros da Biblioteca, derivada da URL.
 *
 * UMA funcao, usada pelo Server Component e pelo client component, porque a
 * chave de cache montada em dois lugares diverge em silencio — e o modo de
 * falha e o prefetch da Tarefa 8 virar custo puro sem erro nenhum.
 *
 * Aceita as duas formas de parametro que o Next entrega: `URLSearchParams`
 * (de `useSearchParams`, no cliente) e o objeto simples de `searchParams`
 * (no servidor).
 */
export const FILTROS_PADRAO = {
    tab: "library",
    sortBy: "created_at_desc",
    page: 1,
    size: 15,
} as const

type ParamsDaUrl = URLSearchParams | Record<string, string | string[] | undefined>

function pegar(params: ParamsDaUrl, chave: string): string | undefined {
    if (params instanceof URLSearchParams) return params.get(chave) ?? undefined
    const valor = params[chave]
    return Array.isArray(valor) ? valor[0] : valor
}

function pegarTodos(params: ParamsDaUrl, chave: string): string[] {
    if (params instanceof URLSearchParams) return params.getAll(chave)
    const valor = params[chave]
    if (valor === undefined) return []
    return Array.isArray(valor) ? valor : [valor]
}

export function filtrosDaUrl(params: ParamsDaUrl): FiltrosDeProduto {
    return {
        tab: pegar(params, "tab") ?? FILTROS_PADRAO.tab,
        q: pegar(params, "q"),
        sortBy: pegar(params, "sort_by") ?? FILTROS_PADRAO.sortBy,
        page: Number(pegar(params, "page") ?? FILTROS_PADRAO.page),
        size: Number(pegar(params, "size") ?? FILTROS_PADRAO.size),
        categories: pegarTodos(params, "categories"),
        origins: pegarTodos(params, "origins"),
    }
}
