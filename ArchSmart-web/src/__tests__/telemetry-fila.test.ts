import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { EventoDeProduto } from "@/features/telemetry/types"

// --- A fila: QUANTAS requisicoes, e com que conteudo ------------------------
//
// Aqui o envio e mockado de proposito: o que se mede e o agrupamento e o
// momento. Que o `keepalive` chega mesmo ao `fetch` e outro assunto, e esta em
// `telemetry-fila-keepalive.test.ts` — aquele arquivo nao mocka nada do caminho
// de rede.

interface Lote {
    eventos: EventoDeProduto[]
    opcoes: { keepalive?: boolean }
}

const lotes: Lote[] = []

vi.mock("@/lib/api/telemetry", () => ({
    enviarEventos: async (eventos: EventoDeProduto[], opcoes: { keepalive?: boolean } = {}) => {
        lotes.push({ eventos, opcoes })
    },
}))

import { _zerarFila, descarregar, enfileirar, TAMANHO_MAXIMO } from "@/features/telemetry/fila"

function nomes(): string[] {
    return lotes.flatMap((l) => l.eventos.map((e) => e.name))
}

function esconderAba(escondida: boolean) {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => (escondida ? "hidden" : "visible"),
    })
}

describe("fila de eventos", () => {
    beforeEach(() => {
        lotes.length = 0
        _zerarFila()
        esconderAba(false)
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it("junta eventos da mesma janela numa requisicao so", async () => {
        enfileirar({ name: "a", properties: {} })
        enfileirar({ name: "b", properties: {} })
        enfileirar({ name: "c", properties: {} })
        expect(lotes).toHaveLength(0)

        await vi.advanceTimersByTimeAsync(1000)
        expect(lotes).toHaveLength(1)
        expect(lotes[0].eventos.map((e) => e.name)).toEqual(["a", "b", "c"])
    })

    it("descarrega sozinha ao encher, sem esperar o tempo", async () => {
        for (let i = 0; i < 20; i++) enfileirar({ name: `e${i}`, properties: {} })
        expect(lotes).toHaveLength(1)
        expect(lotes[0].eventos).toHaveLength(20)
    })

    it("descarregar() manda o que houver e esvazia", async () => {
        enfileirar({ name: "a", properties: {} })
        descarregar()
        expect(lotes).toHaveLength(1)

        descarregar()
        // Fila vazia nao manda requisicao nenhuma.
        expect(lotes).toHaveLength(1)
    })

    it("nao perde evento quando o envio acontece durante o enfileiramento", async () => {
        enfileirar({ name: "a", properties: {} })
        descarregar()
        enfileirar({ name: "b", properties: {} })
        await vi.advanceTimersByTimeAsync(1000)
        expect(nomes()).toEqual(["a", "b"])
    })

    it("o lote da janela normal nao pede keepalive", async () => {
        enfileirar({ name: "a", properties: {} })
        await vi.advanceTimersByTimeAsync(1000)
        expect(lotes[0].opcoes.keepalive).toBeUndefined()
    })
})

describe("fila na saida da pagina", () => {
    beforeEach(() => {
        lotes.length = 0
        _zerarFila()
        esconderAba(false)
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it("pagehide descarrega o que estava esperando, com keepalive", () => {
        enfileirar({ name: "a", properties: {} })
        window.dispatchEvent(new Event("pagehide"))
        expect(lotes).toHaveLength(1)
        expect(lotes[0].opcoes.keepalive).toBe(true)
    })

    // Defeito de ordem de ouvintes, achado depois do plano desta tarefa: a fila
    // registra o ouvinte de `pagehide` no carregamento do modulo, e a
    // `TelemetriaDeTela` registra o dela num efeito de React — depois. Logo a
    // fila descarrega (vazia) ANTES de a telemetria enfileirar a linha da
    // saida, e sem a guarda de `saindo` essa linha esperaria a janela de 1s num
    // documento que esta morrendo.
    it("evento enfileirado DEPOIS do pagehide sai na hora, com keepalive", () => {
        window.dispatchEvent(new Event("pagehide"))
        expect(lotes).toHaveLength(0)

        enfileirar({ name: "screen_viewed", properties: {} })
        expect(lotes).toHaveLength(1)
        expect(lotes[0].eventos.map((e) => e.name)).toEqual(["screen_viewed"])
        expect(lotes[0].opcoes.keepalive).toBe(true)
    })

    it("pageshow devolve o lote: o documento voltou do cache de navegacao", async () => {
        window.dispatchEvent(new Event("pagehide"))
        window.dispatchEvent(new Event("pageshow"))

        enfileirar({ name: "a", properties: {} })
        enfileirar({ name: "b", properties: {} })
        expect(lotes).toHaveLength(0)

        await vi.advanceTimersByTimeAsync(1000)
        expect(lotes).toHaveLength(1)
        expect(lotes[0].eventos.map((e) => e.name)).toEqual(["a", "b"])
    })

    it("aba escondida descarrega com keepalive; aba visivel nao descarrega", () => {
        enfileirar({ name: "a", properties: {} })
        esconderAba(false)
        document.dispatchEvent(new Event("visibilitychange"))
        expect(lotes).toHaveLength(0)

        esconderAba(true)
        document.dispatchEvent(new Event("visibilitychange"))
        expect(lotes).toHaveLength(1)
        expect(lotes[0].opcoes.keepalive).toBe(true)
    })
})

// --- O lote cheio tem de CABER no que o servidor aceita ---------------------
//
// `LoteDeEventos.eventos` declara `max_length=50` em
// ArchSmart-api/app/schemas/telemetry_schema.py. Subir `TAMANHO_MAXIMO` acima
// disso faz o Pydantic recusar o lote INTEIRO com 422, e `enviarEventos` engole
// o erro: a perda seria total e silenciosa, indistinguivel de "ninguem
// navegou".
//
// Este teste prende UMA direcao: a mudanca que acontece no cliente. A outra —
// baixar o teto do servidor abaixo do lote do cliente — esta presa do lado do
// backend, em
// tests/api/test_telemetria.py::test_aceita_o_lote_cheio_do_cliente. Sao dois
// testes porque cada lado so reprova a mudanca feita NELE: um teste sozinho,
// em qualquer dos dois repositorios, deixa passar a metade perigosa que mora no
// outro. O numero do servidor e copia literal aqui, e e por isso que o teste
// dele mora la.
const MAX_LENGTH_DO_SERVIDOR = 50

describe("o teto do servidor", () => {
    it("o lote cheio do cliente cabe no max_length do schema", () => {
        expect(
            TAMANHO_MAXIMO,
            `a fila descarrega em ${TAMANHO_MAXIMO} eventos, acima do max_length de ` +
            `${MAX_LENGTH_DO_SERVIDOR} de LoteDeEventos: todo lote cheio seria recusado ` +
            "inteiro com 422, e enviarEventos engoliria o erro",
        ).toBeLessThanOrEqual(MAX_LENGTH_DO_SERVIDOR)
    })
})
