"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// ---------------------------------------------------------------------------
// Card "Projetos Ativos" — separado para nao renderizar limite nenhum
// enquanto `entitlements` (Art. 3) nao chegou.
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
                <Badge variant="secondary" className="text-[10px] font-semibold bg-secondary/10 text-secondary border-secondary/20">
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

export function ProjectsLimitCardSkeleton() {
    return (
        <Card className="bg-card shadow-sm relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-40" />
            </CardContent>
        </Card>
    )
}
