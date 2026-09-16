import { test, expect } from "@playwright/test"

import { esperarListaDeProjetos } from "./projetos-dados"

/**
 * Mede "do clique até os dados na tela" na lista de Projetos.
 *
 * Cópia adaptada de `medicao-dashboard.spec.ts` (Tarefa 12 da migração de
 * Projetos, Seção 8). Não é teste de regressão: é instrumento. Roda com
 * sessão real e API quente (o Render free tier hiberna — a primeira chamada
 * mediu 41,9 s em 06/09/2026, e incluir esse número na mediana mediria o
 * Render, não o front).
 *
 * Precisa de sessão autenticada. `playwright.config.ts` não tem
 * `storageState` configurado, então este spec faz login de verdade no
 * início, lendo as credenciais de `E2E_EMAIL`/`E2E_PASSWORD` no ambiente.
 * Sem essas variáveis, o spec falha imediatamente com uma mensagem clara —
 * nunca pula silenciosamente, e nunca produz um número.
 */
const REPETICOES = 5

test("mede o tempo até a lista de Projetos ter dados", async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD

    if (!email || !password) {
        throw new Error(
            "E2E_EMAIL e/ou E2E_PASSWORD não estão definidos no ambiente. " +
            "Defina as duas variáveis com credenciais de um usuário real antes de rodar esta medição, ex.: " +
            "E2E_EMAIL=... E2E_PASSWORD=... npx playwright test e2e/medicao-projetos.spec.ts"
        )
    }

    // Login real via UI: cria a sessão que a medição reutiliza em seguida.
    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    const amostras: number[] = []

    // Aquece: descarta a primeira, que pode pagar cold start da API.
    await page.goto("/projects")
    await esperarListaDeProjetos(page)

    for (let i = 0; i < REPETICOES; i++) {
        await page.goto("/dashboard")
        await page.waitForLoadState("networkidle")

        const inicio = Date.now()
        await page.click("a[href='/projects']")
        await esperarListaDeProjetos(page)
        amostras.push(Date.now() - inicio)
    }

    amostras.sort((a, b) => a - b)
    const mediana = amostras[Math.floor(amostras.length / 2)]
    console.log(`AMOSTRAS=${amostras.join(",")}`)
    console.log(`MEDIANA_MS=${mediana}`)
    expect(amostras).toHaveLength(REPETICOES)
})
