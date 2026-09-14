import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Duas rotas da API sao declaradas COM barra final. Chamar sem a barra nao
 * quebra: o FastAPI responde `307` para a versao com barra e o navegador
 * repete a requisicao — duas idas onde bastaria uma.
 *
 * Medido em 13/09/2026 contra a API implantada: o `307` sozinho custa
 * **0,29 s**, e a Biblioteca o pagava **duas vezes** (lista e badge). Ver
 * `docs/dev/medicoes/2026-09-13-custo-da-requisicao-autenticada.md`.
 *
 * A lista abaixo nao e adivinhada — sai da propria API, e e assim que se
 * confere se ela mudou:
 *
 *     curl -s <API>/openapi.json | python -c "import json,sys; \
 *       print([p for p in json.load(sys.stdin)['paths'] if p.endswith('/')])"
 */
const ROTAS_COM_BARRA_FINAL = ["/api/products", "/api/notifications"]

const RAIZ = join(process.cwd(), "src")

function arquivosDeCodigo(dir: string): string[] {
    const achados: string[] = []
    for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome)
        if (statSync(caminho).isDirectory()) {
            if (nome === "__tests__" || nome === "node_modules") continue
            achados.push(...arquivosDeCodigo(caminho))
        } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
            achados.push(caminho)
        }
    }
    return achados
}

describe("chamadas as rotas que exigem barra final", () => {
    it.each(ROTAS_COM_BARRA_FINAL)(
        "nenhuma chamada a %s sai sem a barra, que custaria um 307",
        (rota) => {
            // Pega `"/api/products"` e `` `/api/products` `` — e nao
            // `/api/products/${id}`, que tem segmento proprio e nao redireciona.
            const semBarra = new RegExp(`["'\`]${rota}["'\`]`)
            const culpados = arquivosDeCodigo(RAIZ)
                .map((caminho) => ({ caminho, texto: readFileSync(caminho, "utf-8") }))
                .flatMap(({ caminho, texto }) =>
                    texto
                        .split("\n")
                        .map((linha, i) => ({ linha, numero: i + 1 }))
                        .filter(({ linha }) => semBarra.test(linha))
                        .map(({ numero }) => `${relative(process.cwd(), caminho)}:${numero}`),
                )

            expect(
                culpados,
                `chame "${rota}/" com a barra final; sem ela cada chamada paga um 307 de ~0,29 s:\n  ${culpados.join("\n  ")}`,
            ).toEqual([])
        },
    )
})
