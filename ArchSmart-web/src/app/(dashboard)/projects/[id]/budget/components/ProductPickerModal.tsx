"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import { useBudget } from "./BudgetProvider"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { apiUrl } from "@/lib/api-url"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, PackageOpen } from "lucide-react"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface ProductPickerModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    targetItemId?: string // Se presente, funciona no modo "Adicionar Opção B" para um item existente
}

export function ProductPickerModal({ isOpen, onOpenChange, targetItemId }: ProductPickerModalProps) {
    const { projectId, selectedEnvironmentId } = useBudget()
    const { toast } = useToast()
    const router = useRouter()

    const [products, setProducts] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [search, setSearch] = useState("")

    // Item Addition State
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
    const [ruleType, setRuleType] = useState<string>(targetItemId ? "UNIT" : "FLOOR")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Fetch Library Products
    useEffect(() => {
        if (!isOpen) {
            setSearch("")
            setSelectedProduct(null)
            return
        }

        const fetchProducts = async () => {
            setIsLoading(true)
            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token || ""

                const res = await fetch(apiUrl("/api/products"), {
                    headers: { "Authorization": `Bearer ${token}` }
                })

                if (res.ok) {
                    const data = await res.json()
                    // Handle paginated response: { items: [], total: ... }
                    setProducts(data.items || [])
                }
            } catch (e) {
                console.error("Failed to fetch products", e)
            } finally {
                setIsLoading(false)
            }
        }

        fetchProducts()
    }, [isOpen])

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
    )

    const handleLinkProduct = async () => {
        if (!selectedEnvironmentId || !selectedProduct) return

        setIsSubmitting(true)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token || ""
            const isOptionMode = !!targetItemId;
            let endpoint = ""
            let payload: any = {}

            if (isOptionMode) {
                endpoint = apiUrl(`/api/budgets/items/${targetItemId}/options`)
                payload = { product_id: selectedProduct.id }
            } else {
                endpoint = apiUrl("/api/budgets/items")
                payload = {
                    project_id: projectId,
                    environment_id: selectedEnvironmentId,
                    product_id: selectedProduct.id,
                    rule_type: ruleType
                }
            }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error("Failed to add to budget")

            toast({
                title: "Produto Vinculado!",
                description: `${selectedProduct.name} foi adicionado como ${isOptionMode ? "uma nova opção" : "um novo item"}.`,
            })

            onOpenChange(false)
            router.refresh() // Refresh Server Component to fetch new Budget Tree

            // Wait for React to process refresh, then fire recalculation
            setTimeout(() => {
                window.dispatchEvent(new Event('archsmart:budget_updated'))
            }, 500)

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Não foi possível adicionar o produto ao orçamento.",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <div className="p-6 pb-4 border-b">
                    <DialogHeader>
                        <DialogTitle>{targetItemId ? "Selecionar Opção Alternativa" : "Biblioteca de Produtos"}</DialogTitle>
                        <DialogDescription>
                            {targetItemId
                                ? "Escolha uma variação ou alternativa de material para este item do orçamento."
                                : "Selecione um produto da sua biblioteca global para inserir neste ambiente."
                            }
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Dynamic Area */}
                {!selectedProduct ? (
                    <div className="flex-1 flex flex-col overflow-hidden bg-muted/10">
                        <div className="p-4 border-b bg-background">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Buscar na biblioteca..."
                                    className="pl-9"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                                    <PackageOpen className="w-12 h-12 mb-4 opacity-20" />
                                    <p>Nenhum produto encontrado na biblioteca.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-8">
                                    {filteredProducts.map((prod) => (
                                        <div
                                            key={prod.id}
                                            className="border rounded-md p-3 cursor-pointer hover:border-primary hover:shadow-sm transition-all bg-background group"
                                            onClick={() => setSelectedProduct(prod)}
                                        >
                                            <div className="aspect-square bg-muted/20 rounded-sm mb-3 overflow-hidden border">
                                                {prod.image_url ? (
                                                    <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Sem Foto</div>
                                                )}
                                            </div>
                                            <p className="font-medium text-sm line-clamp-2 leading-tight">{prod.name}</p>
                                            <p className="text-xs text-muted-foreground mt-1 truncate">{prod.category || 'Geral'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col p-6 items-center justify-center text-center animate-in slide-in-from-right-8 bg-muted/10">
                        <div className="max-w-sm w-full space-y-6 bg-background p-6 rounded-xl border shadow-sm">
                            <div className="mx-auto w-24 h-24 border rounded-md overflow-hidden bg-muted/20 mb-4">
                                {selectedProduct.image_url && <img src={selectedProduct.image_url} alt="" className="w-full h-full object-cover" />}
                            </div>

                            <div>
                                <h3 className="font-semibold text-lg line-clamp-2">{selectedProduct.name}</h3>
                                <p className="text-sm text-muted-foreground">Como este item será quantificado?</p>
                            </div>

                            <div className="space-y-3">
                                <Select value={ruleType} onValueChange={setRuleType}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Regra de Medição" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="UNIT">Por Unidade (Ex: Móveis)</SelectItem>
                                        <SelectItem value="FLOOR">Área do Piso (Ex: Porcelanato)</SelectItem>
                                        <SelectItem value="WALL">Área das Paredes (Ex: Tinta)</SelectItem>
                                        <SelectItem value="CEILING">Área do Teto (Ex: Gesso)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2 pt-4 border-t">
                                <Button variant="outline" className="w-full" onClick={() => setSelectedProduct(null)} disabled={isSubmitting}>
                                    Voltar
                                </Button>
                                <Button className="w-full" onClick={handleLinkProduct} disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirmar"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

            </DialogContent>
        </Dialog>
    )
}
