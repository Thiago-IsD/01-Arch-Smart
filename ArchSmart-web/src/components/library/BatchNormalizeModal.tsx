"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiUrl } from "@/lib/api-url"
import { createClient } from "@/utils/supabase/client"

const CATEGORIES = [
    "Mobiliário",
    "Iluminação",
    "Decoração",
    "Revestimentos",
    "Marcenaria",
    "Paisagismo",
    "Outros",
]

async function getToken(): Promise<string | undefined> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
}

// Campos numéricos aceitam string vazia para permitir apagar o valor no input.
type NumField = number | ""

interface Row {
    id: string
    name: string
    store?: string
    image_url?: string | null
    source_url: string
    category: string
    price: NumField
    width: NumField
    height: NumField
    depth: NumField
    yield_factor: NumField
    selected: boolean
}

const toNum = (v: NumField): number => (v === "" ? 0 : Number(v))
const rowHasDims = (r: Row): boolean =>
    toNum(r.width) > 0 && toNum(r.height) > 0 && toNum(r.depth) > 0

interface BatchNormalizeModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function BatchNormalizeModal({ isOpen, onOpenChange }: BatchNormalizeModalProps) {
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const [rows, setRows] = useState<Row[]>([])
    const [loading, setLoading] = useState(false)
    const [aiRunning, setAiRunning] = useState(false)
    const [approving, setApproving] = useState(false)

    // Carrega o inbox (produtos CAPTURED) toda vez que o modal abre.
    useEffect(() => {
        if (!isOpen) return
        let cancelled = false

        const load = async () => {
            setLoading(true)
            try {
                const token = await getToken()
                const headers: Record<string, string> = {}
                if (token) headers["Authorization"] = `Bearer ${token}`

                // A API limita size a 100 (le=100), então paginamos para trazer
                // todo o inbox, independente da quantidade.
                const size = 100
                let page = 1
                let totalPages = 1
                const items: any[] = []
                do {
                    const res = await fetch(apiUrl(`/api/products?state=CAPTURED&page=${page}&size=${size}`), { headers })
                    if (!res.ok) throw new Error("fetch inbox failed")
                    const data = await res.json()
                    items.push(...(data.items || []))
                    totalPages = data.pages || 1
                    page++
                } while (page <= totalPages && !cancelled)

                if (cancelled) return

                setRows(items.map((p: any): Row => ({
                    id: p.id,
                    name: p.name || "",
                    store: p.store,
                    image_url: p.image_url,
                    source_url: p.source_url || "",
                    category: p.category || "",
                    price: p.price ?? "",
                    width: p.dimensions?.width ?? "",
                    height: p.dimensions?.height ?? "",
                    depth: p.dimensions?.depth ?? "",
                    yield_factor: p.yield_factor ?? "",
                    selected: true,
                })))
            } catch {
                if (!cancelled) {
                    toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar o inbox." })
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    const update = (id: string, patch: Partial<Row>) => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    }

    const selectedRows = rows.filter((r) => r.selected)
    const validSelected = selectedRows.filter(rowHasDims)
    const skippedCount = selectedRows.length - validSelected.length
    const allChecked = rows.length > 0 && rows.every((r) => r.selected)

    // Botão geral: normaliza com IA todas as linhas selecionadas de uma vez.
    const runAi = async () => {
        const targets = rows.filter((r) => r.selected)
        if (targets.length === 0) return

        setAiRunning(true)
        try {
            const token = await getToken()
            const headers: Record<string, string> = { "Content-Type": "application/json" }
            if (token) headers["Authorization"] = `Bearer ${token}`

            const results = await Promise.allSettled(
                targets.map(async (r) => {
                    const res = await fetch(apiUrl("/api/products/normalize"), {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ text: r.name, source_url: r.source_url }),
                    })
                    if (!res.ok) throw new Error("normalize failed")
                    return { id: r.id, data: await res.json() }
                })
            )

            const okMap = new Map<string, any>()
            results.forEach((res) => {
                if (res.status === "fulfilled") okMap.set(res.value.id, res.value.data)
            })

            setRows((prev) => prev.map((r) => {
                const d = okMap.get(r.id)
                if (!d) return r
                return {
                    ...r,
                    name: d.name ?? r.name,
                    category: d.category ?? r.category,
                    price: d.price !== undefined && d.price !== null ? d.price : r.price,
                    width: d.dimensions?.width ?? r.width,
                    height: d.dimensions?.height ?? r.height,
                    depth: d.dimensions?.depth ?? r.depth,
                    yield_factor: d.yield_factor !== undefined && d.yield_factor !== null ? d.yield_factor : r.yield_factor,
                }
            }))

            toast({ title: "IA concluída", description: `${okMap.size} de ${targets.length} linha(s) preenchidas.` })
        } catch {
            toast({ variant: "destructive", title: "Erro", description: "Falha ao normalizar com IA." })
        } finally {
            setAiRunning(false)
        }
    }

    const approve = async () => {
        if (validSelected.length === 0) {
            toast({ variant: "destructive", title: "Nada para aprovar", description: "Selecione linhas com dimensões completas (L×A×P)." })
            return
        }

        setApproving(true)
        try {
            const token = await getToken()
            const headers: Record<string, string> = { "Content-Type": "application/json" }
            if (token) headers["Authorization"] = `Bearer ${token}`

            const payload = {
                items: validSelected.map((r) => ({
                    id: r.id,
                    name: r.name,
                    category: r.category || null,
                    price: r.price === "" ? null : toNum(r.price),
                    source_url: r.source_url || null,
                    dimensions: {
                        width: toNum(r.width),
                        height: toNum(r.height),
                        depth: toNum(r.depth),
                        unit: "cm",
                    },
                    yield_factor: r.yield_factor === "" ? null : toNum(r.yield_factor),
                })),
            }

            const res = await fetch(apiUrl("/api/products/batch-approve"), {
                method: "PATCH",
                headers,
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error("batch approve failed")
            const data = await res.json()
            const approvedCount = data.approved?.length ?? validSelected.length

            queryClient.invalidateQueries({ queryKey: ["products"] })
            queryClient.invalidateQueries({ queryKey: ["inbox-count"] })

            toast({
                title: "Produtos aprovados!",
                description: skippedCount > 0
                    ? `${approvedCount} aprovado(s). ${skippedCount} pulado(s) por falta de dimensões.`
                    : `${approvedCount} produto(s) movido(s) para a biblioteca.`,
            })
            onOpenChange(false)
        } catch {
            toast({ variant: "destructive", title: "Erro", description: "Falha ao aprovar em lote." })
        } finally {
            setApproving(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1100px] w-[95vw] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Normalizar em lote</DialogTitle>
                    <DialogDescription>
                        Edite os dados direto na planilha. Dimensões (L×A×P) são obrigatórias para aprovar.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                        {selectedRows.length} selecionado(s)
                        {skippedCount > 0 && (
                            <> · <span className="text-destructive font-medium">{skippedCount} sem dimensões</span></>
                        )}
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={runAi}
                        disabled={aiRunning || loading || selectedRows.length === 0}
                    >
                        {aiRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {aiRunning ? "Analisando..." : "Normalizar com IA"}
                    </Button>
                </div>

                <div className="flex-1 overflow-auto border rounded-lg min-h-[200px]">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="flex items-center justify-center py-20 text-muted-foreground">
                            Nenhum produto no inbox.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox
                                            checked={allChecked}
                                            onCheckedChange={(v) => setRows((prev) => prev.map((r) => ({ ...r, selected: !!v })))}
                                            aria-label="Selecionar todos"
                                        />
                                    </TableHead>
                                    <TableHead className="min-w-[220px]">Produto</TableHead>
                                    <TableHead className="w-[150px]">Categoria</TableHead>
                                    <TableHead className="w-[110px]">Preço (R$)</TableHead>
                                    <TableHead className="w-[80px]">L (cm)</TableHead>
                                    <TableHead className="w-[80px]">A (cm)</TableHead>
                                    <TableHead className="w-[80px]">P (cm)</TableHead>
                                    <TableHead className="w-[90px]">Rend.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((r) => {
                                    const missing = r.selected && !rowHasDims(r)
                                    return (
                                        <TableRow key={r.id} className={missing ? "bg-destructive/5" : undefined}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={r.selected}
                                                    onCheckedChange={(v) => update(r.id, { selected: !!v })}
                                                    aria-label={`Selecionar ${r.name}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {r.image_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={r.image_url} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded bg-muted shrink-0" />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <Input
                                                            value={r.name}
                                                            onChange={(e) => update(r.id, { name: e.target.value })}
                                                            className="h-8"
                                                        />
                                                        {r.store && (
                                                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{r.store}</p>
                                                        )}
                                                    </div>
                                                    {missing && (
                                                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-label="Faltam dimensões" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Select value={r.category || undefined} onValueChange={(v) => update(r.id, { category: v })}>
                                                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                                                    <SelectContent>
                                                        {CATEGORIES.map((c) => (
                                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" step="0.01" className="h-8"
                                                    value={r.price}
                                                    onChange={(e) => update(r.id, { price: e.target.value === "" ? "" : Number(e.target.value) })}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" step="0.1" className="h-8"
                                                    value={r.width}
                                                    onChange={(e) => update(r.id, { width: e.target.value === "" ? "" : Number(e.target.value) })}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" step="0.1" className="h-8"
                                                    value={r.height}
                                                    onChange={(e) => update(r.id, { height: e.target.value === "" ? "" : Number(e.target.value) })}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" step="0.1" className="h-8"
                                                    value={r.depth}
                                                    onChange={(e) => update(r.id, { depth: e.target.value === "" ? "" : Number(e.target.value) })}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" step="0.01" className="h-8"
                                                    value={r.yield_factor}
                                                    onChange={(e) => update(r.id, { yield_factor: e.target.value === "" ? "" : Number(e.target.value) })}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-xs text-muted-foreground order-2 sm:order-1">
                        Serão aprovados {validSelected.length} produto(s)
                        {skippedCount > 0 && `; ${skippedCount} pulado(s)`}.
                    </p>
                    <div className="flex gap-2 order-1 sm:order-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={approving}>
                            Cancelar
                        </Button>
                        <Button onClick={approve} disabled={approving || loading || validSelected.length === 0}>
                            {approving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Aprovar{validSelected.length > 0 ? ` (${validSelected.length})` : ""}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
