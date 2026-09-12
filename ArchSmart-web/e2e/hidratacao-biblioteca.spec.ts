import { test, expect } from "@playwright/test"

import { esperarListaDaBiblioteca } from "./biblioteca"

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
 * ficou fora do prefetch durante toda a Seção 5 — lacuna documentada por
 * leitura de código desde a Tarefa 12 daquela seção
 * (`docs/dev/medicoes/2026-09-06-biblioteca-depois.md`, seção 1) e confirmada
 * ao vivo por este mesmo spec. O filtro nasceu por isso: um `toHaveLength(0)`
 * sem ele reprovaria para sempre pelo motivo já conhecido, o que a regra da
 * casa contra "é esperado que falhe" não permite deixar em pé.
 *
 * **A Tarefa 7 da Seção 8 fechou essa lacuna, e em 12/09/2026 isso foi
 * MEDIDO:** `LibraryData` prefetcha a lista e o badge em `Promise.all`, e o
 * `state=CAPTURED` também parou de sair do navegador. Três execuções
 * consecutivas com credencial real mediram `PEDIDOS_TOTAL=0` — nenhum pedido
 * a `/api/products` de nenhum tipo no primeiro carregamento.
 *
 * Por isso a asserção foi **apertada** na mesma ocasião: ela não filtra mais
 * por `state=NORMALIZED`, e exige zero pedido a `/api/products`. O filtro
 * antigo existia só porque o badge vazava por motivo conhecido; com o vazamento
 * fechado, filtrar seria deixar de olhar justamente o que a Tarefa 7 entregou.
 * Se a hidratação da lista OU do badge regredir, esta asserção acende.
 */
test("a Biblioteca nao busca /api/products no navegador no primeiro carregamento (lista e badge)", async ({ page }) => {
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
    await esperarListaDaBiblioteca(page)

    const pedidos: string[] = []
    page.on("request", (r) => {
        if (r.url().includes("/api/products")) pedidos.push(r.url())
    })

    await page.goto("/library")
    await esperarListaDaBiblioteca(page)

    // Discrimina na MENSAGEM, nao na asserção: saber se quem vazou foi a lista
    // (`state=NORMALIZED`) ou o badge do inbox (`state=CAPTURED`) e a primeira
    // pergunta de quem for investigar uma regressão aqui.
    const daLista = pedidos.filter((url) => url.includes("state=NORMALIZED"))
    const doBadge = pedidos.filter((url) => url.includes("state=CAPTURED"))

    expect(
        pedidos,
        "o primeiro carregamento de /library pediu /api/products no navegador " +
        `(lista: ${daLista.length}, badge do inbox: ${doBadge.length}) — ` +
        `o prefetch do servidor nao esta sendo aproveitado: ${pedidos.join(", ")}`,
    ).toHaveLength(0)
})
