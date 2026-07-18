"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Sparkles } from "lucide-react"
import { ProductCard } from "@/components/library/ProductCard"
import { LibraryToolbar } from "@/components/library/LibraryToolbar"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { ProductFormSheet } from "@/components/library/ProductFormSheet"
import { NormalizationSheet } from "@/components/library/NormalizationSheet"
import { BatchNormalizeModal } from "@/components/library/BatchNormalizeModal"
import { ClipperOnboarding } from "@/components/library/ClipperOnboarding"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { apiUrl } from "@/lib/api-url"

interface ProductQuery {
    q?: string
    categories?: string[]
    origins?: string[]
    sort_by?: string
    page: number
    size: number
    state?: string
}

interface ProductsResponse {
    items: any[]
    total: number
    page: number
    size: number
    pages: number
}

const EMPTY_RESPONSE: ProductsResponse = { items: [], total: 0, page: 1, size: 15, pages: 0 }

async function getToken(): Promise<string | undefined> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
}

async function fetchProducts(query: ProductQuery): Promise<ProductsResponse> {
    const token = await getToken()

    const params = new URLSearchParams()
    params.set("page", query.page.toString())
    params.set("size", query.size.toString())
    if (query.q) params.set("q", query.q)
    if (query.sort_by) params.set("sort_by", query.sort_by)
    if (query.state) params.set("state", query.state)
    query.categories?.forEach((c) => params.append("categories", c))
    query.origins?.forEach((o) => params.append("origins", o))

    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(apiUrl(`/api/products?${params.toString()}`), { headers })
    if (!res.ok) throw new Error(`Failed to fetch products (${res.status})`)
    return res.json()
}

async function fetchProduct(id: string): Promise<any | null> {
    const token = await getToken()
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(apiUrl(`/api/products/${id}`), { headers })
    if (!res.ok) return null
    return res.json()
}

export function LibraryContent() {
    const searchParams = useSearchParams()
    const [batchOpen, setBatchOpen] = useState(false)

    const q = searchParams.get("q") || undefined
    const tab = searchParams.get("tab") || "library"
    const sort_by = searchParams.get("sort_by") || "created_at_desc"
    const page = parseInt(searchParams.get("page") || "1")
    const size = parseInt(searchParams.get("size") || "15")
    const categories = searchParams.getAll("categories")
    const origins = searchParams.getAll("origins")
    const action = searchParams.get("action") || undefined
    const editId = searchParams.get("id") || undefined

    const needsList = tab === "library" || tab === "inbox"
    const productState = tab === "inbox" ? "CAPTURED" : "NORMALIZED"

    // Lista de produtos da aba atual — cacheada por combinação de filtros.
    // placeholderData mantém a lista anterior visível enquanto a nova carrega,
    // evitando "pulos" de layout ao paginar/filtrar.
    const { data, isLoading } = useQuery({
        queryKey: ["products", { tab, q, categories, origins, sort_by, page, size }],
        queryFn: () => fetchProducts({ q, categories, origins, sort_by, page, size, state: productState }),
        enabled: needsList,
        placeholderData: (prev) => prev,
    })

    // Contagem do inbox (badge) — independente da aba, sempre o total de CAPTURED.
    const { data: inboxCountData } = useQuery({
        queryKey: ["inbox-count"],
        queryFn: () => fetchProducts({ page: 1, size: 1, state: "CAPTURED" }),
    })
    const inboxCount = inboxCountData?.total || 0

    // Produto em edição/normalização (quando aplicável).
    const { data: productToEdit } = useQuery({
        queryKey: ["product", editId],
        queryFn: () => fetchProduct(editId as string),
        enabled: !!editId && (action === "edit" || action === "normalize"),
    })

    const result = data ?? EMPTY_RESPONSE
    const products = result.items || []

    return (
        <>
            <LibraryToolbar inboxCount={inboxCount} />

            <div className="flex-1 flex flex-col space-y-4 mt-4">
                {tab === "inbox" && (
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => setBatchOpen(true)}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Normalizar em lote
                        </Button>
                    </div>
                )}

                {needsList && (
                    <>
                        {isLoading ? (
                            <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {products.length > 0 ? (
                                    products.map((product: any) => (
                                        <ProductCard
                                            key={product.id}
                                            id={product.id}
                                            name={product.name}
                                            store={product.store}
                                            price={product.price}
                                            image_url={product.image_url}
                                            state={product.state ? product.state.name : undefined}
                                            origin={product.origin ? product.origin.name : undefined}
                                            dimensions={product.dimensions}
                                            isInbox={tab === "inbox"}
                                        />
                                    ))
                                ) : (
                                    <div className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground">
                                        <p>Nenhum produto encontrado com os filtros selecionados.</p>
                                        {(q || categories.length > 0 || origins.length > 0) && (
                                            <Button variant="link" className="mt-2" asChild>
                                                <a href="/library">Limpar filtros</a>
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {products.length > 0 && (
                            <PaginationControls
                                total={result.total}
                                page={result.page}
                                size={result.size}
                                pages={result.pages}
                            />
                        )}
                    </>
                )}

                {tab === "clipper" && <ClipperOnboarding />}
            </div>

            {/* Product Form Sheet (Create/Edit) */}
            {action !== "normalize" && (
                <ProductFormSheet
                    isOpen={!!action && action !== "normalize"}
                    productToEdit={productToEdit}
                />
            )}

            {/* Normalization Sheet */}
            {action === "normalize" && (
                <NormalizationSheet
                    isOpen={action === "normalize"}
                    productToNormalize={productToEdit}
                />
            )}

            {/* Batch Normalization Modal */}
            <BatchNormalizeModal isOpen={batchOpen} onOpenChange={setBatchOpen} />
        </>
    )
}
