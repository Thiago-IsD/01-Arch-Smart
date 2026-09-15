"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// ---------------------------------------------------------------------------
// Card "Projetos Ativos" — separado por composicao, nao por espera de dado.
// `activeProjectsCount`/`planLimit` chegam prontos de `/api/dashboard/lean`
// (decisao 5 da spec do Dashboard): e a excecao a regra da Secao 5 de ler
// limite so por `useEntitlements()` -- ver "A excecao a regra da Secao 5" em
// docs/dev/modulos/dashboard.md. Nao ha estado de "entitlements ainda nao
// chegou" aqui: quem espera e o `QueryBoundary` da tela, antes deste card
// existir.
// ---------------------------------------------------------------------------

export function ProjectsLimitCard({
    activeProjectsCount,
    planLimit,
}: {
    activeProjectsCount: number
    planLimit: number
}) {
    const projectPercentage = Math.min((activeProjectsCount / planLimit) * 100, 100)

    return (
        <Card className="bg-card shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-secondary" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium text-muted-foreground">Projetos Ativos</span>
                <Badge variant="secondary" className="text-[10px] font-semibold bg-secondary/10 text-foreground border-secondary/20">
                    Plano Solo
                </Badge>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl font-bold tracking-tight">{activeProjectsCount}</span>
                    <span className="text-xs text-muted-foreground">limite de {planLimit}</span>
                </div>

                {/* Custom Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden mb-1.5">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            projectPercentage >= 100 ? 'bg-secondary' : 'bg-primary'
                        }`}
                        style={{ width: `${projectPercentage}%` }}
                    />
                </div>
                <p className="text-[11px] text-muted-foreground">
                    {projectPercentage >= 100 ? "Limite de projetos atingido" : `${planLimit - activeProjectsCount} espaço(s) livre(s)`}
                </p>
            </CardContent>
        </Card>
    )
}
