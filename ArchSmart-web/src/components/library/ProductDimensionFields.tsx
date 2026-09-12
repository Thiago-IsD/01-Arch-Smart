"use client"

import { Control } from "react-hook-form"
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ProductFormValues } from "./product-form-schema"

interface ProductDimensionFieldsProps {
    control: Control<ProductFormValues>
}

// Os três campos de dimensão (largura/altura/profundidade, em cm) do
// formulário de produto. Extraído de ProductFormSheet.tsx.
//
// Os rótulos visíveis são `FormLabel`, não `<span>`, e isso é o conserto do
// Art. 6 feito na Tarefa 9 da Seção 8: `FormLabel` põe `htmlFor={formItemId}` e
// o `FormControl` põe o `id` igual no input, então a associação é real. Antes
// cada input se sustentava só em atributo `title`, e a armadilha é que a regra
// do axe PASSA com `non-empty-title` — o portão ficaria verde com o Art. 6
// descumprido. Não troque `FormLabel` por `<span>` de novo.
export function ProductDimensionFields({ control }: ProductDimensionFieldsProps) {
    return (
        <div className="flex gap-2">
            <FormField
                control={control}
                name="width"
                render={({ field }) => (
                    <FormItem className="flex-1">
                        <div className="flex flex-col gap-1">
                            <FormLabel className="text-[10px] font-semibold text-muted-foreground uppercase">Largura</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="L" {...field} />
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
                            <FormLabel className="text-[10px] font-semibold text-muted-foreground uppercase">Altura</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="A" {...field} />
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
                            <FormLabel className="text-[10px] font-semibold text-muted-foreground uppercase">Profundidade</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="P" {...field} />
                            </FormControl>
                        </div>
                    </FormItem>
                )}
            />
        </div>
    )
}
