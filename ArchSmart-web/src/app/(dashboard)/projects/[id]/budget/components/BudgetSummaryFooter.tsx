"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useBudget } from "./BudgetProvider"

export function BudgetSummaryFooter() {
    const { projectId, selectedEnvironmentId } = useBudget()
    const [summary, setSummary] = useState<{ total_project: number, total_by_environment: Record<string, number> } | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // A hacky but functional way to listen to global updates from MainBudgetArea revalidation
    useEffect(() => {
        const fetchSummary = async () => {
            if (!projectId) return;

            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token || ""
                const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

                // Since budget logic is tied 1:1 to project.id for simplicity/speed in our current implementation,
                // we'll hit the project's budget summary endpoint as drafted in the backend router.
                // Notice the backend actually wants `budget_id` but the router allows us to find budget from project
                // Wait, examining the backend router, `GET /budgets/{budget_id}/summary` literally needs the budget.id UUID.
                // It doesn't find it by project. We need `GET /projects/{id}/budget` first or we need to extract budgetId.

                // Let's call GET /projects/{id}/budget to get the budget ID, then fetch summary.
                const budgetRes = await fetch(`${apiBase}/api/projects/${projectId}/budget`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (!budgetRes.ok) throw new Error("Could not find budget")
                const budgetData = await budgetRes.json()
                const budgetId = budgetData.id

                const res = await fetch(`${apiBase}/api/budgets/${budgetId}/summary`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json()
                    setSummary(data)
                }
            } catch (e) {
                console.error("Failed to load budget summary", e)
            } finally {
                setIsLoading(false)
            }
        }

        fetchSummary()

        // Setup a rough custom event listener to re-fetch when MainBudgetArea signals an update
        const handleBudgetUpdate = () => fetchSummary()
        window.addEventListener('archsmart:budget_updated', handleBudgetUpdate)

        return () => window.removeEventListener('archsmart:budget_updated', handleBudgetUpdate)
    }, [projectId])

    if (!summary) return null

    const currentEnvTotal = selectedEnvironmentId && summary.total_by_environment[selectedEnvironmentId]
        ? summary.total_by_environment[selectedEnvironmentId]
        : 0

    return (
        <div className="bg-muted/30 border-t p-4 transition-all duration-300">
            <div className="w-full flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total do Ambiente</span>
                    <span className="text-xl font-bold text-foreground">
                        R$ {currentEnvTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>

                <div className="flex flex-col text-right">
                    <span className="text-sm font-medium text-primary uppercase tracking-wider flex items-center justify-end gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        Total Global do Projeto
                    </span>
                    <span className="text-2xl font-black text-primary">
                        R$ {summary.total_project.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        </div>
    )
}
