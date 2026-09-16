/**
 * As tres mutacoes de ambiente/DNA chamam `router.refresh()` apos sucesso —
 * decisao de Thiago em 15/09/2026, depois de a Tarefa 7 medir que
 * `budget/page.tsx` e `print/page.tsx` sao Server Components que leem a lista
 * de ambientes (`GET /api/projects/{id}/environments`) direto no servidor.
 * Sem o refresh, criar/excluir um ambiente ou salvar o DNA e depois abrir
 * Orcamento ou o Caderno de Obras pode servir o Router Cache do Next com a
 * lista velha — a mesma classe de problema que ja mantinha o refresh nas
 * quatro mutacoes de projeto (`project-wizard.test.tsx`,
 * `project-status-select.test.tsx`, `delete-project-alert.test.tsx`).
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DNAEditorSheet } from "@/components/projects/environments/DNAEditorSheet"
import { EnvironmentCard } from "@/components/projects/environments/EnvironmentCard"
import { NewEnvironmentModal } from "@/components/projects/environments/NewEnvironmentModal"
import type { Ambiente } from "@/features/projects/types"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}))

const toast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "token-de-teste" }))

function resposta(corpo: unknown, status = 200) {
    return status === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } })
}

const fetchMock = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
})

function montar(filho: ReactNode) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    return render(<QueryClientProvider client={client}>{filho}</QueryClientProvider>)
}

const ambiente: Ambiente = {
    id: "e1",
    project_id: "p1",
    name: "Sala de Estar",
    type: "Interna/Seca",
    created_at: "2026-01-01T00:00:00Z",
    dna: null,
}

describe("mutacoes de ambiente chamam router.refresh apos sucesso", () => {
    it("criar ambiente", async () => {
        fetchMock.mockImplementation(async () => resposta({ id: "e1", project_id: "p1", name: "Sala" }, 201))
        const usuario = userEvent.setup()
        montar(<NewEnvironmentModal isOpen onOpenChange={vi.fn()} projectId="p1" />)

        await usuario.type(screen.getByLabelText("Nome"), "Sala de Estar")
        await usuario.click(screen.getByRole("button", { name: "Criar" }))

        await waitFor(() => expect(toast).toHaveBeenCalled())
        expect(refresh).toHaveBeenCalled()
    })

    it("excluir ambiente", async () => {
        fetchMock.mockImplementation(async () => resposta(undefined, 204))
        const usuario = userEvent.setup()
        montar(<EnvironmentCard environment={ambiente} onClick={vi.fn()} />)

        await usuario.click(screen.getByRole("button", { name: "Abrir menu" }))
        await usuario.click(await screen.findByRole("menuitem", { name: /Excluir/ }))
        await usuario.click(await screen.findByRole("button", { name: "Excluir" }))

        await waitFor(() => expect(toast).toHaveBeenCalled())
        expect(refresh).toHaveBeenCalled()
    })

    it("salvar DNA", async () => {
        fetchMock.mockImplementation(async () => resposta({ id: "dna1", environment_id: "e1", floor_area: 0, wall_area: 0, ceiling_area: 0, is_complete: false }, 200))
        const usuario = userEvent.setup()
        montar(<DNAEditorSheet isOpen onOpenChange={vi.fn()} environment={ambiente} />)

        await usuario.click(screen.getByRole("button", { name: "Salvar DNA Técnico" }))

        await waitFor(() => expect(toast).toHaveBeenCalled())
        expect(refresh).toHaveBeenCalled()
    })
})

/**
 * Correcao 2 da Tarefa 7: "Interna/Seca" morava em dois lugares —
 * `defaultValues.type` do formulario e o `?? "Interna/Seca"` do `onSubmit`.
 * O schema do formulario (`environmentSchema`, com `z.string().default(...)`)
 * passou a ser a UNICA fonte do padrao; o `onSubmit` so repassa `data.type`.
 * Este teste prende o corpo que sai no `fetch`, nao so o toast — e o que
 * impede a divergencia (schema dizendo uma coisa, `onSubmit` outra) de
 * voltar.
 */
describe("NewEnvironmentModal — o tipo padrao vem do schema, fonte unica", () => {
    it("submete sem escolher tipo e o corpo enviado traz type: Interna/Seca", async () => {
        fetchMock.mockImplementation(async () => resposta({ id: "e1", project_id: "p1", name: "Sala" }, 201))
        const usuario = userEvent.setup()
        montar(<NewEnvironmentModal isOpen onOpenChange={vi.fn()} projectId="p1" />)

        await usuario.type(screen.getByLabelText("Nome"), "Sala de Estar")
        await usuario.click(screen.getByRole("button", { name: "Criar" }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const [, init] = fetchMock.mock.calls[0]
        expect(JSON.parse(init.body).type).toBe("Interna/Seca")
    })
})
