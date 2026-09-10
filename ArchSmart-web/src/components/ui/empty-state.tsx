import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

/**
 * O estado vazio e decisao de produto, nao de tela: toda tela vazia diz o que
 * aconteceu e, quando existe, oferece a saida. Por isso `titulo` e `descricao`
 * sao obrigatorios — vazio mudo e o defeito que este componente evita.
 */
export function EmptyState({
    titulo,
    descricao,
    icone,
    acao,
}: {
    titulo: string
    descricao: string
    icone?: ReactNode
    acao?: { rotulo: string; aoClicar: () => void }
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
            {icone}
            <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
            <p className="max-w-sm text-sm">{descricao}</p>
            {acao ? <Button onClick={acao.aoClicar}>{acao.rotulo}</Button> : null}
        </div>
    )
}
