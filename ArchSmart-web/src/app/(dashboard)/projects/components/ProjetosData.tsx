import { HydrationBoundary, dehydrate } from "@tanstack/react-query"

import { apiServer } from "@/lib/api/server"
import { clienteComSinal, criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { queryDaListaDeProjetos } from "@/features/projects/queries"
import type { Me } from "@/features/account/types"

import { ProjetosContent } from "./ProjetosContent"

/**
 * Busca no servidor e entrega hidratado, dentro do <Suspense> de page.tsx.
 *
 * EXCECAO ESCRITA (decisao 2 da spec de Projetos): `/api/users/me` e chamado
 * por `apiServer` direto, fora das fabricas, e NAO e hidratado — so o
 * `project_limit` desce, como prop. Vale so para `/me` e so ate uma tela criar
 * `features/account/queries.ts`. Orcamento e Financeiro nao estao cobertos.
 *
 * As duas correm em paralelo: a API hiberna no free tier do Render (41,9 s num
 * cold start, ADR 0009), e um segundo await sequencial dobraria a exposicao.
 */
export async function ProjetosData() {
    const queryClient = criarQueryClientDoServidor()

    const [, me] = await Promise.all([
        tentarPrefetch(queryClient, (signal) =>
            queryClient.prefetchQuery(queryDaListaDeProjetos(clienteComSinal(apiServer, signal))),
        ),
        apiServer<Me>("/api/users/me").catch(() => undefined),
    ])

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ProjetosContent planLimit={me?.entitlements?.project_limit} />
        </HydrationBoundary>
    )
}
