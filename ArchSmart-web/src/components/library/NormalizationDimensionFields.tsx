"use client"

import { Control } from "react-hook-form"
import { FormControl, FormField, FormItem } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NormalizationFormValues } from "./normalization-sheet-schema"

interface NormalizationDimensionFieldsProps {
    control: Control<NormalizationFormValues>
    hasDimensions: boolean
}

// Os três campos de dimensão (L/A/P, em cm) do formulário de normalização,
// com o aviso de obrigatoriedade — dimensões completas são condição para
// aprovar o item do inbox. Extraído de NormalizationSheet.tsx sem mudança de
// JSX nem de regra.
export function NormalizationDimensionFields({ control, hasDimensions }: NormalizationDimensionFieldsProps) {
    return (
        <div className="space-y-3">
            <label className="text-sm font-medium leading-none">
                Dimensões: Largura x Altura x Prof. (cm) {!hasDimensions && <span className="text-destructive">*</span>}
            </label>
            <div className="flex gap-2">
                <FormField
                    control={control}
                    name="width"
                    render={({ field }) => (
                        <FormItem className="flex-1 space-y-1">
                            <FormControl>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-4 text-center">L</span>
                                    <Input type="number" step="0.1" className="pl-8" placeholder="0" title="Largura em cm" {...field} />
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="height"
                    render={({ field }) => (
                        <FormItem className="flex-1 space-y-1">
                            <FormControl>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-4 text-center">A</span>
                                    <Input type="number" step="0.1" className="pl-8" placeholder="0" title="Altura em cm" {...field} />
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="depth"
                    render={({ field }) => (
                        <FormItem className="flex-1 space-y-1">
                            <FormControl>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-4 text-center">P</span>
                                    <Input type="number" step="0.1" className="pl-8" placeholder="0" title="Profundidade em cm" {...field} />
                                </div>
                            </FormControl>
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
