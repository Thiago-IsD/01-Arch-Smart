import { describe, expect, it } from "vitest"
import { decidirMedicao, normalizarTela, vazioDoDesfecho } from "@/features/telemetry/types"

// As funcoes puras da telemetria. Ficam separadas do gatilho
// (`telemetry.test.tsx`) porque nao precisam de nenhum dos dois `vi.mock`
// daquele arquivo — nem da arvore React — e porque juntas passavam das 400
// linhas que a catraca mede por arquivo.

describe("normalizarTela", () => {
    it("troca uuid por [id]", () => {
        expect(normalizarTela("/projects/3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b")).toBe(
            "/projects/[id]"
        )
    })

    it("troca cada uuid de um caminho aninhado", () => {
        const caminho =
            "/projects/3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b/presentation/" +
            "8e7d6c5b-4a39-2817-6f5e-4d3c2b1a0987"
        expect(normalizarTela(caminho)).toBe("/projects/[id]/presentation/[id]")
    })

    it("deixa caminho sem id intacto", () => {
        expect(normalizarTela("/library")).toBe("/library")
    })
})

describe("decidirMedicao", () => {
    it("repassa o desfecho da regiao que reportou", () => {
        expect(decidirMedicao({ desfecho: "dados", principal: true }, true)).toBe("dados")
        expect(decidirMedicao({ desfecho: "vazio", principal: true }, true)).toBe("vazio")
        expect(decidirMedicao({ desfecho: "erro", principal: true }, true)).toBe("erro")
    })

    it("diz 'abandonado' quando houve anuncio e ninguem reportou", () => {
        expect(decidirMedicao(null, true)).toBe("abandonado")
    })

    it("diz 'pintura' quando a tela nao tem regiao nenhuma", () => {
        expect(decidirMedicao(null, false)).toBe("pintura")
    })
})

describe("vazioDoDesfecho", () => {
    it("traduz os tres desfechos e o nulo", () => {
        expect(vazioDoDesfecho("vazio")).toBe(true)
        expect(vazioDoDesfecho("dados")).toBe(false)
        // `null` e "nao sei", que e diferente de "nao esta vazia".
        expect(vazioDoDesfecho("erro")).toBeNull()
        expect(vazioDoDesfecho(null)).toBeNull()
    })
})
