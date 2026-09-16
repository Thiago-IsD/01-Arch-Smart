import { queryOptions } from "@tanstack/react-query"

import type { ClienteApi } from "@/lib/api/core"
import { cachePolicy, queryKeys } from "@/lib/query/keys"

import type { Ambiente, PaginaDeProjetos, Projeto } from "./types"

/**
 * As queries de Projetos, definidas UMA vez. O servidor chama com `apiServer`,
 * o hook com `api`. Ver `features/library/queries.ts` para o porque.
 *
 * NAO importa `@/lib/api/client` ("use client"): quem escolhe o cliente e quem
 * chama. `enabled` e `select` ficam nos hooks.
 */
export const PAGINA_PADRAO = { page: 1, size: 20 } as const

export interface Pagina {
    page: number
    size: number
}

export const queryDaListaDeProjetos = (cliente: ClienteApi, pagina: Pagina = PAGINA_PADRAO) =>
    queryOptions({
        queryKey: queryKeys.projects.list(pagina.page, pagina.size),
        queryFn: ({ signal }) =>
            cliente<PaginaDeProjetos>("/api/projects", {
                signal,
                query: { page: pagina.page, size: pagina.size },
            }),
        ...cachePolicy.transacional,
    })

export const queryDoProjeto = (cliente: ClienteApi, id: string) =>
    queryOptions({
        queryKey: queryKeys.projects.detail(id),
        queryFn: ({ signal }) => cliente<Projeto>(`/api/projects/${id}`, { signal }),
        // Um 404 nao melhora tentando de novo; os 3 retries padrao custariam
        // 3 idas a mais a 0,17 s cada na API implantada.
        retry: false,
        ...cachePolicy.transacional,
    })

export const queryDosAmbientes = (cliente: ClienteApi, projectId: string) =>
    queryOptions({
        queryKey: queryKeys.projects.environments(projectId),
        queryFn: ({ signal }) => cliente<Ambiente[]>(`/api/projects/${projectId}/environments`, { signal }),
        ...cachePolicy.transacional,
    })
