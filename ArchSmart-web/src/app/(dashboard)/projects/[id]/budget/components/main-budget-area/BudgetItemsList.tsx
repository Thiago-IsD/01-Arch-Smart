"use client"

import type { BudgetItem } from "../BudgetProvider"
import { BudgetItemRow } from "./BudgetItemRow"

export function BudgetItemsList({ environmentId, items }: { environmentId: string, items: BudgetItem[] }) {
    // We need router refresh to re-pull the global get budget 
    const { useRouter } = require("next/navigation")
    const router = useRouter()

    const handleUpdate = () => {
        router.refresh()
        // Broadcast local signal so sticky footer re-calculates financials instantly
        window.dispatchEvent(new Event('archsmart:budget_updated'))
    }

    const envItems = items.filter(i => i.environment_id === environmentId)

    if (envItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <p className="text-sm">Nenhum produto atrelado a este ambiente ainda.</p>
                <p className="text-xs mt-1">Clique no botão Acima para importar da biblioteca.</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border bg-card">
            <div className="w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Produto / Material</th>
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Base Calc. (DNA)</th>
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-24">Perda</th>
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Qtd</th>
                            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Total</th>
                            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                        {envItems.map(item => (
                            <BudgetItemRow key={item.id} item={item} onUpdate={handleUpdate} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
