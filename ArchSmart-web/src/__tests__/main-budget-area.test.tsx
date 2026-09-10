/**
 * Caracterizacao do MainBudgetArea — a Acao de Valor do produto.
 *
 * Escrito ANTES da quebra da Tarefa 9 da Secao 6 e verde na primeira
 * execucao, sem nenhuma linha de producao tocada. Se algum destes precisar
 * de edicao para voltar a passar depois da quebra, o comportamento mudou:
 * desfaz a quebra, nao ajusta o teste.
 *
 * Os irmaos (SidebarNav, BudgetSummaryFooter, ProductPickerModal) sao
 * dublados: eles tem vida propria (fetch, contexto, dialogo) e nao sao o que
 * esta sendo quebrado aqui. O BudgetProvider e o de verdade — e dele que sai
 * todo o estado que a tela le.
 */
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { MainBudgetArea } from "@/app/(dashboard)/projects/[id]/budget/components/MainBudgetArea"
import type { BudgetItem, BudgetTree, Environment } from "@/app/(dashboard)/projects/[id]/budget/components/BudgetProvider"

// `BudgetItemsList` pega o router com `require("next/navigation")`, nao com
// import — e um `require` nao passa pelo `vi.mock` de modulo ES. Por isso o
// roteador entra aqui pelo contexto do App Router, que e o que o `useRouter`
// de verdade le. Trocar aquele `require` por import e mudanca de
// comportamento: fica para a Secao 8.
const refresh = vi.fn()
const routerFalso = {
    push: vi.fn(), replace: vi.fn(), refresh, back: vi.fn(), forward: vi.fn(), prefetch: vi.fn(),
} as never

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "token-de-teste" }))

vi.mock("@/app/(dashboard)/projects/[id]/budget/components/SidebarNav", () => ({
    SidebarNav: () => <div data-testid="sidebar-nav" />,
}))
vi.mock("@/app/(dashboard)/projects/[id]/budget/components/BudgetSummaryFooter", () => ({
    BudgetSummaryFooter: () => <div data-testid="summary-footer" />,
}))
vi.mock("@/app/(dashboard)/projects/[id]/budget/components/ProductPickerModal", () => ({
    ProductPickerModal: ({ isOpen, targetItemId }: { isOpen: boolean; targetItemId?: string }) =>
        isOpen ? <div data-testid="picker" data-target={targetItemId ?? ""} /> : null,
}))

const AMBIENTES: Environment[] = [
    { id: "env1", name: "Sala", type: "Estar" },
    { id: "env2", name: "Cozinha" },
]

function item(over: Partial<BudgetItem> = {}): BudgetItem {
    return {
        id: "item1",
        budget_id: "b1",
        environment_id: "env1",
        rule_type: "FLOOR",
        manual_quantity: null,
        loss_factor: 10,
        calculated_quantity: 12,
        base_area: 20,
        options: [
            {
                id: "opt1",
                budget_item_id: "item1",
                product_id: "p1",
                is_selected: true,
                product: { name: "Porcelanato Bege", price: 100, store: "Loja X" },
            },
        ],
        ...over,
    }
}

function arvore(items: BudgetItem[]): BudgetTree {
    return { id: "b1", project_id: "1", total_value: 0, items }
}

const fetchMock = vi.fn()
const open = vi.fn()

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn() as never
    Element.prototype.hasPointerCapture = vi.fn(() => false) as never
    Element.prototype.setPointerCapture = vi.fn() as never
    Element.prototype.releasePointerCapture = vi.fn() as never
})

beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("open", open)
})

function montar(items: BudgetItem[] = [item()], ambientes = AMBIENTES) {
    return render(
        <AppRouterContext.Provider value={routerFalso}>
            <MainBudgetArea
                projectId="1"
                budgetTree={arvore(items)}
                environments={ambientes}
                projectName="Casa da Praia"
            />
        </AppRouterContext.Provider>,
    )
}

describe("MainBudgetArea (caracterizacao — descreve o presente)", () => {
    it("monta a moldura: sidebar de ambientes + area do ambiente selecionado", () => {
        montar()
        expect(screen.getByText("Ambientes")).toBeInTheDocument()
        expect(screen.getByText("Selecione para ver os itens")).toBeInTheDocument()
        expect(screen.getByTestId("sidebar-nav")).toBeInTheDocument()
        // O provider seleciona o primeiro ambiente sozinho.
        expect(screen.getByRole("heading", { name: "Sala" })).toBeInTheDocument()
        expect(screen.getByText("Estar")).toBeInTheDocument()
        expect(screen.getByTestId("summary-footer")).toBeInTheDocument()
    })

    it("sem ambiente nenhum mostra o vazio, e nao mostra a barra de acoes", () => {
        montar([], [])
        expect(screen.getByText("Nenhum ambiente selecionado")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Adicionar Produto/ })).not.toBeInTheDocument()
        expect(screen.queryByTestId("summary-footer")).not.toBeInTheDocument()
    })

    it("ambiente sem itens mostra o texto de lista vazia", () => {
        montar([item({ environment_id: "env2" })])
        expect(screen.getByText("Nenhum produto atrelado a este ambiente ainda.")).toBeInTheDocument()
        expect(screen.queryByRole("table")).not.toBeInTheDocument()
    })

    it("lista so os itens do ambiente selecionado, com as seis colunas", () => {
        montar([item(), item({ id: "item2", environment_id: "env2" })])
        const tabela = screen.getByRole("table")
        for (const coluna of ["Produto / Material", "Base Calc. (DNA)", "Perda", "Qtd", "Total", "Ações"]) {
            expect(within(tabela).getByText(coluna)).toBeInTheDocument()
        }
        expect(within(tabela).getAllByRole("row")).toHaveLength(2) // cabecalho + 1 item
        expect(within(tabela).getByText("Porcelanato Bege")).toBeInTheDocument()
    })

    it("calcula base, perda, quantidade e total da linha a partir do item", () => {
        montar()
        expect(screen.getByText(/20\.00 m²/)).toBeInTheDocument()
        expect(screen.getByText("(Piso)")).toBeInTheDocument()
        expect(screen.getByDisplayValue("10")).toBeInTheDocument()  // perda %
        expect(screen.getByText("12 cx/un")).toBeInTheDocument()
        expect(screen.getByText("R$ 1200.00")).toBeInTheDocument()  // 12 * 100
        expect(screen.getByText("R$ 100.00 uni")).toBeInTheDocument()
    })

    it("item UNIT troca base e perda por tracos e mostra a quantidade manual", () => {
        montar([item({ rule_type: "UNIT", manual_quantity: 3, base_area: null })])
        expect(screen.getAllByText("-")).toHaveLength(2)
        expect(screen.getByDisplayValue("3")).toBeInTheDocument()
        expect(screen.getByText("R$ 300.00")).toBeInTheDocument()
    })

    it("blur no campo de perda faz PATCH em /api/budgets/items/<id> e pede refresh", async () => {
        const usuario = userEvent.setup()
        montar()
        const perda = screen.getByDisplayValue("10")
        await usuario.clear(perda)
        await usuario.type(perda, "15")
        await usuario.tab()

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain("/api/budgets/items/item1")
        expect(init.method).toBe("PATCH")
        expect(init.headers).toEqual({
            "Content-Type": "application/json",
            Authorization: "Bearer token-de-teste",
        })
        expect(JSON.parse(init.body)).toEqual({ loss_factor: 15, manual_quantity: null })
        await waitFor(() => expect(refresh).toHaveBeenCalled())
    })

    it("o cadeado destrava a quantidade, e o campo nasce com a quantidade calculada", async () => {
        const usuario = userEvent.setup()
        montar()
        await usuario.click(screen.getByTitle("Editar Manualmente"))
        expect(await screen.findByTitle("Travar Automático")).toBeInTheDocument()
        expect(screen.getByDisplayValue("12")).toBeInTheDocument()
        expect(screen.queryByText("12 cx/un")).not.toBeInTheDocument()
    })

    it("o alerta de rendimento aparece so quando has_yield_alert e a quantidade esta travada", () => {
        const { unmount } = montar([item({ has_yield_alert: true })])
        expect(screen.getByText(/Rendimento do material não cadastrado/)).toBeInTheDocument()
        unmount()
        montar([item({ has_yield_alert: false })])
        expect(screen.queryByText(/Rendimento do material não cadastrado/)).not.toBeInTheDocument()
    })

    it("com uma opcao so, oferece 'Alternativa B' e abre o picker mirando o item", async () => {
        const usuario = userEvent.setup()
        montar()
        await usuario.click(screen.getByTitle("Desbloquear comparativo de preços"))
        const picker = await screen.findByTestId("picker")
        expect(picker).toHaveAttribute("data-target", "item1")
    })

    it("com duas opcoes mostra Opção A/B, e clicar em B faz PATCH de select", async () => {
        const usuario = userEvent.setup()
        montar([item({
            options: [
                { id: "optA", budget_item_id: "item1", product_id: "p1", is_selected: true, created_at: "1", product: { name: "Porcelanato Bege", price: 100 } },
                { id: "optB", budget_item_id: "item1", product_id: "p2", is_selected: false, created_at: "2", product: { name: "Porcelanato Cinza", price: 80 } },
            ] as never,
        })])
        expect(screen.getByText("Opção A")).toBeInTheDocument()
        expect(screen.getByText("Opção B")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Alternativa B/ })).not.toBeInTheDocument()

        await usuario.click(screen.getByText("Opção B"))
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain("/api/budgets/options/optB/select")
        expect(init.method).toBe("PATCH")
    })

    it("o X de uma opcao faz DELETE em /api/budgets/options/<id>", async () => {
        const usuario = userEvent.setup()
        montar([item({
            options: [
                { id: "optA", budget_item_id: "item1", product_id: "p1", is_selected: true, created_at: "1", product: { name: "Bege", price: 100 } },
                { id: "optB", budget_item_id: "item1", product_id: "p2", is_selected: false, created_at: "2", product: { name: "Cinza", price: 80 } },
            ] as never,
        })])
        const remover = screen.getAllByTitle("Remover Opção")
        await usuario.click(remover[1])
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain("/api/budgets/options/optB")
        expect(init.method).toBe("DELETE")
    })

    it("confirmar a exclusao da linha faz DELETE do item", async () => {
        const usuario = userEvent.setup()
        montar()
        await usuario.click(screen.getByTitle("Remover produto do ambiente"))
        expect(await screen.findByText("Remover do Ambiente")).toBeInTheDocument()
        await usuario.click(screen.getByRole("button", { name: "Confirmar Exclusão" }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toContain("/api/budgets/items/item1")
        expect(init.method).toBe("DELETE")
    })

    it("Adicionar Produto abre o picker do ambiente, sem item alvo", async () => {
        const usuario = userEvent.setup()
        montar()
        expect(screen.queryByTestId("picker")).not.toBeInTheDocument()
        await usuario.click(screen.getByRole("button", { name: /Adicionar Produto/ }))
        const pickers = await screen.findAllByTestId("picker")
        expect(pickers.some((p) => p.getAttribute("data-target") === "")).toBe(true)
    })

    it("Exportar WhatsApp monta o texto do orcamento inteiro e abre o wa.me", async () => {
        const usuario = userEvent.setup()
        montar([
            item(),
            item({ id: "item2", environment_id: "env2", rule_type: "UNIT", manual_quantity: 2, options: [
                { id: "opt2", budget_item_id: "item2", product_id: "p2", is_selected: true, product: { name: "Luminaria", price: 50 } },
            ] as never }),
        ])
        await usuario.click(screen.getByRole("button", { name: /Exportar WhatsApp/ }))

        expect(open).toHaveBeenCalledTimes(1)
        const [href, alvo] = open.mock.calls[0]
        expect(alvo).toBe("_blank")
        const texto = decodeURIComponent(String(href).replace("https://wa.me/?text=", ""))
        expect(texto).toContain("*Orçamento - Casa da Praia*")
        expect(texto).toContain("*Sala*")
        expect(texto).toContain("Porcelanato Bege: R$ 1.200,00")
        expect(texto).toContain("*Cozinha*")
        expect(texto).toContain("Luminaria: R$ 100,00")
        expect(texto).toContain("*Total Geral: R$ 1.300,00*")
    })
})
