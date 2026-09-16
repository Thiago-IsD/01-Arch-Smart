import type { Page } from "@playwright/test"

/**
 * Espera a lista de Projetos resolver — e nomeia a falha quando o desfecho foi
 * erro. Mesmo contrato de `dashboard-dados.ts`: esperar so pelo sucesso faria
 * uma falha virar timeout mudo.
 */
export async function esperarListaDeProjetos(page: Page): Promise<void> {
    await page.waitForSelector("[data-testid='projetos-pagina'], [data-testid='projetos-vazio'], [data-testid='projetos-error']")
    await falharSeErro(page, "projetos-error", "a lista de Projetos")
}

/**
 * Espera os ambientes do detalhe resolverem (a regiao `principal`).
 *
 * O detalhe tem DUAS regioes com `QueryBoundary` independentes — cabecalho
 * (`projeto-cabecalho`) e ambientes (`projeto-ambientes`) — e cada uma emite o
 * SEU PROPRIO testid de erro: `projeto-error` (cabecalho) e
 * `projeto-ambientes-error` (ambientes). Elas podem falhar ao mesmo tempo ou
 * uma sem a outra (`ProjetoContent.tsx`), entao esperar/checar so uma faria a
 * guarda ficar cega para o erro da outra e virar timeout mudo nela.
 */
export async function esperarAmbientesDoProjeto(page: Page): Promise<void> {
    await page.waitForSelector(
        "[data-testid='projeto-ambientes'] :is(h3, h4), [data-testid='projeto-error'], [data-testid='projeto-ambientes-error']",
    )
    await falharSeErro(page, "projeto-error", "o cabeçalho do projeto")
    await falharSeErro(page, "projeto-ambientes-error", "os ambientes do projeto")
}

async function falharSeErro(page: Page, testid: string, oQue: string): Promise<void> {
    const erro = page.locator(`[data-testid='${testid}']`)
    if ((await erro.count()) > 0) {
        const texto = (await erro.first().innerText()).replace(/\s+/g, " ").trim()
        throw new Error(`${oQue} falhou em vez de carregar: ${texto}`)
    }
}
