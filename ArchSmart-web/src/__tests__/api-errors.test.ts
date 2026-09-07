import { describe, it, expect } from "vitest"
import {
    ApiError,
    MENSAGEM_GENERICA,
    mensagemDoCorpo,
    erroDaResposta,
} from "@/lib/api/errors"

describe("mensagemDoCorpo", () => {
    it("usa o detail quando ele e string — erro de dominio do backend", () => {
        expect(mensagemDoCorpo({ detail: "Seu plano não permite esta ação." }))
            .toBe("Seu plano não permite esta ação.")
    })

    it("cai na generica quando o detail e array — 422 de schema do Pydantic", () => {
        const corpo = { detail: [{ loc: ["header", "authorization"], msg: "Field required" }] }
        expect(mensagemDoCorpo(corpo)).toBe(MENSAGEM_GENERICA)
    })

    it("cai na generica quando nao ha corpo", () => {
        expect(mensagemDoCorpo(null)).toBe(MENSAGEM_GENERICA)
    })

    it("respeita o fallback do chamador", () => {
        expect(mensagemDoCorpo(null, "Falha ao aprovar em lote."))
            .toBe("Falha ao aprovar em lote.")
    })
})

describe("erroDaResposta", () => {
    it("monta ApiError a partir de um erro de dominio", async () => {
        const res = new Response(JSON.stringify({ detail: "Recurso não encontrado." }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        })
        const erro = await erroDaResposta(res)
        expect(erro).toBeInstanceOf(ApiError)
        expect(erro.status).toBe(404)
        expect(erro.message).toBe("Recurso não encontrado.")
        expect(erro.ehDeSchema).toBe(false)
    })

    it("marca ehDeSchema quando o detail e array, mesmo com status 422", async () => {
        const res = new Response(JSON.stringify({ detail: [{ msg: "Field required" }] }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
        })
        const erro = await erroDaResposta(res)
        expect(erro.status).toBe(422)
        expect(erro.ehDeSchema).toBe(true)
        expect(erro.message).toBe(MENSAGEM_GENERICA)
    })

    it("nao explode com corpo que nao e JSON", async () => {
        const res = new Response("<html>502 Bad Gateway</html>", { status: 502 })
        const erro = await erroDaResposta(res)
        expect(erro.status).toBe(502)
        expect(erro.message).toBe(MENSAGEM_GENERICA)
    })

    it("um 422 de dominio e indistinguivel de um 400 de dominio — por formato", async () => {
        // As dez rotas que a Secao 4 mudou de 400/500 para 422 continuam
        // devolvendo `detail` string. O cliente nao pode ramificar por status.
        const dominio422 = new Response(JSON.stringify({ detail: "Dados inválidos." }), { status: 422 })
        const dominio400 = new Response(JSON.stringify({ detail: "Dados inválidos." }), { status: 400 })
        expect((await erroDaResposta(dominio422)).message)
            .toBe((await erroDaResposta(dominio400)).message)
    })
})
