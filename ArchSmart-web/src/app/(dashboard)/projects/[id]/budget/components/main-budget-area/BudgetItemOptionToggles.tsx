"use client"

import { X } from "lucide-react"

import type { BudgetItem } from "../BudgetProvider"

interface BudgetItemOptionTogglesProps {
    item: BudgetItem
    optimisticActiveOptionId: string | null
    optimisticDeletedOptionId: string | null
    setOptimisticDeletedOptionId: (id: string | null) => void
    handleOptionSelect: (optionId: string) => void
    handleDeleteOption: (optionId: string) => void
}

/** Os botoes "Opcao A/B" de um item com mais de uma opcao, e o X que remove uma. */
export function BudgetItemOptionToggles({
    item,
    optimisticActiveOptionId,
    optimisticDeletedOptionId,
    setOptimisticDeletedOptionId,
    handleOptionSelect,
    handleDeleteOption,
}: BudgetItemOptionTogglesProps) {
    // Stable sort to prevent Postgres MVCC reordering on updates from swapping A and B
    const sortedOptions = [...item.options]
        .filter((opt: any) => opt.id !== optimisticDeletedOptionId)
        .sort((a: any, b: any) => (a.created_at || a.id).localeCompare(b.created_at || b.id))
    if (sortedOptions.length <= 1) return null;
    return (
        <div className="flex items-center gap-1 mb-3">
            {sortedOptions.map((opt: any, index: number) => {
                const isSelected = optimisticActiveOptionId ? opt.id === optimisticActiveOptionId : opt.is_selected
                return (
                    <div key={opt.id} className="relative group/opt inline-flex h-full">
                        <button
                            onClick={() => handleOptionSelect(opt.id)}
                            className={`text-xs pl-3 pr-6 py-1 rounded-full border transition-colors ${isSelected
                                ? 'bg-primary text-primary-foreground border-primary font-medium shadow-sm'
                                : 'bg-background hover:bg-muted text-muted-foreground border-border'
                                }`}
                        >
                            Opção {String.fromCharCode(65 + index)}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setOptimisticDeletedOptionId(opt.id);
                                handleDeleteOption(opt.id);
                            }}
                            className={`absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition-opacity hover:bg-destructive hover:text-destructive-foreground
                            ${isSelected ? 'text-primary-foreground/70 hover:opacity-100' : 'text-muted-foreground/70 opacity-0 group-hover/opt:opacity-100'}
                        `}
                            title="Remover Opção"
                        >
                            <X className="w-2.5 h-2.5" />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}
