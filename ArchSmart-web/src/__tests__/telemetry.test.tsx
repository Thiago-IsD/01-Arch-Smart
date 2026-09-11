import { beforeEach, describe, expect, it, vi } from "vitest"
import { StrictMode, type ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { normalizarTela, decidirMedicao } from "@/features/telemetry/types"
import type { EventoDeProduto } from "@/features/telemetry/types"
import { TelemetriaDeTela } from "@/features/telemetry/TelemetriaDeTela"
import { VazioDaTelaProvider } from "@/features/telemetry/contexto"
import { QueryBoundary } from "@/components/ui/query-boundary"

describe("normalizarTela", () => {
    it("troca uuid por [id]", () => {
        expect(normalizarTela("/projects/3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b")).toBe(
            "/projects/[id]"
        )
    })

    it("troca cada uuid de um caminho aninhado", () => {
        const caminho =
            "/projects/3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b/presentation/" +
            "8e7d6c5b-4a39-2817-6f5e-4d3c2b1a0987"
        expect(normalizarTela(caminho)).toBe("/projects/[id]/presentation/[id]")
    })

    it("deixa caminho sem id intacto", () => {
        expect(normalizarTela("/library")).toBe("/library")
    })
})

describe("decidirMedicao", () => {
    it("diz 'dados' quando alguma query da rota assentou", () => {
        expect(decidirMedicao({ queriesAssentaram: true })).toBe("dados")
    })

    it("diz 'pintura' quando a tela nao tem query nenhuma", () => {
        expect(decidirMedicao({ queriesAssentaram: false })).toBe("pintura")
    })
})

// --- TelemetriaDeTela: o gatilho do `screen_viewed` ---------------------------
//
// A parte com mais chance de errar da tarefa e QUANDO o evento sai. Estes
// testes prendem as tres situacoes que decidem `medido_ate` e o dedupe por
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
            <VazioDaTelaProvider>
                <TelemetriaDeTela />
                {children}
            </VazioDaTelaProvider>
        </QueryClientProvider>
    )
}

let cliente = clienteDeTeste()

function TelaComLista({ itens }: { itens: string[] }) {
    const query = useQuery({
        queryKey: ["tela-de-teste", itens.length],
        queryFn: async () => itens,
    })
    return (
        <QueryBoundary
            query={query}
            skeleton={<p>carregando</p>}
            empty={<p>vazio</p>}
            error={() => <p>erro</p>}
        >
            {(dados) => <p>{dados.length} itens</p>}
        </QueryBoundary>
    )
}

describe("TelemetriaDeTela", () => {
    beforeEach(() => {
        eventos.length = 0
        caminhoAtual = "/library"
        cliente = clienteDeTeste()
    })

    it("tela sem query nenhuma emite medido_ate 'pintura' e is_empty null", async () => {
        render(<Envolvido />)
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].name).toBe("screen_viewed")
        expect(eventos[0].properties.screen).toBe("/library")
        expect(eventos[0].properties.medido_ate).toBe("pintura")
        // null, nao false: ninguem reportou vazio nenhum nesta tela.
        expect(eventos[0].properties.is_empty).toBeNull()
    })

    it("tela que busca dados espera a query assentar e emite 'dados'", async () => {
        render(
            <Envolvido>
                <TelaComLista itens={["a", "b"]} />
            </Envolvido>
        )
        await screen.findByText("2 itens")
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("dados")
        expect(eventos[0].properties.is_empty).toBe(false)
    })

    it("lista vazia chega na telemetria como is_empty true", async () => {
        render(
            <Envolvido>
                <TelaComLista itens={[]} />
            </Envolvido>
        )
        await screen.findByText("vazio")
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.is_empty).toBe(true)
    })

    // A tela anterior deixou entrada no cache — que e o estado normal da
    // segunda navegacao em diante, e o caso que o gatilho original errava:
    // perguntando ao cache GLOBAL se ele tem alguma entrada, uma tela sem query
    // nenhuma nunca pegava o caminho da pintura e ficava esperando um evento de
    // cache que so chega no gcTime. Resultado: nenhum evento, ou um `load_ms`
    // de minutos rotulado `dados`.
    it("tela sem query emite mesmo com o cache quente da tela anterior", async () => {
        cliente.setQueryData(["tela-anterior"], ["deixado pela tela de antes"])
        expect(cliente.getQueryCache().getAll()).toHaveLength(1)

        render(<Envolvido />)
        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties.medido_ate).toBe("pintura")
    })

    // O StrictMode do `npm run dev` monta o efeito, desmonta e monta de novo.
    // Este teste pede EXATAMENTE uma linha, e falha dos dois lados: zero (a
    // emissao morreu no cleanup) e dois (a tela contou dobrado) reprovam
    // igual. O `next.config.ts` nao desliga Strict Mode e o default do Next 16
    // e `true`, entao este e o modo em que a prova viva do Passo 10 vai rodar.
    it("sob StrictMode emite exatamente uma linha", async () => {
        render(
            <StrictMode>
                <Envolvido>
                    <TelaComLista itens={["a", "b"]} />
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
                <TelaComLista itens={["a"]} />
            </Envolvido>
        )
        await screen.findByText("1 itens")
        await waitFor(() => expect(eventos).toHaveLength(1))

        rerender(
            <Envolvido>
                <TelaComLista itens={["a"]} />
            </Envolvido>
        )
        await new Promise((r) => setTimeout(r, 50))
        expect(eventos).toHaveLength(1)
    })
})
