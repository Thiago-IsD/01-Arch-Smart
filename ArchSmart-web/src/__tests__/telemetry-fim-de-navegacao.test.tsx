import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type ReactNode } from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import type { EventoDeProduto } from "@/features/telemetry/types"
import { TelemetriaDeTela } from "@/features/telemetry/TelemetriaDeTela"
import { ProntidaoDaTelaProvider } from "@/features/telemetry/contexto"
import { QueryBoundary } from "@/components/ui/query-boundary"

// --- TelemetriaDeTela: QUANDO a linha fecha ---------------------------------
//
// Nao ha prazo: a decisao espera o fim da navegacao, que sao tres momentos
// concretos — a navegacao seguinte, o `pagehide` e o desmonte da arvore. Cada um
// tem o seu teste aqui, e nenhum deles pode emitir duas vezes nem perder um
// report que ja havia chegado.

const eventos: EventoDeProduto[] = []

// Intercepta a FILA, nao o envio. O que estes testes medem e quando o evento e
// emitido e com que conteudo; o lote e a janela de 1s sao assunto de
// `telemetry-fila.test.ts`. Mockar o envio punha a janela da fila dentro do
// prazo padrao do `waitFor` — 1000 ms, o mesmo numero — e quem decidiria se o
// teste passa seria o relogio.
vi.mock("@/features/telemetry/fila", () => ({
    enfileirar: (evento: EventoDeProduto) => {
        eventos.push(evento)
    },
    descarregar: () => {},
    _zerarFila: () => {},
}))

let caminhoAtual = "/library"
vi.mock("next/navigation", () => ({
    usePathname: () => caminhoAtual,
}))

function clienteDeTeste() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

let cliente = clienteDeTeste()

function Envolvido({ children }: { children?: ReactNode }) {
    return (
        <QueryClientProvider client={cliente}>
            <ProntidaoDaTelaProvider>
                <TelemetriaDeTela />
                {children}
            </ProntidaoDaTelaProvider>
        </QueryClientProvider>
    )
}

function TelaComLista({ itens, principal = false }: { itens: string[]; principal?: boolean }) {
    const query = useQuery({
        queryKey: ["tela-de-teste", itens.length],
        queryFn: async () => itens,
    })
    return (
        <QueryBoundary
            query={query}
            principal={principal}
            skeleton={<p>carregando</p>}
            empty={<p>vazio</p>}
            error={() => <p>erro</p>}
        >
            {(dados) => <p>{dados.length} itens</p>}
        </QueryBoundary>
    )
}

/** Regiao que anuncia e NUNCA resolve: o caminho do `abandonado`. */
function TelaPendente() {
    const query = useQuery({
        queryKey: ["nunca-resolve"],
        queryFn: () => new Promise<string[]>(() => {}),
    })
    return (
        <QueryBoundary
            query={query}
            principal
            skeleton={<p>carregando</p>}
            empty={<p>vazio</p>}
            error={() => <p>erro</p>}
        >
            {() => <p>nunca</p>}
        </QueryBoundary>
    )
}

describe("TelemetriaDeTela — fim de navegacao", () => {
    beforeEach(() => {
        eventos.length = 0
        caminhoAtual = "/library"
        cliente = clienteDeTeste()
    })

    // O desmonte agenda a decisao do evento para o tick seguinte (ver o cleanup
    // do TelemetriaDeTela). O desmonte automatico do RTL roda DEPOIS do teste,
    // entao sem drenar esse tick aqui a linha de um teste cairia dentro do
    // proximo — e o `beforeEach` limparia o array antes de ela chegar.
    afterEach(async () => {
        cleanup()
        await new Promise((r) => setTimeout(r, 0))
    })

    it("tela sem regiao nenhuma emite 'pintura' quando a sessao termina nela", async () => {
        render(<Envolvido />)
        // Nada foi emitido ainda: sem anuncio, a decisao espera o fim da navegacao.
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(0)

        window.dispatchEvent(new Event("pagehide"))
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("pintura")
        expect(eventos[0].properties.is_empty).toBeNull()
    })

    it("tela sem regiao nenhuma emite 'pintura' quando a navegacao seguinte comeca", async () => {
        const { rerender } = render(<Envolvido />)
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(0)

        caminhoAtual = "/dashboard"
        rerender(<Envolvido />)
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.screen).toBe("/library")
        expect(eventos[0].properties.medido_ate).toBe("pintura")
    })

    it("regiao que anuncia e nunca resolve emite 'abandonado' ao sair", async () => {
        render(
            <Envolvido>
                <TelaPendente />
            </Envolvido>
        )
        await screen.findByText("carregando")
        expect(eventos).toHaveLength(0)

        window.dispatchEvent(new Event("pagehide"))
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("abandonado")
        expect(eventos[0].properties.is_empty).toBeNull()
    })

    // Sair de (dashboard) para uma rota publica — logout, landing — desmonta o
    // layout inteiro: nao ha navegacao seguinte para descarregar a pendencia, e
    // `pagehide` NAO dispara em navegacao de cliente. Sem o adiamento no
    // cleanup, estes dois eventos se perdiam; com emissao sincrona no cleanup,
    // o StrictMode contava errado. Os dois testes abaixo prendem o caminho, e o
    // "sob StrictMode" prende o outro lado.
    it("desmonte sem pagehide emite 'pintura' na tela sem regiao", async () => {
        const { unmount } = render(<Envolvido />)
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(0)

        unmount()
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.screen).toBe("/library")
        expect(eventos[0].properties.medido_ate).toBe("pintura")
        // Folga: uma segunda linha reprova igual.
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(1)
    })

    it("desmonte sem pagehide emite 'abandonado' se a regiao nao resolveu", async () => {
        const { unmount } = render(
            <Envolvido>
                <TelaPendente />
            </Envolvido>
        )
        await screen.findByText("carregando")
        expect(eventos).toHaveLength(0)

        unmount()
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("abandonado")
        expect(eventos[0].properties.is_empty).toBeNull()
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(1)
    })

    // Pego na revisao: `aoSair` e o desmonte chamavam `emitir(atual, null)`
    // mesmo com `candidato` preenchido — um report JA RECEBIDO, so esperando o
    // frame de folga — e o cleanup ainda cancelava esse frame. A linha saia
    // `abandonado` sobre uma regiao que resolveu.
    it("pagehide nao joga fora o report que estava esperando a folga", async () => {
        // rAF que nunca dispara: e o que acontece em aba oculta, onde o frame
        // de folga nao roda. Sem isto o teste seria uma corrida com o timer de
        // 16 ms do jsdom e passaria pelo motivo errado.
        const rafOriginal = window.requestAnimationFrame
        window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame
        try {
            render(
                <Envolvido>
                    <TelaComLista itens={["a", "b"]} />
                </Envolvido>
            )
            await screen.findByText("2 itens")
            // A folga nunca chega, entao nada foi emitido ainda.
            expect(eventos).toHaveLength(0)

            window.dispatchEvent(new Event("pagehide"))
            await waitFor(() => expect(eventos).toHaveLength(1))
            expect(eventos[0].properties.medido_ate).toBe("dados")
            expect(eventos[0].properties.is_empty).toBe(false)
        } finally {
            window.requestAnimationFrame = rafOriginal
        }
    })

    // O mesmo defeito do teste acima, no outro caminho de saida — e este cleanup
    // AINDA cancela o frame de folga, entao desmontar no frame entre o report e
    // a folga rotulava `abandonado` uma regiao que resolveu.
    it("desmonte nao joga fora o report que estava esperando a folga", async () => {
        const rafOriginal = window.requestAnimationFrame
        window.requestAnimationFrame = (() => 0) as typeof window.requestAnimationFrame
        try {
            const { unmount } = render(
                <Envolvido>
                    <TelaComLista itens={["a", "b"]} />
                </Envolvido>
            )
            await screen.findByText("2 itens")
            expect(eventos).toHaveLength(0)

            unmount()
            await waitFor(() => expect(eventos).toHaveLength(1))
            expect(eventos[0].properties.medido_ate).toBe("dados")
            expect(eventos[0].properties.is_empty).toBe(false)
        } finally {
            window.requestAnimationFrame = rafOriginal
        }
    })

    // `jaEmitido` e um slot unico: guarda o ULTIMO caminho emitido, nao um
    // conjunto. E isso que faz a revisita funcionar — com um Set, voltar a uma
    // tela ja vista nunca emitiria de novo. A `key` troca a cada navegacao
    // porque e o que o App Router faz de verdade: a subarvore da rota remonta.
    it("revisitar a mesma tela emite linha nova (A -> B -> A)", async () => {
        const tela = () => (
            <Envolvido>
                <TelaComLista key={caminhoAtual} itens={["a"]} principal />
            </Envolvido>
        )
        const { rerender } = render(tela())
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.screen).toBe("/library")

        caminhoAtual = "/projects"
        rerender(tela())
        await waitFor(() => expect(eventos).toHaveLength(2))
        expect(eventos[1].properties.screen).toBe("/projects")

        caminhoAtual = "/library"
        rerender(tela())
        await waitFor(() => expect(eventos).toHaveLength(3))
        expect(eventos[2].properties.screen).toBe("/library")
        expect(eventos[2].properties.medido_ate).toBe("dados")
    })
})
