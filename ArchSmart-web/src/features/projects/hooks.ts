"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api/client"

import {
    criarAmbiente,
    criarProjeto,
    editarProjeto,
    excluirAmbiente,
    excluirProjeto,
    mudarStatusDoProjeto,
    salvarDna,
    type AreasDoDna,
    type CorpoDeAmbiente,
    type DadosDoProjeto,
} from "./api"
import { aplicarEfeito, efeitos } from "./invalidacao"
import { queryDaListaDeProjetos, queryDoProjeto, queryDosAmbientes } from "./queries"

export function useListaDeProjetos() {
    return useQuery(queryDaListaDeProjetos(api))
}

export function useProjeto(id: string) {
    return useQuery(queryDoProjeto(api, id))
}

export function useAmbientes(projectId: string) {
    return useQuery(queryDosAmbientes(api, projectId))
}

/**
 * Usados pelo `MoveToProjectModal` da Biblioteca. Moravam em
 * `features/library/hooks.ts` ate `features/projects` existir (nota da Secao 5
 * no PROGRESS.md). A chave `projects.list(1, 100)` e a mesma de antes.
 */
export function useProjetosParaMover(ativo: boolean) {
    return useQuery({
        ...queryDaListaDeProjetos(api, { page: 1, size: 100 }),
        enabled: ativo,
        // `?? []` cobre tanto `undefined` quanto `items: null` vindo da API.
        // O destructuring com default (`= []`) do consumidor so cobre
        // `undefined` — sem isto, `items: null` chegaria como `null` e
        // `projects.map(...)` quebraria no MoveToProjectModal.
        select: (pagina) => pagina.items ?? [],
    })
}

export function useAmbientesDoProjeto(projectId: string | undefined) {
    return useQuery({
        ...queryDosAmbientes(api, projectId ?? ""),
        enabled: !!projectId,
    })
}

/**
 * Mutacoes de projeto. Quem chama continua fazendo `router.refresh()` depois do
 * sucesso — nao por causa desta tela, mas porque Orcamento e Apresentacoes
 * renderizam `ProjectHeader` com dado do SERVIDOR (nota revisada da spec de
 * Projetos, "Mutacoes"). O refresh sai quando essas duas telas migrarem.
 */
export function useCriarProjeto() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (dados: DadosDoProjeto) => criarProjeto(dados),
        onSuccess: () => aplicarEfeito(queryClient, efeitos.criarProjeto()),
    })
}

export function useEditarProjeto() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, dados }: { id: string; dados: Partial<DadosDoProjeto> }) => editarProjeto(id, dados),
        onSuccess: (_projeto, { id }) => aplicarEfeito(queryClient, efeitos.editarProjeto(id)),
    })
}

export function useMudarStatusDoProjeto() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => mudarStatusDoProjeto(id, status),
        onSuccess: (_projeto, { id }) => aplicarEfeito(queryClient, efeitos.editarProjeto(id)),
    })
}

export function useExcluirProjeto() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => excluirProjeto(id),
        onSuccess: (_vazio, id) => aplicarEfeito(queryClient, efeitos.excluirProjeto(id)),
    })
}

/** Ambientes: sem `router.refresh()` — nenhuma tela de servidor le a lista de ambientes. */
export function useCriarAmbiente(projectId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (corpo: CorpoDeAmbiente) => criarAmbiente(projectId, corpo),
        onSuccess: () => aplicarEfeito(queryClient, efeitos.mudarAmbientes(projectId)),
    })
}

export function useExcluirAmbiente(projectId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (envId: string) => excluirAmbiente(envId),
        onSuccess: () => aplicarEfeito(queryClient, efeitos.mudarAmbientes(projectId)),
    })
}

export function useSalvarDna(projectId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ envId, areas }: { envId: string; areas: AreasDoDna }) => salvarDna(envId, areas),
        onSuccess: () => aplicarEfeito(queryClient, efeitos.salvarDna(projectId)),
    })
}
