"use client"

import { useEffect, useRef, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
    NORMALIZE_CONCURRENCY,
    NormalizedProduct,
    mapWithConcurrency,
    normalizeProduct,
} from "@/lib/normalize-product"
import { listarInboxCompleto } from "@/features/library/api"
import { useBatchApprove } from "@/features/library/hooks"
import { Row, rowHasDims, toNum } from "./batch-normalize-types"
import { BatchNormalizeTable } from "./BatchNormalizeTable"

interface BatchNormalizeModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function BatchNormalizeModal({ isOpen, onOpenChange }: BatchNormalizeModalProps) {
    const { toast } = useToast()
    const aprovarEmLoteMutation = useBatchApprove()

    const [rows, setRows] = useState<Row[]>([])
    const [loading, setLoading] = useState(false)
    const [aiRunning, setAiRunning] = useState(false)
    const approving = aprovarEmLoteMutation.isPending
    // Linhas em que a loja bloqueou o acesso: a IA extraiu só pelo nome e os dados
    // precisam de conferência manual.
    const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
    const aiAbortRef = useRef<AbortController | null>(null)

    // Fechar o modal (ou desmontar) precisa abortar as requisições em voo — caso
    // contrário elas seguem consumindo quota da IA sem ninguém para receber o resultado.
    useEffect(() => {
        if (!isOpen) aiAbortRef.current?.abort()
    }, [isOpen])
    useEffect(() => () => aiAbortRef.current?.abort(), [])

    // Carrega o inbox (produtos CAPTURED) toda vez que o modal abre.
    useEffect(() => {
        if (!isOpen) return
        let cancelled = false
        const controller = new AbortController()

        const load = async () => {
            setLoading(true)
            try {
                const items = await listarInboxCompleto(controller.signal)

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
        return () => {
            cancelled = true
            controller.abort()
        }
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
        const abort = new AbortController()
        aiAbortRef.current = abort

        try {
            const results = await mapWithConcurrency(targets, NORMALIZE_CONCURRENCY, async (r) => ({
                id: r.id,
                data: await normalizeProduct(
                    { text: r.name, source_url: r.source_url },
                    { signal: abort.signal },
                ),
            }))

            const okMap = new Map<string, NormalizedProduct>()
            const errors: string[] = []
            results.forEach((res) => {
                if (res.status === "fulfilled") okMap.set(res.value.id, res.value.data)
                else errors.push(res.reason instanceof Error ? res.reason.message : String(res.reason))
            })

            const blocked = new Set<string>()
            setRows((prev) => prev.map((r) => {
                const d = okMap.get(r.id)
                if (!d) return r
                if (d.source_blocked) blocked.add(r.id)
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
            setBlockedIds(blocked)

            if (errors.length > 0) {
                // Falha precisa aparecer como falha: antes, 40 erros viravam
                // "IA concluída — 0 de 40 linhas preenchidas" com toast de sucesso.
                const causa = errors[0]
                toast({
                    variant: "destructive",
                    title: okMap.size > 0 ? "IA concluída com falhas" : "Falha ao normalizar com IA",
                    description: `${errors.length} de ${targets.length} linha(s) falharam. ${causa}`,
                })
            } else {
                toast({
                    title: "IA concluída",
                    description: blocked.size > 0
                        ? `${okMap.size} linha(s) preenchidas. ${blocked.size} com a loja bloqueando o acesso — revise os dados.`
                        : `${okMap.size} de ${targets.length} linha(s) preenchidas.`,
                })
            }
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: err instanceof Error ? err.message : "Falha ao normalizar com IA.",
            })
        } finally {
            aiAbortRef.current = null
            setAiRunning(false)
        }
    }

    const approve = async () => {
        if (validSelected.length === 0) {
            toast({ variant: "destructive", title: "Nada para aprovar", description: "Selecione linhas com dimensões completas (L×A×P)." })
            return
        }

        try {
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

            const data = await aprovarEmLoteMutation.mutateAsync(payload)
            const approvedCount = data.approved?.length ?? validSelected.length

            toast({
                title: "Produtos aprovados!",
                description: skippedCount > 0
                    ? `${approvedCount} aprovado(s). ${skippedCount} pulado(s) por falta de dimensões.`
                    : `${approvedCount} produto(s) movido(s) para a biblioteca.`,
            })
            onOpenChange(false)
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: err instanceof Error ? err.message : "Falha ao aprovar em lote.",
            })
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
                    <BatchNormalizeTable
                        rows={rows}
                        loading={loading}
                        blockedIds={blockedIds}
                        allChecked={allChecked}
                        onUpdate={update}
                        onToggleAll={(checked) => setRows((prev) => prev.map((r) => ({ ...r, selected: checked })))}
                    />
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
