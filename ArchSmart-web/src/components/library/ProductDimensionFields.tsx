"use client"

import { Control } from "react-hook-form"
import { FormControl, FormField, FormItem } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ProductFormValues } from "./product-form-schema"

interface ProductDimensionFieldsProps {
    control: Control<ProductFormValues>
}

// Os três campos de dimensão (largura/altura/profundidade, em cm) do
// formulário de produto. Extraído de ProductFormSheet.tsx sem mudança de
// comportamento — mesmo JSX, mesmos nomes de campo.
export function ProductDimensionFields({ control }: ProductDimensionFieldsProps) {
    return (
        <div className="flex gap-2">
            <FormField
                control={control}
                name="width"
                render={({ field }) => (
                    <FormItem className="flex-1">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Largura</span>
                            <FormControl>
                                <Input type="number" placeholder="L" title="Largura" {...field} />
                            </FormControl>
                        </div>
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name="height"
                render={({ field }) => (
                    <FormItem className="flex-1">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Altura</span>
                            <FormControl>
                                <Input type="number" placeholder="A" title="Altura" {...field} />
                            </FormControl>
                        </div>
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name="depth"
                render={({ field }) => (
                    <FormItem className="flex-1">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Profundidade</span>
                            <FormControl>
                                <Input type="number" placeholder="P" title="Profundidade" {...field} />
                            </FormControl>
                        </div>
                    </FormItem>
                )}
            />
        </div>
    )
}
