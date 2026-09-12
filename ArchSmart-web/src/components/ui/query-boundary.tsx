"use client"

import { useEffect, type ReactElement, type ReactNode } from "react"
import type { UseQueryResult } from "@tanstack/react-query"
import { useProntidao } from "@/features/telemetry/contexto"
import type { Desfecho } from "@/features/telemetry/contexto"

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
    /**
     * Marca esta regiao como a que decide o `load_ms` e o `is_empty` da tela.
     * Uma por tela. Tela com varias regioes e nenhuma marcada usa a primeira
     * que resolver, e o evento grava `principal_declarada: false`.
     */
    principal?: boolean
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
    principal = false,
    children,
}: Props<T>): ReactElement {
    const prontidao = useProntidao()

    // Anuncia UMA vez, na montagem: e o que distingue "tela sem regiao de
    // dados" de "regiao ainda carregando". Sem isto a telemetria teria de
    // decidir no primeiro frame, que e o defeito que esta secao conserta.
    useEffect(() => {
        prontidao?.anunciar()
    }, [prontidao])

    // Calculado antes dos returns porque hook nao pode ficar atras de return.
    // `null` enquanto nao ha resposta: nao da para dizer "vazio" nem
    // "nao vazio" sobre dados que ainda nao chegaram.
    const pronto = !query.isPending && !query.isError
    const vazio = pronto
        ? isEmpty
            ? isEmpty(query.data as T)
            : vazioPorPadrao(query.data)
        : null

    const desfecho: Desfecho | null = query.isPending
        ? null
        : query.isError
          ? "erro"
          : vazio
            ? "vazio"
            : "dados"

    // Em efeito, nao no render: reportar durante o render e efeito colateral
    // no meio de uma fase que o React pode repetir ou descartar.
    useEffect(() => {
        if (desfecho) prontidao?.reportar({ desfecho, principal })
    }, [desfecho, principal, prontidao])

    if (query.isPending) return <>{skeleton}</>
    if (query.isError) return <>{error(query.error as Error, () => void query.refetch())}</>
    if (vazio) return <>{empty}</>

    return <>{children(query.data as T)}</>
}
