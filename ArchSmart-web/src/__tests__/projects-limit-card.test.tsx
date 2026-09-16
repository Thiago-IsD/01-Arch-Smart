import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ProjectsLimitCard } from "@/app/(dashboard)/dashboard/components/ProjectsLimitCard"

describe("ProjectsLimitCard", () => {
    it("abaixo do limite mostra as vagas livres", () => {
        render(<ProjectsLimitCard activeProjectsCount={1} planLimit={3} />)
        expect(screen.getByText("2 espaço(s) livre(s)")).toBeInTheDocument()
    })

    it("limite 0 nao produz NaN e diz que o limite foi atingido", () => {
        // `not.toContain("NaN")` no HTML seria um no-op: o jsdom descarta
        // silenciosamente um `style` invalido (`width: NaN%`) em vez de
        // renderiza-lo, entao a string nunca apareceria de qualquer jeito.
        // A asserção que discrimina de verdade e o valor CALCULADO da barra.
        const { container } = render(<ProjectsLimitCard activeProjectsCount={0} planLimit={0} />)
        const barra = container.querySelector<HTMLElement>(".transition-all")
        expect(barra?.style.width).toBe("100%")
        expect(screen.getByText("Limite de projetos atingido")).toBeInTheDocument()
    })

    it("acima do limite nao mostra vaga negativa", () => {
        render(<ProjectsLimitCard activeProjectsCount={5} planLimit={3} />)
        expect(screen.getByText("Limite de projetos atingido")).toBeInTheDocument()
        expect(screen.queryByText(/-\d+ espaço/)).not.toBeInTheDocument()
    })
})
