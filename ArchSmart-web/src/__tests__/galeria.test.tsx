import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Galeria } from "@/app/dev/componentes/galeria"

describe("galeria de componentes", () => {
    it("mostra cada componente da Secao 6, com secao nomeada", () => {
        render(<Galeria />)
        for (const nome of [
            "EmptyState",
            "CurrencyInput",
            "FormField",
            "DataTable",
            "ErrorBoundary",
            "QueryBoundary",
            "AlertDialog",
            "DropdownMenu",
            "Skeleton",
        ]) {
            expect(screen.getByRole("heading", { name: nome })).toBeInTheDocument()
        }
    })

    it("mostra os estados de dado do QueryBoundary, nao so o caminho feliz", () => {
        render(<Galeria />)
        expect(screen.getByTestId("qb-carregando")).toBeInTheDocument()
        expect(screen.getByTestId("qb-vazio")).toBeInTheDocument()
        expect(screen.getByTestId("qb-erro")).toBeInTheDocument()
        expect(screen.getByTestId("qb-dados")).toBeInTheDocument()
    })
})
