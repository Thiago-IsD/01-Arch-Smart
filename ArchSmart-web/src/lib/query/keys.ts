/**
 * Chaves de cache e politica por natureza do dado.
 *
 * HIERARQUIA, nao lista plana. O React Query invalida por PREFIXO: uma chave
 * `["products", ...]` e alcancada por `invalidateQueries({ queryKey: ["products"] })`.
 * Antes desta secao as chaves eram irmas planas — `["products"]` e
 * `["inbox-count"]` — e o BatchNormalizeModal precisava invalidar as duas a
 * mao (linhas 278-279). Quem esquecesse a segunda deixava o badge do inbox
 * mentindo, sem erro nenhum aparecer. Com a hierarquia, esse esquecimento
 * deixa de ser possivel de escrever.
 */

export interface FiltrosDeProduto {
    tab?: string
    q?: string
    categories?: string[]
    origins?: string[]
    sortBy?: string
    page: number
    size: number
}

export const queryKeys = {
    products: {
        all: ["products"] as const,
        lists: () => [...queryKeys.products.all, "list"] as const,
        list: (filtros: FiltrosDeProduto) => [...queryKeys.products.lists(), filtros] as const,
        details: () => [...queryKeys.products.all, "detail"] as const,
        detail: (id: string) => [...queryKeys.products.details(), id] as const,
        inboxCount: () => [...queryKeys.products.all, "inbox-count"] as const,
    },
    projects: {
        all: ["projects"] as const,
        lists: () => [...queryKeys.projects.all, "list"] as const,
        list: (page: number, size: number) => [...queryKeys.projects.lists(), { page, size }] as const,
        environments: (projectId: string) =>
            [...queryKeys.projects.all, projectId, "environments"] as const,
    },
    account: {
        all: ["account"] as const,
        me: () => [...queryKeys.account.all, "me"] as const,
    },
} as const

/**
 * Politica de cache por natureza do dado.
 *
 * `refetchOnWindowFocus: false` em todas: rebuscar por troca de aba foi
 * medido como custo sem beneficio nesta aplicacao — o usuario alterna entre a
 * ferramenta e o site do fornecedor o tempo todo.
 */
export const cachePolicy = {
    /** Catalogo, planos, categorias: muda por deploy, nao por uso. */
    referencia: {
        staleTime: 60 * 60_000,
        gcTime: 24 * 60 * 60_000,
        refetchOnWindowFocus: false,
    },
    /** Perfil e entitlements: muda quando o usuario troca de plano. */
    conta: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
    },
    /** Produtos, projetos, orcamento: o usuario edita e espera ver. */
    transacional: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
    },
} as const
