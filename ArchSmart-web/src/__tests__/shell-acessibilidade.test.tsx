import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Header } from "@/components/layout/app-shell/Header"
import { NotificationPanel } from "@/components/layout/app-shell/NotificationPanel"
import { GlobalChatWidget } from "@/components/layout/GlobalChatWidget"

vi.mock("next/navigation", () => ({
    usePathname: () => "/projects",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn(), resolvedTheme: "light" }) }))
vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "tok", signOut: vi.fn() }))

/**
 * Os quatro defeitos do shell que o axe achou em 14/09/2026
 * (docs/dev/medicoes/2026-09-14-passada-de-navegador.md, "o shell").
 * jsdom nao mede contraste nem visibilidade; o que ele prova e nome acessivel,
 * landmark e `inert`. O resto e o instrumento `e2e/medicao-axe.spec.ts`.
 */
describe("shell: nome acessivel, landmark e foco fora do que esta fechado", () => {
    it("o menu do usuario no Header tem nome", () => {
        render(
            <Header
                notificationsOpen={false}
                setNotificationsOpen={vi.fn()}
                mobileMenuOpen={false}
                setMobileMenuOpen={vi.fn()}
                unreadCount={0}
            />,
        )
        expect(screen.getByRole("button", { name: "Menu da conta" })).toBeInTheDocument()
    })

    it("o painel de notificacoes e uma regiao nomeada e, fechado, fica inert", () => {
        const { rerender, container } = render(
            <NotificationPanel isOpen={false} onClose={vi.fn()} notifications={[]} onMarkAsRead={vi.fn()} />,
        )
        const painel = container.querySelector("aside")
        expect(painel).not.toBeNull()
        expect(painel).toHaveAttribute("aria-label", "Notificações")
        expect(painel).toHaveAttribute("inert")

        rerender(<NotificationPanel isOpen onClose={vi.fn()} notifications={[]} onMarkAsRead={vi.fn()} />)
        expect(painel).not.toHaveAttribute("inert")
        expect(within(painel as HTMLElement).getByRole("button", { name: "Fechar notificações" })).toBeInTheDocument()
    })

    it("o chat: botao flutuante com nome; janela fechada inert; aberta, o flutuante fica inert", async () => {
        const usuario = userEvent.setup()
        const { container } = render(<GlobalChatWidget />)

        const regiao = container.querySelector("aside")
        expect(regiao).toHaveAttribute("aria-label", "Assistente Arq Smart")

        const abrir = screen.getByRole("button", { name: "Abrir assistente" })
        const janela = container.querySelector("[data-chat-janela]")
        expect(janela).toHaveAttribute("inert")

        await usuario.click(abrir)
        expect(janela).not.toHaveAttribute("inert")
        expect(abrir).toHaveAttribute("inert")
        expect(screen.getByRole("button", { name: "Fechar assistente" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeInTheDocument()
    })
})
