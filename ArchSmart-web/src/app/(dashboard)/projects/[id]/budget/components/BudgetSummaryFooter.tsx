"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useBudget } from "./BudgetProvider"
import { apiUrl } from "@/lib/api-url"

export function BudgetSummaryFooter() {
    const { projectId, selectedEnvironmentId } = useBudget()
    const [summary, setSummary] = useState<{ total_project: number, total_by_environment: Record<string, number> } | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // A hacky but functional way to listen to global updates from MainBudgetArea revalidation
    useEffect(() => {
        const fetchSummary = async () => {
            if (!projectId) return;
            setIsLoading(true);

            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token || ""
                const res = await fetch(apiUrl(`/api/projects/${projectId}/budget`), {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (!res.ok) throw new Error("Could not find budget")
                const budgetData = await res.json()
                const budgetId = budgetData.id

                const summaryRes = await fetch(apiUrl(`/api/budgets/${budgetId}/summary`), {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (summaryRes.ok) {
                    const data = await summaryRes.json()
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

    if (!summary && !isLoading) return null

    const currentEnvTotal = selectedEnvironmentId && summary?.total_by_environment[selectedEnvironmentId]
        ? summary.total_by_environment[selectedEnvironmentId]
        : 0

    return (
        <div className="bg-muted/30 border-t p-4 transition-all duration-300">
            <div className="w-full flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total do Ambiente</span>
                    {isLoading ? (
                        <div className="h-7 w-32 bg-muted animate-pulse rounded mt-1" />
                    ) : (
                        <span className="text-xl font-bold text-foreground">
                            R$ {currentEnvTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    )}
                </div>

                <div className="flex flex-col text-right">
                    <span className="text-sm font-medium text-primary uppercase tracking-wider flex items-center justify-end gap-2">
                        {!isLoading && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                        Total Global do Projeto
                    </span>
                    {isLoading ? (
                        <div className="h-8 w-40 bg-primary/20 animate-pulse rounded mt-1 ml-auto" />
                    ) : (
                        <span className="text-2xl font-black text-primary">
                            R$ {summary?.total_project.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
