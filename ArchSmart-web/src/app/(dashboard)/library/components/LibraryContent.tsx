"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { ProductCard } from "@/components/library/ProductCard"
import { LibraryToolbar } from "@/components/library/LibraryToolbar"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { ProductFormSheet } from "@/components/library/ProductFormSheet"
import { ClipperOnboarding } from "@/components/library/ClipperOnboarding"
import { Button } from "@/components/ui/button"
import { useProducts, useProduct, useInboxCount, RESPOSTA_VAZIA } from "@/features/library/hooks"
import { filtrosDaUrl } from "@/features/library/filters"

// `loading: () => null` porque estes dois sao overlay (sheet e modal). Um
// modal fechado nao ocupa espaco no fluxo da pagina, entao o fallback dele
// tambem nao pode ocupar: `next/dynamic` e lazy + Suspense, e um Skeleton
// aqui desenhava um bloco cinza de 256px embaixo da grade enquanto o chunk
// nao chegava — com o modal fechado. Quem espera ver algo carregando e quem
// abriu o overlay, e ai o proprio overlay ja tem o estado dele.
const NormalizationSheet = dynamic(
    () => import("@/components/library/NormalizationSheet").then((m) => m.NormalizationSheet),
    { loading: () => null },
)
const BatchNormalizeModal = dynamic(
    () => import("@/components/library/BatchNormalizeModal").then((m) => m.BatchNormalizeModal),
    { loading: () => null },
)

export function LibraryContent() {
    const searchParams = useSearchParams()
    const filtros = filtrosDaUrl(searchParams)
    const [batchOpen, setBatchOpen] = useState(false)

    // Estes dois nao sao filtro de busca — sao estado de UI vindo da URL.
    const action = searchParams.get("action") || undefined
    const editId = searchParams.get("id") || undefined

    const needsList = filtros.tab === "library" || filtros.tab === "inbox"

    // Lista de produtos da aba atual — cacheada por combinação de filtros.
    // placeholderData mantém a lista anterior visível enquanto a nova carrega,
    // evitando "pulos" de layout ao paginar/filtrar.
    const { data, isLoading } = useProducts(filtros, { ativo: needsList })

    // Contagem do inbox (badge) — independente da aba, sempre o total de CAPTURED.
    const { data: inboxCount = 0 } = useInboxCount()

    // Produto em edição/normalização (quando aplicável).
    const { data: productToEdit } = useProduct(editId, action === "edit" || action === "normalize")

    const result = data ?? RESPOSTA_VAZIA
    const products = result.items

    return (
        <>
            <LibraryToolbar inboxCount={inboxCount} />

            <div className="flex-1 flex flex-col space-y-4 mt-4">
                {filtros.tab === "inbox" && (
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
                            <div data-testid="product-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {products.length > 0 ? (
                                    products.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            id={product.id}
                                            name={product.name}
                                            store={product.store ?? undefined}
                                            price={product.price ?? undefined}
                                            image_url={product.image_url}
                                            state={product.state ? product.state.name : undefined}
                                            origin={product.origin ? product.origin.name : undefined}
                                            dimensions={product.dimensions ?? undefined}
                                            isInbox={filtros.tab === "inbox"}
                                        />
                                    ))
                                ) : (
                                    <div data-testid="library-empty" className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground">
                                        <p>Nenhum produto encontrado com os filtros selecionados.</p>
                                        {(filtros.q || (filtros.categories?.length ?? 0) > 0 || (filtros.origins?.length ?? 0) > 0) && (
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

                {filtros.tab === "clipper" && <ClipperOnboarding />}
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
