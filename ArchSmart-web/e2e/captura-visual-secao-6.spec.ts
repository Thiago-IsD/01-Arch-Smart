import { test, expect, type Page } from "@playwright/test"
import fs from "fs"
import path from "path"

/**
 * Captura visual das três mudanças da Seção 6: `min-h-11` no
 * `DropdownMenuItem`, a cor do botão de fechar do toast destrutivo, e
 * `aria-hidden` no `Skeleton`.
 *
 * Instrumento, não guarda permanente — como `medicao-biblioteca.spec.ts`.
 * Precisa de `CAPTURAS_DIR` no ambiente (nunca escreve dentro do
 * repositório) e de `E2E_EMAIL`/`E2E_PASSWORD`, lidos de `process.env` — a
 * senha nunca passa por nada que o agente escreva.
 *
 * Três correções em relação ao brief original (Tarefa 1 da Seção 8), medidas
 * por grep/leitura antes de escrever este spec, não deduzidas:
 *
 * 1. `/dev/componentes` NÃO está fora de `ROTAS_PUBLICAS` (confirmado em
 *    `src/proxy.ts`) — exige sessão como qualquer outra rota, exatamente a
 *    pendência 1 da Seção 7 registrada em `../CLAUDE.md`. Por isso o login
 *    acontece ANTES da galeria aqui, não depois.
 * 2. O alvo "alternador de tema" não está em `/dashboard`. O `Header` do
 *    dashboard tem um botão Sol/Lua simples (sem `DropdownMenu`). O
 *    `ModeToggle` de `src/components/theme-toggle.tsx` — o que de fato usa
 *    `DropdownMenuItem` — só é renderizado pelo `Navbar` público (`/`, e as
 *    páginas de auth/landing). Capturado em `/`, que continua acessível
 *    depois do login (só `/auth/login` redireciona o usuário autenticado).
 *    Na largura mobile o `ModeToggle` vive dentro do menu hambúrguer do
 *    `Navbar` (`hidden ... group-data-[state=active]:block`) — o spec abre
 *    esse menu antes de procurar o botão.
 * 3. O alvo "toast destrutivo" não tem gatilho em `/dev/componentes` — a
 *    galeria não tem seção de Toast (confirmado por leitura de
 *    `galeria.tsx`). O componente `Toaster` é global (montado em
 *    `src/app/layout.tsx`), então o CSS medido não depende da rota. Disparado
 *    em `/library`, interceptando a requisição DELETE do produto para
 *    forçar erro sem tocar em dado real (a rota nunca chega ao backend).
 */

function capturasDir(): string {
    const dir = process.env.CAPTURAS_DIR
    if (!dir) {
        throw new Error(
            "CAPTURAS_DIR não está definido no ambiente. Defina um diretório de " +
            "destino (fora do repositório) antes de rodar, ex.: " +
            "CAPTURAS_DIR=/caminho/de/scratch npx playwright test e2e/captura-visual-secao-6.spec.ts"
        )
    }
    fs.mkdirSync(dir, { recursive: true })
    return dir
}

const LARGURAS = [
    { nome: "mobile-390x844", width: 390, height: 844 },
    { nome: "desktop-1440x900", width: 1440, height: 900 },
] as const

/** Lê `min-height` computado de cada `[role="menuitem"]` visível na página. */
async function minHeightsDosItens(page: Page): Promise<string[]> {
    return page.getByRole("menuitem").evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).minHeight)
    )
}

test("captura visual das mudanças da Seção 6", async ({ page }) => {
    // Muitas navegações + duas larguras; o default de 30s do Playwright não
    // cabe mesmo no caminho feliz. O tempo real de cada passo fica nos logs.
    test.setTimeout(180_000)

    const dir = capturasDir()
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
        throw new Error(
            "E2E_EMAIL e/ou E2E_PASSWORD não estão definidos no ambiente. " +
            "Carregue-os de .env.e2e.local (set -a; . ./.env.e2e.local; set +a) antes de rodar."
        )
    }

    // --- Alvo: alternador de tema — corrigido para "/" (ModeToggle é público) ---
    // Roda ANTES da tentativa de login: "/" não exige sessão, e se o login
    // falhar abaixo, este alvo continua sendo evidência válida por si só.
    for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura.width, height: largura.height })
        await page.goto("/")
        await page.waitForLoadState("networkidle")

        // Abaixo do breakpoint `lg` (1024px) o ModeToggle vive dentro do menu
        // hambúrguer do Navbar, escondido por `hidden` até o menu abrir.
        if (largura.width < 1024) {
            await page.getByRole("button", { name: "Abrir menu" }).click()
        }

        const trigger = page.getByRole("button", { name: /alternar tema/i })
        await trigger.click()
        const alturas = await minHeightsDosItens(page)
        console.log(`ALTERNADOR_TEMA_MIN_HEIGHT[${largura.nome}]=${JSON.stringify(alturas)}`)
        await page.screenshot({
            path: path.join(dir, `alternador-tema-${largura.nome}.png`),
        })
        await page.keyboard.press("Escape")
    }

    // --- Login real via UI, mesmo caminho de medicao-biblioteca.spec.ts ---
    // Só o status da resposta de login é logado (nunca o corpo) — o suficiente
    // para diagnosticar falha de login sem expor nada sensível.
    let autenticado = false
    page.on("response", (res) => {
        if (res.url().includes("/api/auth/login")) {
            console.log(`LOGIN_RESPONSE_STATUS=${res.status()}`)
        }
    })
    try {
        await page.goto("/auth/login")
        await page.getByLabel(/e-mail/i).fill(email)
        await page.getByLabel(/senha/i).fill(password)
        await page.getByRole("button", { name: /entrar/i }).click()
        await page.waitForURL("**/dashboard", { timeout: 20000 })
        autenticado = true
    } catch (erro) {
        // Regra 6 do brief: reportar a mensagem exata, não tentar rota
        // alternativa de credencial. Os alvos que exigem sessão ficam sem
        // evidência, registrados individualmente abaixo, e o erro.png dessa
        // tentativa também não é mantido, por poder conter o valor do campo
        // de senha no DOM (risco medido nesta mesma tarefa).
        console.log(`LOGIN_FALHOU=${erro instanceof Error ? erro.message : String(erro)}`)
    }

    if (!autenticado) {
        const alvosNaoAlcancados = [
            "galeria de componentes (/dev/componentes)",
            "menu do cabeçalho (/dashboard)",
            "card de produto (/library)",
            "toast destrutivo (/library)",
            "tabela financeira (/finance)",
            "card de ambiente (/projects/<id>)",
        ]
        for (const alvo of alvosNaoAlcancados) {
            console.log(`ALVO_NAO_ALCANCADO=${alvo} — login falhou, ver LOGIN_FALHOU acima`)
        }
        expect(fs.existsSync(dir)).toBe(true)
        return
    }

    // --- Alvo: galeria de componentes (/dev/componentes) ---
    for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura.width, height: largura.height })
        await page.goto("/dev/componentes")
        await page.waitForLoadState("networkidle")

        // Skeleton: aria-hidden é a classe que o CSS compilado exige.
        const skeletons = await page.locator(".animate-pulse").evaluateAll((els) =>
            els.map((el) => ({
                ariaHidden: el.getAttribute("aria-hidden"),
                className: el.className,
            }))
        )
        console.log(`GALERIA_SKELETONS[${largura.nome}]=${JSON.stringify(skeletons)}`)

        await page.screenshot({
            path: path.join(dir, `galeria-${largura.nome}.png`),
            fullPage: true,
        })

        // Bônus: a própria galeria tem um DropdownMenu ("Acoes", sem acento no
        // próprio texto-fonte), um dos 6 arquivos com DropdownMenuItem — medir
        // também, não só capturar a página.
        const triggerGaleria = page.getByRole("button", { name: "Acoes" })
        if ((await triggerGaleria.count()) === 0) {
            console.log(`GALERIA_DROPDOWN[${largura.nome}]=gatilho "Acoes" não encontrado por esse nome`)
        } else {
            await triggerGaleria.click()
            const alturas = await minHeightsDosItens(page)
            console.log(`GALERIA_DROPDOWN_MIN_HEIGHT[${largura.nome}]=${JSON.stringify(alturas)}`)
            await page.screenshot({
                path: path.join(dir, `galeria-dropdown-${largura.nome}.png`),
            })
            await page.keyboard.press("Escape")
        }
    }

    // --- Alvo: menu do cabeçalho (/dashboard) ---
    for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura.width, height: largura.height })
        await page.goto("/dashboard")
        await page.waitForLoadState("networkidle")

        const trigger = page.locator("header").getByRole("button").last()
        await trigger.click()
        const alturas = await minHeightsDosItens(page)
        console.log(`MENU_CABECALHO_MIN_HEIGHT[${largura.nome}]=${JSON.stringify(alturas)}`)
        await page.screenshot({
            path: path.join(dir, `menu-cabecalho-${largura.nome}.png`),
        })
        await page.keyboard.press("Escape")
    }

    // --- Alvo: card de produto (/library) ---
    for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura.width, height: largura.height })
        await page.goto("/library")
        await page.waitForSelector(
            "[data-testid='product-grid'], [data-testid='library-empty']"
        )

        const trigger = page.getByRole("button", { name: "Ações" }).first()
        if ((await trigger.count()) === 0) {
            console.log(`CARD_PRODUTO[${largura.nome}]=nenhum cartão de produto encontrado (biblioteca vazia?)`)
        } else {
            await trigger.hover()
            await trigger.click()
            const alturas = await minHeightsDosItens(page)
            console.log(`CARD_PRODUTO_MIN_HEIGHT[${largura.nome}]=${JSON.stringify(alturas)}`)
            await page.screenshot({
                path: path.join(dir, `card-produto-${largura.nome}.png`),
            })
            await page.keyboard.press("Escape")
        }
    }

    // --- Alvo: toast destrutivo — corrigido para /library (galeria não tem gatilho) ---
    for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura.width, height: largura.height })
        await page.goto("/library")
        await page.waitForSelector(
            "[data-testid='product-grid'], [data-testid='library-empty']"
        )

        const trigger = page.getByRole("button", { name: "Ações" }).first()
        if ((await trigger.count()) === 0) {
            console.log(`TOAST_DESTRUTIVO[${largura.nome}]=nenhum cartão de produto para disparar o fluxo de exclusão`)
            continue
        }

        // Intercepta o DELETE antes de clicar: a requisição nunca chega ao
        // backend, nenhum dado real é tocado — só o caminho de erro do
        // cliente é exercitado, para o toast destrutivo aparecer de verdade.
        await page.route("**/api/products/**", (route) => {
            if (route.request().method() === "DELETE") {
                route.fulfill({
                    status: 500,
                    contentType: "application/json",
                    body: JSON.stringify({ detail: "Erro forçado pela captura visual (Tarefa 1, Seção 8)" }),
                })
            } else {
                route.continue()
            }
        })

        await trigger.hover()
        await trigger.click()
        await page.getByRole("menuitem", { name: "Excluir" }).click()
        await page
            .getByRole("alertdialog")
            .getByRole("button", { name: "Excluir" })
            .click()

        const fecharToast = page.locator("[toast-close]")
        await fecharToast.waitFor({ state: "visible" })

        const estilos = await fecharToast.evaluate((el) => {
            const raiz = el.closest('[class*="destructive"]')
            return {
                corDoBotaoFechar: getComputedStyle(el).color,
                corDeFundoDoToast: raiz ? getComputedStyle(raiz).backgroundColor : null,
            }
        })
        console.log(`TOAST_DESTRUTIVO_ESTILO[${largura.nome}]=${JSON.stringify(estilos)}`)

        await page.screenshot({
            path: path.join(dir, `toast-destrutivo-${largura.nome}.png`),
        })

        await page.unroute("**/api/products/**")
    }

    // --- Alvo: tabela financeira (/finance) ---
    for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura.width, height: largura.height })
        await page.goto("/finance")
        await page.waitForLoadState("networkidle")

        const trigger = page.getByRole("button", { name: "Abrir menu" }).first()
        if ((await trigger.count()) === 0) {
            console.log(`TABELA_FINANCEIRA[${largura.nome}]=nenhuma linha com menu encontrada (sem movimentações no período?)`)
        } else {
            await trigger.click()
            const alturas = await minHeightsDosItens(page)
            console.log(`TABELA_FINANCEIRA_MIN_HEIGHT[${largura.nome}]=${JSON.stringify(alturas)}`)
            await page.screenshot({
                path: path.join(dir, `tabela-financeira-${largura.nome}.png`),
            })
            await page.keyboard.press("Escape")
        }
    }

    // --- Alvo: card de ambiente (/projects/<id>) ---
    for (const largura of LARGURAS) {
        await page.setViewportSize({ width: largura.width, height: largura.height })
        await page.goto("/projects")
        await page.waitForLoadState("networkidle")

        const linkProjeto = page.locator('a[href^="/projects/"]').first()
        if ((await linkProjeto.count()) === 0) {
            console.log(`CARD_AMBIENTE[${largura.nome}]=nenhum projeto encontrado em /projects`)
            continue
        }
        await linkProjeto.click()
        await page.waitForLoadState("networkidle")

        const trigger = page.getByRole("button", { name: "Abrir menu" }).first()
        if ((await trigger.count()) === 0) {
            console.log(`CARD_AMBIENTE[${largura.nome}]=projeto sem ambiente com menu (sem ambientes cadastrados?)`)
        } else {
            await trigger.click()
            const alturas = await minHeightsDosItens(page)
            console.log(`CARD_AMBIENTE_MIN_HEIGHT[${largura.nome}]=${JSON.stringify(alturas)}`)
            await page.screenshot({
                path: path.join(dir, `card-ambiente-${largura.nome}.png`),
            })
            await page.keyboard.press("Escape")
        }
    }

    expect(fs.existsSync(dir)).toBe(true)
})
