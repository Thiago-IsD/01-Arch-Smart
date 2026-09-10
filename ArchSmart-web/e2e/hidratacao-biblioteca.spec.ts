import { test, expect } from "@playwright/test"

/**
 * Prova que o prefetch no servidor da Seção 5 está de fato hidratando: ao abrir
 * /library direto (navegação de servidor, não client-side), o navegador não
 * pode emitir requisição pela LISTA principal de produtos
 * (`/api/products?...&state=NORMALIZED`, a chave que `page.tsx`/`LibraryData`
 * prefetcham no servidor) no primeiro carregamento.
 *
 * Sem isto, "o prefetch funciona" é inferência estrutural. O modo de falha é
 * silencioso: o prefetch vira custo puro sem emitir erro nenhum.
 *
 * A asserção filtra por `state=NORMALIZED` de propósito, e não por
 * `/api/products` cru. `useInboxCount()` (`features/library/hooks.ts`) chama
 * o mesmo endpoint com `state=CAPTURED` para o badge do inbox, e essa chamada
 * **nunca foi prefetchada pelo servidor** — lacuna já documentada por leitura
 * de código desde a Tarefa 12 da Seção 5
 * (`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`, seção 1) e confirmada
 * ao vivo por este mesmo spec antes desta correção. Ela é pendência aberta da
 * Seção 5 (`PROGRESS.md`, nota da Seção 5, item 9), não desta seção — um
 * `toHaveLength(0)` sem esse filtro reprovaria este teste para sempre pelo
 * motivo já conhecido, o que a regra da casa contra "é esperado que falhe"
 * não permite deixar em pé. O que este teste garante é mais estreito e ainda
 * assim é o que importa aqui: se a hidratação da LISTA quebrar (a chave não
 * bater, o timeout do prefetch estourar), esta asserção acende — o badge do
 * inbox pedir como já sabido não apaga esse sinal.
 */
test("a lista da Biblioteca nao busca /api/products no navegador no primeiro carregamento", async ({ page }) => {
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

    // `state=NORMALIZED` e a chave da lista principal (a que o servidor
    // prefetcha); `state=CAPTURED` e o badge do inbox (nunca prefetchado,
    // pendencia separada — ver comentario do teste, acima).
    const pedidosDaLista = pedidos.filter((url) => url.includes("state=NORMALIZED"))

    expect(
        pedidosDaLista,
        `a lista da Biblioteca pediu /api/products no navegador: ${pedidosDaLista.join(", ")}`,
    ).toHaveLength(0)
})
