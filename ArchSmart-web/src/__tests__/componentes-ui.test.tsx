import { useEffect } from "react"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

import { EmptyState } from "@/components/ui/empty-state"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
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

// Existiam dois componentes chamados FormField: o desta suite (Secao 6,
// manual) e o do react-hook-form (@/components/ui/form), usado por 11 telas
// reais contra as zero do primeiro. A Secao 8 apagou o manual e portou a
// unica coisa que ele tinha e o outro nao — `sensivel` -> `data-private` —
// para o `FormItem` do conjunto vigente. Os testes abaixo substituem os
// cinco de antes, um a um:
//   - "liga rotulo e campo por htmlFor"            -> mantido
//   - "anuncia erro por aria-describedby/invalid"   -> mantido
//   - "injeta id no campo sem o chamador repetir"   -> mantido (explicito)
//   - "nao sobrescreve id que o chamador passou"    -> mantido (explicito)
//   - "marca data-private quando sensivel"          -> mantido, mais o
//     caso negativo (nao marcar quando nao e sensivel), que a suite antiga
//     nao tinha.
function FormularioDeTeste({
    sensivel = false,
    erro,
    idExplicito,
}: {
    sensivel?: boolean
    erro?: string
    idExplicito?: string
}) {
    const form = useForm({ defaultValues: { cpf: "" } })
    // setError precisa rodar em efeito, nao direto no corpo do componente:
    // chama-lo a cada render (incondicional, porque `erro` nao muda) dispara
    // um loop — setError muda o formState, o que re-renderiza, o que chama
    // setError de novo. O exemplo do brief tinha esse bug; useEffect corrige
    // sem mudar o que o teste verifica.
    useEffect(() => {
        if (erro) form.setError("cpf", { message: erro })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [erro])
    return (
        <Form {...form}>
            <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                    <FormItem sensivel={sensivel}>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                            <input {...field} {...(idExplicito ? { id: idExplicito } : {})} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Form>
    )
}

describe("FormItem", () => {
    it("liga rotulo e campo por htmlFor", () => {
        render(<FormularioDeTeste />)
        const campo = screen.getByLabelText("CPF")
        expect(campo).toBeInTheDocument()
    })

    it("injeta o id no campo quando o chamador nao passa nenhum", () => {
        // O <input> de FormularioDeTeste nao recebe id proprio (idExplicito
        // nao foi passado): o FormControl (Slot do Radix) injeta o
        // formItemId gerado. Sem essa injecao, getByLabelText acima tambem
        // falharia — este teste torna a garantia explicita em vez de deixa-la
        // so implicita no primeiro.
        render(<FormularioDeTeste />)
        const campo = screen.getByLabelText("CPF")
        expect(campo.getAttribute("id")).toBeTruthy()
    })

    it("preserva o id que o chamador passa de proposito, mesmo divergindo do rotulo", () => {
        // Radix Slot faz merge de props priorizando o valor explicito do
        // filho para atributos simples como `id` (node_modules/@radix-ui/
        // react-slot: mergeProps devolve overrideProps, que comeca como
        // spread de childProps, por cima de slotProps). Quando o consumidor
        // define o proprio id, ele vence — e a divergencia com o rotulo fica
        // visivel em vez de ser silenciosamente "consertada".
        render(<FormularioDeTeste idExplicito="campo-proprio" />)
        expect(screen.getByRole("textbox")).toHaveAttribute("id", "campo-proprio")
        expect(screen.queryByLabelText("CPF")).toBeNull()
    })

    it("marca data-private quando o dado e sensivel", () => {
        const { container } = render(<FormularioDeTeste sensivel />)
        expect(container.querySelector('[data-private="true"]')).not.toBeNull()
    })

    it("nao marca data-private quando o dado nao e sensivel", () => {
        const { container } = render(<FormularioDeTeste />)
        expect(container.querySelector("[data-private]")).toBeNull()
    })

    it("anuncia o erro pelo aria-describedby e marca aria-invalid", async () => {
        render(<FormularioDeTeste erro="CPF invalido" />)
        const campo = await screen.findByLabelText("CPF")
        expect(campo).toHaveAttribute("aria-invalid", "true")
        const descrito = campo.getAttribute("aria-describedby") ?? ""
        expect(descrito.length).toBeGreaterThan(0)
        expect(screen.getByText("CPF invalido")).toBeInTheDocument()
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
