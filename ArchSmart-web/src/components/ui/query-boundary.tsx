"use client"

import type { ReactElement, ReactNode } from "react"
import type { UseQueryResult } from "@tanstack/react-query"

/**
 * Fronteira de query com os estados obrigatorios por tipo.
 *
 * `skeleton`, `empty` e `error` nao tem default de proposito: o caminho feliz
 * sozinho deixa de compilar. Esses tres sao os estados de dado dos 5 da
 * constituicao; "padrao" e o proprio `children`, e "hover/foco" e estado
 * visual, cobrado pelo lint de acessibilidade e pela galeria.
 */
type Props<T> = {
    query: UseQueryResult<T>
    skeleton: ReactNode
    empty: ReactNode
    error: (erro: Error, refazer: () => void) => ReactNode
    /** Quando o dado nao e lista. Sem isto, vazio = array de tamanho 0. */
    isEmpty?: (dados: T) => boolean
    children: (dados: T) => ReactNode
}

export function QueryBoundary<T>({
    query,
    skeleton,
    empty,
    error,
    isEmpty,
    children,
}: Props<T>): ReactElement {
    if (query.isPending) return <>{skeleton}</>
    if (query.isError) return <>{error(query.error as Error, () => void query.refetch())}</>

    const dados = query.data as T
    const vazio = isEmpty ? isEmpty(dados) : Array.isArray(dados) && dados.length === 0
    if (vazio) return <>{empty}</>

    return <>{children(dados)}</>
}
