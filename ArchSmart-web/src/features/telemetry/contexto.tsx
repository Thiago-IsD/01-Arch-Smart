"use client"

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react"

export type Desfecho = "dados" | "vazio" | "erro"
export interface Report {
    desfecho: Desfecho
    principal: boolean
    /**
     * Identidade da regiao que reportou — um objeto estavel por instancia de
     * componente (uma `ref`), nao um id legivel.
     *
     * Existe para o aviso de duas `principal` nao disparar falso sob
     * StrictMode, onde o efeito de UMA regiao roda duas vezes. E opcional
     * porque `decidirMedicao` e testado com literais de `Report`; quem produz
     * report de verdade (o `QueryBoundary`) sempre manda.
     */
    origem?: object
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
    /**
     * "Existe regiao de dados aqui." `origem` e a identidade da regiao; duas
     * chamadas com a MESMA origem contam uma vez.
     */
    anunciar: (origem: object) => void
    reportar: (report: Report) => void
    /**
     * A telemetria ouve. Se um report ja chegou desde o ultimo `limpar()`, o
     * ouvinte o recebe NA HORA da assinatura — ver o latch abaixo.
     */
    assinar: (ouvinte: (report: Report) => void) => () => void
    /** Quantas regioes DISTINTAS anunciaram desde o ultimo `limpar()`. */
    anunciadas: () => number
    limpar: () => void
}

/**
 * Exportado para que um teste possa injetar um canal ESPIAO.
 *
 * O contrato daqui e o que as oito telas seguintes copiam, e provar "anunciou
 * uma vez, nao uma por desfecho" exige contar chamadas — o que o provider real
 * nao permite, porque `anunciadas()` deduplica por identidade de proposito.
 * Tela nenhuma usa este export: telas usam `useProntidao()`.
 */
export const ContextoDeProntidao = createContext<ProntidaoDaTela | null>(null)
const Contexto = ContextoDeProntidao

export function ProntidaoDaTelaProvider({ children }: { children: ReactNode }) {
    // Conjunto de IDENTIDADES, nao contador. Sob StrictMode o efeito de cada
    // regiao roda duas vezes e nao ha decremento no cleanup, entao um contador
    // devolvia 2 para uma regiao so — ver a pendencia 4 da Secao 7, que e onde
    // alguem vai querer contar regioes de verdade. `useRef` sobrevive ao
    // remonte simulado do StrictMode, entao a mesma regiao traz a mesma chave.
    const regioes = useRef(new Set<object>())
    const ouvintes = useRef(new Set<(report: Report) => void>())

    // O LATCH. Sem ele, um report que chegue ANTES de a telemetria assinar era
    // descartado em silencio, e o efeito era global: todo evento virava
    // `pintura`. Ver a decisao 2 da spec da Secao 8 — a dependencia de ordem
    // entre `TelemetriaDeTela` e o boundary era "acidente de posicao e nao
    // garantia".
    const ultimoReport = useRef<Report | null>(null)

    // Identidades que ja reportaram como `principal` desde o ultimo `limpar()`,
    // e se o aviso ja saiu nesta navegacao (para nao repetir a cada re-render).
    const principais = useRef(new Set<object>())
    const jaAvisou = useRef(false)

    const canal = useMemo<ProntidaoDaTela>(
        () => ({
            anunciar: (origem) => {
                regioes.current.add(origem)
            },
            reportar: (report) => {
                if (report.principal) {
                    // `origem` ausente nao da para deduplicar; nesse caso nao
                    // inventa identidade — o aviso simplesmente nao dispara,
                    // que e melhor que disparar falso.
                    if (report.origem) principais.current.add(report.origem)
                    if (
                        process.env.NODE_ENV !== "production" &&
                        principais.current.size > 1 &&
                        !jaAvisou.current
                    ) {
                        jaAvisou.current = true
                        // A guarda contra o erro de copia mais provavel das oito
                        // telas seguintes. "A primeira ganha" nao e escolha de
                        // desenho: e a ordem da arvore, e por isso precisa de
                        // aviso em vez de ficar silenciosa.
                        console.warn(
                            "[telemetria] Duas regioes marcadas como `principal` na mesma tela. " +
                                "Vale a PRIMEIRA que reportar, que e a ordem da arvore — " +
                                "o `load_ms` e o `is_empty` do `screen_viewed` saem dela. " +
                                "Marque exatamente uma."
                        )
                    }
                }
                ultimoReport.current = report
                ouvintes.current.forEach((ouvinte) => ouvinte(report))
            },
            assinar: (ouvinte) => {
                ouvintes.current.add(ouvinte)
                // Reproduz o report latchado para quem chegou depois. Isto e o
                // que tira a ordem de execucao dos efeitos do caminho critico.
                if (ultimoReport.current) ouvinte(ultimoReport.current)
                return () => {
                    ouvintes.current.delete(ouvinte)
                }
            },
            anunciadas: () => regioes.current.size,
            limpar: () => {
                // Zera TUDO que e por navegacao. O latch em especial: sem isto,
                // a tela seguinte assinaria e receberia na hora o report da
                // tela ANTERIOR, com um `load_ms` que nao e dela.
                regioes.current.clear()
                ultimoReport.current = null
                principais.current.clear()
                jaAvisou.current = false
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
