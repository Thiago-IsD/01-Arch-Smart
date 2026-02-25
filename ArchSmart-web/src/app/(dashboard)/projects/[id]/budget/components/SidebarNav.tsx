"use client"

import { useBudget } from "./BudgetProvider"
import { Button } from "@/components/ui/button"
import { LayoutGrid } from "lucide-react"

export function SidebarNav() {
    const { environments, selectedEnvironmentId, setSelectedEnvironmentId } = useBudget()

    if (environments.length === 0) {
        return (
            <div className="text-sm text-muted-foreground p-4 text-center">
                Você ainda não adicionou ambientes para este projeto.
            </div>
        )
    }

    return (
        <nav className="flex flex-col space-y-1">
            {environments.map((env) => {
                const isActive = selectedEnvironmentId === env.id

                return (
                    <Button
                        key={env.id}
                        variant={isActive ? "secondary" : "ghost"}
                        className={`justify-start ${isActive ? "font-medium" : "font-normal"}`}
                        onClick={() => setSelectedEnvironmentId(env.id)}
                    >
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        <span className="truncate">{env.name}</span>
                        {/* Podemos adicionar um Badge no futuro de itens preenchidos aqui */}
                    </Button>
                )
            })}
        </nav>
    )
}
