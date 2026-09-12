import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { StrictMode, type ReactNode } from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import type { EventoDeProduto } from "@/features/telemetry/types"
import { TelemetriaDeTela } from "@/features/telemetry/TelemetriaDeTela"
import { ProntidaoDaTelaProvider } from "@/features/telemetry/contexto"
import { QueryBoundary } from "@/components/ui/query-boundary"

// --- TelemetriaDeTela: o gatilho do `screen_viewed` ---------------------------
//
// A parte com mais chance de errar da tarefa e QUANDO o evento sai. Estes
// testes prendem as cinco situacoes que decidem `medido_ate` e o dedupe por
// navegacao. Eles nao substituem a prova viva (um `load_ms` real contra o
// banco), mas prendem o comportamento do gatilho.

const eventos: EventoDeProduto[] = []

vi.mock("@/lib/api/telemetry", () => ({
    enviarEventos: async (lote: EventoDeProduto[]) => {
        eventos.push(...lote)
    },
}))

let caminhoAtual = "/library"
vi.mock("next/navigation", () => ({
    usePathname: () => caminhoAtual,
}))

function clienteDeTeste() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

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

let cliente = clienteDeTeste()

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

describe("TelemetriaDeTela", () => {
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

    // `medido_de` nasce nesta tarefa e e o campo que diz de ONDE o cronometro
    // partiu. Sem este teste, ele podia sair sempre "commit" — o valor que nao
    // depende de nada — e ninguem notaria: um numero que as vezes mede do
    // clique e as vezes do commit sem dizer de qual e o defeito que a Secao 8
    // conserta.
    it("ancora no clique em link interno, e diz isso em medido_de", async () => {
        const { rerender } = render(
            <Envolvido>
                {/* preventDefault imita o <Link> do Next, que intercepta o
                    clique e navega por roteador. E por isso que o ouvinte da
                    marca de clique fica na fase de CAPTURA: na de borbulha ele
                    viria depois deste handler. */}
                <a href="/dashboard" onClick={(e) => e.preventDefault()}>
                    ir
                </a>
            </Envolvido>
        )
        await new Promise((r) => setTimeout(r, 50))

        screen.getByRole("link", { name: "ir" }).click()
        caminhoAtual = "/dashboard"
        rerender(
            <Envolvido>
                {/* preventDefault imita o <Link> do Next, que intercepta o
                    clique e navega por roteador. E por isso que o ouvinte da
                    marca de clique fica na fase de CAPTURA: na de borbulha ele
                    viria depois deste handler. */}
                <a href="/dashboard" onClick={(e) => e.preventDefault()}>
                    ir
                </a>
            </Envolvido>
        )
        // A linha que saiu e a da tela ANTERIOR, descarregada pela navegacao
        // nova; ela foi medida do commit, porque nao houve clique antes dela.
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.screen).toBe("/library")
        expect(eventos[0].properties.medido_de).toBe("commit")

        // A nova navegacao ancorou no clique.
        window.dispatchEvent(new Event("pagehide"))
        await waitFor(() => expect(eventos).toHaveLength(2))
        expect(eventos[1].properties.screen).toBe("/dashboard")
        expect(eventos[1].properties.medido_de).toBe("clique")
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
