import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ProjectsLimitCard } from "@/app/(dashboard)/dashboard/components/ProjectsLimitCard"

describe("ProjectsLimitCard", () => {
    it("abaixo do limite mostra as vagas livres", () => {
        render(<ProjectsLimitCard activeProjectsCount={1} planLimit={3} />)
        expect(screen.getByText("2 espaço(s) livre(s)")).toBeInTheDocument()
    })

    it("limite 0 nao produz NaN e diz que o limite foi atingido", () => {
        const { container } = render(<ProjectsLimitCard activeProjectsCount={0} planLimit={0} />)
        expect(container.innerHTML).not.toContain("NaN")
        expect(screen.getByText("Limite de projetos atingido")).toBeInTheDocument()
    })

    it("acima do limite nao mostra vaga negativa", () => {
        render(<ProjectsLimitCard activeProjectsCount={5} planLimit={3} />)
        expect(screen.getByText("Limite de projetos atingido")).toBeInTheDocument()
        expect(screen.queryByText(/-\d+ espaço/)).not.toBeInTheDocument()
    })
})
