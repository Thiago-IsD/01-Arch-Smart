"use client"

import React, { createContext, useContext, useState } from "react"

// Types
export type Environment = {
    id: string
    name: string
    type?: string
}

export type ItemOption = {
    id: string
    budget_item_id: string
    product_id: string
    is_selected: boolean
    product: any // We'll refine this later with full Product type
}

export type BudgetItem = {
    id: string
    budget_id: string
    environment_id: string | null
    rule_type: string
    manual_quantity: number | null
    options: ItemOption[]
}

export type BudgetTree = {
    id: string
    project_id: string
    total_value: number
    items: BudgetItem[]
}

// Context Definition
type BudgetContextType = {
    projectId: string
    budgetTree: BudgetTree
    environments: Environment[]
    selectedEnvironmentId: string | null
    setSelectedEnvironmentId: (id: string | null) => void
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined)

export function BudgetProvider({
    children,
    projectId,
    initialBudgetTree,
    initialEnvironments
}: {
    children: React.ReactNode
    projectId: string
    initialBudgetTree: BudgetTree
    initialEnvironments: Environment[]
}) {
    const [budgetTree] = useState<BudgetTree>(initialBudgetTree)
    const [environments] = useState<Environment[]>(initialEnvironments)
    const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(
        initialEnvironments.length > 0 ? initialEnvironments[0].id : null
    )

    return (
        <BudgetContext.Provider value={{
            projectId,
            budgetTree,
            environments,
            selectedEnvironmentId,
            setSelectedEnvironmentId
        }}>
            {children}
        </BudgetContext.Provider>
    )
}

export function useBudget() {
    const context = useContext(BudgetContext)
    if (context === undefined) {
        throw new Error("useBudget must be used within a BudgetProvider")
    }
    return context
}
