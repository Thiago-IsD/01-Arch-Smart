
import { Suspense } from "react"
import { ProductCard } from "@/components/library/ProductCard"
import { LibraryToolbar } from "@/components/library/LibraryToolbar"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

// Function to fetch products
// Function to fetch products
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

    // In a real app, use absolute URL or internal API call helper
    // For Server Components, we often need absolute URL if fetching from own API
    // Use 127.0.0.1 to avoid IPv6 issues with localhost in Node.js
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
        // Return empty structure on error to prevent crashes
        return { items: [], total: 0, page: 1, size: 15, pages: 0 }
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

    // Helper to get array from param
    const getArrayParam = (param: string | string[] | undefined): string[] => {
        if (!param) return []
        return Array.isArray(param) ? param : [param]
    }

    const categories = getArrayParam(searchParams.categories)
    const origins = getArrayParam(searchParams.origins)

    // Fetch data if on library tab
    let data = { items: [], total: 0, page: 1, size: 15, pages: 0 }

    if (tab === "library") {
        try {
            data = await getProducts({ q, categories, origins, sort_by, page, size })
        } catch (error) {
            console.error(error)
            // Handle error state gracefully
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
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Produto
                    </Button>
                </div>
            </div>

            {/* Client Component handles Search, Filters, and Tabs state sync */}
            <LibraryToolbar />

            {/* Content for Tabs - Controlled by URL state in LibraryToolbar,
                but we need to render content based on current tab param */}

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
                                        name={product.name}
                                        store={product.store} // Now supported by API
                                        price={product.price}
                                        image_url={product.image_url}
                                        state={product.state ? product.state.name : undefined} // Adjust based on API response structure
                                        origin={product.origin ? product.origin.name : undefined}
                                    // created_at is available but not displayed on card according to design, but used for sorting
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

                        {/* Pagination Controls */}
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
        </div>
    )
}
