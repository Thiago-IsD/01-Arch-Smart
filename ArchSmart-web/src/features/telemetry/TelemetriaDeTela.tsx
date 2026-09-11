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
 * O `load_ms` vem de quando as queries em voo assentam — isso e "dados na
 * tela", que e a metrica do orcamento de performance. Tela sem query nenhuma
 * emite depois da pintura, e `medido_ate` diz qual dos dois o numero e.
 *
 * "Em voo" e no cliente inteiro, nao so nesta rota; ver o comentario de
 * `buscandoAlgo` antes de tratar o numero como tempo desta tela.
 *
 * Monta DENTRO do QueryProvider, senao `useQueryClient` estoura.
 */
export function TelemetriaDeTela() {
    const pathname = usePathname()
    const queryClient = useQueryClient()
    const vazioDaTela = useVazioDaTela()
    const track = useTrack()

    // Dedupe por navegacao: o duplo-efeito do StrictMode monta este efeito
    // duas vezes em desenvolvimento, e sem isto cada tela contaria duas.
    //
    // A guarda mora dentro do `emitir`, NAO na entrada do efeito, e a diferenca
    // e entre emitir uma vez e nao emitir nunca. Guardando na entrada, o run 1
    // gravava a ref, assinava o cache e agendava o frame; o cleanup do
    // StrictMode cancelava a inscricao e o frame; o run 2 batia na ref e
    // voltava sem assinar nada. Os dois caminhos de emissao morriam, e o
    // resultado em `npm run dev` era ZERO evento, nao dois — com o agravante de
    // que `npm run dev` e o modo em que a conferencia manual acontece.
    const jaEmitido = useRef<string | null>(null)

    useEffect(() => {
        vazioDaTela?.limpar()

        const inicio = performance.now()
        let emitido = false
        let aguardandoRender = 0

        const emitir = (queriesAssentaram: boolean) => {
            if (emitido || jaEmitido.current === pathname) return
            emitido = true
            jaEmitido.current = pathname
            track("screen_viewed", {
                screen: normalizarTela(pathname),
                load_ms: Math.round(performance.now() - inicio),
                medido_ate: decidirMedicao({ queriesAssentaram }),
                // null, e nao false: "nao sei" e "nao esta vazia" sao coisas
                // diferentes, e gravar false aqui inventaria uma medicao.
                is_empty: vazioDaTela?.ler() ?? null,
            })
        }

        /**
         * "Tem QUALQUER query em voo no cliente inteiro?" — e nao "desta
         * navegacao". Le com atencao antes de confiar na bandeira abaixo.
         */
        const buscandoAlgo = () =>
            queryClient
                .getQueryCache()
                .getAll()
                .some((q) => q.state.fetchStatus !== "idle")

        // A bandeira significa "alguma query estava em voo no cliente enquanto
        // esta tela carregava" — NAO "esta tela buscou alguma coisa".
        //
        // Ela e melhor do que perguntar ao cache se ele tem alguma ENTRADA
        // (`getAll().length > 0`), que era a versao anterior: aquela nunca
        // voltava falso da segunda navegacao em diante, porque as queries da
        // tela anterior ficam no cache ate o gcTime — tela sem query nenhuma
        // nunca pegava o caminho da pintura e esperava um evento de cache que
        // so chega na coleta de lixo (`load_ms` de minutos rotulado `dados`), e
        // revisita com cache quente nao emitia nada.
        //
        // Mas o escopo continua sendo o cliente, nao a navegacao, e isso tem
        // consequencia MEDIDA: com uma query alheia de 400 ms em voo na hora da
        // navegacao, uma tela sem query nenhuma emite `medido_ate: "dados"` com
        // `load_ms` de ~430 ms — cronometrando a query da tela anterior. Nao e
        // hipotese: o React Query nao cancela fetch no unmount, entao sair de
        // uma tela lenta antes de ela terminar produz exatamente isso na
        // seguinte. Escopar de verdade exige olhar os observadores montados
        // nesta navegacao, que e mudanca de desenho — decidido para a Secao 8,
        // que reescreve estas telas de qualquer jeito.
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
