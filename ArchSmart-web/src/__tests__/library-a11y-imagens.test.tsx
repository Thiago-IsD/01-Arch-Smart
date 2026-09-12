/**
 * O que a Tarefa 9 conseguiu prender sem sessao autenticada.
 *
 * A metade de verificacao da Tarefa 9 (axe, navegacao so por teclado, olhar em
 * 390px e 1440px) esta BLOQUEADA: toda rota da aplicacao exige sessao e a
 * credencial do usuario de teste e rejeitada por staging hoje. Estes testes nao
 * substituem aquilo — eles prendem as tres afirmacoes da tarefa que DAO para
 * provar em jsdom, para que ninguem as desfaca enquanto a verificacao visual
 * espera. O que cada um cobre, e o que NAO cobre, esta dito em cada caso.
 *
 * O mais importante e o primeiro grupo. `next/image` com dominio nao declarado
 * em `images.remotePatterns` quebra a imagem em tempo de EXECUCAO, sem erro de
 * build e sem teste vermelho — e a imagem de produto vem da loja que o Web
 * Clipper raspou, de dominio arbitrario. A saida foi `unoptimized`, e o que
 * estes testes provam e que ela esta de fato em vigor: o `src` renderizado e a
 * URL externa crua, e nao o caminho `/_next/image?url=...` do otimizador, que e
 * o que devolveria 400 para dominio fora da lista.
 */
import axe from "axe-core"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { ProductCard } from "@/components/library/ProductCard"
import { NormalizationProductPreview } from "@/components/library/NormalizationProductPreview"
import { BatchNormalizeRow } from "@/components/library/BatchNormalizeRow"
import { Table, TableBody } from "@/components/ui/table"
import type { Row } from "@/components/library/batch-normalize-types"

// Mesmo dublê que `library-hooks` e `library-estados` usam: `lib/api/auth`
// puxa `lib/env`, que valida as variaveis no import e estoura no vitest.
vi.mock("@/lib/api/auth", () => ({
    getAccessToken: async () => "token-de-teste",
    supabaseBrowser: () => {
        throw new Error("nao deve ser chamado no teste")
    },
    signOut: async () => {},
    setSession: async () => {},
}))

const roteador = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => roteador,
    usePathname: () => "/library",
}))

// O modal de mover tem vida propria (lista de projetos, rede) e nao e objeto
// deste teste; o ProductCard o monta sempre, fechado.
vi.mock("@/components/library/MoveToProjectModal", () => ({
    MoveToProjectModal: () => null,
}))

// Uma URL de loja qualquer — o ponto e justamente que o dominio NAO esta em
// `images.remotePatterns` do next.config.ts, como nenhuma loja real esta.
const URL_DE_LOJA = "https://loja-qualquer.example.com/fotos/poltrona.jpg"

function Envelope({ children }: { children: ReactNode }) {
    const cliente = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
}

afterEach(() => {
    cleanup()
})

describe("imagem de produto de dominio arbitrario", () => {
    // Cobre: que o `unoptimized` esta em vigor nos dois componentes, ou seja,
    // que a URL da loja chega crua ao DOM. NAO cobre: se a loja responde, nem
    // se a imagem aparece bonita — isso e olho humano no Passo 6.
    it("o ProductCard entrega a URL da loja crua, sem passar pelo otimizador", () => {
        render(
            <Envelope>
                <ProductCard id="p1" name="Poltrona Lisboa" image_url={URL_DE_LOJA} />
            </Envelope>,
        )

        const imagem = screen.getByAltText("Poltrona Lisboa")
        expect(imagem).toHaveAttribute("src", URL_DE_LOJA)
        expect(imagem.getAttribute("src")).not.toContain("/_next/image")
    })

    it("o NormalizationProductPreview entrega a URL da loja crua", () => {
        render(
            <NormalizationProductPreview
                product={{ image_url: URL_DE_LOJA, name: "Poltrona Lisboa", store: "Loja Qualquer" }}
            />,
        )

        const imagem = screen.getByAltText("Poltrona Lisboa")
        expect(imagem).toHaveAttribute("src", URL_DE_LOJA)
        expect(imagem.getAttribute("src")).not.toContain("/_next/image")
    })

    it("sem image_url nenhum dos dois renderiza imagem", () => {
        render(
            <Envelope>
                <ProductCard id="p1" name="Poltrona Lisboa" image_url={null} />
            </Envelope>,
        )

        expect(screen.queryByRole("img")).not.toBeInTheDocument()
    })
})

describe("a acao do ProductCard escondida atras de hover", () => {
    // Cobre: que o gatilho do menu e um botao com nome acessivel, portanto
    // alcancavel por Tab, e que a classe de escape de foco continua na arvore.
    // NAO cobre: que ele fique VISIVEL ao receber foco — jsdom nao aplica
    // Tailwind, entao a opacidade real e do Passo 6, a olho, em navegador.
    it("o gatilho do menu tem nome acessivel e entra na ordem de tabulacao", () => {
        render(
            <Envelope>
                <ProductCard id="p1" name="Poltrona Lisboa" />
            </Envelope>,
        )

        const gatilho = screen.getByRole("button", { name: "Ações" })
        expect(gatilho).not.toHaveAttribute("tabindex", "-1")

        gatilho.focus()
        expect(gatilho).toHaveFocus()
    })

    it("o contêiner da acao tem escape de foco, e nao so hover", () => {
        render(
            <Envelope>
                <ProductCard id="p1" name="Poltrona Lisboa" />
            </Envelope>,
        )

        const gatilho = screen.getByRole("button", { name: "Ações" })
        // O contêiner e o avo do botao: div absoluta > DropdownMenu > button.
        const recipiente = gatilho.closest("div.opacity-0")
        expect(recipiente).not.toBeNull()
        expect(recipiente?.className).toContain("group-hover:opacity-100")
        expect(recipiente?.className).toContain("group-focus-within:opacity-100")
    })
})

/**
 * A parte do axe do Passo 6 que roda sem sessao.
 *
 * O Passo 6 pede axe em `/library` no navegador, com sessao — e isso continua
 * BLOQUEADO. Isto aqui e o pedaco que da para rodar em jsdom, e o limite precisa
 * estar dito: axe em jsdom avalia as regras de ESTRUTURA e de ARIA (nome
 * acessivel, `alt`, rotulo de campo, papel valido), porque essas dependem so do
 * DOM. Ele **nao** avalia `color-contrast` nem nada que dependa de layout: o
 * Tailwind nao e compilado aqui, entao nao existe cor nem caixa para medir — a
 * regra sai como "incomplete", nunca como violacao, e passar aqui nao diz nada
 * sobre contraste. Contraste, visibilidade ao foco e estouro em 390px seguem
 * dependendo de olho humano em navegador.
 *
 * O valor disto e concreto: foi exatamente uma regra de estrutura
 * (`button-name`) que a Tarefa 9 quase introduziu ao tirar o `tabIndex={-1}` de
 * um gatilho cujo unico filho e um icone.
 */
describe("axe nos componentes da Biblioteca (estrutura e ARIA, sem contraste)", () => {
    const SEM_ESTRUTURA_DE_PAGINA = {
        rules: {
            // Mesma razao que a galeria: um componente isolado e fragmento, nao
            // documento. `region` produziria violacao falsa.
            region: { enabled: false },
        },
    }

    async function violacoes(container: Element) {
        const resultado = await axe.run(container, SEM_ESTRUTURA_DE_PAGINA)
        return resultado.violations
    }

    function resumir(lista: Awaited<ReturnType<typeof violacoes>>) {
        return lista.map((v) => `${v.id}: ${v.nodes.length} no(s) — ${v.help}`).join("\n")
    }

    it("o ProductCard nao tem violacao de estrutura", async () => {
        const { container } = render(
            <Envelope>
                <ProductCard
                    id="p1"
                    name="Poltrona Lisboa"
                    store="Loja Qualquer"
                    price={1234.5}
                    image_url={URL_DE_LOJA}
                    state="NORMALIZED"
                    origin="CLIPPER"
                />
            </Envelope>,
        )
        const lista = await violacoes(container)
        expect(lista, `violacoes:\n${resumir(lista)}`).toHaveLength(0)
    }, 20_000)

    it("o NormalizationProductPreview nao tem violacao de estrutura", async () => {
        const { container } = render(
            <NormalizationProductPreview
                product={{
                    image_url: URL_DE_LOJA,
                    name: "Poltrona Lisboa",
                    store: "Loja Qualquer",
                    source_url: "https://loja-qualquer.example.com/p/1",
                }}
            />,
        )
        const lista = await violacoes(container)
        expect(lista, `violacoes:\n${resumir(lista)}`).toHaveLength(0)
    }, 20_000)

    it("a linha da planilha de lote nao tem violacao de estrutura", async () => {
        const linha: Row = {
            id: "r1",
            name: "Poltrona Lisboa",
            store: "Loja Qualquer",
            image_url: URL_DE_LOJA,
            source_url: "https://loja-qualquer.example.com/p/1",
            category: "Mobiliário",
            price: 1234.5,
            width: 80,
            height: 90,
            depth: 85,
            yield_factor: 1,
            selected: true,
        }
        // `blocked` ligado para que o aviso que trocou de classe literal para
        // token de aviso entre na arvore que o axe percorre.
        const { container } = render(
            <Table>
                <TableBody>
                    <BatchNormalizeRow row={linha} blocked onUpdate={() => {}} />
                </TableBody>
            </Table>,
        )
        const lista = await violacoes(container)
        expect(lista, `violacoes:\n${resumir(lista)}`).toHaveLength(0)
    }, 20_000)
})
