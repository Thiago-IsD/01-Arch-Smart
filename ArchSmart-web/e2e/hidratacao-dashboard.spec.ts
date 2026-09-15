import { test, expect } from "@playwright/test"

import { esperarPainelDoDashboard } from "./dashboard-dados"

/**
 * O prefetch do Dashboard hidrata: abrir /dashboard direto (navegacao de
 * servidor) nao pode emitir /api/dashboard/lean do navegador, e — decisao 5 da
 * spec — nao pode emitir /api/users/me tambem: o card le plan_limit de lean.
 */
test("o Dashboard nao busca lean nem users/me no navegador no primeiro carregamento", async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
        throw new Error("E2E_EMAIL e/ou E2E_PASSWORD nao definidos. Localmente: ArchSmart-web/.env.e2e.local")
    }

    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")
    // Aquece: o cold start do Render nao pode virar falha de hidratacao.
    await esperarPainelDoDashboard(page)

    const pedidos: string[] = []
    page.on("request", (r) => {
        const url = r.url()
        if (url.includes("/api/dashboard/lean") || url.includes("/api/users/me")) pedidos.push(url)
    })

    await page.goto("/dashboard")
    await esperarPainelDoDashboard(page)

    expect(
        pedidos,
        `o primeiro carregamento de /dashboard pediu no navegador: ${pedidos.join(", ")} — ` +
            "o prefetch nao esta sendo aproveitado, ou o card voltou a chamar users/me",
    ).toHaveLength(0)
})
