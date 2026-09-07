import { describe, it, expect } from "vitest"
import { ehEstatico, ehRotaPublica } from "@/proxy"

describe("ehEstatico", () => {
    it.each([
        "/_next/static/chunk.js",
        "/api/products",
        "/static/x",
        "/assets/logo.png",
        "/favicon.ico",
    ])("%s e estatico", (pathname) => {
        expect(ehEstatico(pathname)).toBe(true)
    })

    it("qualquer caminho com ponto e estatico", () => {
        expect(ehEstatico("/arquivo.pdf")).toBe(true)
    })

    it.each(["/dashboard", "/library", "/projects/123"])(
        "%s nao e estatico",
        (pathname) => {
            expect(ehEstatico(pathname)).toBe(false)
        },
    )
})

describe("ehRotaPublica", () => {
    it.each(["/", "/precos", "/portal/abc-123", "/auth/login", "/auth/verify"])(
        "%s e publica",
        (pathname) => {
            expect(ehRotaPublica(pathname)).toBe(true)
        },
    )

    it.each(["/dashboard", "/library", "/finance", "/settings"])(
        "%s nao e publica — deve continuar redirecionando para login",
        (pathname) => {
            expect(ehRotaPublica(pathname)).toBe(false)
        },
    )

    it("'/' e exata: nao cobre '/dashboard'", () => {
        expect(ehRotaPublica("/")).toBe(true)
        expect(ehRotaPublica("/dashboard")).toBe(false)
    })
})
