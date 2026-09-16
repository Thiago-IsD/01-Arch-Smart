import { api } from "@/lib/api/client"
import type { WizardFormValues } from "@/components/projects/project-wizard/schema"

import type { Ambiente, DnaDoAmbiente, Projeto } from "./types"

/**
 * As escritas de Projetos. As leituras moram em `queries.ts`, que nao importa
 * `@/lib/api/client` porque o servidor tambem as usa; estas so rodam no
 * navegador.
 *
 * `fallbackDeErro` e a frase que aparece quando a API nao manda uma de dominio
 * (`lib/api/errors.ts`) — as mesmas frases dos toasts de antes da migracao.
 */
export type DadosDoProjeto = WizardFormValues

const ERRO_AO_SALVAR = "Ocorreu um erro ao tentar salvar o projeto."

export function criarProjeto(dados: DadosDoProjeto): Promise<Projeto> {
    return api<Projeto>("/api/projects", { method: "POST", body: dados, fallbackDeErro: ERRO_AO_SALVAR })
}

export function editarProjeto(id: string, dados: Partial<DadosDoProjeto>): Promise<Projeto> {
    return api<Projeto>(`/api/projects/${id}`, { method: "PUT", body: dados, fallbackDeErro: ERRO_AO_SALVAR })
}

export function mudarStatusDoProjeto(id: string, status: string): Promise<Projeto> {
    return api<Projeto>(`/api/projects/${id}`, {
        method: "PUT",
        body: { status },
        fallbackDeErro: "Não foi possível atualizar o status.",
    })
}

export function excluirProjeto(id: string): Promise<void> {
    return api<void>(`/api/projects/${id}`, {
        method: "DELETE",
        fallbackDeErro: "Não foi possível excluir o projeto.",
    })
}

export interface CorpoDeAmbiente {
    name: string
    type: string
    dna: { floor_area: number; wall_area: number; ceiling_area: number }
}

export function criarAmbiente(projectId: string, corpo: CorpoDeAmbiente): Promise<Ambiente> {
    return api<Ambiente>(`/api/projects/${projectId}/environments`, {
        method: "POST",
        body: corpo,
        fallbackDeErro: "Não foi possível criar o ambiente.",
    })
}

export function excluirAmbiente(envId: string): Promise<void> {
    return api<void>(`/api/environments/${envId}`, {
        method: "DELETE",
        fallbackDeErro: "Erro ao excluir o ambiente.",
    })
}

export interface AreasDoDna {
    floor_area: number
    wall_area: number
    ceiling_area: number
}

export function salvarDna(envId: string, areas: AreasDoDna): Promise<DnaDoAmbiente> {
    return api<DnaDoAmbiente>(`/api/environments/${envId}/dna`, {
        method: "PUT",
        body: areas,
        fallbackDeErro: "Erro ao salvar as áreas.",
    })
}
