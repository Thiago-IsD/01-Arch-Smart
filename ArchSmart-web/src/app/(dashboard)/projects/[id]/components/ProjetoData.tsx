import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { notFound } from "next/navigation"

import { apiServer } from "@/lib/api/server"
import { ApiError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/query/keys"
import { clienteComSinal, criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { queryDoProjeto, queryDosAmbientes } from "@/features/projects/queries"

import { ProjetoContent } from "./ProjetoContent"

/**
 * Projeto e ambientes em paralelo — o page.tsx antigo fazia os dois `fetch` em
 * sequencia.
 *
 * 404 da API vira `notFound()`: projeto de outra conta tambem responde 404
 * (ScopedRepository.obter, nunca 403), e a rota nao pode mostrar skeleton nem
 * "erro, tente de novo" para um id que nao existe para quem pergunta. Chamado
 * DENTRO do <Suspense>, entao a resposta sai 200 com a UI de nao encontrado
 * (nota revisada da spec de Projetos, "Detalhe").
 *
 * `dehydrate` so leva query com sucesso: um erro que nao seja 404 nao desce,
 * e o cliente busca de novo — o mesmo caminho de quando o prefetch desiste.
 */
export async function ProjetoData({ id }: { id: string }) {
    const queryClient = criarQueryClientDoServidor()

    await tentarPrefetch(queryClient, (signal) => {
        const cliente = clienteComSinal(apiServer, signal)
        return Promise.all([
            queryClient.prefetchQuery(queryDoProjeto(cliente, id)),
            queryClient.prefetchQuery(queryDosAmbientes(cliente, id)),
        ])
    })

    const erro = queryClient.getQueryState(queryKeys.projects.detail(id))?.error
    if (erro instanceof ApiError && erro.status === 404) notFound()

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ProjetoContent id={id} />
        </HydrationBoundary>
    )
}
