import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import NaoEncontrado from "@/app/(dashboard)/projects/[id]/not-found"

describe("not-found de /projects/[id]", () => {
    it("mostra titulo, explicacao e link de volta para Projetos", () => {
        render(<NaoEncontrado />)

        expect(screen.getByRole("heading", { name: /projeto não encontrado/i })).toBeInTheDocument()
        expect(
            screen.getByText(/pode ter sido excluído ou não pertencer a esta conta/i),
        ).toBeInTheDocument()
        expect(screen.getByRole("link", { name: /voltar para projetos/i })).toHaveAttribute(
            "href",
            "/projects",
        )
    })
})
