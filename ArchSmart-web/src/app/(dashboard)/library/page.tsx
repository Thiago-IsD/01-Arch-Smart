
import { Suspense } from "react"
import { ProductCard } from "@/components/library/ProductCard"
import { LibraryToolbar } from "@/components/library/LibraryToolbar"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ProductFormSheet } from "@/components/library/ProductFormSheet"
import Link from "next/link"

// Function to fetch products
async function getProducts(searchParams: {
    q?: string;
    categories?: string[];
    origins?: string[];
    sort_by?: string;
    page: number;
    size: number;
}) {
    const params = new URLSearchParams()
    params.set("page", searchParams.page.toString())
    params.set("size", searchParams.size.toString())

    if (searchParams.q) params.set("q", searchParams.q)
    if (searchParams.sort_by) params.set("sort_by", searchParams.sort_by)

    if (searchParams.categories) {
        searchParams.categories.forEach(c => params.append("categories", c))
    }
    if (searchParams.origins) {
        searchParams.origins.forEach(o => params.append("origins", o))
    }

    try {
        const res = await fetch(`http://127.0.0.1:8000/api/products?${params.toString()}`, {
            cache: "no-store",
        })

        if (!res.ok) {
            console.error(`Fetch failed with status: ${res.status}`)
            throw new Error("Failed to fetch products")
        }

        return res.json()
    } catch (error) {
        console.error("Connection error:", error)
        return { items: [], total: 0, page: 1, size: 15, pages: 0 }
    }
}

async function getProduct(id: string) {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/products/${id}`, {
            cache: "no-store",
        })
        if (!res.ok) return null
        return res.json()
    } catch (error) {
        console.error("Error fetching product:", error)
        return null
    }
}

export default async function LibraryPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams

    const q = typeof searchParams.q === "string" ? searchParams.q : undefined
    const tab = typeof searchParams.tab === "string" ? searchParams.tab : "library"
    const sort_by = typeof searchParams.sort_by === "string" ? searchParams.sort_by : "created_at_desc"
    const page = typeof searchParams.page === "string" ? parseInt(searchParams.page) : 1
    const size = typeof searchParams.size === "string" ? parseInt(searchParams.size) : 15

    // Form Actions
    const action = typeof searchParams.action === "string" ? searchParams.action : undefined
    const editId = typeof searchParams.id === "string" ? searchParams.id : undefined

    // Helper to get array from param
    const getArrayParam = (param: string | string[] | undefined): string[] => {
        if (!param) return []
        return Array.isArray(param) ? param : [param]
    }

    const categories = getArrayParam(searchParams.categories)
    const origins = getArrayParam(searchParams.origins)

    // Fetch data if on library tab
    let data = { items: [], total: 0, page: 1, size: 15, pages: 0 }
    let productToEdit = null

    if (tab === "library") {
        try {
            data = await getProducts({ q, categories, origins, sort_by, page, size })

            if (action === "edit" && editId) {
                productToEdit = await getProduct(editId)
            }
        } catch (error) {
            console.error(error)
        }
    }

    const products = data.items || []

    return (
        <div className="h-full flex flex-col space-y-6 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Biblioteca</h2>
                    <p className="text-muted-foreground">
                        Gerencie seus produtos, materiais e referências.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button asChild>
                        <Link href={{
                            pathname: "/library",
                            query: { ...searchParams, action: "new" }
                        }}>
                            <Plus className="mr-2 h-4 w-4" /> Adicionar Produto
                        </Link>
                    </Button>
                </div>
            </div>

            <LibraryToolbar />

            <div className="flex-1 flex flex-col space-y-4 mt-4">
                {tab === "inbox" && (
                    <div className="flex flex-col items-center justify-center h-[400px] border border-dashed rounded-lg">
                        <p className="text-muted-foreground">Itens capturados aparecerão aqui para normalização.</p>
                    </div>
                )}

                {tab === "library" && (
                    <>
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

                        {products.length > 0 && (
                            <PaginationControls
                                total={data.total}
                                page={data.page}
                                size={data.size}
                                pages={data.pages}
                            />
                        )}
                    </>
                )}

                {tab === "shopping" && (
                    <div className="flex flex-col items-center justify-center h-[400px] border border-dashed rounded-lg">
                        <p className="text-muted-foreground">Shopping Hub integration coming soon.</p>
                    </div>
                )}
            </div>

            {/* Product Form Sheet */}
            <ProductFormSheet
                isOpen={!!action}
                productToEdit={productToEdit}
            />
        </div>
    )
}
