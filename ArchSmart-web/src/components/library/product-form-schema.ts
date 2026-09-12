import * as z from "zod"

// Categorias de produto do catálogo. Extraído de ProductFormSheet.tsx sem
// mudança de valores — mesma lista usada no formulário de criação/edição.
export const CATEGORIES = [
    "Mobiliário",
    "Iluminação",
    "Decoração",
    "Revestimentos",
    "Marcenaria",
    "Paisagismo",
    "Outros"
]

// Schema de validação do formulário de produto (criação/edição). Extraído de
// ProductFormSheet.tsx sem mudança de regras.
export const formSchema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
    store: z.string().optional(),
    category: z.string().optional(),
    price: z.coerce.number().min(0, "Preço inválido").optional(),
    cost_price: z.coerce.number().min(0, "Preço inválido").optional(),
    markup: z.coerce.number().optional(),
    image_url: z.string().url("URL inválida").optional().or(z.literal("")),
    description: z.string().optional(),
    // Dimensions
    width: z.coerce.number().optional(),
    height: z.coerce.number().optional(),
    depth: z.coerce.number().optional(),
    yield_factor: z.coerce.number().optional(),
    source_url: z.string().url("URL inválida").optional().or(z.literal("")),
})

export type ProductFormValues = z.infer<typeof formSchema>
