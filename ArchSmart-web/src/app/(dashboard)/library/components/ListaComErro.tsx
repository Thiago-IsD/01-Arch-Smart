"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * O estado que nao existia.
 *
 * Antes desta tarefa a lista que falhava caia no `data ?? RESPOSTA_VAZIA` e a
 * tela dizia "Nenhum produto encontrado com os filtros selecionados." —
 * mostrava vazio onde a verdade era falha, e o usuario ficava mexendo nos
 * filtros para consertar uma API fora do ar.
 *
 * A mensagem do erro e exibida porque `lib/api/errors.ts` ja garante que ela e
 * frase de dominio em pt-BR, ou o fallback generico quando o corpo e o 422 de
 * schema. Trocar isso por um "algo deu errado" fixo jogaria fora a unica pista
 * que o usuario tem.
 */
export function ListaComErro({ erro, refazer }: { erro: Error; refazer: () => void }) {
    return (
        <div
            data-testid="library-error"
            role="alert"
            className="flex flex-col items-center justify-center gap-3 py-10 text-center"
        >
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="font-medium text-foreground">Não foi possível carregar os produtos.</p>
            <p className="max-w-sm text-sm text-muted-foreground">{erro.message}</p>
            <Button variant="outline" onClick={refazer}>
                Tentar de novo
            </Button>
        </div>
    )
}
