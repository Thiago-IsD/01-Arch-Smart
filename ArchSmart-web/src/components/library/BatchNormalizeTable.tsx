"use client"

import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { Row } from "./batch-normalize-types"
import { BatchNormalizeRow } from "./BatchNormalizeRow"

interface BatchNormalizeTableProps {
    rows: Row[]
    loading: boolean
    blockedIds: Set<string>
    allChecked: boolean
    onUpdate: (id: string, patch: Partial<Row>) => void
    onToggleAll: (checked: boolean) => void
}

// A lista de resultados do lote: cabeçalho, estado de carregando, estado
// vazio ("nenhum produto no inbox") e a lista de linhas. Extraído de
// BatchNormalizeModal.tsx sem mudança de JSX.
export function BatchNormalizeTable({ rows, loading, blockedIds, allChecked, onUpdate, onToggleAll }: BatchNormalizeTableProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (rows.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
                Nenhum produto no inbox.
            </div>
        )
    }

    return (
        <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                    <TableHead className="w-[40px]">
                        <Checkbox
                            checked={allChecked}
                            onCheckedChange={(v) => onToggleAll(!!v)}
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
                {rows.map((r) => (
                    <BatchNormalizeRow
                        key={r.id}
                        row={r}
                        blocked={blockedIds.has(r.id)}
                        onUpdate={onUpdate}
                    />
                ))}
            </TableBody>
        </Table>
    )
}
