"use client"

import { useCallback } from "react"
import { enfileirar } from "./fila"

/**
 * `track(nome, propriedades)` — estavel entre renders, entao pode entrar em
 * lista de dependencia de efeito sem re-disparar.
 *
 * Nao manda nada: enfileira. O contrato do servidor sempre foi um lote, e quem
 * junta a janela e decide o momento de enviar e `./fila`.
 */
export function useTrack() {
    return useCallback((nome: string, propriedades: Record<string, unknown> = {}) => {
        enfileirar({ name: nome, properties: propriedades })
    }, [])
}
