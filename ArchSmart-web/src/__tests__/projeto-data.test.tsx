import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/query/keys"

const apiServerMock = vi.fn()
vi.mock("@/lib/api/server", () => ({ apiServer: (...args: unknown[]) => apiServerMock(...args) }))
vi.mock("@/app/(dashboard)/projects/[id]/components/ProjetoContent", () => ({
    ProjetoContent: () => null,
}))

const notFound = vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
})
vi.mock("next/navigation", () => ({ notFound: () => notFound() }))

beforeEach(() => {
    apiServerMock.mockReset()
    notFound.mockClear()
})

describe("ProjetoData", () => {
    it("prefetcha projeto e ambientes pelas fabricas, e hidrata os dois", async () => {
        apiServerMock.mockImplementation(async (path: string) =>
            path.endsWith("/environments") ? [] : { id: "p1", name: "Casa" },
        )
        const { ProjetoData } = await import("@/app/(dashboard)/projects/[id]/components/ProjetoData")

        const elemento = (await ProjetoData({ id: "p1" })) as {
            props: { state: { queries: { queryKey: unknown }[] } }
        }

        expect(apiServerMock.mock.calls.map((c) => c[0]).sort()).toEqual([
            "/api/projects/p1",
            "/api/projects/p1/environments",
        ])
        const chaves = elemento.props.state.queries.map((q) => JSON.stringify(q.queryKey)).sort()
        expect(chaves).toEqual(
            [queryKeys.projects.detail("p1"), queryKeys.projects.environments("p1")].map((k) => JSON.stringify(k)).sort(),
        )
        expect(notFound).not.toHaveBeenCalled()
    })

    it("404 da API no projeto vira notFound() da rota", async () => {
        apiServerMock.mockImplementation(async (path: string) => {
            if (path.endsWith("/environments")) throw new ApiError(404, "Não encontrado.", "Não encontrado.", false)
            throw new ApiError(404, "Não encontrado.", "Não encontrado.", false)
        })
        const { ProjetoData } = await import("@/app/(dashboard)/projects/[id]/components/ProjetoData")

        await expect(ProjetoData({ id: "sumido" })).rejects.toThrow("NEXT_NOT_FOUND")
        expect(notFound).toHaveBeenCalledTimes(1)
    })

    it("erro que nao e 404 NAO vira notFound — degrada para o cliente buscar", async () => {
        apiServerMock.mockImplementation(async () => {
            throw new ApiError(503, "Indisponivel.", "Indisponivel.", false)
        })
        const { ProjetoData } = await import("@/app/(dashboard)/projects/[id]/components/ProjetoData")

        await ProjetoData({ id: "p1" })

        expect(notFound).not.toHaveBeenCalled()
    })
})
