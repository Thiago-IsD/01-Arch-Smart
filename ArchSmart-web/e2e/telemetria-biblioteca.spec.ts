import { test, expect, type Request } from "@playwright/test"

import { esperarListaDaBiblioteca } from "./biblioteca"

/**
 * A prova viva do `screen_viewed` da Biblioteca: o que a Seção 7 não conseguiu
 * fazer e deixou aberto como pendência 2.
 *
 * Guarda, não instrumento — diferente de `medicao-biblioteca.spec.ts`. Não
 * produz número para ninguém registrar: afirma o que o evento **diz**, e que o
 * `load_ms` está na ordem de grandeza certa. O defeito concreto que ela pega é
 * o da Seção 7, medido por experimento na revisão daquela seção:
 * `{"screen":"/library","load_ms":28,"medido_ate":"pintura"}` numa tela cujo
 * dado levou ~100 ms — o gatilho antigo decidia no primeiro frame, com o
 * fallback do `<Suspense>` ainda no ar.
 *
 * > ⚠️ **Este spec nunca foi executado.** Escrito na Tarefa 10 da Seção 8, em
 * > 11/09/2026, quando a credencial do usuário de teste E2E estava sendo
 * > rejeitada pelo Supabase de staging (`HTTP 400, "Invalid login
 * > credentials"`). Ele está no quarto job do CI
 * > (`.github/workflows/ci.yml`, job `e2e`) e é lá, ou à mão com a credencial
 * > viva, que ele roda pela primeira vez. Até então **nenhuma navegação real
 * > confirmou que um `screen_viewed` com `medido_ate: "dados"` chega ao banco**
 * > — a pendência 2 da Seção 7 continua aberta, e este arquivo é o comando que
 * > a fecha, não a prova de que fechou.
 *
 * A navegação é por **clique em link**, e não `page.goto`: o `medido_de` de uma
 * carga dura é `commit` (ver `features/telemetry/types.ts`), então um `goto`
 * mediria outra coisa e a asserção de `"clique"` nunca passaria.
 */

/** O que o cliente manda em `POST /api/telemetry/events` (um lote). */
interface LoteRecebido {
    eventos?: { name?: string; properties?: Record<string, unknown> }[]
}

/**
 * Faixa deliberadamente larga. O que se prova aqui é **ordem de grandeza**, não
 * orçamento de performance: quem mede o orçamento é `medicao-biblioteca.spec.ts`
 * (mediana de 1454 ms em 10/09/2026, `AMOSTRAS=1434,1445,1454,1469,1948`). O
 * piso existe para reprovar o `load_ms: 28` da Seção 7 — um número que só é
 * possível se o relógio parar antes de o dado existir. O teto existe para
 * reprovar relógio que começou na navegação anterior.
 */
const PISO_MS = 200
const TETO_MS = 10_000

test("o screen_viewed da Biblioteca mede ate os dados, a partir do clique", async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
        throw new Error(
            "E2E_EMAIL e/ou E2E_PASSWORD nao definidos no ambiente. " +
            "Localmente eles vivem em ArchSmart-web/.env.e2e.local (nao versionado); " +
            "no CI, nos Secrets do repositorio."
        )
    }

    const lotes: LoteRecebido[] = []
    page.on("request", (requisicao: Request) => {
        if (requisicao.method() !== "POST") return
        if (!requisicao.url().includes("/api/telemetry/events")) return
        // `postDataJSON()` volta null para corpo ausente ou ilegivel; um lote
        // ilegivel aqui e defeito do cliente, e deixar passar como "nenhum
        // evento" esconderia exatamente isso.
        const corpo = requisicao.postDataJSON() as LoteRecebido | null
        if (corpo) lotes.push(corpo)
    })

    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    // Aquece a API antes de medir: o cold start do Render foi medido em 41,9 s
    // (ADR 0009), e um `load_ms` que o inclua nao diz nada sobre a tela.
    await page.goto("/library")
    await esperarListaDaBiblioteca(page)

    // Volta ao Dashboard para que a ida a Biblioteca seja uma navegacao de
    // cliente, nascida de um clique — o unico caminho que rende
    // `medido_de: "clique"`.
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    lotes.length = 0
    await page.click("a[href='/library']")
    await esperarListaDaBiblioteca(page)

    // Precondicao explicita, e nao asserção disfarçada: as duas afirmacoes
    // abaixo (`medido_ate: "dados"` e `is_empty: false`) dependem de a conta de
    // teste ter produto NORMALIZED. `esperarListaDaBiblioteca` aceita tambem o
    // estado vazio, que renderia `"vazio"`/`true` — rotulos corretos para uma
    // tela vazia, e reprovacao confusa aqui. Falhando por esta linha, o recado
    // e "a conta de teste esta sem produto", nao "a telemetria esta errada".
    await expect(
        page.getByTestId("product-grid"),
        "a conta de teste nao tem produto na aba Biblioteca: o evento sairia " +
        "`vazio`/`is_empty: true`, que e correto para a tela e nao e o que este spec prova"
    ).toBeVisible()

    // A fila junta uma janela de 1 s antes de mandar (`features/telemetry/fila.ts`),
    // e o evento so e enfileirado quando a regiao principal reporta. Esperar
    // pelos eventos, e nao por tempo fixo, e o que mantem isto estavel.
    const eventosDaBiblioteca = () =>
        lotes
            .flatMap((lote) => lote.eventos ?? [])
            .filter((evento) => evento.name === "screen_viewed")
            .filter((evento) => evento.properties?.screen === "/library")

    await expect
        .poll(() => eventosDaBiblioteca().length, {
            message: "nenhum screen_viewed de /library saiu do navegador",
            timeout: 15_000,
        })
        .toBeGreaterThan(0)

    // Uma linha por navegacao. Duas significam dedupe quebrado — o modo de
    // falha que o StrictMode produz, e que `telemetry.test.tsx` prende em
    // jsdom; aqui a prova e de fora.
    const eventos = eventosDaBiblioteca()
    expect(eventos, `saiu mais de um screen_viewed: ${JSON.stringify(eventos)}`).toHaveLength(1)

    const propriedades = eventos[0].properties ?? {}

    // `dados`, nao `pintura`: a Biblioteca tem regiao de dados declarada
    // (`QueryBoundary principal` em LibraryContent.tsx), e o rotulo antigo
    // nesta tela era `pintura`.
    expect(propriedades.medido_ate).toBe("dados")
    expect(propriedades.medido_de).toBe("clique")
    expect(propriedades.principal_declarada).toBe(true)
    // A lista tem dados (o `esperarListaDaBiblioteca` acima interrompe no
    // estado de erro e distingue grade de vazio), entao `is_empty` e `false` —
    // nunca `null`, que era o valor de 100% dos eventos antes desta secao.
    expect(propriedades.is_empty).toBe(false)

    const loadMs = propriedades.load_ms
    expect(typeof loadMs).toBe("number")
    expect(loadMs as number).toBeGreaterThan(PISO_MS)
    expect(loadMs as number).toBeLessThan(TETO_MS)
})
