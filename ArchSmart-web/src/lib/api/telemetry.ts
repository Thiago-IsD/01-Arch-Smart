"use client"

import { api } from "@/lib/api/client"
import type { EventoDeProduto } from "@/features/telemetry/types"

/**
 * Manda o lote e engole qualquer erro.
 *
 * Fire-and-forget de verdade: esta funcao NUNCA rejeita. Telemetria que
 * derruba a tela do usuario e pior que telemetria nenhuma — e o modo de falha
 * de uma promise rejeitada aqui e um unhandled rejection que ninguem ve ate
 * virar erro no console de um cliente.
 *
 * Fica em lib/api/ porque e daqui que sai toda chamada de rede (Art. 4): o
 * cliente resolve base, token e erro num lugar so.
 */
export async function enviarEventos(eventos: EventoDeProduto[]): Promise<void> {
    if (eventos.length === 0) return
    try {
        await api<void>("/api/telemetry/events", {
            method: "POST",
            body: { eventos },
        })
    } catch {
        // Silencio proposital. Ver a docstring.
    }
}
