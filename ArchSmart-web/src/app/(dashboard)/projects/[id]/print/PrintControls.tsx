"use client"

import { useState } from "react"
import Link from "next/link"
import { Printer, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

type PageSize = "A4" | "A3"

export function PrintControls({ projectId }: { projectId: string }) {
    const [pageSize, setPageSize] = useState<PageSize>("A4")

    return (
        <>
            {/* Barra de controles (somente tela) */}
            <div className="bg-white border-b px-8 py-4 sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 shadow-sm print:hidden">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/projects/${projectId}`}>
                            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Projeto
                        </Link>
                    </Button>
                    <span className="text-slate-300">|</span>
                    <h3 className="font-semibold text-sm">Visualização de Impressão</h3>
                </div>

                <div className="flex items-center gap-3">
                    {/* Seletor de formato A4 / A3 */}
                    <div className="flex items-center gap-1 rounded-lg border bg-slate-50 p-1">
                        {(["A4", "A3"] as PageSize[]).map((size) => (
                            <button
                                key={size}
                                type="button"
                                onClick={() => setPageSize(size)}
                                aria-pressed={pageSize === size}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                    pageSize === size
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-slate-500 hover:text-slate-800"
                                }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>

                    <Button
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                        size="sm"
                        onClick={() => window.print()}
                    >
                        <Printer className="w-4 h-4 mr-2" /> Imprimir / Salvar PDF
                    </Button>
                </div>
            </div>

            {/* Tamanho da página aplicado dinamicamente na impressão */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: ${pageSize};
                        margin: 15mm;
                    }
                }
            `}} />
        </>
    )
}
