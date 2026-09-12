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
import Image from "next/image"
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
                        // `unoptimized`: a imagem vem da loja raspada pelo Web Clipper, de
                        // dominio arbitrario, que nao da para declarar em
                        // `images.remotePatterns`. Ver o comentario no ProductCard.
                        <Image
                            src={r.image_url}
                            alt=""
                            width={36}
                            height={36}
                            unoptimized
                            className="w-9 h-9 rounded object-cover shrink-0"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded bg-muted shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                        <Input
                            value={r.name}
                            onChange={(e) => onUpdate(r.id, { name: e.target.value })}
                            className="h-8"
                            aria-label={`Nome de ${r.name}`}
                        />
                        {blocked ? (
                            // Este aviso e CHIP PREENCHIDO, nao texto colorido, e isso e
                            // deliberado: `--warning` e claro demais para virar cor de texto.
                            // Medido com tools/contraste.py, no tema claro sobre
                            // `--background`: `text-warning` da 1,99:1 e reprova o 4.5:1 do
                            // Art. 6 (a classe literal de ambar que existia aqui antes dava
                            // 3,19:1 e tambem reprovava). Como fundo, o mesmo token passa:
                            // `bg-warning` com `text-warning-foreground` da **4,91:1** no
                            // claro e 10,83:1 no escuro.
                            //
                            // Nao "simplifique" de volta para texto colorido, e nao escureca
                            // `--warning` para consertar o texto: `--warning-foreground` e
                            // escuro, entao um `--warning` escuro quebraria o par do chip nos
                            // dois temas -- e mexeria em toda superficie de aviso do produto.
                            <p className="text-[11px] bg-warning text-warning-foreground mt-0.5 truncate rounded px-1.5 py-0.5 w-fit max-w-full">
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
                    <SelectTrigger className="h-8" aria-label={`Categoria de ${r.name}`}>
                        <SelectValue placeholder="—" />
                    </SelectTrigger>
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
                    aria-label={`Preço de ${r.name}`}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number" step="0.1" className="h-8"
                    value={r.width}
                    onChange={(e) => onUpdate(r.id, { width: e.target.value === "" ? "" : Number(e.target.value) })}
                    aria-label={`Largura de ${r.name}`}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number" step="0.1" className="h-8"
                    value={r.height}
                    onChange={(e) => onUpdate(r.id, { height: e.target.value === "" ? "" : Number(e.target.value) })}
                    aria-label={`Altura de ${r.name}`}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number" step="0.1" className="h-8"
                    value={r.depth}
                    onChange={(e) => onUpdate(r.id, { depth: e.target.value === "" ? "" : Number(e.target.value) })}
                    aria-label={`Profundidade de ${r.name}`}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number" step="0.01" className="h-8"
                    value={r.yield_factor}
                    onChange={(e) => onUpdate(r.id, { yield_factor: e.target.value === "" ? "" : Number(e.target.value) })}
                    aria-label={`Rendimento de ${r.name}`}
                />
            </TableCell>
        </TableRow>
    )
}
