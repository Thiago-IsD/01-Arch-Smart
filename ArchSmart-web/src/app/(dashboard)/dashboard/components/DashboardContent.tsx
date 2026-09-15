"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { QueryBoundary } from "@/components/ui/query-boundary"
import { useDashboard } from "@/features/dashboard/hooks"
import { dashboardVazio } from "@/features/dashboard/vazio"
import type { DashboardLean } from "@/features/dashboard/types"

import { DashboardComErro } from "./DashboardComErro"
import { DashboardSkeleton } from "./DashboardSkeleton"
import { FinancialMetricCards } from "./FinancialMetricCards"
import { GreetingBanner } from "./GreetingBanner"
import { ProjectsLimitCard } from "./ProjectsLimitCard"
import { QuickActions } from "./QuickActions"
import { RecentProductsColumn } from "./RecentProductsColumn"
import { RecentProjectsColumn } from "./RecentProjectsColumn"
import { UpcomingEventsColumn } from "./UpcomingEventsColumn"

/**
 * A data da saudacao e calculada no NAVEGADOR, no efeito. Renderizada no
 * servidor ela usaria o fuso do Render e mostraria o dia errado a quem abre a
 * tela perto da meia-noite.
 */
function useDataDeHoje(): string {
    const [data, setData] = useState("")
    useEffect(() => {
        const formatada = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        setData(formatada.replace(/^\w/, (c) => c.toUpperCase()))
    }, [])
    return data
}

function Painel({ dados }: { dados: DashboardLean }) {
    const hoje = useDataDeHoje()

    return (
        <div data-testid="dashboard-painel" className="flex flex-col gap-8 p-4 md:p-8 w-full max-w-7xl mx-auto">
            <GreetingBanner userName={dados.user_first_name || "Usuário"} currentDate={hoje} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <FinancialMetricCards data={dados} />
                <ProjectsLimitCard
                    activeProjectsCount={dados.active_projects_count}
                    planLimit={dados.plan_limit}
                />
            </div>

            <QuickActions />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <RecentProjectsColumn data={dados} />
                <UpcomingEventsColumn data={dados} />
                <RecentProductsColumn data={dados} />
            </div>
        </div>
    )
}

/**
 * Uma requisicao, uma regiao, marcada `principal`.
 *
 * `empty` renderiza a MESMA pagina que os dados: as tres colunas ja tem vazio
 * proprio e a paridade e total. O que o vazio muda e o `is_empty` que a
 * telemetria grava — `dashboardVazio`, decisao 3 da spec.
 */
export function DashboardContent() {
    const query = useDashboard()

    return (
        <QueryBoundary
            query={query}
            principal
            isEmpty={dashboardVazio}
            skeleton={<DashboardSkeleton />}
            empty={query.data ? <Painel dados={query.data} /> : null}
            error={(erro, refazer) => <DashboardComErro erro={erro} refazer={refazer} />}
        >
            {(dados) => <Painel dados={dados} />}
        </QueryBoundary>
    )
}
