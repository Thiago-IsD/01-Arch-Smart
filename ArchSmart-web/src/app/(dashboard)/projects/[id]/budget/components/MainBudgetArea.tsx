"use client"

import { BudgetProvider, useBudget, type BudgetTree, type Environment, type BudgetItem } from "./BudgetProvider"
import { SidebarNav } from "./SidebarNav"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

// Wraps the entire layout inside the Provider to keep state consistent across Server/Client boundary
export function MainBudgetArea({
    projectId,
    budgetTree,
    environments
}: {
    projectId: string
    budgetTree: BudgetTree
    environments: Environment[]
}) {
    return (
        <BudgetProvider
            projectId={projectId}
            initialBudgetTree={budgetTree}
            initialEnvironments={environments}
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

import { ProductPickerModal } from "./ProductPickerModal"
import { useState } from "react"

function ActiveBudgetWorkspace() {
    const { budgetTree, environments, selectedEnvironmentId } = useBudget()
    const [isPickerOpen, setIsPickerOpen] = useState(false)

    const activeEnv = environments.find(e => e.id === selectedEnvironmentId)

    if (!activeEnv) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/10">
                <div className="p-4 bg-muted/30 rounded-full mb-4">
                    <LayoutGridIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum ambiente selecionado</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Para começar a orçar, selecione um ambiente no painel ao lado ou retorne à aba "Ambientes" para criar seu primeiro espaço.
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full relative">
            {/* Header Toolbar */}
            <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-6">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">{activeEnv.name}</h2>
                    {activeEnv.type && <p className="text-xs text-muted-foreground">{activeEnv.type}</p>}
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={() => setIsPickerOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Produto
                    </Button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto p-6 bg-muted/5">
                <BudgetItemsList environmentId={activeEnv.id} items={budgetTree.items} />
            </main>

            <ProductPickerModal isOpen={isPickerOpen} onOpenChange={setIsPickerOpen} />
        </div>
    )
}

function BudgetItemsList({ environmentId, items }: { environmentId: string, items: BudgetItem[] }) {
    // Filter items that belong to the active environment
    const envItems = items.filter(i => i.environment_id === environmentId)

    if (envItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <p className="text-sm">Nenhum produto atrelado a este ambiente ainda.</p>
                <p className="text-xs mt-1">Clique no botão Acima para importar da biblioteca.</p>
            </div>
        )
    }

    const ruleTranslations: Record<string, string> = {
        FLOOR: "Área de Piso",
        WALL: "Área de Parede",
        CEILING: "Área de Teto",
        UNIT: "Unidade(s)"
    }

    return (
        <div className="space-y-4">
            {envItems.map(item => {
                const activeOption = item.options.find((o: any) => o.is_selected)
                const product = activeOption?.product

                return (
                    <div key={item.id} className="flex items-center justify-between p-4 border bg-background rounded-lg shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-muted rounded-md overflow-hidden border flex-shrink-0">
                                {product?.image_url ? (
                                    <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Img</div>
                                )}
                            </div>
                            <div>
                                <h4 className="font-medium text-sm">{product?.name || "Produto Desconhecido"}</h4>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <span className="bg-muted px-2 py-0.5 rounded-sm">
                                        {ruleTranslations[item.rule_type] || item.rule_type}
                                    </span>
                                    {item.rule_type === "UNIT" && (
                                        <span>• Qtd: {item.manual_quantity || 1}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold">
                                {product?.price ? `R$ ${product.price.toFixed(2)}` : "R$ 0,00"}
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function LayoutGridIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
    )
}
