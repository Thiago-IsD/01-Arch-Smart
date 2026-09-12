import { render, screen } from "@testing-library/react"
import type { UseQueryResult } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import { QueryBoundary } from "@/components/ui/query-boundary"
import { ContextoDeProntidao, type ProntidaoDaTela } from "@/features/telemetry/contexto"
import { RESPOSTA_VAZIA, type ProductsResponse } from "@/features/library/types"

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

/** Canal espiao: conta chamadas, que e o que o provider real nao permite. */
function canalEspiao() {
    return {
        anunciar: vi.fn(),
        reportar: vi.fn(),
        assinar: vi.fn(() => () => {}),
        anunciadas: vi.fn(() => 0),
        limpar: vi.fn(),
    } satisfies ProntidaoDaTela
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

    it("mostra o vazio no formato paginado real da camada de dados, sem isEmpty", () => {
        // RESPOSTA_VAZIA e o objeto que `features/library/hooks` devolve de
        // fato — nao um `{ items: [] }` inventado aqui. O criterio padrao
        // antigo era so `Array.isArray(dados) && dados.length === 0`, e este
        // objeto nao e array: a tela renderizava `children` com lista vazia
        // em vez do estado vazio, sem erro de tipo, sem lint e sem teste.
        render(
            <QueryBoundary
                query={query<ProductsResponse>({ data: RESPOSTA_VAZIA })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {(d) => <p>{d.items.length} itens</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("vazio")).toBeInTheDocument()
    })

    it("nao confunde pagina cheia com vazio no formato paginado", () => {
        render(
            <QueryBoundary
                query={query<ProductsResponse>({
                    data: { ...RESPOSTA_VAZIA, items: [{ id: "1", name: "Cadeira" }], total: 1, pages: 1 },
                })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {(d) => <p>{d.items.length} itens</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("1 itens")).toBeInTheDocument()
    })

    it("um objeto sem `items` nao e vazio por padrao — quem decide e o isEmpty", () => {
        render(
            <QueryBoundary
                query={query<{ total: number }>({ data: { total: 0 } })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {(d) => <p>total {d.total}</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("total 0")).toBeInTheDocument()
    })

    it("o isEmpty explicito continua ganhando do criterio padrao", () => {
        render(
            <QueryBoundary
                query={query<ProductsResponse>({ data: RESPOSTA_VAZIA })}
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
                isEmpty={() => false}
            >
                {(d) => <p>{d.items.length} itens</p>}
            </QueryBoundary>,
        )
        expect(screen.getByText("0 itens")).toBeInTheDocument()
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
    // O contrato com a telemetria, testado DIRETO e nao de lado. Ate a onda de
    // correcao da revisao final da Secao 8, este arquivo nao mencionava
    // `anunciar`, `reportar` nem `principal`: o contrato que as oito telas
    // seguintes copiam era exercitado so indiretamente, pelos testes da
    // `TelemetriaDeTela`.
    describe("o contrato com o canal de prontidao", () => {
        const comCanal = (canal: ProntidaoDaTela, q: UseQueryResult<string[]>, principal = false) => (
            <ContextoDeProntidao.Provider value={canal}>
                <QueryBoundary
                    query={q}
                    skeleton={<p>carregando</p>}
                    empty={<p>vazio</p>}
                    error={() => <p>erro</p>}
                    principal={principal}
                >
                    {(dados) => <p>{dados.join()}</p>}
                </QueryBoundary>
            </ContextoDeProntidao.Provider>
        )

        it("anuncia UMA vez por montagem, e nao a cada mudanca de desfecho", () => {
            const canal = canalEspiao()
            const { rerender } = render(
                comCanal(canal, query<string[]>({ isPending: true, fetchStatus: "fetching" })),
            )
            expect(canal.anunciar).toHaveBeenCalledTimes(1)

            // O desfecho muda duas vezes: pendente -> dados -> erro. O anuncio
            // responde a MONTAGEM, nao ao desfecho.
            rerender(comCanal(canal, query<string[]>({ data: ["a"] })))
            rerender(comCanal(canal, query<string[]>({ isError: true, error: new Error("caiu") })))
            expect(canal.anunciar).toHaveBeenCalledTimes(1)

            // Os dois desfechos resolvidos viraram report; o pendente nao.
            expect(canal.reportar).toHaveBeenCalledTimes(2)
        })

        it("o `principal` chega ao report", () => {
            const canal = canalEspiao()
            render(comCanal(canal, query<string[]>({ data: ["a"] }), true))
            expect(canal.reportar).toHaveBeenCalledWith(
                expect.objectContaining({ desfecho: "dados", principal: true }),
            )
        })

        it("sem `principal` o report sai com `principal: false`", () => {
            const canal = canalEspiao()
            render(comCanal(canal, query<string[]>({ data: ["a"] })))
            expect(canal.reportar).toHaveBeenCalledWith(
                expect.objectContaining({ principal: false }),
            )
        })

        // Os dois lados da query DESABILITADA. No react-query v5, `enabled:
        // false` e `isPending` + `fetchStatus: "idle"` para sempre: o boundary
        // mostra skeleton eterno e a regiao nunca reporta. Anunciar nesse caso
        // fazia a telemetria gravar `abandonado` FALSO na saida da tela.
        it("nao anuncia quando a query esta desabilitada", () => {
            const canal = canalEspiao()
            render(comCanal(canal, query<string[]>({ isPending: true, fetchStatus: "idle" })))
            expect(canal.anunciar).not.toHaveBeenCalled()
            expect(canal.reportar).not.toHaveBeenCalled()
            // O skeleton eterno e o comportamento documentado no docstring: o
            // certo e a tela NAO renderizar o boundary nesse caso.
            expect(screen.getByText("carregando")).toBeInTheDocument()
        })

        it("anuncia quando a query esta carregando de verdade", () => {
            const canal = canalEspiao()
            render(comCanal(canal, query<string[]>({ isPending: true, fetchStatus: "fetching" })))
            expect(canal.anunciar).toHaveBeenCalledTimes(1)
        })

        it("uma query que SAI do desabilitado passa a anunciar", () => {
            const canal = canalEspiao()
            const { rerender } = render(
                comCanal(canal, query<string[]>({ isPending: true, fetchStatus: "idle" })),
            )
            expect(canal.anunciar).not.toHaveBeenCalled()

            rerender(comCanal(canal, query<string[]>({ isPending: true, fetchStatus: "fetching" })))
            expect(canal.anunciar).toHaveBeenCalledTimes(1)
        })
    })
})
