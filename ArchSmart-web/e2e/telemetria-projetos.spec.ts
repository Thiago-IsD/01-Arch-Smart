import { test, expect, type Request } from "@playwright/test"

import { esperarListaDeProjetos } from "./projetos-dados"

/**
 * A prova viva do `screen_viewed` de Projetos.
 *
 * Copia adaptada de `telemetria-dashboard.spec.ts` (Tarefa 12 da migração de
 * Projetos, Seção 8) — duplicacao aceita de proposito: cada spec e evidencia
 * de uma tela, e um helper comum mexeria nos specs das outras telas. Trocou-se
 * so o que e da tela: a espera (`esperarListaDeProjetos`), a rota de partida
 * do clique (`/dashboard`), o link clicado (`a[href='/projects']`), a
 * precondicao de dados e o `screen` filtrado. As asserções finais sao as
 * mesmas do Dashboard e da Biblioteca.
 *
 * Guarda, nao instrumento. O defeito que ela pega e o da Secao 7: um gatilho
 * que decide no primeiro frame grava `medido_ate: "pintura"` e um `load_ms` de
 * dezenas de ms.
 *
 * A navegacao e por **clique em link**, e nao `page.goto`: o `medido_de` de uma
 * carga dura e `commit` (ver `features/telemetry/types.ts`), entao um `goto`
 * mediria outra coisa e a asserção de `"clique"` nunca passaria. O link e o da
 * sidebar (`src/config/navigation.ts`, `href: "/projects"`).
 */

/** O que o cliente manda em `POST /api/telemetry/events` (um lote). */
interface LoteRecebido {
    eventos?: { name?: string; properties?: Record<string, unknown> }[]
}

/**
 * Faixa deliberadamente larga. O que se prova aqui é **ordem de grandeza**, não
 * orçamento de performance. Mesma faixa dos specs da Biblioteca e do Dashboard,
 * de proposito. O piso existe para reprovar um `load_ms` que só é possível se o
 * relógio parar antes de o dado existir. O teto existe para reprovar relógio
 * que começou na navegação anterior.
 */
const PISO_MS = 200
const TETO_MS = 10_000

/**
 * A janela da fila (`JANELA_MS` em `features/telemetry/fila.ts`), mais folga.
 *
 * O `screen_viewed` do aquecimento é **também** de `/projects`, e portanto
 * indistinguível por conteúdo do que este spec vai medir. Ele sai pelo timer de
 * 1 s ou pelo `keepalive` do `pagehide`, então um POST atrasado entraria na
 * contagem e o `toHaveLength(1)` reprovaria com "saiu mais de um
 * screen_viewed" — culpando o dedupe por um defeito deste spec. Drenar a fila
 * antes de começar a contar é o que impede isso; o instante de captura de cada
 * lote é a segunda guarda, para o caso de um lote escapar mesmo assim.
 */
const DRENAGEM_DA_FILA_MS = 1_500

test("o screen_viewed de Projetos mede ate os dados, a partir do clique", async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
        throw new Error(
            "E2E_EMAIL e/ou E2E_PASSWORD nao definidos no ambiente. " +
            "Localmente eles vivem em ArchSmart-web/.env.e2e.local (nao versionado); " +
            "no CI, nos Secrets do repositorio."
        )
    }

    // Cada lote vai com o instante em que foi capturado: e o unico jeito de
    // distinguir o evento desta navegacao do evento do aquecimento, que tem o
    // mesmo `screen` e o mesmo `name`.
    const lotes: { recebidoEm: number; corpo: LoteRecebido }[] = []
    page.on("request", (requisicao: Request) => {
        if (requisicao.method() !== "POST") return
        if (!requisicao.url().includes("/api/telemetry/events")) return
        // `postDataJSON()` volta null para corpo ausente ou ilegivel; um lote
        // ilegivel aqui e defeito do cliente, e deixar passar como "nenhum
        // evento" esconderia exatamente isso.
        const corpo = requisicao.postDataJSON() as LoteRecebido | null
        if (corpo) lotes.push({ recebidoEm: Date.now(), corpo })
    })

    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    // Aquece a API antes de medir: o cold start do Render foi medido em 41,9 s
    // (ADR 0009), e um `load_ms` que o inclua nao diz nada sobre a tela.
    await page.goto("/projects")
    await esperarListaDeProjetos(page)

    // Precondicao explicita: a conta de teste precisa ter ao menos um projeto,
    // senao `is_empty` sai `true` e a asserção de dados abaixo muda.
    await expect(
        page.getByTestId("projetos-pagina"),
        "a conta de teste nao tem projeto: o evento sairia is_empty true"
    ).toBeVisible()

    // Deixa a fila do aquecimento esvaziar ANTES de comecar a contar. Ver
    // DRENAGEM_DA_FILA_MS: o evento do aquecimento e de `/projects` tambem.
    await page.waitForTimeout(DRENAGEM_DA_FILA_MS)

    // Vai ao Dashboard para que a ida a Projetos seja uma navegacao de
    // cliente, nascida de um clique — o unico caminho que rende
    // `medido_de: "clique"`.
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    lotes.length = 0
    const instanteDoClique = Date.now()
    await page.click("a[href='/projects']")
    await esperarListaDeProjetos(page)

    await expect(
        page.getByTestId("projetos-pagina"),
        "a conta de teste esta vazia: o evento sairia is_empty true"
    ).toBeVisible()

    // A fila junta uma janela de 1 s antes de mandar (`features/telemetry/fila.ts`),
    // e o evento so e enfileirado quando a regiao principal reporta. Esperar
    // pelos eventos, e nao por tempo fixo, e o que mantem isto estavel.
    const eventosDeProjetos = () =>
        lotes
            // Segunda guarda contra o lote do aquecimento: so conta o que foi
            // capturado a partir do clique. `lotes` e zerado logo antes do
            // clique, mas um lote em voo pode chegar no meio.
            .filter((lote) => lote.recebidoEm >= instanteDoClique)
            .flatMap((lote) => lote.corpo.eventos ?? [])
            .filter((evento) => evento.name === "screen_viewed")
            .filter((evento) => evento.properties?.screen === "/projects")

    await expect
        .poll(() => eventosDeProjetos().length, {
            message: "nenhum screen_viewed de /projects saiu do navegador",
            timeout: 15_000,
        })
        .toBeGreaterThan(0)

    // Uma linha por navegacao. Duas significam dedupe quebrado — o modo de
    // falha que o StrictMode produz, e que `telemetry.test.tsx` prende em
    // jsdom; aqui a prova e de fora.
    const eventos = eventosDeProjetos()
    expect(eventos, `saiu mais de um screen_viewed: ${JSON.stringify(eventos)}`).toHaveLength(1)

    const propriedades = eventos[0].properties ?? {}

    // `dados`, nao `pintura`: a lista de Projetos tem regiao de dados
    // declarada (`QueryBoundary principal` em ProjetosContent.tsx).
    expect(propriedades.medido_ate).toBe("dados")
    expect(propriedades.medido_de).toBe("clique")
    expect(propriedades.principal_declarada).toBe(true)
    // A lista tem dados (a precondicao acima interrompe se `projetos-pagina`
    // nao estiver visivel), entao `is_empty` e `false` — nunca `null`.
    expect(propriedades.is_empty).toBe(false)

    const loadMs = propriedades.load_ms
    expect(typeof loadMs).toBe("number")
    expect(loadMs as number).toBeGreaterThan(PISO_MS)
    expect(loadMs as number).toBeLessThan(TETO_MS)
})
