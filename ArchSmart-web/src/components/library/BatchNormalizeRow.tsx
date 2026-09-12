"use client"

import { TableCell, TableRow } from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle } from "lucide-react"
import { CATEGORIES, Row, rowHasDims } from "./batch-normalize-types"

interface BatchNormalizeRowProps {
    row: Row
    blocked: boolean
    onUpdate: (id: string, patch: Partial<Row>) => void
}

// Uma linha da planilha de normalização em lote: edição inline de
// nome/categoria/preço/dimensões/rendimento, com o aviso de dimensões
// faltantes e o rótulo de "loja bloqueou o acesso". Extraído de
// BatchNormalizeModal.tsx sem mudança de JSX.
export function BatchNormalizeRow({ row: r, blocked, onUpdate }: BatchNormalizeRowProps) {
    const missing = r.selected && !rowHasDims(r)

    return (
        <TableRow className={missing ? "bg-destructive/5" : undefined}>
            <TableCell>
                <Checkbox
                    checked={r.selected}
                    onCheckedChange={(v) => onUpdate(r.id, { selected: !!v })}
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
                            onChange={(e) => onUpdate(r.id, { name: e.target.value })}
                            className="h-8"
                        />
                        {blocked ? (
                            <p className="text-[11px] text-amber-600 mt-0.5 truncate">
                                A loja bloqueou o acesso — confira os dados
                            </p>
                        ) : r.store && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{r.store}</p>
                        )}
                    </div>
                    {missing && (
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-label="Faltam dimensões" />
                    )}
                </div>
            </TableCell>
            <TableCell>
                <Select value={r.category || undefined} onValueChange={(v) => onUpdate(r.id, { category: v })}>
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
                    onChange={(e) => onUpdate(r.id, { price: e.target.value === "" ? "" : Number(e.target.value) })}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number" step="0.1" className="h-8"
                    value={r.width}
                    onChange={(e) => onUpdate(r.id, { width: e.target.value === "" ? "" : Number(e.target.value) })}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number" step="0.1" className="h-8"
                    value={r.height}
                    onChange={(e) => onUpdate(r.id, { height: e.target.value === "" ? "" : Number(e.target.value) })}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number" step="0.1" className="h-8"
                    value={r.depth}
                    onChange={(e) => onUpdate(r.id, { depth: e.target.value === "" ? "" : Number(e.target.value) })}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number" step="0.01" className="h-8"
                    value={r.yield_factor}
                    onChange={(e) => onUpdate(r.id, { yield_factor: e.target.value === "" ? "" : Number(e.target.value) })}
                />
            </TableCell>
        </TableRow>
    )
}
