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

/**
 * O ultimo clique que PODE ancorar o cronometro: quando, e para onde ia.
 *
 * O destino entra junto porque a marca sozinha vaza. Ela e global de modulo e
 * so e consumida dentro do efeito, que roda quando o `pathname` muda — entao
 * um clique que nao navega ESTE documento ficava de pe indefinidamente e
 * ancorava a navegacao seguinte num instante velho. Caso real no repositorio:
 * `(dashboard)/settings/page.tsx` abre Termos e Privacidade com
 * `target="_blank"`; o usuario lia noutra aba, voltava, clicava na Biblioteca,
 * e o evento saia `medido_de: "clique"` cronometrando a distracao dele.
 */
interface MarcaDeClique {
    instante: number
    caminho: string
}

let marcaDeClique: MarcaDeClique | null = null

function instalarOuvinteDeClique() {
    if (typeof window === "undefined" || window.__arqsmartOuvinteDeClique) return
    window.__arqsmartOuvinteDeClique = true
    // Fase de CAPTURA: o handler do React pode chamar preventDefault — e o
    // `<Link>` do Next chama —, e a marca precisa existir de qualquer forma.
    document.addEventListener(
        "click",
        (evento) => {
            // Clique modificado abre outra aba ou janela: ESTE documento nao
            // navega, e a marca viraria ancora de uma navegacao futura alheia.
            if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return
            if (evento.button !== 0) return

            const alvo = (evento.target as HTMLElement | null)?.closest("a[href]")
            if (!alvo) return

            // `target` para fora desta aba tambem nao navega este documento.
            const destino = alvo.getAttribute("target")
            if (destino && destino !== "_self") return

            const href = alvo.getAttribute("href") ?? ""
            // Interno de verdade: "/library". Nao "https://...", nao "#ancora",
            // e nao "//host/x", que e EXTERNO (protocol-relative) apesar de
            // comecar com barra.
            if (!href.startsWith("/") || href.startsWith("//")) return

            marcaDeClique = {
                instante: performance.now(),
                // Query e fragmento ficam fora: `usePathname` nao os devolve.
                caminho: href.split(/[?#]/)[0],
            }
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

        // A marca e consumida SEMPRE, e honrada so se o clique apontava para o
        // caminho que de fato commitou. As guardas do ouvinte derrubam a maior
        // parte dos cliques que nao navegam; esta conferencia e a que pega o
        // resto (link da pagina ja ativa, navegacao que falhou no meio do
        // caminho). Na duvida vale "commit": mede menos, mas nao mente — e
        // rotulo que nao mente e o objetivo desta secao.
        const marca = marcaDeClique
        marcaDeClique = null
        const ancora = marca && marca.caminho === pathname ? marca.instante : null

        const medidoDe: MedidoDe = ancora !== null ? "clique" : "commit"
        const atual: Pendencia = {
            pathname,
            inicio: ancora ?? performance.now(),
            medidoDe,
            instanteDaPintura: null,
            anunciadas: () => prontidao?.anunciadas() ?? 0,
        }
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
        // `candidato`, nao `null`: um report nao-principal pode ja ter chegado e
        // estar apenas esperando o frame de folga — e `requestAnimationFrame`
        // NAO roda em aba oculta, entao aba em segundo plano que depois e
        // fechada daria `abandonado` falso sobre uma regiao que resolveu.
        const aoSair = () => emitir(atual, candidato)
        window.addEventListener("pagehide", aoSair)

        return () => {
            cancelarAssinatura?.()
            cancelAnimationFrame(naPintura)
            cancelAnimationFrame(aguardandoFolga)
            window.removeEventListener("pagehide", aoSair)

            // Desmonte de verdade x remonte do StrictMode: os dois passam por
            // aqui, e so da para distinguir DEPOIS. Emitir de forma SINCRONA
            // aqui produz uma linha espuria de `abandonado` no primeiro
            // desmonte do StrictMode e, pelo dedupe, mata a linha real — medido
            // por mutacao em 11/09/2026, e quem pega isso e o teste "sob
            // StrictMode emite exatamente uma linha".
            //
            // Adiar um tick resolve: se o efeito voltar (StrictMode, ou
            // navegacao dentro do dashboard), ele troca `pendencia.current` por
            // outro objeto e este timeout nao faz nada. Se ninguem voltou, foi
            // desmonte de verdade — sair de (dashboard) para uma rota publica
            // (logout, landing) desmonta o layout inteiro, e nao ha navegacao
            // seguinte para descarregar a pendencia nem `pagehide` para avisar.
            //
            // A comparacao e por IDENTIDADE do objeto, nao por `pathname`: e ela
            // que distingue "a pendencia ainda e minha" de "outro efeito
            // assumiu". Por pathname, o remonte do StrictMode passaria.
            // `candidato` pelo mesmo motivo do `aoSair`, agravado por este
            // cleanup cancelar o frame de folga logo acima: sem isto, desmontar
            // no frame entre o report e a folga rotularia `abandonado` uma
            // regiao que resolveu.
            setTimeout(() => {
                if (pendencia.current === atual) emitir(atual, candidato)
            }, 0)
        }
    }, [pathname, prontidao, track])

    return null
}
