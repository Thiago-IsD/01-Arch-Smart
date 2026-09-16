/**
 * O que `/api/projects` e `/api/projects/{id}/environments` devolvem.
 * Espelha `ProjectResponse`/`PaginatedProjectResponse` (project_schema.py) e
 * `EnvironmentResponse` (environment_schema.py).
 */

export interface ClienteDoProjeto {
    id: string
    name: string
    email?: string | null
    phone?: string | null
}

export interface Projeto {
    id: string
    account_id: string
    client_id: string
    name: string
    /** A API tipa como string. Valores em uso: ACTIVE, COMPLETED, DRAFT. */
    status: string
    service_type?: string | null
    service_value?: number | null
    payment_installments?: number | null
    payment_method?: string | null
    created_at: string
    environments_count: number
    client?: ClienteDoProjeto | null
}

export interface PaginaDeProjetos {
    items: Projeto[]
    total: number
    page: number
    size: number
    pages: number
    plan_limit: number
    /** Ativos da conta INTEIRA, contados no servidor (Art. 3). Nao conte `items`. */
    active_count: number
}

export interface DnaDoAmbiente {
    id: string
    environment_id: string
    floor_area: number
    wall_area: number
    ceiling_area: number
    is_complete: boolean
}

export interface Ambiente {
    id: string
    project_id: string
    name: string
    type?: string | null
    created_at: string
    dna?: DnaDoAmbiente | null
}
