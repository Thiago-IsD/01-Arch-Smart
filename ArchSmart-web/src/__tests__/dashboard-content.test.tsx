import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardContent } from "@/app/(dashboard)/dashboard/components/DashboardContent"

const push = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/dashboard",
}))

const apiMock = vi.fn()
vi.mock("@/lib/api/client", () => ({ api: (...args: unknown[]) => apiMock(...args) }))

const RESPOSTA = {
    user_first_name: "Thiago",
    recent_projects: [
        { id: "p1", name: "Casa da Praia", client_name: "Maria" },
        { id: "p2", name: "Loft Centro" },
    ],
    recent_products: [
        { id: "prod1", name: "Cadeira Eames", price: 1200, store: "Loja X", image_url: "http://exemplo/img.png" },
        { id: "prod2", name: "Mesa Lateral" },
    ],
    active_projects_count: 3,
    plan_limit: 5,
    financial_balance: 1500.5,
    financial_income: 3000,
    financial_expense: 1499.5,
    financial_entries_count: 4,
    upcoming_events: [
        {
            id: "e1",
            title: "Reuniao com cliente",
            start_time: "2026-09-15T14:00:00",
            end_time: "2026-09-15T15:00:00",
            meet_link: "http://meet/abc",
            project_name: "Casa da Praia",
        },
    ],
}

function renderizar() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return render(<DashboardContent />, { wrapper: Wrapper })
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ")

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2026-09-10T09:00:00"))
    apiMock.mockResolvedValue(RESPOSTA)
})

afterEach(() => {
    vi.useRealTimers()
})

describe("DashboardContent", () => {
    it("mostra o esqueleto enquanto carrega", () => {
        apiMock.mockReturnValue(new Promise(() => {}))
        renderizar()
        expect(screen.getByLabelText("Carregando painel")).toHaveAttribute("aria-busy", "true")
    })

    it("busca /api/dashboard/lean pela camada de dados, sem fetch na tela", async () => {
        renderizar()
        await waitFor(() => expect(apiMock).toHaveBeenCalled())
        expect(apiMock.mock.calls[0][0]).toBe("/api/dashboard/lean")
    })

    it("mostra o erro NA TELA, com tentar de novo — nao por toast", async () => {
        apiMock.mockRejectedValueOnce(new Error("A API esta fora do ar."))
        renderizar()
        const erro = await screen.findByTestId("dashboard-error")
        expect(erro).toHaveTextContent("A API esta fora do ar.")

        apiMock.mockResolvedValueOnce(RESPOSTA)
        await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }))
        expect(await screen.findByText(/Bom dia, Thiago/)).toBeInTheDocument()
    })

    it("sauda pelo primeiro nome, conforme a hora do dia", async () => {
        renderizar()
        expect(await screen.findByText(/Bom dia, Thiago/)).toBeInTheDocument()
    })

    it("mostra as tres metricas financeiras formatadas em BRL", async () => {
        renderizar()
        expect(await screen.findByText("Saldo Realizado")).toBeInTheDocument()
        expect(screen.getByText("Receitas deste Mês")).toBeInTheDocument()
        expect(screen.getByText("Despesas deste Mês")).toBeInTheDocument()
        expect(screen.getByText(brl(1500.5))).toBeInTheDocument()
        expect(screen.getByText(brl(3000))).toBeInTheDocument()
        expect(screen.getByText(brl(1499.5))).toBeInTheDocument()
    })

    it("mostra o card de limite com o plan_limit que veio de lean (decisao 5)", async () => {
        renderizar()
        expect(await screen.findByText("Projetos Ativos")).toBeInTheDocument()
        expect(screen.getByText("limite de 5")).toBeInTheDocument()
        expect(screen.getByText("2 espaço(s) livre(s)")).toBeInTheDocument()
    })

    it("os tres botoes de acesso rapido navegam para projetos, biblioteca e financeiro", async () => {
        const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        renderizar()
        await usuario.click(await screen.findByText("Criar Projeto"))
        expect(push).toHaveBeenCalledWith("/projects")
        await usuario.click(screen.getByText("Ir para Biblioteca"))
        expect(push).toHaveBeenCalledWith("/library")
        await usuario.click(screen.getByText("Lançamento Financeiro"))
        expect(push).toHaveBeenCalledWith("/finance")
    })

    it("lista projetos recentes, com e sem cliente, ligados a rota do projeto", async () => {
        renderizar()
        expect(await screen.findByText("Casa da Praia")).toBeInTheDocument()
        expect(screen.getByText("Cliente: Maria")).toBeInTheDocument()
        expect(screen.getByText("Sem cliente vinculado")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /Loft Centro/ })).toHaveAttribute("href", "/projects/p2")
    })

    it("lista compromissos com data, hora, badge do projeto e botao Entrar", async () => {
        renderizar()
        expect(await screen.findByText("Reuniao com cliente")).toBeInTheDocument()
        expect(screen.getByText("15 de set às 14:00")).toBeInTheDocument()
        expect(screen.getByText("Projeto: Casa da Praia")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Entrar/ })).toBeInTheDocument()
    })

    it("lista produtos recentes, com preco so quando ha preco", async () => {
        renderizar()
        expect(await screen.findByText("Cadeira Eames")).toBeInTheDocument()
        expect(screen.getByText("Loja X")).toBeInTheDocument()
        expect(
            screen.getByText(
                (1200).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " "),
            ),
        ).toBeInTheDocument()
        expect(screen.getByText("Mesa Lateral")).toBeInTheDocument()
        expect(screen.getByText("Sem imagem")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /Cadeira Eames/ })).toHaveAttribute("href", "/library?product=prod1")
    })

    it("mostra os tres vazios quando a resposta vem sem listas", async () => {
        apiMock.mockResolvedValue({ ...RESPOSTA, recent_projects: [], recent_products: [], upcoming_events: [] })
        renderizar()
        expect(await screen.findByText("Você ainda não tem projetos ativos.")).toBeInTheDocument()
        expect(screen.getByText("Nenhum compromisso para os próximos dias.")).toBeInTheDocument()
        expect(screen.getByText("Nenhum produto salv recentemente.")).toBeInTheDocument()
    })

    it("estado vazio (dashboardVazio=true) renderiza o mesmo painel, via o ramo `empty` do QueryBoundary", async () => {
        // dashboardVazio (features/dashboard/vazio.ts) exige active_projects_count,
        // recent_products, upcoming_events E financial_entries_count zerados -- os
        // quatro, nao so as listas do teste acima -- para o QueryBoundary tomar o
        // ramo `vazio` em vez do ramo `children` (mesmo dado, caminho diferente:
        // ver query-boundary.tsx, `if (vazio) return <>{empty}</>`).
        apiMock.mockResolvedValue({
            ...RESPOSTA,
            recent_projects: [],
            recent_products: [],
            upcoming_events: [],
            active_projects_count: 0,
            financial_entries_count: 0,
            financial_balance: 0,
            financial_income: 0,
            financial_expense: 0,
        })
        renderizar()

        expect(await screen.findByTestId("dashboard-painel")).toBeInTheDocument()
        expect(screen.getByText(/Bom dia, Thiago/)).toBeInTheDocument()
        expect(screen.getByText("Você ainda não tem projetos ativos.")).toBeInTheDocument()
        expect(screen.getByText("Nenhum compromisso para os próximos dias.")).toBeInTheDocument()
        expect(screen.getByText("Nenhum produto salv recentemente.")).toBeInTheDocument()
    })
})
