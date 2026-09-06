import { api } from "@/lib/api/client"
import type { Me } from "./types"

/**
 * `GET /api/users/me` — nao `/api/v1/me` como a spec dizia. Ver ADR 0008: nao
 * existe prefixo /api/v1 nesta aplicacao e criar um para uma rota so foi
 * recusado.
 */
export function obterMe(signal?: AbortSignal): Promise<Me> {
    return api<Me>("/api/users/me", { signal })
}
