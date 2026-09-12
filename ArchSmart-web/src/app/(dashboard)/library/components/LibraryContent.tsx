"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { Sparkles } from "lucide-react"
import { ProductCard } from "@/components/library/ProductCard"
import { LibraryToolbar } from "@/components/library/LibraryToolbar"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { ProductFormSheet } from "@/components/library/ProductFormSheet"
import { ClipperOnboarding } from "@/components/library/ClipperOnboarding"
import { Button } from "@/components/ui/button"
import { QueryBoundary } from "@/components/ui/query-boundary"
import { Skeleton } from "@/components/ui/skeleton"
import { useProducts, useProduct, useInboxCount } from "@/features/library/hooks"
import { filtrosDaUrl } from "@/features/library/filters"
import { BibliotecaVazia } from "./BibliotecaVazia"
import { ListaComErro } from "./ListaComErro"

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
    // evitando "pulos" de layout ao paginar/filtrar. Com o QueryBoundary isso
    // continua valendo: `isPending` é falso enquanto há placeholderData, então
    // paginar não volta ao skeleton — que é o motivo de placeholderData existir.
    const query = useProducts(filtros, { ativo: needsList })

    // Contagem do inbox (badge) — independente da aba, sempre o total de CAPTURED.
    const { data: inboxCount = 0 } = useInboxCount()

    // Produto em edição/normalização (quando aplicável).
    const { data: productToEdit } = useProduct(editId, action === "edit" || action === "normalize")

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
                    // `principal` fica AQUI, e não no badge do inbox: é a lista
                    // que define "dados na tela" para esta rota, e é dela que
                    // saem o `load_ms` e o `is_empty` do `screen_viewed`.
                    <QueryBoundary
                        query={query}
                        principal
                        skeleton={
                            <div data-testid="library-skeleton" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <Skeleton key={i} className="h-64 w-full" />
                                ))}
                            </div>
                        }
                        empty={<BibliotecaVazia filtros={filtros} />}
                        error={(erro, refazer) => <ListaComErro erro={erro} refazer={refazer} />}
                    >
                        {(resposta) => (
                            <>
                                <div data-testid="product-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {resposta.items.map((product) => (
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
                                    ))}
                                </div>
                                {/*
                                  * Sem `items.length > 0` na frente: aqui
                                  * dentro a lista NUNCA esta vazia — o
                                  * boundary desviou esse caso para `empty`
                                  * antes de chamar este render. A guarda era
                                  * resto da logica manual, e resto sem
                                  * explicacao e o que as outras oito telas
                                  * copiariam junto.
                                  */}
                                <PaginationControls
                                    total={resposta.total}
                                    page={resposta.page}
                                    size={resposta.size}
                                    pages={resposta.pages}
                                />
                            </>
                        )}
                    </QueryBoundary>
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
