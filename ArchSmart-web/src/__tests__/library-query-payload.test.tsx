import { beforeEach, describe, it, expect, vi } from "vitest"
import type { FiltrosDeProduto } from "@/lib/query/keys"

/**
 * Defeito C (revisao final da Secao 5): o payload de `/api/products` era
 * escrito duas vezes — em `listarProdutos` (cliente) e em `LibraryData`
 * (prefetch no servidor). Byte-identicos hoje, mas sem fonte unica: mudar um
 * dos dois grava, sob a mesma chave de cache (`filtrosDaUrl`), uma resposta
 * de forma diferente da que o outro lado espera — linhas erradas na grade,
 * sem erro nenhum. Este teste garante que os dois montam o query pela mesma
 * funcao, `queryDeProdutos`.
 *
 * O MESMO defeito reapareceu na Tarefa 7 da Secao 8, do outro lado: o prefetch
 * do badge do inbox nasceu com o payload escrito a mao em `LibraryData`, ao
 * lado da copia que ja existia em `contarInbox`. Batiam por coincidencia, e
 * nada prendia a igualdade. O segundo teste deste arquivo e a prenda.
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

    // Os dois testes chamam `LibraryData`, que hoje dispara DOIS prefetches:
    // sem limpar, o indice das chamadas do segundo teste dependeria do primeiro.
    beforeEach(() => {
        apiMock.mockClear()
        apiServerMock.mockClear()
    })

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

    it("contarInbox e o prefetch do badge mandam o mesmo query, montado por queryDoInbox", async () => {
        const { queryDoInbox, contarInbox } = await import("@/features/library/api")
        const { LibraryData } = await import("@/app/(dashboard)/library/components/LibraryData")

        const esperado = queryDoInbox()

        await contarInbox()
        const [, initCliente] = apiMock.mock.calls[0]
        expect((initCliente as { query: unknown }).query).toEqual(esperado)

        await LibraryData({ filtros })
        // Procurado pelo CONTEUDO, nao por indice: a ordem dentro do
        // `Promise.all` nao e o que este teste afirma, e amarrar o teste a ela
        // faria uma troca de ordem inofensiva reprovar.
        const queries = apiServerMock.mock.calls.map(([, init]) => (init as { query: unknown }).query)
        expect(queries).toContainEqual(esperado)
    })
})
