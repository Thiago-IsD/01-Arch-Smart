"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

import { useBudget } from "../BudgetProvider"
import { BudgetSummaryFooter } from "../BudgetSummaryFooter"
import { ProductPickerModal } from "../ProductPickerModal"
import { BudgetItemsList } from "./BudgetItemsList"
import { LayoutGridIcon } from "./LayoutGridIcon"
import { WhatsAppIcon } from "./WhatsAppIcon"

export function ActiveBudgetWorkspace() {
    const { budgetTree, environments, selectedEnvironmentId, projectName } = useBudget()
    const [isPickerOpen, setIsPickerOpen] = useState(false)

    const activeEnv = environments.find(e => e.id === selectedEnvironmentId)

    const handleExportWhatsApp = () => {
        let text = `*Orçamento${projectName ? ` - ${projectName}` : ''}*\n\n`

        environments.forEach((env) => {
            const envItems = (budgetTree.items || []).filter(item => item.environment_id === env.id)
            if (envItems.length === 0) return

            text += `*${env.name}*\n`
            envItems.forEach(item => {
                const activeOption = item.options.find((o: any) => o.is_selected) || item.options[0]
                if (!activeOption || !activeOption.product) return

                const product = activeOption.product
                const qty = item.rule_type === "UNIT" ? (item.manual_quantity || 1) : (item.calculated_quantity || 0)
                const price = product.price || 0
                const total = qty * price

                text += `- ${product.name}: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`
            })
            text += '\n'
        })

        const totalProject = (budgetTree.items || []).reduce((sum, item) => {
            const activeOption = item.options.find((o: any) => o.is_selected) || item.options[0]
            if (!activeOption || !activeOption.product) return sum
            const qty = item.rule_type === "UNIT" ? (item.manual_quantity || 1) : (item.calculated_quantity || 0)
            const price = activeOption.product.price || 0
            return sum + (qty * price)
        }, 0)

        text += `*Total Geral: R$ ${totalProject.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*`

        const encodedText = encodeURIComponent(text)
        window.open(`https://wa.me/?text=${encodedText}`, '_blank')
    }

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
                    <Button 
                        onClick={handleExportWhatsApp} 
                        className="bg-[#25D366] hover:bg-[#20BA56] text-white font-bold transition-all shadow-sm flex items-center"
                    >
                        <WhatsAppIcon className="w-4 h-4 mr-2" />
                        Exportar WhatsApp
                    </Button>
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

            <BudgetSummaryFooter />

            <ProductPickerModal isOpen={isPickerOpen} onOpenChange={setIsPickerOpen} />
        </div>
    )
}
