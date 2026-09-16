"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * `testId` tem default porque as duas regioes do detalhe (cabecalho e
 * ambientes) usam este mesmo componente, e os dois `useQuery` sao
 * independentes: uma queda de API pode errar os dois ao mesmo tempo. Sem um
 * testid por regiao, os dois emitiriam "projeto-error" e um
 * `getByTestId("projeto-error")` estouraria por match multiplo.
 */
export function ProjetoComErro({
    erro,
    refazer,
    testId = "projeto-error",
}: {
    erro: Error
    refazer: () => void
    testId?: string
}) {
    return (
        <div
            data-testid={testId}
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
