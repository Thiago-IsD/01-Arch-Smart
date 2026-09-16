import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { apiServer } from "@/lib/api/server"
import type { FiltrosDeProduto } from "@/lib/query/keys"
import { clienteComSinal, criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"
import { queryDaListaDeProdutos, queryDoBadgeDoInbox } from "@/features/library/queries"
import { LibraryContent } from "./LibraryContent"

/**
 * Busca no servidor e entrega hidratado.
 *
 * Fica dentro de um <Suspense> em page.tsx: o shell da Biblioteca faz stream
 * na hora e este bloco chega quando ficar pronto. Ver ADR 0009 — a spec pedia
 * prefetch bloqueante, e o cold start medido de 41,9 s tornaria isso uma
 * regressao do pior caso.
 */
export async function LibraryData({ filtros }: { filtros: FiltrosDeProduto }) {
    const queryClient = criarQueryClientDoServidor()

    // O badge do inbox ficou fora do prefetch na Secao 5, e por isso era a
    // UNICA requisicao que a Biblioteca disparava do navegador no primeiro
    // carregamento — foi ela que o load_ms quebrado da Secao 7 cronometrava.
    // `useInboxCount` tem `select`, entao o que se prefetcha e a resposta CRUA.
    // Chave e payload dos dois vem das fabricas de `features/library/queries.ts`
    // — a MESMA fonte que os hooks (`useProducts`, `useInboxCount`) usam do lado
    // do cliente. Ate a Tarefa 1 da Secao 8 cada lado montava a chave a mao, e
    // divergir nao dava erro nenhum — so fazia o prefetch deixar de ser
    // aproveitado e virar custo puro.
    //
    // `clienteComSinal` embrulha `apiServer` para abortar tambem quando o teto
    // de `tentarPrefetch` abortar: a `queryFn` da fabrica recebe o `signal` do
    // React Query, nao o do teto, e sem o embrulho um cold start voltaria a
    // pendurar a conexao ate a API responder.
    //
    // UMA chamada de `tentarPrefetch`, com as duas queries em `Promise.all`
    // POR DENTRO — como `ProjetoData` ja fazia com projeto e ambientes. Ate a
    // rodada de correcao 1 da Tarefa 9 (15/09/2026) eram DUAS chamadas em
    // paralelo sobre o MESMO QueryClient: cada uma tirava o proprio snapshot
    // do cache, e se uma terminasse antes da outra, seu laco final encontrava
    // a query da irma ainda em voo e a acusava de ter desistido sem ter
    // desistido de nada (a irma so nao existia no snapshot de quem terminou
    // primeiro). Uma chamada so tambem da a Biblioteca o mesmo teto de tempo
    // UNICO que as outras tres telas migradas ja tem — antes eram dois tetos
    // independentes de `TIMEOUT_DO_PREFETCH_MS` correndo ao mesmo tempo.
    await tentarPrefetch(queryClient, (signal) => {
        const cliente = clienteComSinal(apiServer, signal)
        return Promise.all([
            queryClient.prefetchQuery(queryDaListaDeProdutos(cliente, filtros)),
            queryClient.prefetchQuery(queryDoBadgeDoInbox(cliente)),
        ])
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <LibraryContent />
        </HydrationBoundary>
    )
}
