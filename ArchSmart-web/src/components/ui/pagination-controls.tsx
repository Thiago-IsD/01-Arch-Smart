"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PaginationControlsProps {
    total: number
    page: number
    size: number
    pages: number
}

export function PaginationControls({ total, page, size, pages }: PaginationControlsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const createPageURL = (newPage: number | string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("page", newPage.toString())
        return `?${params.toString()}`
    }

    const handlePageChange = (newPage: number) => {
        router.replace(createPageURL(newPage))
    }

    const handleSizeChange = (newSize: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("size", newSize)
        params.set("page", "1") // Reset to page 1
        router.replace(`?${params.toString()}`)
    }

    // Don't render if no items or only 1 page? 
    // User wants to see "Show 15, 20..." even if just 1 page usually.
    if (total === 0) return null

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 gap-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <p>
                    Exibindo {Math.min((page - 1) * size + 1, total)} até {Math.min(page * size, total)} de {total} resultados
                </p>
            </div>

            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground hidden sm:inline-block">Por página</span>
                    <Select value={size.toString()} onValueChange={handleSizeChange}>
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={size.toString()} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[15, 30, 50, 100].map((pageSize) => (
                                <SelectItem key={pageSize} value={pageSize.toString()}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => handlePageChange(1)}
                        disabled={page === 1}
                    >
                        <span className="sr-only">Primeira página</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                    >
                        <span className="sr-only">Página anterior</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center justify-center text-sm font-medium w-[60px]">
                        Página {page} de {pages}
                    </div>

                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === pages}
                    >
                        <span className="sr-only">Próxima página</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => handlePageChange(pages)}
                        disabled={page === pages}
                    >
                        <span className="sr-only">Última página</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
