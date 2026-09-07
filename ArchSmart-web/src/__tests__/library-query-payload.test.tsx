import { describe, it, expect, vi } from "vitest"
import type { FiltrosDeProduto } from "@/lib/query/keys"

/**
 * Defeito C (revisao final da Secao 5): o payload de `/api/products` era
 * escrito duas vezes — em `listarProdutos` (cliente) e em `LibraryData`
 * (prefetch no servidor). Byte-identicos hoje, mas sem fonte unica: mudar um
 * dos dois grava, sob a mesma chave de cache (`filtrosDaUrl`), uma resposta
 * de forma diferente da que o outro lado espera — linhas erradas na grade,
 * sem erro nenhum. Este teste garante que os dois montam o query pela mesma
 * funcao, `queryDeProdutos`.
 */

const apiMock = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, size: 15, pages: 1 })
const apiServerMock = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, size: 15, pages: 1 })

vi.mock("@/lib/api/client", () => ({ api: (...args: unknown[]) => apiMock(...args) }))
vi.mock("@/lib/api/server", () => ({ apiServer: (...args: unknown[]) => apiServerMock(...args) }))
// LibraryContent arrasta toda a arvore de componentes da Biblioteca — nao e
// o que este teste mede. So o payload do prefetch importa aqui.
vi.mock("@/app/(dashboard)/library/components/LibraryContent", () => ({
    LibraryContent: () => null,
}))

describe("payload de /api/products — fonte unica", () => {
    const filtros: FiltrosDeProduto = {
        tab: "inbox",
        q: "cadeira",
        categories: ["moveis"],
        origins: ["catalogo"],
        sortBy: "created_at_desc",
        page: 2,
        size: 15,
    }

    it("listarProdutos e LibraryData mandam o mesmo query, montado por queryDeProdutos", async () => {
        const { queryDeProdutos, listarProdutos } = await import("@/features/library/api")
        const { LibraryData } = await import("@/app/(dashboard)/library/components/LibraryData")

        const esperado = queryDeProdutos(filtros)

        await listarProdutos(filtros)
        const [, initCliente] = apiMock.mock.calls[0]
        expect((initCliente as { query: unknown }).query).toEqual(esperado)

        await LibraryData({ filtros })
        const [, initServidor] = apiServerMock.mock.calls[0]
        expect((initServidor as { query: unknown }).query).toEqual(esperado)
    })
})
