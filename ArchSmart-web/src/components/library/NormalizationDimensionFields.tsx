"use client"

import { Control } from "react-hook-form"
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NormalizationFormValues } from "./normalization-sheet-schema"

interface NormalizationDimensionFieldsProps {
    control: Control<NormalizationFormValues>
    hasDimensions: boolean
}

// Os três campos de dimensão (L/A/P, em cm) do formulário de normalização,
// com o aviso de obrigatoriedade — dimensões completas são condição para
// aprovar o item do inbox. Extraído de NormalizationSheet.tsx.
//
// Conserto de Art. 6 da Tarefa 9 da Seção 8, em duas partes. (1) A legenda do
// grupo era um rotulo sem `htmlFor` — e não podia ter um, porque legenda de
// grupo não rotula UM controle; virou `<span>`. (2) Cada input se sustentava só
// em atributo `title`, e a regra do axe PASSA com `non-empty-title`: o portão
// ficaria verde com o Art. 6 descumprido. Agora cada um tem `FormLabel`
// `sr-only`, que o `FormControl` associa pelo `id` de verdade — invisível, então
// o "L"/"A"/"P" continua sendo a pista visual, sem mudar o layout.
//
// (3) E o `FormControl` agora envolve o `Input`, não a `<div className="relative">`
// que o posiciona. Ele é um Slot: punha o `id` — e também o `aria-invalid` e o
// `aria-describedby` da mensagem de erro — no primeiro filho, ou seja na div, e
// nunca no campo. O rótulo apontava para um `id` que não era de input nenhum.
// Mantenha o `FormControl` colado no `Input`.
export function NormalizationDimensionFields({ control, hasDimensions }: NormalizationDimensionFieldsProps) {
    return (
        <div className="space-y-3">
            <span className="block text-sm font-medium leading-none">
                Dimensões: Largura x Altura x Prof. (cm) {!hasDimensions && <span className="text-destructive">*</span>}
            </span>
            <div className="flex gap-2">
                <FormField
                    control={control}
                    name="width"
                    render={({ field }) => (
                        <FormItem className="flex-1 space-y-1">
                            <FormLabel className="sr-only">Largura em cm</FormLabel>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-4 text-center" aria-hidden="true">L</span>
                                <FormControl>
                                    <Input type="number" step="0.1" className="pl-8" placeholder="0" {...field} />
                                </FormControl>
                            </div>
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="height"
                    render={({ field }) => (
                        <FormItem className="flex-1 space-y-1">
                            <FormLabel className="sr-only">Altura em cm</FormLabel>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-4 text-center" aria-hidden="true">A</span>
                                <FormControl>
                                    <Input type="number" step="0.1" className="pl-8" placeholder="0" {...field} />
                                </FormControl>
                            </div>
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="depth"
                    render={({ field }) => (
                        <FormItem className="flex-1 space-y-1">
                            <FormLabel className="sr-only">Profundidade em cm</FormLabel>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-4 text-center" aria-hidden="true">P</span>
                                <FormControl>
                                    <Input type="number" step="0.1" className="pl-8" placeholder="0" {...field} />
                                </FormControl>
                            </div>
                        </FormItem>
                    )}
                />
            </div>
            {!hasDimensions && (
                <p className="text-[0.8rem] text-destructive font-medium">As dimensões são obrigatórias para aprovação.</p>
            )}
        </div>
    )
}
