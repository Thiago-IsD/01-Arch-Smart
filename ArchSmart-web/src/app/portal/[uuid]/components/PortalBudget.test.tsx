import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { PortalBudget } from "./PortalBudget"
import { tokenKey } from "../portal-token"

const PRESENTATION_ID = "22222222-2222-2222-2222-222222222222"

const items = [
    {
        id: "item-1",
        environment_id: "env-1",
        rule_type: "UNIT",
        calculated_quantity: null,
        manual_quantity: 1,
        options: [
            {
                id: "opt-1",
                is_selected: true,
                approval_status: "PENDING",
                rejection_reason: null,
                product: {
                    id: "prod-1",
                    name: "Sofá 3 lugares",
                    store: "Loja X",
                    price: 100,
                    image_url: null,
                    source_url: null,
                },
            },
        ],
    },
]

const environments = [
    { id: "env-row-1", environment_id: "env-1", environment_name: "Sala", title: "Sala" },
]

describe("PortalBudget - autenticacao do portal", () => {
    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    it("envia o header Authorization ao aprovar uma opcao", async () => {
        localStorage.setItem(tokenKey(PRESENTATION_ID), "token-valido")
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
        vi.stubGlobal("fetch", fetchMock)

        render(
            <PortalBudget
                initialItems={items}
                environments={environments}
                presentationId={PRESENTATION_ID}
                status="SENT"
            />
        )

        fireEvent.click(screen.getByText("Aprovar"))

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())

        const [, opcoes] = fetchMock.mock.calls[0]
        expect(opcoes.headers).toMatchObject({ Authorization: "Bearer token-valido" })
    })
})
