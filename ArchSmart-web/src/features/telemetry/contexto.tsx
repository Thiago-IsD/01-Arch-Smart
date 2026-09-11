"use client"

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react"

/**
 * O canal do `is_empty`.
 *
 * Quem sabe se a tela esta vazia e o QueryBoundary, nao o shell. Este contexto
 * carrega esse unico dado da tela ate a telemetria, para que nenhuma tela
 * precise lembrar de reportar nada.
 *
 * Guardado em ref, e nao em state, DE PROPOSITO: um setState aqui re-renderiza
 * a arvore inteira do dashboard a cada boundary que decide, e o valor so e
 * lido uma vez, na hora de emitir o evento.
 */
interface VazioDaTela {
    reportar: (vazio: boolean) => void
    ler: () => boolean | null
    limpar: () => void
}

const Contexto = createContext<VazioDaTela | null>(null)

export function VazioDaTelaProvider({ children }: { children: ReactNode }) {
    const valor = useRef<boolean | null>(null)
    const canal = useMemo<VazioDaTela>(
        () => ({
            reportar: (vazio: boolean) => {
                valor.current = vazio
            },
            ler: () => valor.current,
            limpar: () => {
                valor.current = null
            },
        }),
        []
    )
    return <Contexto.Provider value={canal}>{children}</Contexto.Provider>
}

/**
 * Uma unica referencia para o caso "fora do provider".
 *
 * Se fosse `() => {}` escrito no `return`, cada render devolveria uma funcao
 * nova, e o efeito do QueryBoundary que depende dela rodaria a cada render.
 */
const NAO_REPORTA = () => {}

/**
 * O QueryBoundary chama isto.
 *
 * Fora do provider vira no-op: a galeria `/dev/componentes` usa o boundary e
 * NAO fica dentro de `(dashboard)`. Sem o no-op, abrir a galeria estouraria.
 */
export function useReportarVazio(): (vazio: boolean) => void {
    const canal = useContext(Contexto)
    return canal ? canal.reportar : NAO_REPORTA
}

export function useVazioDaTela(): VazioDaTela | null {
    return useContext(Contexto)
}
