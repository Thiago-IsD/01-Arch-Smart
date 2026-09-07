import { describe, it, expect } from "vitest"
import { queryKeys, cachePolicy } from "@/lib/query/keys"

/** Uma chave e prefixo de outra? E assim que o React Query decide invalidacao. */
function ehPrefixoDe(prefixo: readonly unknown[], chave: readonly unknown[]) {
    return prefixo.every((parte, i) => JSON.stringify(parte) === JSON.stringify(chave[i]))
}

describe("queryKeys", () => {
    it("inboxCount e FILHO de products — invalidar products alcanca o badge", () => {
        // Este era o defeito: ["products"] e ["inbox-count"] eram irmaos planos,
        // entao BatchNormalizeModal precisava invalidar as duas a mao e quem
        // esquecesse a segunda deixava o badge do inbox mentindo.
        expect(ehPrefixoDe(queryKeys.products.all, queryKeys.products.inboxCount())).toBe(true)
    })

    it("list e detail tambem sao filhos de products", () => {
        const filtros = { tab: "library", page: 1, size: 15 }
        expect(ehPrefixoDe(queryKeys.products.all, queryKeys.products.list(filtros))).toBe(true)
        expect(ehPrefixoDe(queryKeys.products.all, queryKeys.products.detail("abc"))).toBe(true)
    })

    it("list e detail nao colidem entre si", () => {
        const filtros = { tab: "library", page: 1, size: 15 }
        expect(ehPrefixoDe(queryKeys.products.lists(), queryKeys.products.detail("abc"))).toBe(false)
    })

    it("filtros diferentes produzem chaves diferentes", () => {
        const a = queryKeys.products.list({ tab: "library", page: 1, size: 15 })
        const b = queryKeys.products.list({ tab: "inbox", page: 1, size: 15 })
        expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
    })

    it("ambientes sao filhos do projeto a que pertencem", () => {
        expect(ehPrefixoDe(queryKeys.projects.all, queryKeys.projects.environments("p1"))).toBe(true)
    })
})

describe("cachePolicy", () => {
    it("referencia vive mais que transacional", () => {
        expect(cachePolicy.referencia.staleTime).toBeGreaterThan(cachePolicy.transacional.staleTime)
    })

    it("conta fica entre as duas", () => {
        expect(cachePolicy.conta.staleTime).toBeGreaterThan(cachePolicy.transacional.staleTime)
        expect(cachePolicy.conta.staleTime).toBeLessThan(cachePolicy.referencia.staleTime)
    })

    it("nada rebusca por troca de aba", () => {
        for (const politica of Object.values(cachePolicy)) {
            expect(politica.refetchOnWindowFocus).toBe(false)
        }
    })
})
