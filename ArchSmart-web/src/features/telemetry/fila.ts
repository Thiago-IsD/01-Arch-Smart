"use client"

import { enviarEventos } from "./api"
import type { EventoDeProduto } from "./types"

/**
 * A fila de eventos.
 *
 * O contrato do servidor sempre foi um lote; o cliente e que mandava uma
 * requisicao por evento. Com o `screen_viewed` saindo a cada navegacao e a
 * Secao 8 acrescentando interacao, isso multiplicava requisicao sem precisar —
 * e o rate limit do endpoint e um balde de 60/minuto.
 *
 * Nao chama `fetch`: chama `enviarEventos`, que chama o cliente de
 * `lib/api/` (Art. 4).
 */
const JANELA_MS = 1000
const TAMANHO_MAXIMO = 20

let fila: EventoDeProduto[] = []
let timer: ReturnType<typeof setTimeout> | null = null

/**
 * Verdadeiro entre o `pagehide` e um eventual `pageshow` (volta do cache de
 * navegacao). Enquanto estiver ligado, nada espera a janela de 1s: ver a nota
 * de ordem de ouvintes em `enfileirar`.
 */
let saindo = false

export function descarregar(opcoes: { keepalive?: boolean } = {}): void {
    if (timer !== null) {
        clearTimeout(timer)
        timer = null
    }
    if (fila.length === 0) return
    // Troca a referencia ANTES de enviar: evento enfileirado durante o envio
    // entra na fila nova, nao no lote que ja saiu.
    const lote = fila
    fila = []
    void enviarEventos(lote, opcoes)
}

export function enfileirar(evento: EventoDeProduto): void {
    fila.push(evento)

    // Ordem de ouvinte no `pagehide`, e o motivo desta guarda existir: a fila
    // registra o ouvinte dela no carregamento do modulo, antes de qualquer
    // efeito de React, entao ela descarrega (vazia) ANTES de a
    // `TelemetriaDeTela` enfileirar a linha da saida. Sem isto essa linha — a
    // ultima navegacao da sessao, a que diz onde o usuario parou — ficaria
    // esperando uma janela de 1s num documento que esta morrendo, e o evento
    // nunca sairia. Depois do `pagehide` cada evento sai na hora, com
    // `keepalive`, custe uma requisicao a mais.
    if (saindo) {
        descarregar({ keepalive: true })
        return
    }

    if (fila.length >= TAMANHO_MAXIMO) {
        descarregar()
        return
    }
    if (timer === null) {
        timer = setTimeout(() => descarregar(), JANELA_MS)
    }
}

/** Só para teste: zera a fila, cancela o timer e desliga o estado de saida. */
export function _zerarFila(): void {
    fila = []
    saindo = false
    if (timer !== null) {
        clearTimeout(timer)
        timer = null
    }
}

// A sessao pode terminar com eventos na fila — e a ultima navegacao e a que diz
// onde o usuario parou. `keepalive` deixa a requisicao sobreviver a saida da
// pagina; sem ele o navegador tipicamente aborta o `fetch` no unload do
// documento, e a perda e silenciosa.
if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
        saindo = true
        descarregar({ keepalive: true })
    })
    // Volta do cache de navegacao (botao voltar): o documento vive de novo,
    // entao a fila volta a juntar em lote em vez de mandar um por requisicao.
    window.addEventListener("pageshow", () => {
        saindo = false
    })
    // `visibilitychange` e disparado em `document`; chega ao `window` so por
    // borbulhamento. Ouvir na origem e o contrato, e e o que torna isto
    // verificavel sem depender de o evento borbulhar.
    document.addEventListener("visibilitychange", () => {
        // Em mobile a aba pode ser descartada sem `pagehide`. Aqui nao se liga
        // `saindo`: a aba costuma voltar, e o lote continua valendo.
        if (document.visibilityState === "hidden") descarregar({ keepalive: true })
    })
}
