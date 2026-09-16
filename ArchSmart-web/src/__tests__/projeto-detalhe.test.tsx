import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"
import type { Ambiente, Projeto } from "@/features/projects/types"
import { ProjetoContent } from "@/app/(dashboard)/projects/[id]/components/ProjetoContent"

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "tok" }))
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/projects/p1",
}))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

const PROJETO: Projeto = {
    id: "p1",
    account_id: "a",
    client_id: "c",
    name: "Casa Jardim",
    status: "ACTIVE",
    created_at: "2026-09-01T10:00:00",
    environments_count: 1,
    client: { id: "c", name: "Ana" },
}

const SALA: Ambiente = {
    id: "e1",
    project_id: "p1",
    name: "Sala de Estar",
    type: "Interna/Seca",
    created_at: "2026-09-01T10:00:00",
    dna: { id: "d1", environment_id: "e1", floor_area: 10, wall_area: 20, ceiling_area: 10, is_complete: true },
}

function renderizar(projeto?: Projeto, ambientes?: Ambiente[]) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    if (projeto) client.setQueryData(queryKeys.projects.detail("p1"), projeto)
    if (ambientes) client.setQueryData(queryKeys.projects.environments("p1"), ambientes)
    return render(
        <QueryClientProvider client={client}>
            <ProjetoContent id="p1" />
        </QueryClientProvider>,
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("ProjetoContent", () => {
    it("com dados, mostra o cabecalho do projeto e os ambientes", () => {
        renderizar(PROJETO, [SALA])
        expect(screen.getByRole("heading", { name: "Casa Jardim" })).toBeInTheDocument()
        expect(screen.getByText("Ana")).toBeInTheDocument()
        expect(screen.getByText("Sala de Estar")).toBeInTheDocument()
    })

    it("sem ambientes, mostra o vazio proprio do workspace, com o botao de adicionar", () => {
        renderizar(PROJETO, [])
        expect(screen.getByText("Construa o projeto")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /adicionar primeiro ambiente/i })).toBeInTheDocument()
    })

    it("erro ao buscar o projeto vira estado de erro com a frase da API", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ detail: "Projeto não encontrado." }), {
                    status: 404,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        )
        renderizar(undefined, [SALA])
        const erro = await screen.findByTestId("projeto-error")
        expect(erro).toHaveTextContent("Projeto não encontrado.")
    })

    it("as duas regioes em erro ao mesmo tempo nao colidem no testid", async () => {
        // Nao semear NENHUM dos dois caches: `setQueryData` mantém a query
        // "fresca" pelo staleTime (30s) e ela nunca bateria no fetch — é a
        // armadilha que fez o teste anterior só falhar no cabeçalho, mesmo com
        // as duas regiões independentes.
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ detail: "Indisponível." }), {
                    status: 503,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        )
        renderizar(undefined, undefined)

        const erroCabecalho = await screen.findAllByTestId("projeto-error")
        const erroAmbientes = await screen.findAllByTestId("projeto-ambientes-error")
        expect(erroCabecalho).toHaveLength(1)
        expect(erroAmbientes).toHaveLength(1)
    })
})
