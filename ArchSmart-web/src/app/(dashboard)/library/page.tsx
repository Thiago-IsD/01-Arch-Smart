import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { filtrosDaUrl } from "@/features/library/filters"
import { LibraryData } from "./components/LibraryData"

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

            {/*
              * `library-shell-streaming`, e nao `library-skeleton`: este
              * fallback e o SERVIDOR fazendo stream (o LibraryData ainda nao
              * chegou), e o skeleton do `QueryBoundary` dentro do
              * LibraryContent e o CLIENTE carregando a lista. Os dois tinham o
              * mesmo testid ate a Tarefa 7 da Secao 8, e um teste que esperasse
              * "o skeleton do cliente apareceu" passava aqui sem nunca chegar
              * ao boundary. O nome tambem era falso: o que gira aqui e um
              * spinner, nao um skeleton.
              */}
            <Suspense fallback={
                <div data-testid="library-shell-streaming" className="flex flex-1 items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            }>
                <LibraryData filtros={filtrosDaUrl(searchParams)} />
            </Suspense>
        </div>
    )
}
