/**
 * DeleteProjectAlert — o toast de erro tem que mostrar a frase que a API
 * mandou, nao um generico, sempre que o erro for um ApiError de dominio.
 *
 * Regressao da rodada de correcao 1 da Tarefa 6 (Secao 8, Projetos): o
 * `catch` era cego — sempre "Nao foi possivel excluir o projeto.", mesmo com
 * um 422 de dominio (por exemplo, projeto com orcamento aprovado). Alinhado
 * com `ProjectWizard.tsx`: qualquer `ApiError` exibe `erro.message`; o que
 * nao for `ApiError` continua com a frase generica da tela. Esta tela nunca
 * teve tratamento especial de 403 (nao existe "Limite de Plano" aqui), entao
 * o titulo continua "Ops!" em qualquer erro.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DeleteProjectAlert } from "@/components/projects/DeleteProjectAlert"

const push = vi.fn()
const refresh = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace: vi.fn(), refresh }),
}))

const toast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "token-de-teste" }))

function resposta(corpo: unknown, status = 200) {
    return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } })
}

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
})

function montar() {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <DeleteProjectAlert projectId="p1" projectName="Casa da Praia" />
        </QueryClientProvider>,
    )
}

async function tentarExcluir(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.click(screen.getByRole("button", { name: "Excluir" }))
    await usuario.type(await screen.findByPlaceholderText("Casa da Praia"), "Casa da Praia")
    await usuario.click(screen.getByRole("button", { name: /Excluir Projeto Permanentemente/ }))
}

describe("DeleteProjectAlert — erro de dominio no toast", () => {
    it("422 de dominio (nao-403) mostra a frase da API, nao o generico", async () => {
        fetchMock.mockImplementation(async () =>
            resposta({ detail: "O projeto tem orçamento aprovado e não pode ser excluído." }, 422),
        )
        const usuario = userEvent.setup()
        montar()

        await tentarExcluir(usuario)

        await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
            variant: "destructive",
            title: "Ops!",
            description: "O projeto tem orçamento aprovado e não pode ser excluído.",
        })))
        expect(push).not.toHaveBeenCalled()
    })
})
