import { beforeEach, describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"

const PAGINA = { items: [], total: 0, page: 1, size: 20, pages: 0, plan_limit: 3, active_count: 0 }
const apiServerMock = vi.fn()
vi.mock("@/lib/api/server", () => ({ apiServer: (...args: unknown[]) => apiServerMock(...args) }))
vi.mock("@/app/(dashboard)/projects/components/ProjetosContent", () => ({
    ProjetosContent: () => null,
}))

type Elemento = {
    props: { state: { queries: { queryKey: unknown }[] }; children: { props: { planLimit?: number } } }
}

beforeEach(() => {
    apiServerMock.mockReset()
})

describe("ProjetosData", () => {
    it("prefetcha a lista pela fabrica, le o limite de /me, e hidrata so a lista", async () => {
        apiServerMock.mockImplementation(async (path: string) =>
            path === "/api/users/me" ? { entitlements: { project_limit: 3 } } : PAGINA,
        )
        const { ProjetosData } = await import("@/app/(dashboard)/projects/components/ProjetosData")

        const elemento = (await ProjetosData()) as Elemento

        expect(apiServerMock.mock.calls.map((c) => c[0]).sort()).toEqual(["/api/projects", "/api/users/me"])
        expect(elemento.props.state.queries.map((q) => q.queryKey)).toEqual([queryKeys.projects.list(1, 20)])
        expect(elemento.props.children.props.planLimit).toBe(3)
    })

    it("se /me falhar, planLimit fica undefined — a tela nao inventa numero", async () => {
        apiServerMock.mockImplementation(async (path: string) => {
            if (path === "/api/users/me") throw new Error("fora do ar")
            return PAGINA
        })
        const { ProjetosData } = await import("@/app/(dashboard)/projects/components/ProjetosData")

        const elemento = (await ProjetosData()) as Elemento

        expect(elemento.props.children.props.planLimit).toBeUndefined()
    })
})
