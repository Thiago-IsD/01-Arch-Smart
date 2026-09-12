// Categorias de produto do catálogo. Mesma lista de product-form-schema.ts e
// normalization-sheet-schema.ts, mantida separada porque a linha da planilha
// de lote não passa por react-hook-form/zod — é estado simples (ver Row).
export const CATEGORIES = [
    "Mobiliário",
    "Iluminação",
    "Decoração",
    "Revestimentos",
    "Marcenaria",
    "Paisagismo",
    "Outros",
]

// Campos numéricos aceitam string vazia para permitir apagar o valor no input.
export type NumField = number | ""

export interface Row {
    id: string
    name: string
    store?: string
    image_url?: string | null
    source_url: string
    category: string
    price: NumField
    width: NumField
    height: NumField
    depth: NumField
    yield_factor: NumField
    selected: boolean
}

export const toNum = (v: NumField): number => (v === "" ? 0 : Number(v))
export const rowHasDims = (r: Row): boolean =>
    toNum(r.width) > 0 && toNum(r.height) > 0 && toNum(r.depth) > 0
