/**
 * Art. 6 na Biblioteca: todo controle tem rotulo de verdade, associado.
 *
 * Isto existe porque a Tarefa 9 da Secao 8 encontrou cinco rotulos sem
 * `htmlFor` e tres campos que se sustentavam so no atributo `title`. O
 * `getByLabelText` do testing-library e o instrumento certo para prender isso:
 * ele resolve nome acessivel por `<label htmlFor>`, `<label>` envolvente,
 * `aria-label` e `aria-labelledby` -- e **nao** por `title`. O primeiro teste
 * deste arquivo prova essa ultima frase em vez de supo-la, porque e nela que
 * todo o resto se apoia.
 *
 * A armadilha que isto defende: a regra `label` do axe PASSA com
 * `non-empty-title`. Quem ampliasse o axe de jsdom a estes componentes veria
 * verde com o Art. 6 descumprido. Nome acessivel de verdade nao e a mesma
 * pergunta que "o axe esta verde".
 */
import { describe, expect, it, vi, afterEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import type { ReactNode } from "react"

import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ProductDimensionFields } from "@/components/library/ProductDimensionFields"
import { NormalizationDimensionFields } from "@/components/library/NormalizationDimensionFields"
import { LibraryToolbar } from "@/components/library/LibraryToolbar"
import { BatchNormalizeRow } from "@/components/library/BatchNormalizeRow"
import { Table, TableBody } from "@/components/ui/table"
import type { Row } from "@/components/library/batch-normalize-types"

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

afterEach(() => {
    cleanup()
})

// Arnes de formulario: os componentes de dimensao recebem `control` e usam
// `useFormContext` por dentro (o `Form` do shadcn e o FormProvider).
function ComFormulario({ render: renderizar }: { render: (control: never) => ReactNode }) {
    const metodos = useForm({
        defaultValues: { width: "", height: "", depth: "" },
    })
    return <Form {...metodos}>{renderizar(metodos.control as never)}</Form>
}

describe("o instrumento: getByLabelText nao aceita title", () => {
    // Este e o teste que sustenta os outros. Se um dia o testing-library passar a
    // resolver `title` como rotulo, ele fica vermelho e avisa que as asercoes
    // abaixo pararam de significar o que significam hoje.
    it("um input rotulado so por title NAO e achado por getByLabelText", () => {
        render(<Input title="Largura" aria-label={undefined} />)
        expect(screen.queryByLabelText("Largura")).not.toBeInTheDocument()
        // mas ele existe — o defeito e invisivel para quem procura por rotulo
        expect(screen.getByTitle("Largura")).toBeInTheDocument()
    })
})

describe("ProductDimensionFields", () => {
    it("os tres campos tem rotulo associado, nao mais so title", () => {
        render(<ComFormulario render={(control) => <ProductDimensionFields control={control} />} />)

        for (const rotulo of ["Largura", "Altura", "Profundidade"]) {
            expect(screen.getByLabelText(rotulo)).toBeInstanceOf(HTMLInputElement)
        }
    })

    it("o rotulo aponta para o id do proprio input", () => {
        render(<ComFormulario render={(control) => <ProductDimensionFields control={control} />} />)

        const campo = screen.getByLabelText("Largura")
        const rotulo = document.querySelector(`label[for="${campo.id}"]`)
        expect(campo.id).not.toBe("")
        expect(rotulo?.textContent).toBe("Largura")
    })
})

describe("NormalizationDimensionFields", () => {
    it("os tres campos tem rotulo associado, invisivel mas real", () => {
        render(
            <ComFormulario
                render={(control) => <NormalizationDimensionFields control={control} hasDimensions={false} />}
            />,
        )

        for (const rotulo of ["Largura em cm", "Altura em cm", "Profundidade em cm"]) {
            expect(screen.getByLabelText(rotulo)).toBeInstanceOf(HTMLInputElement)
        }
    })

    it("a legenda do grupo nao e um rotulo — ela nao rotula um controle so", () => {
        render(
            <ComFormulario
                render={(control) => <NormalizationDimensionFields control={control} hasDimensions={false} />}
            />,
        )

        const legenda = screen.getByText(/Dimensões: Largura x Altura x Prof/)
        expect(legenda.tagName).toBe("SPAN")
    })
})

describe("a busca da barra de ferramentas", () => {
    // O controle mais usado da tela se sustentava em `placeholder`, e a regra
    // `label` do axe passa com `non-empty-placeholder` — nenhum portao reclamava.
    it("tem nome acessivel, nao so placeholder", () => {
        render(<LibraryToolbar inboxCount={0} />)
        expect(screen.getByLabelText("Buscar produtos")).toBeInstanceOf(HTMLInputElement)
    })
})

describe("a planilha de lote identifica a linha em todo campo", () => {
    it("o campo de nome diz de qual produto e, como os outros seis", () => {
        const linha: Row = {
            id: "r1",
            name: "Poltrona Lisboa",
            store: "Loja Qualquer",
            image_url: null,
            source_url: "https://loja.example.com/p/1",
            category: "Mobiliário",
            price: 10,
            width: 1,
            height: 1,
            depth: 1,
            yield_factor: 1,
            selected: true,
        }
        render(
            <Table>
                <TableBody>
                    <BatchNormalizeRow row={linha} blocked={false} onUpdate={() => {}} />
                </TableBody>
            </Table>,
        )

        for (const rotulo of [
            "Nome de Poltrona Lisboa",
            "Preço de Poltrona Lisboa",
            "Largura de Poltrona Lisboa",
            "Altura de Poltrona Lisboa",
            "Profundidade de Poltrona Lisboa",
            "Rendimento de Poltrona Lisboa",
            "Selecionar Poltrona Lisboa",
        ]) {
            expect(screen.getByLabelText(rotulo)).toBeInTheDocument()
        }
    })
})
