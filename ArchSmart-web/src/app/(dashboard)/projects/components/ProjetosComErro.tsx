"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Erro vira estado na tela. Quebra de paridade DE PROPOSITO: antes, o `catch`
 * de `getProjects` devolvia `{ items: [] }` e a tela dizia "Nenhum projeto
 * ainda" para quem tinha projetos e so estava sem rede. A frase vem de
 * `lib/api/errors.ts`.
 */
export function ProjetosComErro({ erro, refazer }: { erro: Error; refazer: () => void }) {
    return (
        <div
            data-testid="projetos-error"
            role="alert"
            className="flex w-full flex-col items-center justify-center gap-3 py-16 text-center"
        >
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="font-medium text-foreground">Não foi possível carregar os projetos.</p>
            <p className="max-w-sm text-sm text-muted-foreground">{erro.message}</p>
            <Button variant="outline" onClick={refazer}>
                Tentar de novo
            </Button>
        </div>
    )
}
