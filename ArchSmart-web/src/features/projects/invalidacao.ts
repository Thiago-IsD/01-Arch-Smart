import type { QueryClient, QueryKey } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query/keys"

/**
 * O que cada mutacao de Projetos faz com o cache — declarado, nao espalhado.
 *
 * `invalidar`: marca obsoleto e rebusca o que estiver montado.
 * `descartar`: marca obsoleto SEM rebuscar (`refetchType: "none"`). Existe para
 * excluir projeto: o detalhe ainda esta montado no instante do sucesso, e
 * rebusca-lo daria 404 e piscaria o estado de erro durante a navegacao.
 *
 * `dashboard.all` entra em toda mutacao que muda projeto: o Dashboard mostra
 * projetos recentes e o contador de ativos (item 7 do bloco do Dashboard).
 * Ambiente nao entra: o Dashboard nao mostra ambiente nem contagem de ambiente.
 *
 * O teste (`projects-mutacoes.test.tsx`) afirma o CONJUNTO EXATO por mutacao.
 */
export interface EfeitoNoCache {
    invalidar: QueryKey[]
    descartar: QueryKey[]
}

export const efeitos = {
    criarProjeto: (): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.lists(), queryKeys.dashboard.all],
        descartar: [],
    }),
    editarProjeto: (id: string): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.lists(), queryKeys.projects.detail(id), queryKeys.dashboard.all],
        descartar: [],
    }),
    excluirProjeto: (id: string): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.lists(), queryKeys.dashboard.all],
        descartar: [queryKeys.projects.detail(id), queryKeys.projects.environments(id)],
    }),
    /** Criar e excluir ambiente: a lista mostra `environments_count` no card. */
    mudarAmbientes: (projectId: string): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.environments(projectId), queryKeys.projects.lists()],
        descartar: [],
    }),
    salvarDna: (projectId: string): EfeitoNoCache => ({
        invalidar: [queryKeys.projects.environments(projectId)],
        descartar: [],
    }),
}

export async function aplicarEfeito(queryClient: QueryClient, efeito: EfeitoNoCache): Promise<void> {
    await Promise.all([
        ...efeito.descartar.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" }),
        ),
        ...efeito.invalidar.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ])
}
