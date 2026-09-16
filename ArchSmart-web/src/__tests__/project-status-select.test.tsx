/**
 * ProjectStatusSelect — o toast de erro tem que mostrar a frase que a API
 * mandou, nao um generico, sempre que o erro for um ApiError de dominio.
 *
 * Regressao da rodada de correcao 1 da Tarefa 6 (Secao 8, Projetos): so o 403
 * lia `erro.message`; qualquer outro `ApiError` (um 422 recusando a
 * transicao de status, por exemplo) caia no "Nao foi possivel atualizar o
 * status.", perdendo a frase de dominio que `lib/api/errors.ts` ja garante
 * existir quando a API manda uma. Alinhado com `ProjectWizard.tsx`: qualquer
 * `ApiError` exibe `erro.message`; o titulo continua "Limite de Plano" so no
 * 403, "Ops!" nos demais.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { ProjectStatusSelect } from "@/components/projects/ProjectStatusSelect"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}))

const toast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "token-de-teste" }))

function resposta(corpo: unknown, status = 200) {
    return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } })
}

const fetchMock = vi.fn()

beforeAll(() => {
    // O Radix Select usa APIs de ponteiro que o jsdom nao implementa.
    Element.prototype.hasPointerCapture = vi.fn(() => false) as never
    Element.prototype.setPointerCapture = vi.fn() as never
    Element.prototype.releasePointerCapture = vi.fn() as never
    Element.prototype.scrollIntoView = vi.fn() as never
})

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
})

function montar() {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <ProjectStatusSelect projectId="p1" currentStatus="ACTIVE" />
        </QueryClientProvider>,
    )
}

async function trocarStatus(usuario: ReturnType<typeof userEvent.setup>, opcao: string) {
    await usuario.click(screen.getByRole("combobox", { name: "Status do projeto" }))
    await usuario.click(await screen.findByRole("option", { name: opcao }))
}

describe("ProjectStatusSelect — erro de dominio no toast", () => {
    it("403 mostra 'Limite de Plano' com a frase que a API mandou", async () => {
        fetchMock.mockImplementation(async () => resposta({ detail: "Seu plano permite 2 projetos." }, 403))
        const usuario = userEvent.setup()
        montar()

        await trocarStatus(usuario, "Rascunho")

        await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
            variant: "destructive",
            title: "Limite de Plano",
            description: "Seu plano permite 2 projetos.",
        })))
    })

    it("422 de dominio (nao-403) mostra a frase da API, nao o generico", async () => {
        fetchMock.mockImplementation(async () =>
            resposta({ detail: "Transição de status não permitida para este projeto." }, 422),
        )
        const usuario = userEvent.setup()
        montar()

        await trocarStatus(usuario, "Rascunho")

        await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
            variant: "destructive",
            title: "Ops!",
            description: "Transição de status não permitida para este projeto.",
        })))
    })
})
