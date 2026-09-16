"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api/client"

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
