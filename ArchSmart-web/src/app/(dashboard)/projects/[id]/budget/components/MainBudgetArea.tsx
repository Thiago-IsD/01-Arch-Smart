"use client"

import { BudgetProvider, type BudgetTree, type Environment } from "./BudgetProvider"
import { SidebarNav } from "./SidebarNav"
import { ActiveBudgetWorkspace } from "./main-budget-area/ActiveBudgetWorkspace"

// Wraps the entire layout inside the Provider to keep state consistent across Server/Client boundary
export function MainBudgetArea({
    projectId,
    budgetTree,
    environments,
    projectName
}: {
    projectId: string
    budgetTree: BudgetTree
    environments: Environment[]
    projectName?: string
}) {
    return (
        <BudgetProvider
            projectId={projectId}
            initialBudgetTree={budgetTree}
            initialEnvironments={environments}
            projectName={projectName}
        >
            <div className="flex flex-col md:flex-row h-full w-full">
                {/* Sidebar com Lista de Ambientes e Provider Context Injetado */}
                <aside className="md:w-64 border-r bg-muted/20 flex-shrink-0 h-full overflow-y-auto">
                    <div className="sticky top-0 p-4 border-b bg-muted/10 z-10">
                        <h2 className="font-semibold tracking-tight">Ambientes</h2>
                        <p className="text-xs text-muted-foreground mt-1">Selecione para ver os itens</p>
                    </div>
                    <div className="p-2">
                        <SidebarNav />
                    </div>
                </aside>

                {/* Main Content Pane */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <ActiveBudgetWorkspace />
                </div>
            </div>
        </BudgetProvider>
    )
}
