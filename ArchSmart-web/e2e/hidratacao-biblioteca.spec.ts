import { test, expect } from "@playwright/test"

/**
 * Prova que o prefetch no servidor da Seção 5 está de fato hidratando: ao abrir
 * /library direto (navegação de servidor, não client-side), o navegador não
 * pode emitir requisição a /api/products no primeiro carregamento.
 *
 * Sem isto, "o prefetch funciona" é inferência estrutural. O modo de falha é
 * silencioso: o prefetch vira custo puro sem emitir erro nenhum.
 */
test("nao busca /api/products no navegador no primeiro carregamento", async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
        throw new Error("E2E_EMAIL e/ou E2E_PASSWORD nao definidos. Ver Tarefa 1 do plano da Secao 6.")
    }

    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    // Aquece a API: cold start do Render nao pode virar falha de hidratacao.
    await page.goto("/library")
    await page.waitForSelector("[data-testid='product-grid'], [data-testid='library-empty']")

    const pedidos: string[] = []
    page.on("request", (r) => {
        if (r.url().includes("/api/products")) pedidos.push(r.url())
    })

    await page.goto("/library")
    await page.waitForSelector("[data-testid='product-grid'], [data-testid='library-empty']")

    expect(pedidos, `o navegador pediu /api/products: ${pedidos.join(", ")}`).toHaveLength(0)
})
