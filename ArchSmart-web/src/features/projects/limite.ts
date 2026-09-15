/**
 * O estado do limite de projetos, calculado num lugar so.
 *
 * A lista de Projetos e o `ProjectsLimitCard` do Dashboard mostram a mesma
 * barra; ate aqui cada um fazia a conta, e o card dividia por `planLimit` sem
 * guarda — limite 0 dava NaN (item 9 do bloco do Dashboard no CLAUDE.md).
 *
 * Limite 0 e "no limite": o plano nao admite projeto ativo. Nao existe
 * sentinela de "ilimitado" nos entitlements (app/services/entitlements.py,
 * PADRAO com project_limit 2, lido em 15/09/2026); se um dia existir, e aqui
 * que ele entra.
 */
export interface EstadoDoLimite {
    noLimite: boolean
    /** Entre 0 e 1, para a largura da barra. */
    fracao: number
    livres: number
}

export function estadoDoLimite(ativos: number, limite: number): EstadoDoLimite {
    if (limite <= 0) return { noLimite: true, fracao: 1, livres: 0 }
    return {
        noLimite: ativos >= limite,
        fracao: Math.min(ativos / limite, 1),
        livres: Math.max(limite - ativos, 0),
    }
}
