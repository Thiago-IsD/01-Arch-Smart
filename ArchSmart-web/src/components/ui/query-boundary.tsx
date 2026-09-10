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
    /**
     * Quando o dado nao e nem lista nem pagina. Sem isto vale
     * `vazioPorPadrao` — ver o comentario dele.
     */
    isEmpty?: (dados: T) => boolean
    children: (dados: T) => ReactNode
}

/**
 * Vazio por padrao, nos DOIS formatos que a camada de dados devolve hoje.
 *
 * - **array puro** (`T[]`), de quem lista sem paginar;
 * - **pagina** (`{ items, total, page, size, pages }`), que e o que a Secao 5
 *   padronizou para toda lista paginada (ver `features/library/types.ts`,
 *   `RESPOSTA_VAZIA`).
 *
 * Os dois estao aqui porque `isEmpty` e OPCIONAL: reconhecer so o array fazia
 * toda tela paginada que esquecesse o `isEmpty` renderizar `children` com
 * lista vazia em vez do estado vazio — sem erro de tipo, sem lint e sem teste.
 * "Os estados como estrutura, nao lembrete" so vale se o caso comum estiver
 * dentro da estrutura.
 *
 * Objeto SEM `items` nao e chutado como vazio: ali o componente nao tem como
 * saber o que "vazio" quer dizer, e quem decide e o `isEmpty` da tela.
 */
function vazioPorPadrao(dados: unknown): boolean {
    if (Array.isArray(dados)) return dados.length === 0
    if (typeof dados === "object" && dados !== null && "items" in dados) {
        const itens = (dados as { items: unknown }).items
        return Array.isArray(itens) && itens.length === 0
    }
    return false
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
    const vazio = isEmpty ? isEmpty(dados) : vazioPorPadrao(dados)
    if (vazio) return <>{empty}</>

    return <>{children(dados)}</>
}
