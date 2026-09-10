import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EmptyState } from "@/components/ui/empty-state"
import { CurrencyInput } from "@/components/ui/currency-input"

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
