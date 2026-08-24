import { describe, it, expect, beforeEach } from "vitest"
import { tokenKey, cabecalhoDoPortal } from "./portal-token"

describe("cabecalhoDoPortal", () => {
    const uuid = "11111111-1111-1111-1111-111111111111"

    beforeEach(() => {
        localStorage.clear()
    })

    it("monta o header Authorization quando ha token guardado", () => {
        localStorage.setItem(tokenKey(uuid), "token-do-cliente")

        expect(cabecalhoDoPortal(uuid)).toEqual({
            Authorization: "Bearer token-do-cliente",
        })
    })

    it("nao monta o header quando nao ha token guardado", () => {
        expect(cabecalhoDoPortal(uuid)).toEqual({})
    })

    it("nao mistura o token de uma apresentacao com o de outra", () => {
        localStorage.setItem(tokenKey(uuid), "token-do-cliente")

        expect(cabecalhoDoPortal("outro-uuid")).toEqual({})
    })
})
