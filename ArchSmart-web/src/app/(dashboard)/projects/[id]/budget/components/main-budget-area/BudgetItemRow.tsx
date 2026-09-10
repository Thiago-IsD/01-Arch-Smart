"use client"

import { useState, useEffect } from "react"
import { Trash2 } from "lucide-react"

import { apiUrl } from "@/lib/api-url"
import { getAccessToken } from "@/lib/api/auth"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import type { BudgetItem } from "../BudgetProvider"
import { ProductPickerModal } from "../ProductPickerModal"
import { BudgetItemOptionToggles } from "./BudgetItemOptionToggles"
import { BudgetItemProductCell } from "./BudgetItemProductCell"
import { BudgetItemQuantityCell } from "./BudgetItemQuantityCell"

export function BudgetItemRow({ item, onUpdate }: { item: BudgetItem, onUpdate: () => void }) {
    const [lossFactor, setLossFactor] = useState(item.loss_factor?.toString() || "10")
    const [manualQuantity, setManualQuantity] = useState(item.manual_quantity?.toString() || "")
    const [isUpdating, setIsUpdating] = useState(false)
    const [isQuantityUnlocked, setIsQuantityUnlocked] = useState(item.manual_quantity !== null && item.manual_quantity !== undefined)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isOptionSwitching, setIsOptionSwitching] = useState(false)
    const [optimisticActiveOptionId, setOptimisticActiveOptionId] = useState<string | null>(null)
    const [optimisticDeletedOptionId, setOptimisticDeletedOptionId] = useState<string | null>(null)

    const [isPickerOpen, setIsPickerOpen] = useState(false) // For Option B

    const activeOption = item.options.find((o: any) =>
        optimisticActiveOptionId ? o.id === optimisticActiveOptionId : o.is_selected
    ) || item.options[0]
    const product = activeOption?.product

    const ruleTranslations: Record<string, string> = {
        FLOOR: "Piso",
        WALL: "Parede",
        CEILING: "Teto",
        UNIT: "Unidade(s)"
    }

    const handleBlur = async () => {
        setIsUpdating(true)
        try {
            const token = (await getAccessToken()) || ""

            const payload: any = {}
            if (item.rule_type !== "UNIT") {
                payload.loss_factor = parseFloat(lossFactor) || 0;
                if (isQuantityUnlocked && manualQuantity !== "") {
                    payload.manual_quantity = parseInt(manualQuantity, 10);
                } else if (!isQuantityUnlocked) {
                    payload.manual_quantity = null;
                }
            } else {
                payload.manual_quantity = parseInt(manualQuantity, 10) || 1
            }

            const res = await fetch(apiUrl(`/api/budgets/items/${item.id}`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                // Refresh parent tree to pull new calculations
                onUpdate()
            }
        } catch (e) {
            console.error("Failed to update item", e)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const token = (await getAccessToken()) || ""
            const res = await fetch(apiUrl(`/api/budgets/items/${item.id}`), {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })

            if (res.ok) {
                onUpdate()
            }
        } catch (e) {
            console.error("Failed to delete item", e)
        } finally {
            setIsDeleting(false)
        }
    }

    const handleOptionSelect = async (optionId: string) => {
        if (activeOption?.id === optionId) return; // Already selected

        setOptimisticActiveOptionId(optionId) // Optimistic UI jump
        setIsOptionSwitching(true)
        try {
            const token = (await getAccessToken()) || ""
            const res = await fetch(apiUrl(`/api/budgets/options/${optionId}/select`), {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })

            if (res.ok) {
                onUpdate()
            } else {
                // Only revert if failed so the UI doesn't drop the skeleton prematurely
                setOptimisticActiveOptionId(null)
                setIsOptionSwitching(false)
            }
        } catch (e) {
            console.error("Failed to switch option", e)
            setOptimisticActiveOptionId(null)
            setIsOptionSwitching(false)
        }
    }

    const handleDeleteOption = async (optionId: string) => {
        setIsOptionSwitching(true)
        try {
            const token = (await getAccessToken()) || ""
            const res = await fetch(apiUrl(`/api/budgets/options/${optionId}`), {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            })

            if (res.ok) {
                // If this is the active option and we delete it, handleUpdate will refresh 
                // and the backend will have auto-selected another or removed the row completely.
                onUpdate()
            } else {
                setOptimisticDeletedOptionId(null)
                setIsOptionSwitching(false)
            }
        } catch (e) {
            console.error("Failed to delete option", e)
            setOptimisticDeletedOptionId(null)
            setIsOptionSwitching(false)
        }
    }

    // Reset optimistic state if server data catches up and changes
    useEffect(() => {
        const realActive = item.options.find((o: any) => o.is_selected)
        if (realActive?.id === optimisticActiveOptionId) {
            setOptimisticActiveOptionId(null)
            setIsOptionSwitching(false)
        }

        // If the deleted option is actually gone from the server payload
        const stillExists = item.options.find((o: any) => o.id === optimisticDeletedOptionId)
        if (!stillExists && optimisticDeletedOptionId) {
            setOptimisticDeletedOptionId(null)
            setIsOptionSwitching(false)
        }
    }, [item, optimisticActiveOptionId, optimisticDeletedOptionId])

    const price = product?.price || 0
    const qty = item.rule_type === "UNIT" ? (item.manual_quantity || 1) : (item.calculated_quantity || 0)
    const total = price * qty

    return (
        <tr className={`border-b border-muted transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${isUpdating || isDeleting ? 'opacity-50' : ''}`}>
            {/* Produto */}
            <td className="p-4 align-middle">

                {/* A/B Option Toggles */}
                {item.options.length > 1 && (
                    <BudgetItemOptionToggles
                        item={item}
                        optimisticActiveOptionId={optimisticActiveOptionId}
                        optimisticDeletedOptionId={optimisticDeletedOptionId}
                        setOptimisticDeletedOptionId={setOptimisticDeletedOptionId}
                        handleOptionSelect={handleOptionSelect}
                        handleDeleteOption={handleDeleteOption}
                    />
                )}

                <BudgetItemProductCell
                    item={item}
                    product={product}
                    price={price}
                    isOptionSwitching={isOptionSwitching}
                    setIsPickerOpen={setIsPickerOpen}
                />

                <ProductPickerModal
                    isOpen={isPickerOpen}
                    onOpenChange={setIsPickerOpen}
                    targetItemId={item.id}
                />
            </td>

            {/* Base de Calculo */}
            <td className="p-4 align-middle text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    {isOptionSwitching ? (
                        <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                    ) : item.rule_type === "UNIT" ? (
                        <span>-</span>
                    ) : (
                        <span>{item.base_area?.toFixed(2)} m² <span className="text-xs bg-muted px-1 py-0.5 rounded">({ruleTranslations[item.rule_type]})</span></span>
                    )}
                </div>
            </td>

            {/* Perda % */}
            <td className="p-4 align-middle">
                {isOptionSwitching ? (
                    <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                ) : item.rule_type === "UNIT" ? (
                    <span className="text-sm text-muted-foreground">-</span>
                ) : (
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            className="flex h-8 w-16 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={lossFactor}
                            onChange={(e) => setLossFactor(e.target.value)}
                            onBlur={handleBlur}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                    </div>
                )}
            </td>

            {/* Qtd */}
            <BudgetItemQuantityCell
                item={item}
                qty={qty}
                isOptionSwitching={isOptionSwitching}
                manualQuantity={manualQuantity}
                setManualQuantity={setManualQuantity}
                isQuantityUnlocked={isQuantityUnlocked}
                setIsQuantityUnlocked={setIsQuantityUnlocked}
                handleBlur={handleBlur}
            />


            {/* Total */}
            <td className="p-4 align-middle text-right">
                {isOptionSwitching ? (
                    <div className="h-5 w-20 bg-muted animate-pulse rounded ml-auto" />
                ) : (
                    <span className="text-sm font-bold text-primary">R$ {total.toFixed(2)}</span>
                )}
            </td>

            {/* Actions */}
            <td className="p-4 align-middle text-right">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="Remover produto do ambiente"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remover do Ambiente</AlertDialogTitle>
                            <AlertDialogDescription>
                                Você tem certeza que deseja remover este material do orçamento deste ambiente?
                                Esta ação não pode ser desfeita e a quantidade contabilizada será perdida.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Sair</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault() // Prevents dialog from closing immediately before delete finishes
                                    handleDelete()
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {isDeleting ? "Removendo..." : "Confirmar Exclusão"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </td>
        </tr >
    )
}
