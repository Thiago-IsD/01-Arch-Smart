import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --- O `keepalive` chega ao `fetch`? ---------------------------------------
//
// Este arquivo existe porque a ponta que importa nao e observavel em jsdom:
// `dispatchEvent(new Event("pagehide"))` nao destroi documento nenhum, entao
// nenhum teste de comportamento consegue ver um `fetch` ser abortado no unload.
// O que da para provar e que a opcao percorre a cadeia inteira e aparece no
// objeto de init que o `fetch` recebeu — fila -> enviarEventos -> api -> core.
//
// Nada do caminho de rede e mockado aqui: so o resolvedor de token (para nao
// subir Supabase) e o `fetch` global, que e o ponto de medicao.

vi.mock("@/lib/api/auth", () => ({
    getAccessToken: async () => "tok123",
    supabaseBrowser: () => {
        throw new Error("nao deve ser chamado no teste")
    },
    signOut: async () => {},
    setSession: async () => {},
    getUser: async () => null,
}))

import { _zerarFila, descarregar, enfileirar } from "@/features/telemetry/fila"

let fetchFalso: ReturnType<typeof vi.fn>

function initDaChamada(indice = 0): RequestInit {
    const chamada = fetchFalso.mock.calls[indice]
    if (!chamada) throw new Error("o fetch nao foi chamado")
    return chamada[1] as RequestInit
}

beforeEach(() => {
    _zerarFila()
    fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchFalso)
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe("keepalive no caminho real de rede", () => {
    it("o lote do pagehide chega ao fetch com keepalive: true", async () => {
        enfileirar({ name: "screen_viewed", properties: { screen: "/library" } })
        window.dispatchEvent(new Event("pagehide"))
        // `enviarEventos` resolve o token antes de chamar o fetch: a chamada sai
        // num microtask, nao na mesma volta da pilha.
        await vi.advanceTimersByTimeAsync(0)

        expect(fetchFalso).toHaveBeenCalledTimes(1)
        const [url] = fetchFalso.mock.calls[0]
        expect(String(url)).toContain("/api/telemetry/events")
        expect(initDaChamada().method).toBe("POST")
        expect(initDaChamada().keepalive).toBe(true)
    })

    it("o lote da janela normal chega ao fetch sem keepalive", async () => {
        enfileirar({ name: "screen_viewed", properties: {} })
        await vi.advanceTimersByTimeAsync(1000)

        expect(fetchFalso).toHaveBeenCalledTimes(1)
        expect(initDaChamada().keepalive).toBeUndefined()
    })

    it("o corpo que chega ao fetch e o lote inteiro, nao um evento por requisicao", async () => {
        enfileirar({ name: "a", properties: {} })
        enfileirar({ name: "b", properties: {} })
        descarregar({ keepalive: true })
        await vi.advanceTimersByTimeAsync(0)

        expect(fetchFalso).toHaveBeenCalledTimes(1)
        const corpo = JSON.parse(String(initDaChamada().body)) as {
            eventos: { name: string }[]
        }
        expect(corpo.eventos.map((e) => e.name)).toEqual(["a", "b"])
        expect(initDaChamada().keepalive).toBe(true)
    })
})
