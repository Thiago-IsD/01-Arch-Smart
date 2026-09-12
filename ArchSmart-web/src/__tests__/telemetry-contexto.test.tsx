import { useEffect } from "react"

import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
    ProntidaoDaTelaProvider,
    useProntidao,
    type ProntidaoDaTela,
    type Report,
} from "@/features/telemetry/contexto"

/**
 * O canal de prontidao, testado direto.
 *
 * Tres propriedades que a spec da Secao 8 prometia e o codigo nao tinha, e que
 * a onda de correcao da revisao final acrescentou: o LATCH do report, o AVISO
 * de duas regioes `principal`, e `anunciadas()` contando regioes distintas em
 * vez de chamadas.
 */

/**
 * Monta o provider e devolve o canal que ele entrega.
 *
 * A captura acontece num EFEITO, nao no render: reatribuir variavel de fora do
 * componente durante o render e efeito colateral no meio de uma fase que o React
 * pode repetir ou descartar (`react-hooks/globals`). `render` do Testing Library
 * roda dentro de `act`, entao o efeito ja rodou quando esta funcao retorna.
 */
function montarCanal(): ProntidaoDaTela {
    const captura: { canal: ProntidaoDaTela | null } = { canal: null }
    function Captura() {
        const canal = useProntidao()
        useEffect(() => {
            captura.canal = canal
        }, [canal])
        return null
    }
    render(
        <ProntidaoDaTelaProvider>
            <Captura />
        </ProntidaoDaTelaProvider>,
    )
    if (!captura.canal) throw new Error("o provider nao entregou canal")
    return captura.canal
}

const reportDeDados = (origem: object, principal = false): Report => ({
    desfecho: "dados",
    principal,
    origem,
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe("o latch do report", () => {
    // ESTE e o teste que falha sem o latch. Sem ele, um report que chegasse
    // antes da assinatura era descartado em silencio, e o efeito era global:
    // TODO evento virava `pintura`. A spec chamava a dependencia de ordem entre
    // `TelemetriaDeTela` e o boundary de "acidente de posicao e nao garantia".
    it("reportar ANTES de assinar e o ouvinte recebe de todo jeito", () => {
        const canal = montarCanal()
        const regiao = {}

        canal.reportar(reportDeDados(regiao, true))

        const ouvinte = vi.fn()
        canal.assinar(ouvinte)

        expect(ouvinte).toHaveBeenCalledTimes(1)
        expect(ouvinte).toHaveBeenCalledWith(
            expect.objectContaining({ desfecho: "dados", principal: true }),
        )
    })

    it("quem assina depois recebe o ULTIMO report, nao o primeiro", () => {
        const canal = montarCanal()
        canal.reportar({ desfecho: "vazio", principal: false, origem: {} })
        canal.reportar({ desfecho: "erro", principal: false, origem: {} })

        const ouvinte = vi.fn()
        canal.assinar(ouvinte)

        expect(ouvinte).toHaveBeenCalledTimes(1)
        expect(ouvinte).toHaveBeenCalledWith(expect.objectContaining({ desfecho: "erro" }))
    })

    it("`limpar()` zera o latch — a tela seguinte nao herda o report da anterior", () => {
        const canal = montarCanal()
        canal.reportar(reportDeDados({}, true))

        canal.limpar()

        const ouvinte = vi.fn()
        canal.assinar(ouvinte)
        expect(ouvinte).not.toHaveBeenCalled()
    })

    it("quem ja estava assinado continua recebendo na hora", () => {
        const canal = montarCanal()
        const ouvinte = vi.fn()
        canal.assinar(ouvinte)

        canal.reportar(reportDeDados({}))
        expect(ouvinte).toHaveBeenCalledTimes(1)
    })

    it("cancelar a assinatura para de entregar", () => {
        const canal = montarCanal()
        const ouvinte = vi.fn()
        const cancelar = canal.assinar(ouvinte)
        cancelar()

        canal.reportar(reportDeDados({}))
        expect(ouvinte).not.toHaveBeenCalled()
    })
})

describe("o aviso de duas regioes `principal`", () => {
    // A unica guarda contra o erro de copia mais provavel das oito telas
    // seguintes: duas `principal`, ou nenhuma. Quem ganha e a primeira a
    // REPORTAR, que e a ordem da arvore — e por isso precisa de aviso.
    it("avisa no console quando DUAS regioes distintas se declaram principal", () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
        const canal = montarCanal()

        canal.reportar(reportDeDados({}, true))
        expect(aviso).not.toHaveBeenCalled()

        canal.reportar(reportDeDados({}, true))
        expect(aviso).toHaveBeenCalledTimes(1)
        expect(aviso.mock.calls[0][0]).toContain("principal")
    })

    it("avisa UMA vez por navegacao, e nao a cada report", () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
        const canal = montarCanal()

        canal.reportar(reportDeDados({}, true))
        canal.reportar(reportDeDados({}, true))
        canal.reportar(reportDeDados({}, true))

        expect(aviso).toHaveBeenCalledTimes(1)
    })

    // O falso positivo que o conjunto de identidades existe para evitar. Sob
    // StrictMode o efeito de UMA regiao roda duas vezes, entao um contador de
    // chamadas avisaria sobre uma tela correta — e aviso falso em
    // desenvolvimento treina o reflexo de ignorar o aviso.
    it("NAO avisa quando a mesma regiao reporta duas vezes (StrictMode)", () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
        const canal = montarCanal()
        const regiao = {}

        canal.reportar(reportDeDados(regiao, true))
        canal.reportar(reportDeDados(regiao, true))

        expect(aviso).not.toHaveBeenCalled()
    })

    it("uma principal e uma NAO principal nao e caso de aviso", () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
        const canal = montarCanal()

        canal.reportar(reportDeDados({}, true))
        canal.reportar(reportDeDados({}, false))

        expect(aviso).not.toHaveBeenCalled()
    })

    it("`limpar()` rearma o aviso para a navegacao seguinte", () => {
        const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
        const canal = montarCanal()

        canal.reportar(reportDeDados({}, true))
        canal.reportar(reportDeDados({}, true))
        expect(aviso).toHaveBeenCalledTimes(1)

        canal.limpar()
        canal.reportar(reportDeDados({}, true))
        canal.reportar(reportDeDados({}, true))
        expect(aviso).toHaveBeenCalledTimes(2)
    })
})

describe("anunciadas() conta regioes, nao chamadas", () => {
    it("a mesma regiao anunciando duas vezes conta UMA", () => {
        const canal = montarCanal()
        const regiao = {}

        canal.anunciar(regiao)
        canal.anunciar(regiao)

        expect(canal.anunciadas()).toBe(1)
    })

    it("duas regioes distintas contam duas", () => {
        const canal = montarCanal()
        canal.anunciar({})
        canal.anunciar({})
        expect(canal.anunciadas()).toBe(2)
    })

    it("`limpar()` zera a contagem", () => {
        const canal = montarCanal()
        canal.anunciar({})
        canal.limpar()
        expect(canal.anunciadas()).toBe(0)
    })
})
