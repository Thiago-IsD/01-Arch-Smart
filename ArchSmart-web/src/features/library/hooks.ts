"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys, cachePolicy, type FiltrosDeProduto } from "@/lib/query/keys"
import {
    aprovarEmLote, aprovarProduto, atualizarProduto, contarInbox, criarProduto, excluirProduto,
    listarAmbientes, listarProdutos, listarProjetos, moverParaProjeto, obterProduto,
    type PayloadDeProduto,
} from "./api"
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
        // Sem isso herda os 3 retries padrao do React Query. `fetchProduct`
        // (o codigo que este hook substituiu) voltava `null` num nao-ok e
        // falhava uma vez so — um 404 em `?action=edit&id=<sumido>` custava 1
        // requisicao, nao 4.
        retry: false,
        ...cachePolicy.transacional,
    })
}

export { RESPOSTA_VAZIA }

/**
 * Toda mutacao de produto invalida `queryKeys.products.all` — UMA chamada que
 * alcanca lista, detalhe e badge do inbox, porque as chaves sao hierarquicas.
 *
 * Antes desta secao, tres das quatro mutacoes chamavam `router.refresh()`,
 * que revalida Server Component e nao toca no QueryClient de onde a grade le.
 */
function useInvalidarProdutos() {
    const queryClient = useQueryClient()
    return () => queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
}

export function useCreateProduct() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: (payload: PayloadDeProduto) => criarProduto(payload),
        onSuccess: invalidar,
    })
}

export function useUpdateProduct() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: PayloadDeProduto }) =>
            atualizarProduto(id, payload),
        onSuccess: invalidar,
    })
}

export function useDeleteProduct() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: (id: string) => excluirProduto(id),
        onSuccess: invalidar,
    })
}

export function useApproveProduct() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: PayloadDeProduto }) =>
            aprovarProduto(id, payload),
        onSuccess: invalidar,
    })
}

export function useBatchApprove() {
    const invalidar = useInvalidarProdutos()
    return useMutation({
        mutationFn: (payload: { items: unknown[] }) => aprovarEmLote(payload),
        onSuccess: invalidar,
    })
}

/** Invalida `projects`, nao `products`: o produto nao mudou; o orcamento sim. */
export function useMoveToProject() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: moverParaProjeto,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
    })
}

export function useProjetosParaMover(ativo: boolean) {
    return useQuery({
        queryKey: queryKeys.projects.list(1, 100),
        queryFn: ({ signal }) => listarProjetos(signal),
        enabled: ativo,
        select: (r) => r.items ?? [],
        ...cachePolicy.transacional,
    })
}

export function useAmbientesDoProjeto(projectId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.projects.environments(projectId ?? ""),
        queryFn: ({ signal }) => listarAmbientes(projectId as string, signal),
        enabled: !!projectId,
        ...cachePolicy.transacional,
    })
}
