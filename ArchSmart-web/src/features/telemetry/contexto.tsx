"use client"

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react"

export type Desfecho = "dados" | "vazio" | "erro"
export interface Report {
    desfecho: Desfecho
    principal: boolean
}

/**
 * O canal entre as regioes de dados da tela e a telemetria.
 *
 * Quem sabe que os dados estao na tela e o QueryBoundary, nao o shell — e e a
 * mesma coisa que sabe se a tela esta vazia. Antes desta secao a telemetria
 * inferia as duas espiando o QueryCache do cliente inteiro, e cronometrava a
 * query da tela anterior.
 *
 * Guardado em ref, e nao em state, DE PROPOSITO: um setState aqui re-renderiza
 * a arvore inteira do dashboard a cada regiao que resolve.
 */
export interface ProntidaoDaTela {
    anunciar: () => void
    reportar: (report: Report) => void
    assinar: (ouvinte: (report: Report) => void) => () => void
    anunciadas: () => number
    limpar: () => void
}

const Contexto = createContext<ProntidaoDaTela | null>(null)

export function ProntidaoDaTelaProvider({ children }: { children: ReactNode }) {
    const anuncios = useRef(0)
    const ouvintes = useRef(new Set<(report: Report) => void>())

    const canal = useMemo<ProntidaoDaTela>(
        () => ({
            anunciar: () => {
                anuncios.current += 1
            },
            reportar: (report) => {
                ouvintes.current.forEach((ouvinte) => ouvinte(report))
            },
            assinar: (ouvinte) => {
                ouvintes.current.add(ouvinte)
                return () => {
                    ouvintes.current.delete(ouvinte)
                }
            },
            anunciadas: () => anuncios.current,
            limpar: () => {
                anuncios.current = 0
            },
        }),
        []
    )

    return <Contexto.Provider value={canal}>{children}</Contexto.Provider>
}

/**
 * Fora do provider devolve null, e quem chama trata.
 *
 * A galeria `/dev/componentes` usa o QueryBoundary e NAO fica dentro de
 * `(dashboard)`; sem o null, abrir a galeria estouraria.
 */
export function useProntidao(): ProntidaoDaTela | null {
    return useContext(Contexto)
}
