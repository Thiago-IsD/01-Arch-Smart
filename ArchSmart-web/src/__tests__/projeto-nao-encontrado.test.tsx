import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import NaoEncontrado from "@/app/(dashboard)/projects/[id]/not-found"

describe("not-found de /projects/[id]", () => {
    it("mostra titulo, explicacao generica e link de volta para Projetos", () => {
        // A copy e generica de proposito: este boundary cobre nao so o
        // detalhe do projeto, mas tambem orcamento, apresentacao, impressao e
        // o construtor de apresentacao (ver o docstring do componente) — uma
        // frase especifica de "projeto excluido" mentiria nos outros casos.
        render(<NaoEncontrado />)

        expect(screen.getByRole("heading", { name: /não encontrado/i })).toBeInTheDocument()
        expect(
            screen.getByText(/não existir, ainda não ter sido criado, ou não pertencer a esta conta/i),
        ).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /voltar para projetos/i })).toHaveAttribute(
            "href",
            "/projects",
        )
    })
})
