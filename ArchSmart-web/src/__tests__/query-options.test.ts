import { describe, expect, it, vi } from "vitest"

import type { ClienteApi } from "@/lib/api/core"
import { queryKeys } from "@/lib/query/keys"
import { clienteComSinal } from "@/lib/query/hydration"
import { queryDaListaDeProdutos, queryDoBadgeDoInbox } from "@/features/library/queries"
import { queryDeProdutos, queryDoInbox } from "@/features/library/api"

// `features/library/api.ts` importa `@/lib/api/client` no topo, que por sua
// vez importa `@/lib/api/auth` -> `@/lib/env`, que valida as tres variaveis
// NEXT_PUBLIC_* na carga do modulo. O `cliente` usado nos testes abaixo e
// sempre um `vi.fn()` passado a mao para as fabricas — o `api` real nunca e
// chamado — mas so IMPORTAR o modulo sem este mock already estoura o parse do
// Zod fora do ambiente do Next (o mesmo motivo pelo qual todo outro teste que
// toca essa cadeia mocka `@/lib/api/auth` ou `@/lib/api/client`).
vi.mock("@/lib/api/client", () => ({ api: vi.fn() }))

/**
 * A fabrica e a fonte unica: o servidor chama com `apiServer`, o hook com
 * `api`, e os dois recebem a MESMA chave e o MESMO payload. Estes testes
 * prendem o que a fabrica devolve; o que prende que o servidor e o hook USAM a
 * fabrica e `library-query-payload.test.tsx`, que ja existia.
 */
describe("fabricas de query da Biblioteca", () => {
    const filtros = { tab: "inbox", q: "cadeira", page: 2, size: 15 }

    it("a lista usa a chave de products.list e o payload de queryDeProdutos", async () => {
        const cliente = vi.fn().mockResolvedValue({ items: [] }) as unknown as ClienteApi
        const opcoes = queryDaListaDeProdutos(cliente, filtros)

        expect(opcoes.queryKey).toEqual(queryKeys.products.list(filtros))

        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/products/", {
            signal: sinal,
            query: queryDeProdutos(filtros),
        })
    })

    it("o badge usa a chave de products.inboxCount e o payload de queryDoInbox", async () => {
        const cliente = vi.fn().mockResolvedValue({ total: 3 }) as unknown as ClienteApi
        const opcoes = queryDoBadgeDoInbox(cliente)

        expect(opcoes.queryKey).toEqual(queryKeys.products.inboxCount())

        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/products/", {
            signal: sinal,
            query: queryDoInbox(),
        })
    })
})

describe("clienteComSinal", () => {
    it("aborta a chamada quando o sinal do teto aborta, mesmo sem sinal do React Query", async () => {
        let recebido: AbortSignal | undefined
        const cliente = vi.fn(async (_p: string, req?: { signal?: AbortSignal }) => {
            recebido = req?.signal
            return null
        }) as unknown as ClienteApi

        const teto = new AbortController()
        await clienteComSinal(cliente, teto.signal)("/api/x")

        expect(recebido?.aborted).toBe(false)
        teto.abort()
        expect(recebido?.aborted).toBe(true)
    })

    it("aborta tambem quando o sinal da propria requisicao aborta", async () => {
        let recebido: AbortSignal | undefined
        const cliente = vi.fn(async (_p: string, req?: { signal?: AbortSignal }) => {
            recebido = req?.signal
            return null
        }) as unknown as ClienteApi

        const doReactQuery = new AbortController()
        await clienteComSinal(cliente, new AbortController().signal)("/api/x", {
            signal: doReactQuery.signal,
        })

        doReactQuery.abort()
        expect(recebido?.aborted).toBe(true)
    })
})
