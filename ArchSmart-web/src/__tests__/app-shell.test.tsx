/**
 * Caracterizacao do AppShell — descreve o que ele faz HOJE.
 *
 * Escrito ANTES da quebra da Tarefa 9 da Secao 6 e verde na primeira
 * execucao, sem nenhuma linha de producao tocada. Se algum destes testes
 * precisar ser editado para voltar a passar depois da quebra, o
 * comportamento mudou e a quebra e que tem que ser desfeita — nao o teste.
 *
 * Nao e TDD: nao ha comportamento novo aqui. E rede de seguranca para um
 * refactor de "so mover", num arquivo de tela sem nenhuma outra cobertura.
 */
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/layout/AppShell"

// O shell usa roteador e tema; nenhum dos dois existe em jsdom puro.
const push = vi.fn()
vi.mock("next/navigation", () => ({
    usePathname: () => "/projects/12/budget",
    useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

const setTheme = vi.fn()
vi.mock("next-themes", () => ({
    useTheme: () => ({ theme: "light", setTheme, resolvedTheme: "light" }),
}))

// O shell busca notificacoes num useEffect logo no mount. Sem token e sem
// rede, o efeito ainda roda — mockamos os dois para o teste ser deterministico.
const signOut = vi.fn()
vi.mock("@/lib/api/auth", () => ({
    getAccessToken: async () => "token-de-teste",
    signOut: () => signOut(),
}))

const NOTIFICACOES = [
    {
        id: "n1",
        title: "Orcamento aprovado",
        message: "O cliente aprovou o orcamento.",
        is_read: false,
        created_at: "2026-09-10T12:00:00Z",
    },
    {
        id: "n2",
        title: "Projeto arquivado",
        message: "Um projeto foi arquivado.",
        is_read: true,
        created_at: "2026-09-09T12:00:00Z",
    },
]

let respostaDaLista: unknown[] = []
const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    respostaDaLista = []
    fetchMock.mockImplementation((url: string) =>
        Promise.resolve({
            ok: true,
            json: async () => (String(url).endsWith("/api/notifications") ? respostaDaLista : {}),
        }),
    )
    vi.stubGlobal("fetch", fetchMock)
})

describe("AppShell (caracterizacao — descreve o presente)", () => {
    it("renderiza o conteudo que recebe", () => {
        render(<AppShell><p>conteudo da tela</p></AppShell>)
        expect(screen.getByText("conteudo da tela")).toBeInTheDocument()
    })

    it("mostra a navegacao principal, com um link por item de NAV_ITEMS", () => {
        render(<AppShell><p>x</p></AppShell>)
        // Desktop + mobile renderizam a mesma lista, por isso getAllBy.
        for (const titulo of ["Dashboard", "Biblioteca", "Projetos", "Apresentações", "Financeiro", "Agenda"]) {
            expect(screen.getAllByRole("link", { name: titulo }).length).toBeGreaterThan(0)
        }
    })

    it("escreve a marca com Q, em toda ocorrencia", () => {
        const { container } = render(<AppShell><p>x</p></AppShell>)
        expect(container.textContent).toContain("Arq Smart")
        // A grafia errada e MONTADA, nunca escrita por extenso — nem aqui no
        // comentario. O CLAUDE.md documenta um grep por ela em
        // ArchSmart-web/src como a medida da pendencia de Art. 8, e a unica
        // ocorrencia que restava no repositorio era a assercao deste teste:
        // o teste que guarda a regra era a unica violacao dela, e o comando
        // documentado devolvia 1 onde devia devolver 0. O que ele verifica
        // continua identico.
        const grafiaErrada = ["Arch", "Smart"].join(" ")
        expect(container.textContent).not.toContain(grafiaErrada)
    })

    it("a sidebar comeca aberta e o botao Ocultar a fecha, gravando em localStorage", async () => {
        localStorage.removeItem("sidebar-open")
        const usuario = userEvent.setup()
        render(<AppShell><p>x</p></AppShell>)

        expect(screen.getByText("Ocultar")).toBeInTheDocument()
        await usuario.click(screen.getByText("Ocultar"))

        expect(screen.queryByText("Ocultar")).not.toBeInTheDocument()
        await waitFor(() => expect(localStorage.getItem("sidebar-open")).toBe("false"))
    })

    it("monta o breadcrumb a partir do pathname, com rotulo legivel e id virando Detalhes", async () => {
        render(<AppShell><p>x</p></AppShell>)
        const trilha = await screen.findByRole("navigation", { name: "Navegação estrutural" })
        // /projects/12/budget -> Projetos / Detalhes / Orçamento
        expect(within(trilha).getByRole("link", { name: "Projetos" })).toHaveAttribute("href", "/projects")
        expect(within(trilha).getByRole("link", { name: "Detalhes" })).toHaveAttribute("href", "/projects/12")
        const ultimo = within(trilha).getByText("Orçamento")
        expect(ultimo).toHaveAttribute("aria-current", "page")
    })

    it("busca notificacoes no mount e mostra o painel vazio quando nao vem nenhuma", async () => {
        render(<AppShell><p>x</p></AppShell>)
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(String(fetchMock.mock.calls[0][0])).toContain("/api/notifications")
        expect(fetchMock.mock.calls[0][1]).toEqual({
            headers: { Authorization: "Bearer token-de-teste" },
        })
        expect(await screen.findByText("Nenhuma notificação por enquanto.")).toBeInTheDocument()
    })

    it("lista as notificacoes recebidas e marca a nao lida como lida ao clicar", async () => {
        respostaDaLista = NOTIFICACOES
        const usuario = userEvent.setup()
        render(<AppShell><p>x</p></AppShell>)

        expect(await screen.findByText("Orcamento aprovado")).toBeInTheDocument()
        expect(screen.getByText("Projeto arquivado")).toBeInTheDocument()

        await usuario.click(screen.getByText("Orcamento aprovado"))
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(
                    ([url, init]) =>
                        String(url).endsWith("/api/notifications/n1/read") &&
                        (init as { method?: string })?.method === "PATCH",
                ),
            ).toBe(true),
        )

        // A ja lida nao dispara PATCH nenhum.
        const antes = fetchMock.mock.calls.length
        await usuario.click(screen.getByText("Projeto arquivado"))
        expect(fetchMock.mock.calls.length).toBe(antes)
    })

    it("o botao de tema alterna para dark quando o tema atual e light", async () => {
        const usuario = userEvent.setup()
        render(<AppShell><p>x</p></AppShell>)
        const botao = await screen.findByRole("button", { name: "Toggle theme" })
        await usuario.click(botao)
        expect(setTheme).toHaveBeenCalledWith("dark")
    })

    it("tem o botao de menu mobile e o de notificacoes no cabecalho", () => {
        render(<AppShell><p>x</p></AppShell>)
        expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Notificações" })).toBeInTheDocument()
    })

    it("o menu do usuario abre com os itens de perfil e o Sair", async () => {
        const usuario = userEvent.setup()
        const { container } = render(<AppShell><p>x</p></AppShell>)
        const gatilho = container.querySelector<HTMLButtonElement>("[data-state][aria-haspopup='menu']")
        expect(gatilho).not.toBeNull()
        await usuario.click(gatilho!)

        expect(await screen.findByText("Minha Conta")).toBeInTheDocument()
        for (const titulo of ["Meu Perfil", "Configurações", "Faturamento"]) {
            expect(screen.getByRole("menuitem", { name: titulo })).toBeInTheDocument()
        }
        expect(screen.getByRole("menuitem", { name: "Sair" })).toBeInTheDocument()
    })
})
