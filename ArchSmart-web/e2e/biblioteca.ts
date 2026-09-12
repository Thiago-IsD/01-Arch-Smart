import type { Page } from "@playwright/test"

/**
 * Espera a região da lista da Biblioteca resolver — e **nomeia a falha** quando
 * o desfecho foi erro.
 *
 * Não é spec: é módulo auxiliar (o Playwright só coleta `*.spec.ts`).
 *
 * Os três specs que abrem `/library` esperavam só por `product-grid` ou
 * `library-empty`. Até a Tarefa 7 da Seção 8 isso cobria o caso de falha por
 * acidente: lista que quebrava caía na mentira do `library-empty` e o spec
 * seguia em frente — medindo, ou fotografando, uma tela cujo dado não chegou.
 * Com o `QueryBoundary`, falha agora rende `library-error`, e esperar apenas
 * pelos outros dois viraria um timeout de 30 s sem dizer o motivo.
 *
 * Então a espera inclui o estado de erro **e** o erro interrompe na hora, com a
 * mensagem que a tela mostrou. O que não se pode fazer é esperar pelo erro e
 * seguir como se a lista tivesse carregado: para `medicao-biblioteca.spec.ts`
 * isso produziria uma amostra de carga falhada dentro da mediana, que é
 * exatamente o tipo de número que mente.
 */
export async function esperarListaDaBiblioteca(page: Page): Promise<void> {
    await page.waitForSelector(
        "[data-testid='product-grid'], [data-testid='library-empty'], [data-testid='library-error']"
    )

    const erro = page.locator("[data-testid='library-error']")
    if ((await erro.count()) > 0) {
        const texto = (await erro.first().innerText()).replace(/\s+/g, " ").trim()
        throw new Error(`a lista da Biblioteca falhou em vez de carregar: ${texto}`)
    }
}
