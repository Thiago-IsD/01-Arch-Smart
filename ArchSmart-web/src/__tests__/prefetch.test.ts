import { QueryClient } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TIMEOUT_DO_PREFETCH_MS, criarQueryClientDoServidor, tentarPrefetch } from "@/lib/query/hydration"

let aviso: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
    aviso.mockRestore()
    vi.useRealTimers()
})

describe("tentarPrefetch", () => {
    it("prefetch com sucesso nao avisa", async () => {
        const queryClient = criarQueryClientDoServidor()
        await tentarPrefetch(queryClient, () =>
            queryClient.prefetchQuery({ queryKey: ["ok"], queryFn: async () => 1 }),
        )
        expect(aviso).not.toHaveBeenCalled()
    })

    it("queryFn que falha AVISA, com a chave — prefetchQuery engole o erro, e antes isto era invisivel", async () => {
        const queryClient = criarQueryClientDoServidor()
        await tentarPrefetch(queryClient, () =>
            queryClient.prefetchQuery({
                queryKey: ["projects", "detail", "p1"],
                queryFn: async () => {
                    throw new Error("fora do ar")
                },
            }),
        )
        expect(aviso).toHaveBeenCalledTimes(1)
        expect(aviso.mock.calls[0].map(String).join(" ")).toContain("projects")
        expect(aviso.mock.calls[0].map(String).join(" ")).toContain("fora do ar")
    })

    it("estourar o teto AVISA", async () => {
        vi.useFakeTimers()
        const queryClient = criarQueryClientDoServidor()
        const promessa = tentarPrefetch(queryClient, (signal) =>
            queryClient.prefetchQuery({
                queryKey: ["lento"],
                queryFn: () =>
                    new Promise((_, rejeitar) => {
                        signal.addEventListener("abort", () => rejeitar(new Error("abortado pelo teto")))
                    }),
            }),
        )
        await vi.advanceTimersByTimeAsync(TIMEOUT_DO_PREFETCH_MS + 1)
        await promessa
        expect(aviso).toHaveBeenCalledTimes(1)
        expect(aviso.mock.calls[0].map(String).join(" ")).toContain("lento")
    })

    it("so olha as queries da propria tarefa: uma query ja com erro no cliente, de antes, nao conta", async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        await queryClient
            .prefetchQuery({ queryKey: ["velha"], queryFn: async () => { throw new Error("antiga") } })
        aviso.mockClear()

        await tentarPrefetch(queryClient, () =>
            queryClient.prefetchQuery({ queryKey: ["nova"], queryFn: async () => 1 }),
        )
        expect(aviso).not.toHaveBeenCalled()
    })

    it("query irma disparada durante a chamada, ainda em voo quando a tarefa termina, nao avisa — so a que realmente terminou em erro avisa", async () => {
        // Reproduz o cenario da Biblioteca antes do conserto: duas chamadas de
        // prefetch concorrentes sobre o MESMO QueryClient. Aqui as duas
        // queries nascem dentro da mesma `tarefa` para isolar so o laco final
        // de `tentarPrefetch` — a irma e disparada e NAO aguardada, entao
        // ainda esta em voo (fetchStatus "fetching") quando a query propria
        // termina e o laco roda. Sem a guarda de `fetchStatus`, a irma tambem
        // seria acusada de ter desistido.
        const queryClient = criarQueryClientDoServidor()
        let liberarIrma: () => void = () => {}
        const travaDaIrma = new Promise<number>((resolve) => {
            liberarIrma = () => resolve(1)
        })
        let promessaIrma: Promise<unknown> = Promise.resolve()

        await tentarPrefetch(queryClient, () => {
            promessaIrma = queryClient.prefetchQuery({ queryKey: ["irma"], queryFn: () => travaDaIrma })
            return queryClient.prefetchQuery({
                queryKey: ["propria", "com", "erro"],
                queryFn: async () => {
                    throw new Error("falhou de verdade")
                },
            })
        })

        expect(aviso).toHaveBeenCalledTimes(1)
        expect(aviso.mock.calls[0].map(String).join(" ")).toContain("propria")

        liberarIrma()
        await promessaIrma
    })
})
