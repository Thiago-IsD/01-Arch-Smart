import { render, screen } from "@testing-library/react"
import type { UseQueryResult } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import { QueryBoundary } from "@/components/ui/query-boundary"

function query<T>(parcial: Partial<UseQueryResult<T>>): UseQueryResult<T> {
    return {
        isPending: false,
        isError: false,
        data: undefined,
        error: null,
        refetch: vi.fn(),
        ...parcial,
    } as unknown as UseQueryResult<T>
}

describe("QueryBoundary", () => {
    it("mostra o skeleton enquanto carrega", () => {
        render(
            <QueryBoundary
                query={query<string[]>({ isPending: true })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {(dados) => <p>{dados.join()}</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("carregando")).toBeInTheDocument()
    })

    it("mostra o erro e entrega o refetch para tentar de novo", () => {
        const refetch = vi.fn()
        render(
            <QueryBoundary
                query={query<string[]>({ isError: true, error: new Error("caiu"), refetch })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={(erro, refazer) => <button onClick={refazer}>{erro.message}</button>}
            >
                {(dados) => <p>{dados.join()}</p>}
            </QueryBoundary>,
        )
        screen.getByRole("button", { name: "caiu" }).click()
        expect(refetch).toHaveBeenCalledOnce()
    })

    it("mostra o vazio quando a lista volta vazia", () => {
        render(
            <QueryBoundary
                query={query<string[]>({ data: [] })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {(dados) => <p>{dados.join()}</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("vazio")).toBeInTheDocument()
    })

    it("aceita um criterio de vazio proprio, para quem nao devolve lista", () => {
        render(
            <QueryBoundary
                query={query<{ total: number }>({ data: { total: 0 } })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
                isEmpty={(d) => d.total === 0}
            >
                {(d) => <p>{d.total}</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("vazio")).toBeInTheDocument()
    })

    it("mostra os dados quando ha dados", () => {
        render(
            <QueryBoundary
                query={query<string[]>({ data: ["a", "b"] })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {(dados) => <p>{dados.join()}</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("a,b")).toBeInTheDocument()
    })

    it("nao compila sem os estados obrigatorios", () => {
        // @ts-expect-error `empty` e `error` sao obrigatorios: o caminho feliz
        // sozinho tem que deixar de compilar. Se este ts-expect-error virar
        // "unused", alguem afrouxou o tipo — e o portao caiu.
        const so_o_feliz = <QueryBoundary query={query<string[]>({ data: [] })} skeleton={<p />}>
            {(dados) => <p>{dados.join()}</p>}
        </QueryBoundary>
        expect(so_o_feliz).toBeTruthy()
    })
})
