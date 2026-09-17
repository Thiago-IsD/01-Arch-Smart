import { test } from "@playwright/test"

/**
 * Mede o estouro horizontal de `ROTA`, nas DUAS métricas que a revisão da
 * branch `secao-8-limpeza-projetos` pediu para não confundir.
 *
 * Instrumento, não guarda (não entra em `.github/workflows/e2e.yml`).
 *
 * ## O problema que este instrumento existe para responder
 *
 * A coluna principal do shell (`AppShell.tsx`, div em torno de `<Header>` +
 * `<main>`) ganhou `min-w-0`. `main` já era `overflow-auto`. Sem `min-w-0`,
 * a coluna crescia até o conteúdo e o excesso virava rolagem do
 * **documento** — o que `documentElement.scrollWidth − innerWidth` mede.
 * Com `min-w-0`, a coluna para de crescer e o mesmo excesso passa a virar
 * rolagem **dentro de `main`** — invisível para essa métrica. "Estouro do
 * documento zero" pode então significar duas coisas opostas: o conteúdo
 * coube, ou ele passou a rolar por dentro sem ninguém perceber. Por isso
 * este instrumento mede as duas métricas sempre, nunca só uma.
 *
 * ## As duas métricas
 *
 * - **Documento** (a métrica antiga): `document.documentElement.scrollWidth`
 *   e `window.innerWidth`. Estourava antes do `min-w-0`.
 * - **`main`** (a métrica que a revisão pediu): `main.scrollWidth` e
 *   `main.clientWidth`, do PRIMEIRO `<main>` do documento em ordem — é o
 *   `<main>` do `AppShell`, mesmo em rotas que aninham um `<main>` próprio
 *   mais fundo na árvore (`budget`, por exemplo), porque esse `<main>`
 *   interno vem depois no `querySelector`.
 *
 * Quando `main` estoura, o instrumento também percorre TODOS os
 * descendentes de `main` (não só os filhos diretos — o nó que estoura pode
 * estar mais fundo, e um estouro raso não aponta pra causa) e reporta o de
 * maior `scrollWidth`/`getBoundingClientRect().width`, com um seletor que
 * identifica o nó (tag + id + data-testid + até 3 classes) — sem isso o
 * número não aciona ninguém, só denuncia que existe.
 *
 * ## Como rodar
 *
 * Com a API e o front de pé (`npm run dev`), sessão real via login de UI:
 *
 * ```
 * cd ArchSmart-web
 * set -a; . ./.env.e2e.local; set +a
 * ROTA=/library LARGURA=390 TEMA=claro npx playwright test e2e/medicao-largura.spec.ts --reporter=line
 * ```
 *
 * `LARGURA` em px (padrão 1440). `TEMA` é `claro` (padrão) ou `escuro`,
 * forçado por `localStorage.theme`, onde o `next-themes` lê.
 */

interface ElementoMaisLargo {
    seletor: string
    scrollWidth: number
    rectWidth: number
}

test("mede o estouro horizontal de ROTA", async ({ page }) => {
    const rota = process.env.ROTA
    const tema = process.env.TEMA === "escuro" ? "dark" : "light"
    const largura = Number(process.env.LARGURA ?? 1440)
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD

    if (!rota) {
        throw new Error("ROTA não definida. Ex.: ROTA=/library LARGURA=390 npx playwright test e2e/medicao-largura.spec.ts")
    }
    if (!email || !password) {
        throw new Error(
            "E2E_EMAIL e/ou E2E_PASSWORD não definidos. Localmente: " +
            "set -a; . ./ArchSmart-web/.env.e2e.local; set +a"
        )
    }
    if (!Number.isFinite(largura) || largura <= 0) {
        throw new Error(`LARGURA inválida: ${process.env.LARGURA}`)
    }

    await page.setViewportSize({ width: largura, height: 900 })
    await page.addInitScript((t) => localStorage.setItem("theme", t), tema)

    // Login real via UI — mesmo caminho dos outros instrumentos desta pasta.
    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    await page.goto(rota)
    await page.waitForLoadState("networkidle")

    const medida = await page.evaluate(() => {
        const doc = document.documentElement
        const documentoScrollWidth = doc.scrollWidth
        const innerWidth = window.innerWidth
        const documentoDiff = documentoScrollWidth - innerWidth

        const main = document.querySelector("main")
        if (!main) {
            return {
                documentoScrollWidth,
                innerWidth,
                documentoDiff,
                mainEncontrado: false as const,
            }
        }

        const mainScrollWidth = main.scrollWidth
        const mainClientWidth = main.clientWidth
        const mainDiff = mainScrollWidth - mainClientWidth

        let elementoMaisLargo: ElementoMaisLargo | null = null
        if (mainDiff > 0) {
            const candidatos = main.querySelectorAll("*")
            for (const el of Array.from(candidatos)) {
                const scrollWidth = el.scrollWidth
                const rectWidth = el.getBoundingClientRect().width
                const largura = Math.max(scrollWidth, rectWidth)
                const atual = elementoMaisLargo ? Math.max(elementoMaisLargo.scrollWidth, elementoMaisLargo.rectWidth) : -1
                if (largura > atual) {
                    const classes =
                        typeof el.className === "string" && el.className.trim().length > 0
                            ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
                            : ""
                    const testid = el.getAttribute("data-testid")
                    const seletor =
                        el.tagName.toLowerCase() +
                        (el.id ? `#${el.id}` : "") +
                        (testid ? `[data-testid="${testid}"]` : "") +
                        classes
                    elementoMaisLargo = { seletor, scrollWidth, rectWidth }
                }
            }
        }

        return {
            documentoScrollWidth,
            innerWidth,
            documentoDiff,
            mainEncontrado: true as const,
            mainScrollWidth,
            mainClientWidth,
            mainDiff,
            elementoMaisLargo,
        }
    })

    console.log(`ROTA=${rota} TEMA=${tema} LARGURA=${largura}`)
    console.log(
        `DOCUMENTO_SCROLL_WIDTH=${medida.documentoScrollWidth} INNER_WIDTH=${medida.innerWidth} DOCUMENTO_DIFF=${medida.documentoDiff}`
    )

    if (!medida.mainEncontrado) {
        console.log("MAIN_ENCONTRADO=false — nenhum <main> no documento; métrica de main não medida")
        return
    }

    console.log(
        `MAIN_SCROLL_WIDTH=${medida.mainScrollWidth} MAIN_CLIENT_WIDTH=${medida.mainClientWidth} MAIN_DIFF=${medida.mainDiff}`
    )

    if (medida.mainDiff > 0 && medida.elementoMaisLargo) {
        console.log(
            `MAIN_ELEMENTO_MAIS_LARGO=${medida.elementoMaisLargo.seletor} ` +
            `scrollWidth=${medida.elementoMaisLargo.scrollWidth} rectWidth=${medida.elementoMaisLargo.rectWidth}`
        )
    } else {
        console.log("MAIN_ELEMENTO_MAIS_LARGO=n/a — main.scrollWidth <= main.clientWidth, conteúdo cabe")
    }
})
