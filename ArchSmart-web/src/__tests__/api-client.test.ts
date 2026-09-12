import { describe, it, expect, vi } from "vitest"
import { criarCliente } from "@/lib/api/core"
import { ApiError } from "@/lib/api/errors"

// Usar Symbol para detectar quando undefined é explicitamente passado
const NENHUM_TOKEN = Symbol("nenhum token")

function clienteDeTeste(resposta: Response, token: string | undefined | typeof NENHUM_TOKEN = "tok123") {
    const tokenResolvido = token === NENHUM_TOKEN ? undefined : token
    const fetchFalso = vi.fn().mockResolvedValue(resposta)
    const cliente = criarCliente({
        resolverToken: async () => tokenResolvido,
        baseUrl: () => "http://api.teste",
        fetchImpl: fetchFalso as unknown as typeof fetch,
    })
    return { cliente, fetchFalso }
}

function json(corpo: unknown, status = 200) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

describe("criarCliente", () => {
    it("monta o header Authorization sozinho", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }))
        await cliente("/api/products")
        const [, init] = fetchFalso.mock.calls[0]
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok123")
    })

    it("nao manda Authorization quando nao ha sessao", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }), NENHUM_TOKEN)
        await cliente("/api/public")
        const [, init] = fetchFalso.mock.calls[0]
        expect(new Headers(init.headers).has("Authorization")).toBe(false)
    })

    it("manda Authorization tambem em DELETE — o defeito do ProductCard", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }))
        await cliente("/api/products/abc", { method: "DELETE" })
        const [, init] = fetchFalso.mock.calls[0]
        expect(init.method).toBe("DELETE")
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok123")
    })

    it("serializa query, inclusive parametro repetido", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ items: [] }))
        await cliente("/api/products", {
            query: { page: 1, size: 15, categories: ["Mobiliário", "Iluminação"], q: undefined },
        })
        const [url] = fetchFalso.mock.calls[0]
        const params = new URL(url).searchParams
        expect(params.get("page")).toBe("1")
        expect(params.getAll("categories")).toEqual(["Mobiliário", "Iluminação"])
        expect(params.has("q")).toBe(false)
    })

    it("propaga keepalive ao fetch, e so quando pedido", async () => {
        // A telemetria descarrega a fila no `pagehide`, e sem `keepalive` o
        // navegador aborta a requisição no unload do documento — perda
        // silenciosa. jsdom não destrói documento, então o que dá para provar é
        // que a opção chega ao init do fetch.
        const comKeepalive = clienteDeTeste(json({ ok: true }))
        await comKeepalive.cliente("/api/telemetry/events", { method: "POST", body: {}, keepalive: true })
        expect(comKeepalive.fetchFalso.mock.calls[0][1].keepalive).toBe(true)

        const semKeepalive = clienteDeTeste(json({ ok: true }))
        await semKeepalive.cliente("/api/products")
        expect(semKeepalive.fetchFalso.mock.calls[0][1].keepalive).toBeUndefined()
    })

    it("propaga o AbortSignal do chamador", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }))
        const controller = new AbortController()
        await cliente("/api/products", { signal: controller.signal })
        const [, init] = fetchFalso.mock.calls[0]
        expect(init.signal).toBe(controller.signal)
    })

    it("levanta ApiError com a frase de dominio", async () => {
        const { cliente } = clienteDeTeste(json({ detail: "Seu plano não permite esta ação." }, 402))
        await expect(cliente("/api/projects", { method: "POST" })).rejects.toMatchObject({
            status: 402,
            message: "Seu plano não permite esta ação.",
        })
        await expect(cliente("/api/projects", { method: "POST" })).rejects.toBeInstanceOf(ApiError)
    })

    it("manda Content-Type e corpo JSON so quando ha body", async () => {
        const { cliente, fetchFalso } = clienteDeTeste(json({ ok: true }))
        await cliente("/api/products", { method: "POST", body: { name: "Cadeira" } })
        const [, init] = fetchFalso.mock.calls[0]
        expect(new Headers(init.headers).get("Content-Type")).toBe("application/json")
        expect(init.body).toBe(JSON.stringify({ name: "Cadeira" }))
    })

    it("devolve undefined em 204 sem estourar no json()", async () => {
        const { cliente } = clienteDeTeste(new Response(null, { status: 204 }))
        await expect(cliente("/api/products/abc", { method: "DELETE" })).resolves.toBeUndefined()
    })
})
