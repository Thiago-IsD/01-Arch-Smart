import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EmptyState } from "@/components/ui/empty-state"
import { CurrencyInput } from "@/components/ui/currency-input"
import { FormField } from "@/components/ui/form-field"
import { ErrorBoundary, registrarReportadorDeErro } from "@/components/ui/error-boundary"
import { DataTable } from "@/components/ui/data-table"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"

function Explode(): never {
    throw new Error("estourou")
}

type Linha = { nome: string; valor: number }

const COLUNAS = [
    { chave: "nome" as const, rotulo: "Nome" },
    { chave: "valor" as const, rotulo: "Valor" },
]

const LINHAS: Linha[] = [
    { nome: "Cadeira", valor: 300 },
    { nome: "Abajur", valor: 100 },
    { nome: "Mesa", valor: 200 },
]

describe("EmptyState", () => {
    it("mostra titulo, descricao e a acao de saida", async () => {
        const acao = vi.fn()
        render(
            <EmptyState
                titulo="Nenhum produto"
                descricao="Use o Web Clipper para trazer o primeiro."
                acao={{ rotulo: "Abrir o Clipper", aoClicar: acao }}
            />,
        )
        expect(screen.getByRole("heading", { name: "Nenhum produto" })).toBeInTheDocument()
        expect(screen.getByText(/Web Clipper/)).toBeInTheDocument()
        await userEvent.click(screen.getByRole("button", { name: "Abrir o Clipper" }))
        expect(acao).toHaveBeenCalledOnce()
    })

    it("funciona sem acao — nem todo vazio tem saida", () => {
        render(<EmptyState titulo="Sem resultados" descricao="Tente outro filtro." />)
        expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
})

// O Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }) separa
// "R$" do valor com espaco NAO separavel (U+00A0), nao espaco comum — e esse
// e o formato tipograficamente correto em pt-BR (evita que o simbolo e o
// numero quebrem em linhas diferentes), nao um defeito do componente.
// `dashboard/page.tsx` ja exibe esse mesmo caractere hoje via `toLocaleString`,
// entao o `Intl` e a fonte de verdade e o `CurrencyInput` nao normaliza.
// `ESPACO` abaixo e o U+00A0 explicito — comparar com espaco comum (" ")
// nunca bate, mesmo as duas strings parecendo identicas ao olho.
const ESPACO = "\u00A0"

describe("CurrencyInput", () => {
    it("trabalha em centavos: digitar 12345 vira R$ 123,45 e emite 12345", async () => {
        const aoMudar = vi.fn()
        render(<CurrencyInput value={0} onChange={aoMudar} aria-label="Valor" />)
        const campo = screen.getByLabelText("Valor")
        await userEvent.type(campo, "12345")
        expect(aoMudar).toHaveBeenLastCalledWith(12345)
        expect(campo).toHaveValue(`R$${ESPACO}123,45`)
    })

    it("ignora o que nao e digito", async () => {
        const aoMudar = vi.fn()
        render(<CurrencyInput value={0} onChange={aoMudar} aria-label="Valor" />)
        await userEvent.type(screen.getByLabelText("Valor"), "1a2b3")
        expect(aoMudar).toHaveBeenLastCalledWith(123)
    })

    it("formata o valor que recebe de fora", () => {
        render(<CurrencyInput value={987654} onChange={vi.fn()} aria-label="Valor" />)
        expect(screen.getByLabelText("Valor")).toHaveValue(`R$${ESPACO}9.876,54`)
    })
})

describe("FormField", () => {
    it("liga rotulo e campo por htmlFor, sem depender de aninhamento", () => {
        render(<FormField id="nome" rotulo="Nome do projeto"><input id="nome" /></FormField>)
        expect(screen.getByLabelText("Nome do projeto")).toBeInTheDocument()
    })

    it("anuncia o erro pelo aria-describedby e marca aria-invalid", () => {
        render(
            <FormField id="email" rotulo="E-mail" erro="E-mail invalido">
                <input id="email" />
            </FormField>,
        )
        const campo = screen.getByLabelText("E-mail")
        expect(campo).toHaveAttribute("aria-invalid", "true")
        expect(campo).toHaveAccessibleDescription("E-mail invalido")
    })

    it("injeta o id no campo — o chamador nao precisa repetir", () => {
        // O componente existe justamente para ligar rotulo e campo. Ele ja
        // injetava aria-invalid e aria-describedby, mas nao o `id`: esquecer
        // de repeti-lo no filho produzia rotulo orfao EM SILENCIO, sem erro
        // de tipo e sem lint. Note o <input> sem id nenhum.
        render(<FormField id="cidade" rotulo="Cidade"><input /></FormField>)
        expect(screen.getByLabelText("Cidade")).toHaveAttribute("id", "cidade")
    })

    it("nao sobrescreve um id que o chamador passou de proposito", () => {
        // Caso divergente: quando os dois ids existem e sao diferentes, quem
        // manda e o filho — ele pode estar ligado a outra coisa (um
        // aria-controls, um form externo). O rotulo segue o `id` da prop, e a
        // divergencia fica visivel em vez de ser silenciosamente "consertada".
        render(<FormField id="rotulo-cep" rotulo="CEP"><input id="campo-cep" /></FormField>)
        expect(screen.getByRole("textbox")).toHaveAttribute("id", "campo-cep")
        expect(screen.queryByLabelText("CEP")).toBeNull()
    })

    it("marca data-private quando o dado e sensivel", () => {
        const { container } = render(
            <FormField id="cpf" rotulo="CPF" sensivel><input id="cpf" /></FormField>,
        )
        expect(container.querySelector("[data-private='true']")).not.toBeNull()
    })
})

describe("ErrorBoundary", () => {
    it("mostra o fallback em vez de derrubar a arvore", () => {
        const silencio = vi.spyOn(console, "error").mockImplementation(() => {})
        render(
            <ErrorBoundary fallback={(erro) => <p>peguei: {erro.message}</p>}>
                <Explode />
            </ErrorBoundary>,
        )
        expect(screen.getByText("peguei: estourou")).toBeInTheDocument()
        silencio.mockRestore()
    })

    it("chama o reportador registrado — o plugue que a Secao 7 liga", () => {
        const silencio = vi.spyOn(console, "error").mockImplementation(() => {})
        const reportador = vi.fn()
        registrarReportadorDeErro(reportador)
        render(
            <ErrorBoundary fallback={() => <p>fallback</p>}>
                <Explode />
            </ErrorBoundary>,
        )
        expect(reportador).toHaveBeenCalledOnce()
        registrarReportadorDeErro(() => {})
        silencio.mockRestore()
    })
})

describe("DataTable", () => {
    it("ordena ao clicar no cabecalho, e inverte no segundo clique", async () => {
        render(<DataTable colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.nome} />)
        await userEvent.click(screen.getByRole("button", { name: /Nome/ }))
        let celulas = screen.getAllByRole("cell").map((c) => c.textContent)
        expect(celulas.slice(0, 2)).toEqual(["Abajur", "100"])

        await userEvent.click(screen.getByRole("button", { name: /Nome/ }))
        celulas = screen.getAllByRole("cell").map((c) => c.textContent)
        expect(celulas.slice(0, 2)).toEqual(["Mesa", "200"])
    })

    it("pagina, e nao mostra a pagina seguinte antes do clique", async () => {
        render(
            <DataTable colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.nome} porPagina={2} />,
        )
        expect(screen.queryByText("Mesa")).not.toBeInTheDocument()
        // A regex precisou do acento junto com a copy: /proxima/i compara
        // codepoint a codepoint e nao casa "Próxima" — "o" e "ó" sao
        // caracteres diferentes, e `i` so ignora caixa, nao diacritico.
        await userEvent.click(screen.getByRole("button", { name: /próxima/i }))
        expect(screen.getByText("Mesa")).toBeInTheDocument()
    })

    it("volta para a primeira pagina quando as linhas mudam", async () => {
        // Filtrar para uma lista menor deixava o usuario fora do intervalo:
        // "Pagina 3 de 1", tabela vazia e nenhum jeito de voltar a nao ser
        // clicando em Anterior duas vezes. O indice de pagina e estado da
        // tabela; a lista e da tela — quando a lista troca, o indice antigo
        // nao quer dizer mais nada.
        const { rerender } = render(
            <DataTable colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.nome} porPagina={2} />,
        )
        await userEvent.click(screen.getByRole("button", { name: /próxima/i }))
        expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument()

        rerender(
            <DataTable
                colunas={COLUNAS}
                linhas={[LINHAS[0]]}
                chaveDaLinha={(l) => l.nome}
                porPagina={2}
            />,
        )
        expect(screen.getByText(/Página 1 de 1/)).toBeInTheDocument()
        expect(screen.getByText("Cadeira")).toBeInTheDocument()
    })

    it("volta para a primeira pagina quando a ordenacao muda", async () => {
        render(
            <DataTable colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.nome} porPagina={2} />,
        )
        await userEvent.click(screen.getByRole("button", { name: /próxima/i }))
        expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument()

        await userEvent.click(screen.getByRole("button", { name: /Nome/ }))
        expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument()
    })

    it("anuncia a ordenacao por aria-sort, nao so por seta", async () => {
        render(<DataTable colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.nome} />)
        await userEvent.click(screen.getByRole("button", { name: /Nome/ }))
        expect(screen.getByRole("columnheader", { name: /Nome/ })).toHaveAttribute("aria-sort", "ascending")
    })
})

describe("componentes endurecidos", () => {
    it("AlertDialog prende o foco dentro do dialogo", async () => {
        // Todo `AlertDialogContent` real no produto tem um `AlertDialogCancel`
        // — este fixture reflete isso, em vez de um conteudo so com um botao
        // qualquer. Confirmado nos 10 usos reais em src/ com:
        //   grep -rl "AlertDialogContent" ArchSmart-web/src --include=*.tsx \
        //     | grep -v "components/ui/alert-dialog.tsx" | grep -v "__tests__" \
        //     | xargs grep -L "AlertDialogCancel"
        // (sai vazio: nenhum dos 10 fica sem Cancel).
        //
        // Achado do Radix, preservado aqui porque motivou (e depois derrubou)
        // uma correcao em `alert-dialog.tsx`: o `onOpenAutoFocus` padrao do
        // `AlertDialogContent` compoe o handler que a gente passa (se houver)
        // ANTES do handler interno do Radix, que sempre chama
        // `event.preventDefault()` e so entao tenta focar a ref interna do
        // `AlertDialogCancel`. Sem um `Cancel` na arvore essa ref e `null`, o
        // `preventDefault()` ja rodou e o fallback do proprio `FocusScope`
        // (focar o primeiro elemento focavel) nunca dispara — ninguem recebe
        // foco. Como todo uso real tem `Cancel`, esse caminho nunca ocorre em
        // producao, e o componente ficou como o Radix entrega, sem fallback.
        render(
            <AlertDialog>
                <AlertDialogTrigger>abrir</AlertDialogTrigger>
                <AlertDialogContent>
                    <button>dentro</button>
                    <AlertDialogCancel>cancelar</AlertDialogCancel>
                </AlertDialogContent>
            </AlertDialog>,
        )
        await userEvent.click(screen.getByText("abrir"))
        // toContainElement so aceita HTMLElement | SVGElement | null; document.activeElement
        // e tipado como Element | null — o cast nao muda o valor em runtime.
        expect(screen.getByRole("alertdialog")).toContainElement(
            document.activeElement as HTMLElement | null,
        )
    })

    it("DropdownMenuItem tem alvo de toque de no minimo 44px", async () => {
        render(
            <DropdownMenu>
                <DropdownMenuTrigger>menu</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>opcao</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>,
        )
        await userEvent.click(screen.getByText("menu"))
        expect(screen.getByRole("menuitem")).toHaveClass("min-h-11")
    })

    it("Skeleton nao e lido por leitor de tela", () => {
        const { container } = render(<Skeleton className="h-4 w-20" />)
        expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
    })
})
