import { describe, expect, it, vi } from "vitest"

import type { ClienteApi } from "@/lib/api/core"
import { cachePolicy, queryKeys } from "@/lib/query/keys"
import {
    PAGINA_PADRAO,
    queryDaListaDeProjetos,
    queryDoProjeto,
    queryDosAmbientes,
} from "@/features/projects/queries"
import { estadoDoLimite } from "@/features/projects/limite"

/**
 * A fabrica e a fonte unica: `ProjetosData`/`ProjetoData` (servidor) chamam com
 * `apiServer`, os hooks com `api`. Estes testes prendem chave, caminho e query
 * string; o que prende que o servidor USA a fabrica sao `projetos-data.test.tsx`
 * e `projeto-data.test.tsx`.
 */
function clienteFalso(resposta: unknown = {}) {
    return vi.fn().mockResolvedValue(resposta) as unknown as ClienteApi & ReturnType<typeof vi.fn>
}

describe("fabricas de query de Projetos", () => {
    it("a lista padrao pede page=1&size=20 sob projects.list(1, 20)", async () => {
        const cliente = clienteFalso({ items: [] })
        const opcoes = queryDaListaDeProjetos(cliente)
        expect(PAGINA_PADRAO).toEqual({ page: 1, size: 20 })
        expect(opcoes.queryKey).toEqual(queryKeys.projects.list(1, 20))
        expect(opcoes.staleTime).toBe(cachePolicy.transacional.staleTime)

        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/projects", { signal: sinal, query: { page: 1, size: 20 } })
    })

    it("a pagina pedida entra na chave E na query string — a chave nao mente sobre a resposta", async () => {
        const cliente = clienteFalso({ items: [] })
        const opcoes = queryDaListaDeProjetos(cliente, { page: 1, size: 100 })
        expect(opcoes.queryKey).toEqual(queryKeys.projects.list(1, 100))
        await opcoes.queryFn!({ signal: new AbortController().signal } as never)
        expect(cliente.mock.calls[0][1].query).toEqual({ page: 1, size: 100 })
    })

    it("o detalhe usa projects.detail(id) e nao tenta de novo num 404", async () => {
        const cliente = clienteFalso({ id: "p1" })
        const opcoes = queryDoProjeto(cliente, "p1")
        expect(opcoes.queryKey).toEqual(queryKeys.projects.detail("p1"))
        expect(opcoes.retry).toBe(false)
        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/projects/p1", { signal: sinal })
    })

    it("os ambientes usam projects.environments(id)", async () => {
        const cliente = clienteFalso([])
        const opcoes = queryDosAmbientes(cliente, "p1")
        expect(opcoes.queryKey).toEqual(queryKeys.projects.environments("p1"))
        const sinal = new AbortController().signal
        await opcoes.queryFn!({ signal: sinal } as never)
        expect(cliente).toHaveBeenCalledWith("/api/projects/p1/environments", { signal: sinal })
    })
})

describe("estadoDoLimite", () => {
    it("abaixo do limite", () => {
        expect(estadoDoLimite(1, 3)).toEqual({ noLimite: false, fracao: 1 / 3, livres: 2 })
    })

    it("no limite e acima dele a fracao para em 1 e ninguem fica com vaga negativa", () => {
        expect(estadoDoLimite(3, 3)).toEqual({ noLimite: true, fracao: 1, livres: 0 })
        expect(estadoDoLimite(5, 3)).toEqual({ noLimite: true, fracao: 1, livres: 0 })
    })

    it("limite 0 e 'no limite', nunca NaN — o defeito do ProjectsLimitCard (item 9 do Dashboard)", () => {
        const estado = estadoDoLimite(0, 0)
        expect(estado).toEqual({ noLimite: true, fracao: 1, livres: 0 })
        expect(Number.isNaN(estado.fracao)).toBe(false)
    })
})
