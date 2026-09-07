/**
 * `entitlements` e dicionario ABERTO de proposito: um entitlement novo no
 * backend nao deve exigir deploy casado do front. Por isso o tipo declara as
 * chaves que o front usa hoje e aceita o resto — nao ha lista fechada para
 * tipar contra. Ver ArchSmart-web/CLAUDE.md, "O que a Secao 4 mudou".
 */
export interface Entitlements {
    project_limit?: number
    can_use_ai?: boolean
    can_use_portal?: boolean
    [outro: string]: unknown
}

export interface Me {
    id: string
    full_name: string
    email: string
    avatar_url?: string | null
    role: string
    account: {
        id: string
        name: string
        subscription_status: string
        plan_name?: string
    }
    entitlements: Entitlements
}
