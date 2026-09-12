"use client"

import { useEffect, useRef, type ReactElement, type ReactNode } from "react"
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
 *
 * ## ⚠️ NAO passe uma query DESABILITADA para este componente
 *
 * No react-query v5, query com `enabled: false` fica `status: "pending"` e
 * `fetchStatus: "idle"` PARA SEMPRE. Este boundary gateia pelo `isPending`,
 * entao uma tela que lhe entregue uma query desabilitada mostra **skeleton
 * eterno** — nao ha dado chegando para trocar o estado. Isto nao e conserto
 * pendente: e consequencia de `enabled`, e o componente nao tem como inventar
 * um estado para "a pergunta ainda nao faz sentido".
 *
 * **O certo e nao renderizar o boundary nesse caso** — renderize o proprio
 * placeholder da tela (ou nada) enquanto a query nao faz sentido, e entre no
 * boundary quando ela estiver ligada. A Biblioteca faz assim: nao renderiza o
 * boundary na aba que nao precisa da lista.
 *
 * O que o componente FAZ por conta dele: enquanto a query esta desabilitada,
 * **nao anuncia** ao canal de prontidao. Sem isso a telemetria contava uma
 * regiao que nunca ia reportar e gravava `medido_ate: "abandonado"` na saida da
 * tela — numero falso, que e pior que numero ausente. Ele volta a anunciar no
 * momento em que a query e ligada. `features/library/hooks.ts` tem quatro
 * queries gateadas por `enabled`, e query dependente e o caso comum das oito
 * telas seguintes.
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

    // Identidade desta regiao para o canal: um objeto estavel por instancia.
    // O canal conta regioes DISTINTAS, e e isto que impede o StrictMode — que
    // roda o efeito duas vezes — de contar esta regiao duas vezes.
    const origem = useRef({}).current

    // Query desabilitada (`enabled: false`) fica `isPending` com `fetchStatus`
    // em `idle` indefinidamente. Ver o aviso no docstring: aqui isso serve para
    // NAO anunciar uma regiao que nunca vai reportar, senao a telemetria grava
    // `abandonado` falso na saida da tela.
    const desabilitada = query.isPending && query.fetchStatus === "idle"

    // Anuncia UMA vez, na montagem: e o que distingue "tela sem regiao de
    // dados" de "regiao ainda carregando". Sem isto a telemetria teria de
    // decidir no primeiro frame, que e o defeito que esta secao conserta.
    useEffect(() => {
        if (desabilitada) return
        prontidao?.anunciar(origem)
    }, [prontidao, origem, desabilitada])

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
        if (desfecho) prontidao?.reportar({ desfecho, principal, origem })
    }, [desfecho, principal, prontidao, origem])

    if (query.isPending) return <>{skeleton}</>
    if (query.isError) return <>{error(query.error as Error, () => void query.refetch())}</>
    if (vazio) return <>{empty}</>

    return <>{children(query.data as T)}</>
}
