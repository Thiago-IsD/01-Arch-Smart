import type { Page } from "@playwright/test"

/**
 * Espera o painel do Dashboard resolver — e nomeia a falha quando o desfecho
 * foi erro. Mesmo contrato de `biblioteca.ts`: esperar so pelo painel faria
 * uma falha virar timeout mudo, e seguir apos o erro mediria carga falhada.
 */
export async function esperarPainelDoDashboard(page: Page): Promise<void> {
    await page.waitForSelector("[data-testid='dashboard-painel'], [data-testid='dashboard-error']")
    const erro = page.locator("[data-testid='dashboard-error']")
    if ((await erro.count()) > 0) {
        const texto = (await erro.first().innerText()).replace(/\s+/g, " ").trim()
        throw new Error(`o Dashboard falhou em vez de carregar: ${texto}`)
    }
}
