import * as z from "zod"

// Categorias de produto do catálogo. Mesma lista de product-form-schema.ts,
// mas mantida separada porque os dois formulários têm schemas diferentes
// (este não tem store/cost_price/markup/description) e não compartilham tipo.
export const CATEGORIES = [
    "Mobiliário",
    "Iluminação",
    "Decoração",
    "Revestimentos",
    "Marcenaria",
    "Paisagismo",
    "Outros"
]

// Schema de validação do formulário de normalização (aprovar item do inbox).
// Extraído de NormalizationSheet.tsx sem mudança de regras.
export const formSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    category: z.string().optional(),
    price: z.coerce.number().min(0, "Preço inválido").optional(),
    width: z.coerce.number().optional(),
    height: z.coerce.number().optional(),
    depth: z.coerce.number().optional(),
    yield_factor: z.coerce.number().optional(),
    source_url: z.string().url("URL inválida").optional().or(z.literal("")),
})

export type NormalizationFormValues = z.infer<typeof formSchema>
