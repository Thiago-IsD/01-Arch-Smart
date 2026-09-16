import { test, expect } from "@playwright/test"

import { esperarAmbientesDoProjeto, esperarListaDeProjetos } from "./projetos-dados"

/**
 * O prefetch de Projetos hidrata: abrir a lista e o detalhe direto (navegacao
 * de servidor) nao pode emitir /api/projects* do navegador.
 *
 * `networkidle` antes de contar: o conteudo vem renderizado do SERVIDOR, e uma
 * chamada disparada por efeito depois da hidratacao sairia depois do seletor
 * (o defeito que a guarda do Dashboard so pegou depois de provada vermelha).
 */
async function entrar(page: import("@playwright/test").Page) {
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
}

function contarPedidos(page: import("@playwright/test").Page): string[] {
    const pedidos: string[] = []
    page.on("request", (r) => {
        if (new URL(r.url()).pathname.startsWith("/api/projects")) pedidos.push(r.url())
    })
    return pedidos
}

test("a lista de Projetos nao busca /api/projects no navegador no primeiro carregamento", async ({ page }) => {
    await entrar(page)
    await page.goto("/projects")
    await esperarListaDeProjetos(page) // aquece: cold start nao e falha de hidratacao

    const pedidos = contarPedidos(page)
    await page.goto("/projects")
    await esperarListaDeProjetos(page)
    await page.waitForLoadState("networkidle")

    expect(pedidos, `a lista pediu no navegador: ${pedidos.join(", ")}`).toHaveLength(0)
})

test("o detalhe nao busca projeto nem ambientes no navegador no primeiro carregamento", async ({ page }) => {
    await entrar(page)
    await page.goto("/projects")
    await esperarListaDeProjetos(page)
    const href = await page.locator("a[href^='/projects/']").first().getAttribute("href")
    if (!href) throw new Error("a conta de teste nao tem projeto: a guarda do detalhe precisa de um")

    await page.goto(href)
    await esperarAmbientesDoProjeto(page) // aquece

    const pedidos = contarPedidos(page)
    await page.goto(href)
    await esperarAmbientesDoProjeto(page)
    await page.waitForLoadState("networkidle")

    expect(pedidos, `o detalhe pediu no navegador: ${pedidos.join(", ")}`).toHaveLength(0)
})
