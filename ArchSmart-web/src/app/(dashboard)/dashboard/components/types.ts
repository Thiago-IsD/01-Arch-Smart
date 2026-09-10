/** Formato de GET /api/dashboard/lean, como a tela o consome. */
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

export interface DashboardLeanResponse {
    user_first_name: string
    recent_projects: RecentProject[]
    recent_products: RecentProduct[]
    active_projects_count: number
    financial_balance: number
    financial_income: number
    financial_expense: number
    upcoming_events: UpcomingEvent[]
}
