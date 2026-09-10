"use client"

import { AlertTriangle, Lock, Unlock } from "lucide-react"

import type { BudgetItem } from "../BudgetProvider"

interface BudgetItemQuantityCellProps {
    item: BudgetItem
    qty: number
    isOptionSwitching: boolean
    manualQuantity: string
    setManualQuantity: (valor: string) => void
    isQuantityUnlocked: boolean
    setIsQuantityUnlocked: (destravado: boolean) => void
    handleBlur: () => void
}

/** A coluna "Qtd": campo manual, cadeado de destravar e o alerta de rendimento. */
export function BudgetItemQuantityCell({
    item,
    qty,
    isOptionSwitching,
    manualQuantity,
    setManualQuantity,
    isQuantityUnlocked,
    setIsQuantityUnlocked,
    handleBlur,
}: BudgetItemQuantityCellProps) {
    return (
<td className="p-4 align-middle">
    {isOptionSwitching ? (
        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
    ) : item.rule_type === "UNIT" ? (
        <div className="flex items-center gap-1">
            <input
                type="number"
                className="flex h-8 w-16 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={manualQuantity}
                onChange={(e) => setManualQuantity(e.target.value)}
                onBlur={handleBlur}
            />
        </div>
    ) : (
        <div className="flex items-center gap-2 group/edit">
            {isQuantityUnlocked ? (
                <input
                    type="number"
                    className="flex h-8 w-20 rounded-md border border-input bg-background/50 px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={manualQuantity}
                    placeholder={qty.toString()}
                    onChange={(e) => setManualQuantity(e.target.value)}
                    onBlur={handleBlur}
                    autoFocus
                />
            ) : (
                <span className="text-sm font-semibold">{qty} cx/un</span>
            )}
            <button
                type="button"
                onClick={() => {
                    if (isQuantityUnlocked) {
                        setManualQuantity("")
                        setIsQuantityUnlocked(false)
                        // Triggering a tiny delay to allow React state to settle before blur fires
                        setTimeout(() => {
                            // Fake blur since button click doesn't trigger onBlur of input naturally
                            handleBlur()
                        }, 50)
                    } else {
                        setManualQuantity(qty.toString())
                        setIsQuantityUnlocked(true)
                    }
                }}
                className={`p-1.5 rounded-md ${isQuantityUnlocked ? 'bg-primary/20 text-primary' : 'text-muted-foreground opacity-0 group-hover/edit:opacity-100 hover:bg-muted'} transition-all`}
                title={isQuantityUnlocked ? "Travar Automático" : "Editar Manualmente"}
            >
                {isQuantityUnlocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </button>
            {item.has_yield_alert && !isQuantityUnlocked && (
                <div className="group relative flex items-center justify-center cursor-help">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-2 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg border z-50">
                        Atenção: Rendimento do material não cadastrado. O cálculo pode estar impreciso.
                    </div>
                </div>
            )}
        </div>
    )}
</td>
    )
}
