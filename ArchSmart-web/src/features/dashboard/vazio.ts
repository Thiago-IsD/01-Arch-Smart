import type { DashboardLean } from "./types"

/**
 * "Dashboard vazio" e conta sem nada ainda — decisao 3 da spec do Dashboard.
 *
 * Zero projetos ativos, zero capturas, zero compromissos E zero lancamentos: o
 * estado de conta recem-criada, que e o que interessa medir para onboarding.
 * Conta so com financeiro NAO e vazia.
 *
 * `financial_entries_count`, e nao as somas: lancamentos que se anulam somam
 * zero, e deduzir "sem lancamentos" de "saldo zero" mentiria justamente ai.
 *
 * Isto decide o `is_empty` da telemetria, nao o que a tela mostra: vazio e com
 * dados renderizam a mesma pagina (as colunas ja tem mensagem de vazio propria).
 */
export function dashboardVazio(d: DashboardLean): boolean {
    return (
        d.active_projects_count === 0 &&
        d.recent_products.length === 0 &&
        d.upcoming_events.length === 0 &&
        d.financial_entries_count === 0
    )
}
