"use client"

import { useState, useEffect, useMemo } from "react"
import { ExternalLink, Loader2, ShoppingCart } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { apiUrl } from "@/lib/api-url"

// ======= Types =======

export interface ProductInfo {
    id: string
    name: string
    store: string | null
    price: number | null
    image_url: string | null
    source_url: string | null
}

export interface ItemOptionInfo {
    id: string
    is_selected: boolean
    product: ProductInfo | null
}

export interface BudgetItemInfo {
    id: string
    environment_id: string | null
    rule_type: "FLOOR" | "WALL" | "CEILING" | "UNIT"
    manual_quantity: number | null
    calculated_quantity: number | null
    loss_factor: number | null
    options: ItemOptionInfo[]
}

export interface BudgetDataInfo {
    id: string
    project_id: string
    total_value: number | null
    items: BudgetItemInfo[]
}

export interface PresentationEnvInfo {
    id: string
    is_visible: boolean
    title: string | null
    environment: {
        id: string
        name: string
    } | null
}

// ======= Helpers =======

async function getToken(): Promise<string> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ""
}

const RULE_LABEL: Record<string, string> = {
    FLOOR: "Piso", WALL: "Parede", CEILING: "Teto", UNIT: "Unidade(s)"
}

function calcTotal(item: BudgetItemInfo): number {
    const active = item.options.find(o => o.is_selected) || item.options[0]
    const price = active?.product?.price || 0
    const qty = item.rule_type === "UNIT"
        ? (item.manual_quantity || 1)
        : (item.calculated_quantity || 0)
    return price * qty
}

// ======= Single Item Row =======
// Purely presentational — receives current state from parent.

function PresenterItemRow({
    item,
    onOptionSwitch,
}: {
    item: BudgetItemInfo
    onOptionSwitch: (itemId: string, selectedOptionId: string) => void
}) {
    const [isSwitching, setIsSwitching] = useState(false)

    // Stable sort for A/B labels
    const sortedOptions = useMemo(
        () => [...item.options].sort((a, b) => a.id.localeCompare(b.id)),
        [item.options]
    )

    const activeOption = sortedOptions.find(o => o.is_selected) || sortedOptions[0]
    const product = activeOption?.product
    const price = product?.price || 0
    const qty = item.rule_type === "UNIT"
        ? (item.manual_quantity || 1)
        : (item.calculated_quantity || 0)
    const total = price * qty

    const handleSelectOption = async (optionId: string) => {
        if (activeOption?.id === optionId || isSwitching) return

        // Optimistic: update parent state immediately so totals react
        onOptionSwitch(item.id, optionId)
        setIsSwitching(true)

        try {
            const token = await getToken()
            const res = await fetch(apiUrl(`/api/budgets/options/${optionId}/select`), {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}` }
            })

            if (!res.ok) {
                // Revert to original on failure
                onOptionSwitch(item.id, activeOption?.id || "")
            }
        } catch {
            onOptionSwitch(item.id, activeOption?.id || "")
        } finally {
            setIsSwitching(false)
        }
    }

    return (
        <tr className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
            {/* Produto */}
            <td className="p-4 align-middle">
                {/* A/B Toggle Pills */}
                {sortedOptions.length > 1 && (
                    <div className="flex items-center gap-1.5 mb-3">
                        {sortedOptions.map((opt, idx) => {
                            const isSelected = opt.is_selected
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => handleSelectOption(opt.id)}
                                    disabled={isSwitching}
                                    className={`text-xs px-3 py-1 rounded-full border transition-all font-medium disabled:opacity-70 ${isSelected
                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                            : "bg-white hover:bg-gray-100 text-gray-500 border-gray-200"
                                        }`}
                                >
                                    Opção {String.fromCharCode(65 + idx)}
                                </button>
                            )
                        })}
                        {isSwitching && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 ml-1" />}
                    </div>
                )}

                {/* Product card */}
                <div className="flex items-center gap-3">
                    {/* Image */}
                    <div className="w-10 h-10 rounded-md overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                        {isSwitching ? (
                            <div className="w-full h-full animate-pulse bg-gray-200" />
                        ) : product?.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">IMG</div>
                        )}
                    </div>

                    {/* Name + store */}
                    <div className="min-w-0 flex-1">
                        {isSwitching ? (
                            <div className="space-y-1.5">
                                <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
                                <div className="h-3 w-20 bg-gray-200 animate-pulse rounded" />
                            </div>
                        ) : (
                            <>
                                <p className="font-medium text-sm text-gray-900 line-clamp-1">{product?.name || "Produto"}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {product?.store && <span className="mr-2">{product.store}</span>}
                                    <span>R$ {price.toFixed(2)} / uni</span>
                                </p>
                            </>
                        )}
                    </div>

                    {/* Buy link button */}
                    {!isSwitching && product?.source_url && (
                        <a
                            href={product.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 flex items-center gap-1 text-xs text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 px-2.5 py-1.5 rounded-md transition-colors font-medium"
                            title="Ver produto na loja"
                        >
                            <ShoppingCart className="w-3 h-3" />
                            <span className="hidden sm:inline">Ver Produto</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            </td>

            {/* Tipo */}
            <td className="p-4 align-middle text-sm text-gray-500 whitespace-nowrap">
                {RULE_LABEL[item.rule_type] || item.rule_type}
            </td>

            {/* Qtd */}
            <td className="p-4 align-middle text-sm text-right font-medium text-gray-700">
                {isSwitching
                    ? <div className="h-4 w-12 bg-gray-200 animate-pulse rounded ml-auto" />
                    : `${qty % 1 === 0 ? qty : qty.toFixed(2)} cx/un`
                }
            </td>

            {/* Total */}
            <td className="p-4 align-middle text-right">
                {isSwitching
                    ? <div className="h-4 w-16 bg-gray-200 animate-pulse rounded ml-auto" />
                    : <span className="text-sm font-bold text-primary">R$ {total.toFixed(2)}</span>
                }
            </td>
        </tr>
    )
}

// ======= Main Exported Component =======

export function PresenterBudgetTable({
    budgetData,
    visibleEnvironments,
}: {
    budgetData: BudgetDataInfo | null
    visibleEnvironments: PresentationEnvInfo[]
}) {
    // ---- Lift state here so totals are reactive ----
    const [items, setItems] = useState<BudgetItemInfo[]>(budgetData?.items || [])

    // Sync if budgetData changes (e.g. page refresh)
    useEffect(() => {
        setItems(budgetData?.items || [])
    }, [budgetData])

    // Callback: flip is_selected in the local state immediately (optimistic)
    const handleOptionSwitch = (itemId: string, selectedOptionId: string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item
            return {
                ...item,
                options: item.options.map(opt => ({
                    ...opt,
                    is_selected: opt.id === selectedOptionId,
                }))
            }
        }))
    }

    if (!items.length) return null

    // Build groups: for each visible env, collect items matching that env's real id
    const groups: { envId: string; envName: string; items: BudgetItemInfo[] }[] = []

    for (const env of visibleEnvironments) {
        const envId = env.environment?.id
        if (!envId) continue
        const envItems = items.filter(i => i.environment_id === envId)
        if (envItems.length === 0) continue
        groups.push({
            envId,
            envName: env.title || env.environment?.name || "Ambiente",
            items: envItems,
        })
    }

    if (groups.length === 0) return null

    const grandTotal = groups.reduce(
        (sum, g) => sum + g.items.reduce((s, item) => s + calcTotal(item), 0),
        0
    )

    return (
        <div className="mt-12 px-8 md:px-12 pb-16">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                Orçamento Estimado
                <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2.5 py-1 rounded-full">
                    R$ {grandTotal.toFixed(2)}
                </span>
            </h3>

            <div className="space-y-6">
                {groups.map(g => {
                    const groupTotal = g.items.reduce((s, item) => s + calcTotal(item), 0)
                    return (
                        <div key={g.envId} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            {/* Env Header */}
                            <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-200">
                                <span className="text-sm font-bold text-gray-800">{g.envName}</span>
                                <span className="text-sm font-semibold text-primary">R$ {groupTotal.toFixed(2)}</span>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Produto / Material</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Tipo</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Qtd</th>
                                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {g.items.map(item => (
                                            <PresenterItemRow
                                                key={item.id}
                                                item={item}
                                                onOptionSwitch={handleOptionSwitch}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Grand total */}
            <div className="mt-6 flex items-center justify-between bg-primary/10 rounded-xl px-6 py-4 border border-primary/20">
                <div>
                    <p className="font-bold text-gray-800 text-base">Total Geral</p>
                    <p className="text-xs text-gray-500 mt-0.5">Considerando apenas opções ativas</p>
                </div>
                <span className="font-bold text-primary text-2xl">R$ {grandTotal.toFixed(2)}</span>
            </div>
        </div>
    )
}
