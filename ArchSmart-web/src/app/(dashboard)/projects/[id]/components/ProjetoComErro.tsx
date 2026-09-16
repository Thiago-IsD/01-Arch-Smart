"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ProjetoComErro({ erro, refazer }: { erro: Error; refazer: () => void }) {
    return (
        <div
            data-testid="projeto-error"
            role="alert"
            className="flex w-full flex-col items-center justify-center gap-3 py-16 text-center"
        >
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="font-medium text-foreground">Não foi possível carregar o projeto.</p>
            <p className="max-w-sm text-sm text-muted-foreground">{erro.message}</p>
            <div className="flex gap-2">
                <Button variant="outline" onClick={refazer}>
                    Tentar de novo
                </Button>
                <Button variant="ghost" asChild>
                    <Link href="/projects">Voltar para Projetos</Link>
                </Button>
            </div>
        </div>
    )
}
