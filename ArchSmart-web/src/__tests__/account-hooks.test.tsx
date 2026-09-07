import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useEntitlements } from "@/features/account/hooks"

vi.mock("@/lib/api/auth", () => ({
    getAccessToken: async () => "tok123",
    supabaseBrowser: () => {
        throw new Error("nao deve ser chamado no teste")
    },
    signOut: async () => {},
    setSession: async () => {},
}))

function envolver() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    return Wrapper
}

const ME_OK = {
    id: "u1",
    full_name: "Ana Arquiteta",
    email: "ana@example.com",
    role: "owner",
    account: { id: "a1", name: "Escritorio Ana", subscription_status: "active" },
    entitlements: { project_limit: 10, can_use_ai: true, can_use_portal: true },
}

/**
 * Fixa o comportamento que a Tarefa 10 introduziu (Art. 3): `undefined`
 * enquanto carrega e em erro, e o numero exato que a API mandou no sucesso —
 * nunca um `?? 2` (ou qualquer outro fallback) reintroduzido dentro do hook.
 */
describe("useEntitlements", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn())
    })

    it("devolve entitlements undefined e isLoading true enquanto a chamada esta em voo", async () => {
        let resolverFetch: (value: Response) => void = () => {}
        ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
            new Promise<Response>((resolve) => {
                resolverFetch = resolve
            }),
        )

        const { result } = renderHook(() => useEntitlements(), { wrapper: envolver() })

        expect(result.current.entitlements).toBeUndefined()
        expect(result.current.isLoading).toBe(true)

        // Libera a promise pendente para nao vazar entre testes.
        resolverFetch(
            new Response(JSON.stringify(ME_OK), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        )
        await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it("resolve para entitlements undefined quando /api/users/me responde erro — nunca um numero", async () => {
        ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
            new Response(JSON.stringify({ detail: "Conta nao encontrada." }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            }),
        )

        const { result } = renderHook(() => useEntitlements(), { wrapper: envolver() })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.entitlements).toBeUndefined()
    })

    it("no sucesso devolve exatamente o que a API mandou — sem clamp, default ou coercao", async () => {
        ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
            new Response(JSON.stringify(ME_OK), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        )

        const { result } = renderHook(() => useEntitlements(), { wrapper: envolver() })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        // Este e o caso que pegaria um `?? 2` reintroduzido dentro do hook:
        // a conta manda 10, e 10 — nao 2 — precisa chegar ao consumidor.
        expect(result.current.entitlements?.project_limit).toBe(10)
    })
})
