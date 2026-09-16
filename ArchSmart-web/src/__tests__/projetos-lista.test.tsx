import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"
import type { PaginaDeProjetos, Projeto } from "@/features/projects/types"
import { ProjetosContent } from "@/app/(dashboard)/projects/components/ProjetosContent"

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "tok" }))
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/projects",
}))

function projeto(parcial: Partial<Projeto> = {}): Projeto {
    return {
        id: "p1",
        account_id: "a",
        client_id: "c",
        name: "Casa Jardim",
        status: "ACTIVE",
        created_at: "2026-09-01T10:00:00",
        environments_count: 2,
        client: { id: "c", name: "Ana" },
        ...parcial,
    }
}

function pagina(parcial: Partial<PaginaDeProjetos> = {}): PaginaDeProjetos {
    return { items: [projeto()], total: 1, page: 1, size: 20, pages: 1, plan_limit: 3, active_count: 1, ...parcial }
}

function renderizar(dados: PaginaDeProjetos | undefined, planLimit?: number) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    if (dados) client.setQueryData(queryKeys.projects.list(1, 20), dados)
    return render(
        <QueryClientProvider client={client}>
            <ProjetosContent planLimit={planLimit} />
        </QueryClientProvider>,
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("ProjetosContent", () => {
    it("com dados, mostra os cards, o contador e o botao Novo Projeto abaixo do limite", () => {
        renderizar(pagina(), 3)
        expect(screen.getByTestId("projetos-pagina")).toBeInTheDocument()
        expect(screen.getByText("Casa Jardim")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /novo projeto/i })).toHaveAttribute("href", "/projects?action=new")
        expect(screen.getByText("1/3")).toBeInTheDocument()
    })

    it("o limite usa active_count da API, nao os itens da pagina", () => {
        // Um item na pagina, mas 3 ativos na conta: esta no limite.
        renderizar(pagina({ active_count: 3 }), 3)
        expect(screen.getByText("3/3")).toBeInTheDocument()
        expect(screen.queryByRole("link", { name: /novo projeto/i })).not.toBeInTheDocument()
    })

    it("sem planLimit nao mostra contador nem inventa limite", () => {
        renderizar(pagina(), undefined)
        expect(screen.queryByText("1/3")).not.toBeInTheDocument()
        expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument()
        expect(screen.getByRole("link", { name: /novo projeto/i })).toBeInTheDocument()
    })

    it("pagina vazia vira o estado vazio, com o cabecalho", () => {
        renderizar(pagina({ items: [], total: 0, active_count: 0 }), 3)
        expect(screen.getByTestId("projetos-vazio")).toBeInTheDocument()
        expect(screen.getByRole("heading", { name: "Projetos" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /criar primeiro projeto/i })).toBeInTheDocument()
    })

    it("erro da API vira estado de erro com a frase dela — nao lista vazia", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ detail: "Servico indisponivel." }), {
                    status: 503,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        )
        renderizar(undefined, 3)
        const erro = await screen.findByTestId("projetos-error")
        expect(erro).toHaveTextContent("Servico indisponivel.")
        expect(screen.getByRole("button", { name: /tentar de novo/i })).toBeInTheDocument()
        expect(screen.queryByTestId("projetos-vazio")).not.toBeInTheDocument()
    })
})
