"use client"

import { BudgetProvider, useBudget, type BudgetTree, type Environment, type BudgetItem } from "./BudgetProvider"
import { SidebarNav } from "./SidebarNav"
import { BudgetSummaryFooter } from "./BudgetSummaryFooter"
import { Button } from "@/components/ui/button"
import { Search, Loader2, PackageOpen, LayoutGrid, Plus, AlertTriangle, FilePenLine, Trash2, Unlock, Lock, X } from "lucide-react"
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

import { ProductPickerModal } from "./ProductPickerModal"
import { useState, useEffect } from "react"

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={props.className}
        style={{ width: '1em', height: '1em' }}
        {...props}
    >
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.413 9.863-9.83.001-2.624-1.023-5.092-2.884-6.956C16.53 1.96 14.07 .938 11.474.938c-5.437 0-9.865 4.414-9.867 9.832-.001 1.959.514 3.87 1.492 5.562l-1.01 3.693 3.79-.994c1.57.857 3.125 1.309 4.178 1.123zm11.758-6.938c-.305-.153-1.802-.888-2.08-.988-.277-.1-.48-.153-.68.153-.2.305-.777.988-.952 1.188-.176.2-.352.224-.658.072-.305-.153-1.288-.475-2.454-1.516-.906-.809-1.517-1.808-1.695-2.113-.177-.305-.019-.47.133-.62.137-.137.305-.353.458-.53.153-.176.203-.305.305-.51.102-.2.05-.382-.025-.535-.076-.153-.68-1.637-.93-2.239-.244-.588-.492-.51-.68-.52-.176-.01-.377-.01-.58-.01-.202 0-.53.077-.807.382-.277.305-1.058 1.037-1.058 2.532 0 1.496 1.087 2.94 1.238 3.144.152.204 2.14 3.266 5.185 4.578.724.312 1.29.499 1.732.64.727.231 1.39.198 1.912.12.583-.087 1.802-.738 2.054-1.452.252-.713.252-1.325.176-1.452-.076-.127-.277-.203-.583-.356z" />
    </svg>
)

function ActiveBudgetWorkspace() {
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

import { createClient } from "@/utils/supabase/client"

function BudgetItemRow({ item, onUpdate }: { item: BudgetItem, onUpdate: () => void }) {
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
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

            const payload: any = {}
            if (item.rule_type !== "UNIT") {
                payload.loss_factor = parseFloat(lossFactor) || 0;

                // If unlocked and input is not empty, use string parsed as int
                // If it was just locked back, manualQuantity is empty string, which translates to null
                if (isQuantityUnlocked && manualQuantity !== "") {
                    payload.manual_quantity = parseInt(manualQuantity, 10);
                } else if (!isQuantityUnlocked) {
                    payload.manual_quantity = null;
                }
            } else {
                payload.manual_quantity = parseInt(manualQuantity, 10) || 1
            }

            const res = await fetch(`${apiBase}/api/budgets/items/${item.id}`, {
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
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

            const res = await fetch(`${apiBase}/api/budgets/items/${item.id}`, {
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
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

            const res = await fetch(`${apiBase}/api/budgets/options/${optionId}/select`, {
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
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

            const res = await fetch(`${apiBase}/api/budgets/options/${optionId}`, {
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
                {item.options.length > 1 && (() => {
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
                })()}

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

function BudgetItemsList({ environmentId, items }: { environmentId: string, items: BudgetItem[] }) {
    // We need router refresh to re-pull the global get budget 
    const { useRouter } = require("next/navigation")
    const router = useRouter()

    const handleUpdate = () => {
        router.refresh()
        // Broadcast local signal so sticky footer re-calculates financials instantly
        window.dispatchEvent(new Event('archsmart:budget_updated'))
    }

    const envItems = items.filter(i => i.environment_id === environmentId)

    if (envItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <p className="text-sm">Nenhum produto atrelado a este ambiente ainda.</p>
                <p className="text-xs mt-1">Clique no botão Acima para importar da biblioteca.</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border bg-card">
            <div className="w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Produto / Material</th>
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Base Calc. (DNA)</th>
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-24">Perda</th>
                            <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Qtd</th>
                            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Total</th>
                            <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                        {envItems.map(item => (
                            <BudgetItemRow key={item.id} item={item} onUpdate={handleUpdate} />
                        ))}
                    </tbody>
                </table>
            </div>
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
