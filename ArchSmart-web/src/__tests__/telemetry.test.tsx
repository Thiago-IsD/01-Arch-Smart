import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { StrictMode, type ReactNode } from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import type { EventoDeProduto } from "@/features/telemetry/types"
import { TelemetriaDeTela } from "@/features/telemetry/TelemetriaDeTela"
import { ProntidaoDaTelaProvider } from "@/features/telemetry/contexto"
import { QueryBoundary } from "@/components/ui/query-boundary"

// --- TelemetriaDeTela: o desfecho que a linha carrega -----------------------
//
// QUAL rotulo sai, e que sai UMA linha por navegacao. Os outros dois lados estao
// separados: de onde o cronometro parte e quando ele fecha ficam em
// `telemetry-ancora-de-clique.test.tsx` e `telemetry-fim-de-navegacao.test.tsx`.
// Nenhum destes substitui a prova viva (um `load_ms` real contra o banco).

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

describe("TelemetriaDeTela — desfechos", () => {
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

    it("regiao que resolve com dados emite 'dados' e is_empty false", async () => {
        render(
            <Envolvido>
                <TelaComLista itens={["a", "b"]} principal />
            </Envolvido>
        )
        await screen.findByText("2 itens")
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("dados")
        expect(eventos[0].properties.is_empty).toBe(false)
        expect(eventos[0].properties.principal_declarada).toBe(true)
    })

    it("lista vazia emite 'vazio' e is_empty true", async () => {
        render(
            <Envolvido>
                <TelaComLista itens={[]} principal />
            </Envolvido>
        )
        await screen.findByText("vazio")
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("vazio")
        expect(eventos[0].properties.is_empty).toBe(true)
    })

    // Este e o caso que o gatilho antigo errava: a regiao existe mas o dado veio
    // de hidratacao, sem requisicao do navegador. O antigo caia em "pintura" no
    // primeiro frame; este exige "dados".
    it("regiao servida por cache quente (sem requisicao) emite 'dados'", async () => {
        cliente.setQueryData(["tela-de-teste", 2], ["a", "b"])
        render(
            <Envolvido>
                <TelaComLista itens={["a", "b"]} principal />
            </Envolvido>
        )
        await screen.findByText("2 itens")
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("dados")
    })

    it("regiao em erro emite 'erro' e is_empty null", async () => {
        function TelaQueFalha() {
            const query = useQuery({
                queryKey: ["falha"],
                queryFn: async () => {
                    throw new Error("estourou")
                },
                retry: false,
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
        render(
            <Envolvido>
                <TelaQueFalha />
            </Envolvido>
        )
        await screen.findByText("erro")
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("erro")
        expect(eventos[0].properties.is_empty).toBeNull()
    })

    it("com duas regioes, quem decide e a principal, e sai uma linha so", async () => {
        render(
            <Envolvido>
                <TelaComLista itens={[]} />
                <TelaComLista itens={["a", "b", "c"]} principal />
            </Envolvido>
        )
        await screen.findByText("3 itens")
        await waitFor(() => expect(eventos).toHaveLength(1))
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(1)
        // A lista vazia tambem reportou; quem manda no is_empty e a principal.
        expect(eventos[0].properties.is_empty).toBe(false)
        expect(eventos[0].properties.principal_declarada).toBe(true)
    })

    it("sem nenhuma principal declarada, vale o primeiro report, e o evento diz isso", async () => {
        render(
            <Envolvido>
                <TelaComLista itens={["a"]} />
            </Envolvido>
        )
        await screen.findByText("1 itens")
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("dados")
        expect(eventos[0].properties.principal_declarada).toBe(false)
    })

    // A Biblioteca e as duas coisas de uma vez: StrictMode em `npm run dev` E
    // dado servido por hidratacao, que ja esta no cache no PRIMEIRO commit.
    // Ai o report sai dentro do passe 1 do StrictMode, antes do remonte — o
    // caminho em que um dedupe mal posto produz duas linhas ou nenhuma. O teste
    // acima nao cobre isto: nele a query e fria e so resolve depois do remonte.
    it("sob StrictMode, com cache quente, ainda emite exatamente uma linha", async () => {
        cliente.setQueryData(["tela-de-teste", 2], ["a", "b"])
        render(
            <StrictMode>
                <Envolvido>
                    <TelaComLista itens={["a", "b"]} principal />
                </Envolvido>
            </StrictMode>
        )
        await screen.findByText("2 itens")
        await waitFor(() => expect(eventos).toHaveLength(1))
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(1)
        expect(eventos[0].properties.medido_ate).toBe("dados")
    })

    // O StrictMode do `npm run dev` monta o efeito, desmonta e monta de novo.
    // Este teste pede EXATAMENTE uma linha, e falha dos dois lados: zero (a
    // emissao morreu no cleanup) e dois (a tela contou dobrado) reprovam
    // igual. O `next.config.ts` nao desliga Strict Mode e o default do Next 16
    // e `true`, entao este e o modo em que a prova viva vai rodar.
    it("sob StrictMode emite exatamente uma linha", async () => {
        render(
            <StrictMode>
                <Envolvido>
                    <TelaComLista itens={["a", "b"]} principal />
                </Envolvido>
            </StrictMode>
        )
        await screen.findByText("2 itens")
        await waitFor(() => expect(eventos).toHaveLength(1))
        // Folga para uma segunda emissao aparecer, se ela existir.
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(1)
        expect(eventos[0].properties.medido_ate).toBe("dados")
    })

    it("uma navegacao emite uma linha, nao duas", async () => {
        const { rerender } = render(
            <Envolvido>
                <TelaComLista itens={["a"]} principal />
            </Envolvido>
        )
        await screen.findByText("1 itens")
        await waitFor(() => expect(eventos).toHaveLength(1))

        rerender(
            <Envolvido>
                <TelaComLista itens={["a"]} principal />
            </Envolvido>
        )
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(1)
    })
})
