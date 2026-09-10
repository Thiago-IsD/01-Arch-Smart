import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EmptyState } from "@/components/ui/empty-state"
import { CurrencyInput } from "@/components/ui/currency-input"
import { FormField } from "@/components/ui/form-field"
import { ErrorBoundary, registrarReportadorDeErro } from "@/components/ui/error-boundary"
import { DataTable } from "@/components/ui/data-table"
import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog"
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

describe("CurrencyInput", () => {
    it("trabalha em centavos: digitar 12345 vira R$ 123,45 e emite 12345", async () => {
        const aoMudar = vi.fn()
        render(<CurrencyInput value={0} onChange={aoMudar} aria-label="Valor" />)
        const campo = screen.getByLabelText("Valor")
        await userEvent.type(campo, "12345")
        expect(aoMudar).toHaveBeenLastCalledWith(12345)
        expect(campo).toHaveValue("R$ 123,45")
    })

    it("ignora o que nao e digito", async () => {
        const aoMudar = vi.fn()
        render(<CurrencyInput value={0} onChange={aoMudar} aria-label="Valor" />)
        await userEvent.type(screen.getByLabelText("Valor"), "1a2b3")
        expect(aoMudar).toHaveBeenLastCalledWith(123)
    })

    it("formata o valor que recebe de fora", () => {
        render(<CurrencyInput value={987654} onChange={vi.fn()} aria-label="Valor" />)
        expect(screen.getByLabelText("Valor")).toHaveValue("R$ 9.876,54")
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
        await userEvent.click(screen.getByRole("button", { name: /proxima/i }))
        expect(screen.getByText("Mesa")).toBeInTheDocument()
    })

    it("anuncia a ordenacao por aria-sort, nao so por seta", async () => {
        render(<DataTable colunas={COLUNAS} linhas={LINHAS} chaveDaLinha={(l) => l.nome} />)
        await userEvent.click(screen.getByRole("button", { name: /Nome/ }))
        expect(screen.getByRole("columnheader", { name: /Nome/ })).toHaveAttribute("aria-sort", "ascending")
    })
})

describe("componentes endurecidos", () => {
    it("AlertDialog prende o foco dentro do dialogo", async () => {
        render(
            <AlertDialog>
                <AlertDialogTrigger>abrir</AlertDialogTrigger>
                <AlertDialogContent>
                    <button>dentro</button>
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
