/**
 * Os cinco estados da Biblioteca, pela TELA e nao pelo componente.
 *
 * O que estes testes prendem nao e o QueryBoundary — esse ja tem o
 * `query-boundary.test.tsx` dele. E que a Biblioteca nao tenha mais estado de
 * carregamento, de vazio e de erro escritos a mao, e que o erro da lista nao
 * leve a tela inteira com ele.
 *
 * O teste do estado de erro e o que prende o conserto: antes desta tarefa, a
 * lista que falhava caia no `data ?? RESPOSTA_VAZIA` e a tela mostrava
 * "Nenhum produto encontrado" — dizia vazio onde a verdade era falha.
 *
 * O ultimo teste e de outra natureza: ele prova que a regiao da lista se
 * declara `principal`, que e o que faz o `screen_viewed` de `/library` sair
 * com `medido_ate: "dados"` em vez de `pintura`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { LibraryContent } from "@/app/(dashboard)/library/components/LibraryContent"
import { ProntidaoDaTelaProvider } from "@/features/telemetry/contexto"
import { TelemetriaDeTela } from "@/features/telemetry/TelemetriaDeTela"
import { RESPOSTA_VAZIA, type ProductsResponse } from "@/features/library/types"
import type { EventoDeProduto } from "@/features/telemetry/types"

// A rede entra pelas DUAS funcoes que a tela usa de fato, e o resto do modulo
// continua o de verdade: mockar `@/lib/api/client` deixaria a forma do query
// fora do teste, e mockar os hooks deixaria de fora justamente o que se quer
// provar (que a tela le `isPending`/`isError` por meio do boundary).
let listaFalsa: () => Promise<ProductsResponse>
let inboxFalso: () => Promise<ProductsResponse>

vi.mock("@/features/library/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/features/library/api")>()),
    listarProdutos: () => listaFalsa(),
    contarInbox: () => inboxFalso(),
}))

// `ClipperOnboarding` e importado estaticamente pela tela (ele e a aba
// "clipper") e puxa `lib/api/auth` -> `lib/env`, que valida as variaveis no
// import. Mesmo dublê que as outras telas usam nos testes desta suite.
vi.mock("@/lib/api/auth", () => ({ getAccessToken: async () => "token-de-teste" }))

// Os filhos pesados ficam de fora: eles tem vida propria (modal, formulario,
// toast) e nao e nenhum deles que esta sendo migrado aqui. A LibraryToolbar e
// a de VERDADE, porque o quinto teste afirma algo sobre ela.
vi.mock("@/components/library/ProductCard", () => ({
    ProductCard: ({ name }: { name: string }) => <div data-testid="product-card">{name}</div>,
}))
vi.mock("@/components/library/ProductFormSheet", () => ({
    ProductFormSheet: () => null,
}))
vi.mock("@/components/library/NormalizationSheet", () => ({
    NormalizationSheet: () => null,
}))
vi.mock("@/components/library/BatchNormalizeModal", () => ({
    BatchNormalizeModal: () => null,
}))

let parametros = new URLSearchParams()
const roteador = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }

vi.mock("next/navigation", () => ({
    useSearchParams: () => parametros,
    useRouter: () => roteador,
    usePathname: () => "/library",
}))

// Intercepta a FILA, nao o envio — igual ao `telemetry.test.tsx`: o que o
// ultimo teste mede e o conteudo do evento, nao a janela de lote.
const eventos: EventoDeProduto[] = []
vi.mock("@/features/telemetry/fila", () => ({
    enfileirar: (evento: EventoDeProduto) => {
        eventos.push(evento)
    },
    descarregar: () => {},
    _zerarFila: () => {},
}))

function pagina(items: ProductsResponse["items"]): ProductsResponse {
    return { items, total: items.length, page: 1, size: 15, pages: 1 }
}

let cliente: QueryClient

function Envolvido({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={cliente}>
            <ProntidaoDaTelaProvider>{children}</ProntidaoDaTelaProvider>
        </QueryClientProvider>
    )
}

beforeEach(() => {
    eventos.length = 0
    parametros = new URLSearchParams()
    cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    listaFalsa = () => Promise.resolve(pagina([{ id: "p1", name: "Cadeira Eames" }]))
    inboxFalso = () => Promise.resolve({ ...RESPOSTA_VAZIA, total: 0 })
})

afterEach(() => {
    cleanup()
})

describe("Biblioteca — os cinco estados pela tela", () => {
    it("mostra skeleton enquanto a lista nao chega", async () => {
        listaFalsa = () => new Promise(() => {})
        render(
            <Envolvido>
                <LibraryContent />
            </Envolvido>,
        )
        expect(await screen.findByTestId("library-skeleton")).toBeInTheDocument()
        expect(screen.queryByTestId("product-grid")).not.toBeInTheDocument()
    })

    it("mostra o estado vazio quando a lista volta sem itens", async () => {
        listaFalsa = () => Promise.resolve(RESPOSTA_VAZIA)
        render(
            <Envolvido>
                <LibraryContent />
            </Envolvido>,
        )
        expect(
            await screen.findByText("Nenhum produto encontrado com os filtros selecionados."),
        ).toBeInTheDocument()
        expect(screen.queryByTestId("library-error")).not.toBeInTheDocument()
    })

    it("mostra o estado de erro com acao de refazer quando a lista falha", async () => {
        let chamadas = 0
        listaFalsa = () => {
            chamadas += 1
            return Promise.reject(new Error("A API nao respondeu."))
        }
        render(
            <Envolvido>
                <LibraryContent />
            </Envolvido>,
        )

        expect(await screen.findByTestId("library-error")).toBeInTheDocument()
        expect(screen.getByText("A API nao respondeu.")).toBeInTheDocument()
        // A mentira que esta tarefa conserta: lista que falha NAO pode dizer
        // que nao ha produto.
        expect(
            screen.queryByText("Nenhum produto encontrado com os filtros selecionados."),
        ).not.toBeInTheDocument()

        const antes = chamadas
        screen.getByRole("button", { name: "Tentar de novo" }).click()
        await waitFor(() => expect(chamadas).toBeGreaterThan(antes))
    })

    it("renderiza a grade quando a lista tem itens", async () => {
        listaFalsa = () =>
            Promise.resolve(pagina([{ id: "p1", name: "Cadeira Eames" }, { id: "p2", name: "Abajur Linho" }]))
        render(
            <Envolvido>
                <LibraryContent />
            </Envolvido>,
        )
        expect(await screen.findByTestId("product-grid")).toBeInTheDocument()
        expect(screen.getAllByTestId("product-card")).toHaveLength(2)
        expect(screen.queryByTestId("library-skeleton")).not.toBeInTheDocument()
    })

    it("o erro da lista nao derruba a barra de ferramentas nem o badge", async () => {
        listaFalsa = () => Promise.reject(new Error("A API nao respondeu."))
        inboxFalso = () => Promise.resolve({ ...RESPOSTA_VAZIA, total: 3 })
        render(
            <Envolvido>
                <LibraryContent />
            </Envolvido>,
        )

        expect(await screen.findByTestId("library-error")).toBeInTheDocument()
        // A barra continua de pe, e o badge do inbox continua contando: o erro
        // e da regiao da lista, nao da tela.
        expect(screen.getByRole("tab", { name: /Biblioteca/ })).toBeInTheDocument()
        const abaInbox = screen.getByRole("tab", { name: /Inbox/ })
        await waitFor(() => expect(abaInbox).toHaveTextContent("3"))
    })
})

describe("Biblioteca — a lista e a regiao principal da tela", () => {
    it("o screen_viewed sai medido_ate 'dados' e principal_declarada true", async () => {
        render(
            <Envolvido>
                <TelemetriaDeTela />
                <LibraryContent />
            </Envolvido>,
        )

        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].name).toBe("screen_viewed")
        expect(eventos[0].properties).toMatchObject({
            screen: "/library",
            medido_ate: "dados",
            principal_declarada: true,
            is_empty: false,
        })
    })

    it("lista vazia sai medido_ate 'vazio' e is_empty true, ainda como principal", async () => {
        listaFalsa = () => Promise.resolve(RESPOSTA_VAZIA)
        render(
            <Envolvido>
                <TelemetriaDeTela />
                <LibraryContent />
            </Envolvido>,
        )

        await waitFor(() => expect(eventos).toHaveLength(1))
        expect(eventos[0].properties).toMatchObject({
            medido_ate: "vazio",
            principal_declarada: true,
            is_empty: true,
        })
    })
})
