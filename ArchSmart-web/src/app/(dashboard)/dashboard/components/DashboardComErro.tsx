"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * O erro vira estado na tela, nao toast.
 *
 * Quebra de paridade DE PROPOSITO (spec do Dashboard, "A tela"): o toast some
 * sozinho e deixava o painel com os numeros zerados parecendo dado real — o
 * pior modo de falha de um painel financeiro. A mensagem vem de
 * `lib/api/errors.ts`, que garante frase de dominio em pt-BR ou o generico.
 */
export function DashboardComErro({ erro, refazer }: { erro: Error; refazer: () => void }) {
    return (
        <div
            data-testid="dashboard-error"
            role="alert"
            className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-3 p-8 py-16 text-center"
        >
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="font-medium text-foreground">Não foi possível carregar o painel.</p>
            <p className="max-w-sm text-sm text-muted-foreground">{erro.message}</p>
            <Button variant="outline" onClick={refazer}>
                Tentar de novo
            </Button>
        </div>
    )
}
