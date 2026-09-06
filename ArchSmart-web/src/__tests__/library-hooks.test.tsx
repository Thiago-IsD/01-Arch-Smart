import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useProducts, useInboxCount, useDeleteProduct, useBatchApprove } from "@/features/library/hooks"
import { filtrosDaUrl } from "@/features/library/filters"
import { queryKeys } from "@/lib/query/keys"

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

describe("useDeleteProduct — Defeito A", () => {
    it("manda Authorization no DELETE", async () => {
        // ProductCard.tsx:89 chamava fetch(url, { method: "DELETE" }) sem
        // header nenhum. get_context declara `authorization: str = Header(...)`,
        // entao o FastAPI respondia 422 e a exclusao nunca funcionava.
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        )
        const { result } = renderHook(() => useDeleteProduct(), { wrapper })

        await result.current.mutateAsync("p1")

        const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(String(url)).toContain("/api/products/p1")
        expect(init.method).toBe("DELETE")
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok123")
    })
})

describe("mutacoes — Defeito B", () => {
    it("invalidar products alcanca lista, detalhe e badge do inbox com uma chamada", async () => {
        const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
        const espia = vi.spyOn(client, "invalidateQueries")
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        )
        const { result } = renderHook(() => useBatchApprove(), { wrapper })

        await result.current.mutateAsync({ items: [{ id: "p1", name: "Cadeira" }] })

        expect(espia).toHaveBeenCalledWith({ queryKey: queryKeys.products.all })
        // Uma so: a hierarquia da Tarefa 5 dispensa invalidar o badge a parte.
        expect(espia).toHaveBeenCalledTimes(1)
    })
})
