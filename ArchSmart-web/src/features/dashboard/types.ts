/** Formato de GET /api/dashboard/lean. */
export interface RecentProject {
    id: string
    name: string
    client_name?: string
}

export interface RecentProduct {
    id: string
    name: string
    image_url?: string
    price?: number
    store?: string
}

export interface UpcomingEvent {
    id: string
    title: string
    start_time: string
    end_time: string
    meet_link?: string
    project_name?: string
}

export interface DashboardLean {
    user_first_name: string
    recent_projects: RecentProject[]
    recent_products: RecentProduct[]
    active_projects_count: number
    /**
     * O limite de projetos do plano, decidido no servidor a partir dos
     * entitlements da sessao. A tela le daqui, e nao de `useEntitlements()`:
     * decisao 5 da spec do Dashboard, que abre uma excecao escrita a regra da
     * Secao 5 — "quando o endpoint da tela ja traz o entitlement, calculado dos
     * mesmos entitlements da sessao, a tela le de la". Art. 3 intacto.
     */
    plan_limit: number
    financial_balance: number
    financial_income: number
    financial_expense: number
    financial_entries_count: number
    upcoming_events: UpcomingEvent[]
}
