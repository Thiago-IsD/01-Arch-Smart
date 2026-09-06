"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys, cachePolicy, type FiltrosDeProduto } from "@/lib/query/keys"
import { contarInbox, listarProdutos, obterProduto } from "./api"
import { RESPOSTA_VAZIA } from "./types"

/**
 * Hooks do dominio Biblioteca.
 *
 * O `signal` vem do proprio React Query: trocar de filtro ou sair da tela
 * cancela a requisicao em voo, em vez de deixa-la chegar e sobrescrever a
 * mais nova. Isso vale de graca aqui porque `api()` propaga AbortSignal.
 */
export function useProducts(filtros: FiltrosDeProduto, opcoes: { ativo?: boolean } = {}) {
    return useQuery({
        queryKey: queryKeys.products.list(filtros),
        queryFn: ({ signal }) => listarProdutos(filtros, signal),
        enabled: opcoes.ativo ?? true,
        // Mantem a lista anterior visivel enquanto a nova carrega: sem isso a
        // grade pisca em branco a cada pagina e a cada filtro.
        placeholderData: (anterior) => anterior,
        ...cachePolicy.transacional,
    })
}

export function useInboxCount() {
    return useQuery({
        queryKey: queryKeys.products.inboxCount(),
        queryFn: ({ signal }) => contarInbox(signal),
        select: (resposta) => resposta.total,
        ...cachePolicy.transacional,
    })
}

export function useProduct(id: string | undefined, ativo: boolean) {
    return useQuery({
        queryKey: queryKeys.products.detail(id ?? ""),
        queryFn: ({ signal }) => obterProduto(id as string, signal),
        enabled: !!id && ativo,
        ...cachePolicy.transacional,
    })
}

export { RESPOSTA_VAZIA }
