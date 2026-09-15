import { test, type CDPSession } from "@playwright/test"

/**
 * Mede, numa CARGA DURA de `ROTA`, o LCP sob rede e CPU limitadas e o JS que o
 * navegador baixou.
 *
 * Instrumento, nao guarda (Secao 8, Projetos, Tarefa 1). Produz numero; nao
 * entra no e2e.yml.
 *
 * ## O perfil — escrito aqui porque o numero so vale com ele
 *
 * "4G" e o perfil "Slow 4G" do Lighthouse, aplicado por CDP: RTT 150 ms,
 * 1,6 Mbps de descida, 750 Kbps de subida, CPU 4x mais lenta. NAO e rede 4G
 * real — e throttling do Chromium, e o numero e rotulado assim.
 *
 * ## JS
 *
 * Soma de `encodedBodySize` (bytes pela rede, ja comprimidos) dos recursos
 * `.js` da carga dura, com cache DESABILITADO. E JS compartilhado + da rota,
 * nao so da rota. So vale contra `next build && next start`: em `next dev` o
 * JS nao e minificado e o numero nao diz nada.
 *
 * ## Como rodar
 *
 * ```
 * cd ArchSmart-web
 * npm run build && npm run start          # outro terminal; o playwright reusa a :3000
 * set -a; . ./.env.e2e.local; set +a
 * ROTA=/projects npx playwright test e2e/medicao-carga.spec.ts --reporter=line --timeout=180000
 * ```
 */
const REPETICOES = 5

const SLOW_4G = {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
}
const CPU_LENTA = 4

async function limitar(cdp: CDPSession): Promise<void> {
    await cdp.send("Network.enable")
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })
    await cdp.send("Network.emulateNetworkConditions", SLOW_4G)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_LENTA })
}

test("mede LCP e JS da carga dura de ROTA", async ({ page }) => {
    const rota = process.env.ROTA
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!rota) throw new Error("ROTA nao definida. Ex.: ROTA=/projects")
    if (!email || !password) {
        throw new Error("E2E_EMAIL e/ou E2E_PASSWORD nao definidos. Localmente: ArchSmart-web/.env.e2e.local")
    }

    // Login SEM limitacao: o que se mede e a rota, nao o formulario de login.
    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    // Aquece a API (cold start do Render nao e o front) antes de limitar.
    await page.goto(rota)
    await page.waitForLoadState("networkidle")

    await page.addInitScript(() => {
        const w = window as unknown as { __lcp: number }
        w.__lcp = 0
        new PerformanceObserver((lista) => {
            for (const entrada of lista.getEntries()) w.__lcp = entrada.startTime
        }).observe({ type: "largest-contentful-paint", buffered: true })
    })

    const cdp = await page.context().newCDPSession(page)
    await limitar(cdp)

    const lcps: number[] = []
    let jsBytes = 0
    let jsArquivos = 0

    for (let i = 0; i < REPETICOES; i++) {
        await page.goto(rota)
        await page.waitForLoadState("networkidle")
        lcps.push(await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp))

        if (i === 0) {
            const js = await page.evaluate(() =>
                performance
                    .getEntriesByType("resource")
                    .map((r) => r as PerformanceResourceTiming)
                    .filter((r) => new URL(r.name).pathname.endsWith(".js")),
            )
            jsArquivos = js.length
            jsBytes = js.reduce((soma, r) => soma + r.encodedBodySize, 0)
        }
    }

    if (lcps.some((v) => v <= 0)) {
        throw new Error(`LCP nao foi observado em alguma amostra: ${lcps.join(",")}`)
    }

    lcps.sort((a, b) => a - b)
    console.log(`ROTA=${rota}`)
    console.log(`PERFIL=slow4g-cdp rtt=150ms down=1.6Mbps up=750Kbps cpu=${CPU_LENTA}x`)
    console.log(`LCP_AMOSTRAS=${lcps.map(Math.round).join(",")}`)
    console.log(`LCP_MEDIANA_MS=${Math.round(lcps[Math.floor(lcps.length / 2)])}`)
    console.log(`JS_BYTES=${jsBytes}`)
    console.log(`JS_ARQUIVOS=${jsArquivos}`)
})
