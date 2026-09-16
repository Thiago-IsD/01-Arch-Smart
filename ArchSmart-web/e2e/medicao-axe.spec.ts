import path from "node:path"
import { test } from "@playwright/test"

/**
 * axe-core em navegador numa rota autenticada. Instrumento, nao guarda.
 *
 * Usa o axe-core do node_modules (devDependency), nao CDN: o numero nao pode
 * depender da versao que um CDN servir no dia.
 *
 * ROTA (obrigatoria), TEMA=claro|escuro (padrao claro), LARGURA em px (padrao 1440).
 * O tema e forcado por `localStorage.theme`, que e onde o next-themes le.
 */
// O Playwright roda a partir de ArchSmart-web/ (onde esta playwright.config.ts).
const AXE = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js")

test("axe na ROTA", async ({ page }) => {
    const rota = process.env.ROTA
    const tema = process.env.TEMA === "escuro" ? "dark" : "light"
    const largura = Number(process.env.LARGURA ?? 1440)
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!rota) throw new Error("ROTA nao definida")
    if (!email || !password) throw new Error("E2E_EMAIL/E2E_PASSWORD nao definidos (ArchSmart-web/.env.e2e.local)")

    await page.setViewportSize({ width: largura, height: 900 })
    await page.addInitScript((t) => localStorage.setItem("theme", t), tema)

    await page.goto("/auth/login")
    await page.getByLabel(/e-mail/i).fill(email)
    await page.getByLabel(/senha/i).fill(password)
    await page.getByRole("button", { name: /entrar/i }).click()
    await page.waitForURL("**/dashboard")

    await page.goto(rota)
    await page.waitForLoadState("networkidle")
    await page.addScriptTag({ path: AXE })

    const violacoes = await page.evaluate(async () => {
        const r = await (window as unknown as { axe: { run: () => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe.run()
        return r.violations.map((v) => ({ id: v.id, impacto: v.impact, alvos: v.nodes.map((n) => n.target.join(" ")) }))
    })

    console.log(`ROTA=${rota} TEMA=${tema} LARGURA=${largura}`)
    console.log(`AXE_VIOLACOES=${violacoes.map((v) => `${v.id}(${v.alvos.length})`).join(",") || "nenhuma"}`)
    console.log(`AXE_TOTAL_NOS=${violacoes.reduce((s, v) => s + v.alvos.length, 0)}`)
    for (const v of violacoes) console.log(`  ${v.id} [${v.impacto}]: ${v.alvos.join(" | ")}`)
})
