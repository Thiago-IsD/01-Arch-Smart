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
 * O silencio e deliberado, e o que mudou em 11/09/2026 foi o TAMANHO do que
 * ele esconde. Antes da fila, um `429` ou uma falha de rede perdia **um**
 * evento, porque o cliente mandava um por requisicao. Agora o lote e a unidade
 * de perda: um erro engolido aqui leva **ate 20 eventos de uma vez** (a janela
 * de 1s ou o lote cheio), e no modo de saida da pagina leva tudo o que tiver
 * acumulado. Nao e caminho novo de perda — e o mesmo `catch` de sempre, com
 * raio maior. Quem for investigar "faltam eventos" comeca por aqui, e nao por
 * um bug de emissao.
 *
 * Fica em lib/api/ porque e daqui que sai toda chamada de rede (Art. 4): o
 * cliente resolve base, token e erro num lugar so.
 *
 * `keepalive` so e usado no lote que sai na saida da pagina (`pagehide`): sem
 * ele o navegador aborta o `fetch` no unload do documento e o evento se perde
 * calado. Quem decide isso e a fila, em features/telemetry/fila.ts.
 */
export async function enviarEventos(
    eventos: EventoDeProduto[],
    opcoes: { keepalive?: boolean } = {},
): Promise<void> {
    if (eventos.length === 0) return
    try {
        await api<void>("/api/telemetry/events", {
            method: "POST",
            body: { eventos },
            keepalive: opcoes.keepalive,
        })
    } catch {
        // Silencio proposital. Ver a docstring.
    }
}
