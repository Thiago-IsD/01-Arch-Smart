"use client"

import { useCallback } from "react"
import { enviarEventos } from "./api"

/**
 * `track(nome, propriedades)` — estavel entre renders, entao pode entrar em
 * lista de dependencia de efeito sem re-disparar.
 *
 * Manda um evento por vez. O contrato do servidor ja e um lote; o buffer, se um
 * dia fizer falta, entra aqui sem mexer no servidor.
 */
export function useTrack() {
    return useCallback((nome: string, propriedades: Record<string, unknown> = {}) => {
        void enviarEventos([{ name: nome, properties: propriedades }])
    }, [])
}
