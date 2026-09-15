import { describe, expect, it } from "vitest"

import { dashboardVazio } from "@/features/dashboard/vazio"
import type { DashboardLean } from "@/features/dashboard/types"

const NADA: DashboardLean = {
    user_first_name: "Ana",
    recent_projects: [],
    recent_products: [],
    upcoming_events: [],
    active_projects_count: 0,
    plan_limit: 2,
    financial_balance: 0,
    financial_income: 0,
    financial_expense: 0,
    financial_entries_count: 0,
}

describe("dashboardVazio — decisao 3 da spec do Dashboard", () => {
    it("conta sem nada e vazia", () => {
        expect(dashboardVazio(NADA)).toBe(true)
    })

    it("conta so com financeiro NAO e vazia", () => {
        expect(dashboardVazio({ ...NADA, financial_entries_count: 1 })).toBe(false)
    })

    it("lancamentos que se anulam nao fazem a conta parecer vazia", () => {
        // soma zero, mas existem dois lancamentos
        expect(dashboardVazio({ ...NADA, financial_entries_count: 2 })).toBe(false)
    })

    it.each([
        ["projeto ativo", { active_projects_count: 1 }],
        ["captura", { recent_products: [{ id: "p", name: "Cadeira" }] }],
        ["compromisso", { upcoming_events: [{ id: "e", title: "R", start_time: "", end_time: "" }] }],
    ])("conta com %s nao e vazia", (_nome, parcial) => {
        expect(dashboardVazio({ ...NADA, ...parcial } as DashboardLean)).toBe(false)
    })
})
