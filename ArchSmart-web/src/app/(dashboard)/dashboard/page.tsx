"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api-url"
import { getAccessToken } from "@/lib/api/auth"
import { useEntitlements } from "@/features/account/hooks"

import { DashboardSkeleton } from "./components/DashboardSkeleton"
import { FinancialMetricCards } from "./components/FinancialMetricCards"
import { GreetingBanner } from "./components/GreetingBanner"
import { ProjectsLimitCard, ProjectsLimitCardSkeleton } from "./components/ProjectsLimitCard"
import { QuickActions } from "./components/QuickActions"
import { RecentProductsColumn } from "./components/RecentProductsColumn"
import { RecentProjectsColumn } from "./components/RecentProjectsColumn"
import { UpcomingEventsColumn } from "./components/UpcomingEventsColumn"
import type { DashboardLeanResponse } from "./components/types"

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
    const router = useRouter()
    const { toast } = useToast()

    const [data, setData] = useState<DashboardLeanResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState<string>("")
    const { entitlements } = useEntitlements()

    // Set client-side current date
    useEffect(() => {
        const formatted = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        setCurrentDate(formatted.replace(/^\w/, (c) => c.toUpperCase()))
    }, [])

    // Buscar dados do dashboard
    useEffect(() => {
        let isMounted = true

        async function fetchDashboard() {
            setLoading(true)
            try {
                const accessToken = await getAccessToken()

                if (!accessToken) {
                    router.push("/auth/login")
                    return
                }

                // Buscar dados do dashboard (que agora retorna métricas financeiras, eventos e contagem)
                const res = await fetch(apiUrl("/api/dashboard/lean"), {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`,
                    },
                })

                if (!res.ok) throw new Error("Erro ao carregar os dados do dashboard")

                const dashboardData: DashboardLeanResponse = await res.json()
                if (isMounted) {
                    setData(dashboardData)
                }

            } catch (err: any) {
                if (isMounted) {
                    toast({
                        title: "Erro",
                        description: err.message || "Não foi possível carregar a tela inicial.",
                        variant: "destructive",
                    })
                }
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchDashboard()

        return () => {
            isMounted = false
        }
    }, [router, toast])

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    if (loading) {
        return <DashboardSkeleton />
    }

    const userName = data?.user_first_name || "Usuário"
    const activeProjectsCount = data?.active_projects_count || 0

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8 w-full max-w-7xl mx-auto">

            {/* Header / Saudação Premium */}
            <GreetingBanner userName={userName} currentDate={currentDate} />

            {/* Grid de Métricas Principais (Linha 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                <FinancialMetricCards data={data} />

                {/* Metrica 4: Projetos Ativos Limit Solo */}
                {entitlements?.project_limit !== undefined ? (
                    <ProjectsLimitCard
                        activeProjectsCount={activeProjectsCount}
                        planLimit={entitlements.project_limit}
                    />
                ) : (
                    <ProjectsLimitCardSkeleton />
                )}
            </div>

            {/* Quick Actions (Ações Rápidas) */}
            <QuickActions />

            {/* Grid de Conteúdo Secundário (Projetos, Compromissos, Clipper) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Coluna 1: Projetos Recentes */}
                <RecentProjectsColumn data={data} />

                {/* Coluna 2: Próximos Compromissos (Agenda) */}
                <UpcomingEventsColumn data={data} />

                {/* Coluna 3: Últimas Capturas (Biblioteca) */}
                <RecentProductsColumn data={data} />

            </div>
        </div>
    )
}
