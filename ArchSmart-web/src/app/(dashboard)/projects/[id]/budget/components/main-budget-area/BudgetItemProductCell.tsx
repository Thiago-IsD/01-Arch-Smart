"use client"

import { Plus } from "lucide-react"

import type { BudgetItem, ItemOption } from "../BudgetProvider"

interface BudgetItemProductCellProps {
    item: BudgetItem
    // O tipo do produto e o que o BudgetProvider ja declara; nao declaramos
    // um `any` novo aqui so para receber a prop.
    product: ItemOption["product"]
    price: number
    isOptionSwitching: boolean
    setIsPickerOpen: (open: boolean) => void
}

/** O bloco de produto da coluna 1: miniatura, nome, preco unitario e "Alternativa B". */
export function BudgetItemProductCell({
    item,
    product,
    price,
    isOptionSwitching,
    setIsPickerOpen,
}: BudgetItemProductCellProps) {
    return (
    <div className="flex items-center justify-between group/prod">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-md overflow-hidden border flex-shrink-0">
                {isOptionSwitching ? (
                    <div className="w-full h-full animate-pulse bg-muted-foreground/20" />
                ) : product?.image_url ? (
                    <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">Img</div>
                )}
            </div>
            <div>
                {isOptionSwitching ? (
                    <div className="flex flex-col gap-2 py-1">
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    </div>
                ) : (
                    <>
                        <h4 className="font-medium text-sm line-clamp-1" title={product?.name}>{product?.name || "Produto Desconhecido"}</h4>
                        <div className="text-xs text-muted-foreground">
                            {product?.store && <span className="mr-2">{product.store}</span>}
                            <span>R$ {price.toFixed(2)} uni</span>
                        </div>
                    </>
                )}
            </div>
        </div>
        {item.options.length === 1 && (
            <button
                onClick={() => setIsPickerOpen(true)}
                className="text-xs px-2 py-1 rounded-md border bg-background hover:bg-muted text-muted-foreground opacity-0 group-hover/prod:opacity-100 transition-all flex items-center shadow-sm"
                title="Desbloquear comparativo de preços"
            >
                <Plus className="w-3 h-3 mr-1" /> Alternativa B
            </button>
        )}
    </div>
    )
}
