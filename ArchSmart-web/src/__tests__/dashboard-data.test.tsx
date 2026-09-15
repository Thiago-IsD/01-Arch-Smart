import { describe, expect, it, vi } from "vitest"

import { queryKeys } from "@/lib/query/keys"

const apiServerMock = vi.fn().mockResolvedValue({ user_first_name: "Ana" })
vi.mock("@/lib/api/server", () => ({ apiServer: (...args: unknown[]) => apiServerMock(...args) }))
vi.mock("@/app/(dashboard)/dashboard/components/DashboardContent", () => ({
    DashboardContent: () => null,
}))

describe("DashboardData", () => {
    it("prefetcha /api/dashboard/lean sob a chave que useDashboard le, e nada mais", async () => {
        const { DashboardData } = await import("@/app/(dashboard)/dashboard/components/DashboardData")

        const elemento = (await DashboardData()) as { props: { state: { queries: { queryKey: unknown }[] } } }

        expect(apiServerMock).toHaveBeenCalledTimes(1)
        expect(apiServerMock.mock.calls[0][0]).toBe("/api/dashboard/lean")
        const chaves = elemento.props.state.queries.map((q) => q.queryKey)
        expect(chaves).toEqual([queryKeys.dashboard.lean()])
    })
})
