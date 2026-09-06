import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useProducts, useInboxCount } from "@/features/library/hooks"
import { filtrosDaUrl } from "@/features/library/filters"

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
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
}

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ items: [{ id: "p1", name: "Cadeira" }], total: 7, page: 1, size: 15, pages: 1 }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        ),
    )
})

describe("useProducts", () => {
    it("busca a lista e manda o header de autorizacao", async () => {
        const { result } = renderHook(() => useProducts({ tab: "library", page: 1, size: 15 }), {
            wrapper: envolver(),
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.items[0].name).toBe("Cadeira")

        const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok123")
    })

    it("traduz a aba inbox para o state CAPTURED", async () => {
        const { result } = renderHook(() => useProducts({ tab: "inbox", page: 1, size: 15 }), {
            wrapper: envolver(),
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(new URL(url).searchParams.get("state")).toBe("CAPTURED")
    })

    it("propaga um AbortSignal — o cancelamento automatico do React Query", async () => {
        const { result } = renderHook(() => useProducts({ tab: "library", page: 1, size: 15 }), {
            wrapper: envolver(),
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(init.signal).toBeInstanceOf(AbortSignal)
    })
})

describe("useInboxCount", () => {
    it("devolve so o total", async () => {
        const { result } = renderHook(() => useInboxCount(), { wrapper: envolver() })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toBe(7)
    })
})

describe("filtrosDaUrl", () => {
    it("da a MESMA chave a partir de URLSearchParams e do objeto do servidor", () => {
        // Se estes dois divergirem, a hidratacao da Tarefa 8 nunca casa e o
        // prefetch vira custo puro sem erro nenhum aparecer.
        expect(filtrosDaUrl(new URLSearchParams(""))).toEqual(filtrosDaUrl({}))
        expect(filtrosDaUrl(new URLSearchParams("tab=inbox&page=2&categories=A&categories=B")))
            .toEqual(filtrosDaUrl({ tab: "inbox", page: "2", categories: ["A", "B"] }))
    })

    it("preenche os padroes que o LibraryContent usava inline", () => {
        expect(filtrosDaUrl({})).toMatchObject({
            tab: "library", sortBy: "created_at_desc", page: 1, size: 15,
            categories: [], origins: [],
        })
    })
})
