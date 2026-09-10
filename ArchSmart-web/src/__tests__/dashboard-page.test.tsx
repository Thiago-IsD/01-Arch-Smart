/**
 * Caracterizacao de app/(dashboard)/dashboard/page.tsx — descreve o presente.
 *
 * Escrito ANTES da quebra da Tarefa 9 da Secao 6 e verde na primeira
 * execucao. Se algum destes precisar de edicao para voltar a passar depois
 * da quebra, o comportamento mudou: desfaz a quebra, nao ajusta o teste.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import DashboardPage from "@/app/(dashboard)/dashboard/page"

const push = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/dashboard",
}))

const toast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

let tokenAtual: string | null = "token-de-teste"
vi.mock("@/lib/api/auth", () => ({
    getAccessToken: async () => tokenAtual,
}))

let entitlementsAtuais: { project_limit?: number } | undefined
vi.mock("@/features/account/hooks", () => ({
    useEntitlements: () => ({ entitlements: entitlementsAtuais, isLoading: false }),
}))

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
    financial_balance: 1500.5,
    financial_income: 3000,
    financial_expense: 1499.5,
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

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    tokenAtual = "token-de-teste"
    entitlementsAtuais = { project_limit: 5 }
    // Data fixa: a saudacao e a data do banner dependem do relogio.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2026-09-10T09:00:00"))
    fetchMock.mockResolvedValue({ ok: true, json: async () => RESPOSTA })
    vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
    vi.useRealTimers()
})

describe("DashboardPage (caracterizacao — descreve o presente)", () => {
    it("mostra o esqueleto enquanto carrega", () => {
        fetchMock.mockReturnValue(new Promise(() => {}))
        render(<DashboardPage />)
        expect(screen.getByLabelText("Carregando painel")).toHaveAttribute("aria-busy", "true")
    })

    it("busca /api/dashboard/lean com o token no header", async () => {
        render(<DashboardPage />)
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain("/api/dashboard/lean")
        expect(init).toEqual({
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer token-de-teste",
            },
        })
    })

    it("manda para o login quando nao ha token, sem chamar a API", async () => {
        tokenAtual = null
        render(<DashboardPage />)
        await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/login"))
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("avisa por toast quando a API responde erro", async () => {
        fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
        render(<DashboardPage />)
        await waitFor(() => expect(toast).toHaveBeenCalled())
        expect(toast.mock.calls[0][0]).toMatchObject({ title: "Erro", variant: "destructive" })
    })

    it("sauda pelo primeiro nome, conforme a hora do dia", async () => {
        render(<DashboardPage />)
        // 09:00 -> "Bom dia"
        expect(await screen.findByText(/Bom dia, Thiago/)).toBeInTheDocument()
    })

    it("mostra as tres metricas financeiras formatadas em BRL", async () => {
        render(<DashboardPage />)
        expect(await screen.findByText("Saldo Realizado")).toBeInTheDocument()
        expect(screen.getByText("Receitas deste Mês")).toBeInTheDocument()
        expect(screen.getByText("Despesas deste Mês")).toBeInTheDocument()
        // Intl separa "R$" do numero com NBSP; o normalizador do testing-library
        // troca o NBSP do DOM por espaco comum, mas nao mexe no texto procurado.
        const brl = (v: number) =>
            v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ")
        expect(screen.getByText(brl(1500.5))).toBeInTheDocument()
        expect(screen.getByText(brl(3000))).toBeInTheDocument()
        expect(screen.getByText(brl(1499.5))).toBeInTheDocument()
    })

    it("mostra o card de limite de projetos com o numero que veio de entitlements", async () => {
        render(<DashboardPage />)
        expect(await screen.findByText("Projetos Ativos")).toBeInTheDocument()
        expect(screen.getByText("limite de 5")).toBeInTheDocument()
        expect(screen.getByText("2 espaço(s) livre(s)")).toBeInTheDocument()
    })

    it("nao renderiza limite nenhum enquanto entitlements nao chegou (Art. 3)", async () => {
        entitlementsAtuais = undefined
        render(<DashboardPage />)
        expect(await screen.findByText("Saldo Realizado")).toBeInTheDocument()
        expect(screen.queryByText("Projetos Ativos")).not.toBeInTheDocument()
        expect(screen.queryByText(/limite de/)).not.toBeInTheDocument()
    })

    it("os tres botoes de acesso rapido navegam para projetos, biblioteca e financeiro", async () => {
        const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        render(<DashboardPage />)
        await usuario.click(await screen.findByText("Criar Projeto"))
        expect(push).toHaveBeenCalledWith("/projects")
        await usuario.click(screen.getByText("Ir para Biblioteca"))
        expect(push).toHaveBeenCalledWith("/library")
        await usuario.click(screen.getByText("Lançamento Financeiro"))
        expect(push).toHaveBeenCalledWith("/finance")
    })

    it("lista projetos recentes, com e sem cliente, ligados a rota do projeto", async () => {
        render(<DashboardPage />)
        expect(await screen.findByText("Casa da Praia")).toBeInTheDocument()
        expect(screen.getByText("Cliente: Maria")).toBeInTheDocument()
        expect(screen.getByText("Sem cliente vinculado")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /Loft Centro/ })).toHaveAttribute("href", "/projects/p2")
    })

    it("lista compromissos com data, hora, badge do projeto e botao Entrar", async () => {
        render(<DashboardPage />)
        expect(await screen.findByText("Reuniao com cliente")).toBeInTheDocument()
        expect(screen.getByText("15 de set às 14:00")).toBeInTheDocument()
        expect(screen.getByText("Projeto: Casa da Praia")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /Entrar/ })).toBeInTheDocument()
    })

    it("lista produtos recentes, com preco so quando ha preco", async () => {
        render(<DashboardPage />)
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
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ ...RESPOSTA, recent_projects: [], recent_products: [], upcoming_events: [] }),
        })
        render(<DashboardPage />)
        expect(await screen.findByText("Você ainda não tem projetos ativos.")).toBeInTheDocument()
        expect(screen.getByText("Nenhum compromisso para os próximos dias.")).toBeInTheDocument()
        expect(screen.getByText("Nenhum produto salv recentemente.")).toBeInTheDocument()
    })
})
