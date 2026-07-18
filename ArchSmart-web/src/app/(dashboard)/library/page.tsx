import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { LibraryContent } from "./components/LibraryContent"

// Shell leve: os dados são buscados no cliente via React Query (ver
// LibraryContent), então esta página não faz round-trip ao backend nem lê
// cookies no servidor — trocar de aba passa a servir do cache do cliente.
export default async function LibraryPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams

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

            <Suspense fallback={
                <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            }>
                <LibraryContent />
            </Suspense>
        </div>
    )
}
