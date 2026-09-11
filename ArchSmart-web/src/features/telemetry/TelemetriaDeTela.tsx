"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useVazioDaTela } from "./contexto"
import { useTrack } from "./hooks"
import { decidirMedicao, normalizarTela } from "./types"

/**
 * Emite `screen_viewed` uma vez por navegacao.
 *
 * O `load_ms` vem de quando as queries da rota assentam — isso e "dados na
 * tela", que e a metrica do orcamento de performance. Tela sem query nenhuma
 * emite depois da pintura, e `medido_ate` diz qual dos dois o numero e.
 *
 * Monta DENTRO do QueryProvider, senao `useQueryClient` estoura.
 */
export function TelemetriaDeTela() {
    const pathname = usePathname()
    const queryClient = useQueryClient()
    const vazioDaTela = useVazioDaTela()
    const track = useTrack()

    // Dedupe por navegacao: o duplo-efeito do StrictMode monta este efeito
    // duas vezes em desenvolvimento, e sem isto cada tela conta duas.
    const jaEmitido = useRef<string | null>(null)

    useEffect(() => {
        if (jaEmitido.current === pathname) return
        jaEmitido.current = pathname
        vazioDaTela?.limpar()

        const inicio = performance.now()
        let emitido = false
        let aguardandoRender = 0

        const emitir = (queriesAssentaram: boolean) => {
            if (emitido) return
            emitido = true
            track("screen_viewed", {
                screen: normalizarTela(pathname),
                load_ms: Math.round(performance.now() - inicio),
                medido_ate: decidirMedicao({ queriesAssentaram }),
                // null, e nao false: "nao sei" e "nao esta vazia" sao coisas
                // diferentes, e gravar false aqui inventaria uma medicao.
                is_empty: vazioDaTela?.ler() ?? null,
            })
        }

        const buscandoAlgo = () =>
            queryClient
                .getQueryCache()
                .getAll()
                .some((q) => q.state.fetchStatus !== "idle")

        // Escopo de NAVEGACAO, nao do cache inteiro: "esta tela chegou a
        // buscar alguma coisa?".
        //
        // Perguntar ao cache global se ele tem alguma entrada (`getAll().length
        // > 0`) responde outra pergunta: da segunda navegacao em diante o cache
        // NUNCA esta vazio, porque as queries da tela anterior continuam la ate
        // o gcTime. Duas consequencias, as duas ruins: uma tela sem query
        // nenhuma nunca pegava o caminho da pintura e ficava esperando um
        // evento de cache que so chega na coleta de lixo — `load_ms` de
        // minutos, rotulado `dados`; e revisitar uma tela com cache quente nao
        // dispara busca nenhuma, entao nada assentava e o evento nunca saia.
        let algumaBuscou = buscandoAlgo()

        const avaliar = () => {
            if (buscandoAlgo()) {
                algumaBuscou = true
                return
            }
            if (!algumaBuscou) return
            // Um frame de folga antes de ler `is_empty`: o cache assenta ANTES
            // de o React re-renderizar, e o QueryBoundary so decide "vazio" no
            // render. Sem esta espera, `ler()` volta null em toda tela.
            cancelAnimationFrame(aguardandoRender)
            aguardandoRender = requestAnimationFrame(() => emitir(true))
        }

        const cancelarInscricao = queryClient.getQueryCache().subscribe(avaliar)

        // Fim do primeiro frame. Se nada buscou ate aqui, esta tela nao busca
        // dados — ou serviu tudo de cache quente — e o unico numero honesto e o
        // tempo ate a pintura, que e o que `medido_ate: "pintura"` diz.
        const aoPintar = requestAnimationFrame(() => {
            if (buscandoAlgo()) {
                algumaBuscou = true
                return
            }
            if (algumaBuscou) avaliar()
            else emitir(false)
        })

        return () => {
            cancelarInscricao()
            cancelAnimationFrame(aoPintar)
            cancelAnimationFrame(aguardandoRender)
        }
    }, [pathname, queryClient, track, vazioDaTela])

    return null
}
