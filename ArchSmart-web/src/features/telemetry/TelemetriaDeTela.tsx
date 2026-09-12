"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useProntidao } from "./contexto"
import type { Report } from "./contexto"
import { useTrack } from "./hooks"
import { decidirMedicao, normalizarTela, vazioDoDesfecho, type MedidoDe } from "./types"

declare global {
    interface Window {
        __arqsmartOuvinteDeClique?: boolean
    }
}

/** Instante do ultimo clique em link interno, para ancorar o cronometro. */
let marcaDeClique: number | null = null

function instalarOuvinteDeClique() {
    if (typeof window === "undefined" || window.__arqsmartOuvinteDeClique) return
    window.__arqsmartOuvinteDeClique = true
    // Fase de CAPTURA: o handler do React pode chamar preventDefault, e a marca
    // precisa existir de qualquer forma.
    document.addEventListener(
        "click",
        (evento) => {
            const alvo = (evento.target as HTMLElement | null)?.closest("a[href]")
            if (!alvo) return
            const href = alvo.getAttribute("href") ?? ""
            // Link interno so: "/library", nao "https://..." nem "#ancora".
            if (!href.startsWith("/")) return
            marcaDeClique = performance.now()
        },
        true
    )
}

/** O que uma navegacao ainda deve ao banco. */
interface Pendencia {
    pathname: string
    inicio: number
    medidoDe: MedidoDe
    instanteDaPintura: number | null
    anunciadas: () => number
}

/**
 * Emite `screen_viewed` uma vez por navegacao.
 *
 * Nao infere nada: ouve o canal de prontidao. Quem sabe que os dados estao na
 * tela e o QueryBoundary, e e a mesma coisa que sabe se a tela esta vazia. Ver
 * o protocolo em docs/dev/modulos/telemetry.md e a decisao 2 da spec da
 * Secao 8.
 *
 * Monta DENTRO do ProntidaoDaTelaProvider.
 */
export function TelemetriaDeTela() {
    const pathname = usePathname()
    const prontidao = useProntidao()
    const track = useTrack()

    const pendencia = useRef<Pendencia | null>(null)
    const jaEmitido = useRef<string | null>(null)

    useEffect(() => {
        instalarOuvinteDeClique()

        const emitir = (p: Pendencia, report: Report | null) => {
            if (jaEmitido.current === p.pathname) return
            jaEmitido.current = p.pathname
            if (pendencia.current === p) pendencia.current = null

            const houveAnuncio = p.anunciadas() > 0
            // O instante da pintura e usado SO quando a tela nao tinha regiao
            // nenhuma. Capturar e usar sao momentos diferentes: e isso que
            // permite um load_ms honesto sem decidir no primeiro frame.
            const fim =
                report === null && !houveAnuncio && p.instanteDaPintura !== null
                    ? p.instanteDaPintura
                    : performance.now()

            track("screen_viewed", {
                screen: normalizarTela(p.pathname),
                load_ms: Math.round(fim - p.inicio),
                medido_ate: decidirMedicao(report, houveAnuncio),
                medido_de: p.medidoDe,
                is_empty: vazioDoDesfecho(report?.desfecho ?? null),
                principal_declarada: report?.principal ?? false,
            })
        }

        // 1. Descarrega a navegacao ANTERIOR, se houver uma em aberto e ela for
        //    de outro caminho. Isto roda antes do `limpar()`, porque o canal
        //    ainda guarda os anuncios daquela navegacao.
        //
        //    NAO faca isso no cleanup do efeito: o StrictMode monta, desmonta e
        //    monta de novo com o MESMO pathname, e emitir no cleanup produziria
        //    uma linha espuria — e, pelo dedupe, mataria a linha real.
        const anterior = pendencia.current
        if (anterior && anterior.pathname !== pathname) emitir(anterior, null)

        prontidao?.limpar()

        const medidoDe: MedidoDe = marcaDeClique !== null ? "clique" : "commit"
        const atual: Pendencia = {
            pathname,
            inicio: marcaDeClique ?? performance.now(),
            medidoDe,
            instanteDaPintura: null,
            anunciadas: () => prontidao?.anunciadas() ?? 0,
        }
        marcaDeClique = null
        pendencia.current = atual

        let aguardandoFolga = 0
        let candidato: Report | null = null

        // Um report principal emite na hora. Um nao-principal espera um frame,
        // para que uma principal que chegue no MESMO commit ganhe dele. Sem essa
        // folga, a ordem da arvore decidiria o numero.
        const aoReportar = (report: Report) => {
            // Atalho: a guarda que DECIDE e a de dentro do `emitir`. Tirar esta
            // daqui nao muda o comportamento de nenhum teste — medido por
            // mutacao em 11/09/2026. Tirar as DUAS faz a tela contar dobrado
            // sob StrictMode com cache quente, que e a configuracao da
            // Biblioteca; o teste que pega isso e o "sob StrictMode, com cache
            // quente, ainda emite exatamente uma linha".
            if (jaEmitido.current === pathname) return
            if (report.principal) {
                cancelAnimationFrame(aguardandoFolga)
                emitir(atual, report)
                return
            }
            if (candidato) return
            candidato = report
            aguardandoFolga = requestAnimationFrame(() => emitir(atual, candidato))
        }

        const cancelarAssinatura = prontidao?.assinar(aoReportar)

        const naPintura = requestAnimationFrame(() => {
            atual.instanteDaPintura = performance.now()
        })

        // 2. A sessao pode terminar nesta tela. Sem isto, a ultima navegacao — a
        //    que diz onde o usuario parou — nunca chega.
        const aoSair = () => emitir(atual, null)
        window.addEventListener("pagehide", aoSair)

        return () => {
            cancelarAssinatura?.()
            cancelAnimationFrame(naPintura)
            cancelAnimationFrame(aguardandoFolga)
            window.removeEventListener("pagehide", aoSair)
            // Sem emissao aqui, de proposito: o StrictMode desmonta e remonta
            // com o MESMO pathname. Emitir aqui produz uma linha espuria de
            // `abandonado` no primeiro desmonte e, pelo dedupe, mata a linha
            // real — medido por mutacao em 11/09/2026, e o teste que pega isso
            // e o "sob StrictMode emite exatamente uma linha".
        }
    }, [pathname, prontidao, track])

    return null
}
