import axe from "axe-core"
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

    it("a galeria nao tem violacao de acessibilidade", async () => {
        const { container } = render(<Galeria />)
        const resultado = await axe.run(container, {
            rules: {
                // A galeria e um fragmento, nao um documento: as regras de
                // estrutura de pagina (landmark, region, ordem de heading) nao se
                // aplicam a ela e produziriam violacao falsa.
                region: { enabled: false },
            },
        })
        const resumo = resultado.violations
            .map((v) => `${v.id}: ${v.nodes.length} no(s) — ${v.help}`)
            .join("\n")
        expect(resultado.violations, `violacoes:\n${resumo}`).toHaveLength(0)
    }, 20_000)
})
